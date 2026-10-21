const { api, auth, login, dossiers, reinitialiser, db, MDP, ALEX, KARIM } = require('./setup/helpers');

beforeAll(reinitialiser);
afterAll(() => db.close());

describe('SW-01 – Créer un compte', () => {
  const nouveau = {
    courriel: 'Nouveau.Compte@Example.com',
    motDePasse: 'Bienvenue1',
    nom: 'Compte',
    prenom: 'Nouveau',
    telephone: '+1 514 555-9999',
  };

  test('SW-01 crée le compte et ses 3 dossiers système (201)', async () => {
    const res = await api().post('/api/v1/utilisateurs').send(nouveau);
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/v1/utilisateurs/moi');
    expect(res.body).toMatchObject({
      courriel: 'nouveau.compte@example.com',
      nom: 'Compte',
      prenom: 'Nouveau',
      telephone: '+1 514 555-9999',
      photoProfil: null,
    });
    expect(res.body.idUtilisateur).toEqual(expect.any(Number));
    expect(res.body).not.toHaveProperty('motDePasseHash');
    expect(res.body).not.toHaveProperty('mot_de_passe_hash');

    const jeton = await login('nouveau.compte@example.com', 'Bienvenue1');
    const liste = await api().get('/api/v1/dossiers').set(auth(jeton));
    expect(liste.body.donnees.map((d) => [d.nom, d.type, d.nbMessages])).toEqual([
      ['Réception', 'systeme', 0],
      ['Envoyés', 'systeme', 0],
      ['Archives', 'systeme', 0],
    ]);
  });

  test('SW-01 courriel invalide et mot de passe faible (400 avec details)', async () => {
    const res = await api()
      .post('/api/v1/utilisateurs')
      .send({ courriel: 'pas-un-courriel', motDePasse: 'faible', nom: 'A', prenom: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION_ECHOUEE');
    expect(res.body.erreur.details.map((d) => d.champ).sort()).toEqual(['courriel', 'motDePasse']);
  });

  test('SW-01 courriel déjà utilisé (409)', async () => {
    const res = await api().post('/api/v1/utilisateurs').send({ ...nouveau, courriel: ALEX });
    expect(res.status).toBe(409);
    expect(res.body.erreur.code).toBe('COURRIEL_DEJA_UTILISE');
  });
});

describe('SW-04 – Consulter son profil', () => {
  test('SW-04 retourne le profil sans le hachage (200)', async () => {
    const jeton = await login(ALEX);
    const res = await api().get('/api/v1/utilisateurs/moi').set(auth(jeton));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ idUtilisateur: 1, courriel: ALEX, nom: 'Moreau', prenom: 'Alex', telephone: '+1 514 555-1001' });
    expect(res.body.creeLe).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(JSON.stringify(res.body)).not.toMatch(/motDePasse|mot_de_passe/);
  });

  test('SW-04 sans jeton (401)', async () => {
    const res = await api().get('/api/v1/utilisateurs/moi');
    expect(res.status).toBe(401);
    expect(res.body.erreur.code).toBe('JETON_ABSENT');
  });
});

describe('SW-05 – Modifier son profil', () => {
  let jeton;
  beforeAll(async () => {
    jeton = await login(ALEX);
  });

  test('SW-05 modifie le profil (200)', async () => {
    const res = await api()
      .put('/api/v1/utilisateurs/moi')
      .set(auth(jeton))
      .send({ nom: 'Moreau', prenom: 'Alexandre', telephone: '+1 438 555-0000', photoProfil: 'https://exemple.com/a.png', courriel: 'pirate@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ prenom: 'Alexandre', telephone: '+1 438 555-0000', photoProfil: 'https://exemple.com/a.png', courriel: ALEX });
  });

  test('SW-05 un téléphone omis devient null (200)', async () => {
    const res = await api().put('/api/v1/utilisateurs/moi').set(auth(jeton)).send({ nom: 'Moreau', prenom: 'Alex' });
    expect(res.status).toBe(200);
    expect(res.body.telephone).toBeNull();
    expect(res.body.photoProfil).toBeNull();
  });

  test('SW-05 nom vide (400)', async () => {
    const res = await api().put('/api/v1/utilisateurs/moi').set(auth(jeton)).send({ nom: '  ', prenom: 'Alex' });
    expect(res.status).toBe(400);
    expect(res.body.erreur.details).toEqual([expect.objectContaining({ champ: 'nom' })]);
  });
});

describe('SW-06 – Changer son mot de passe', () => {
  let jeton;
  beforeAll(async () => {
    jeton = await login(KARIM);
  });

  test('SW-06 mauvais ancien mot de passe (401)', async () => {
    const res = await api()
      .put('/api/v1/utilisateurs/moi/mot-de-passe')
      .set(auth(jeton))
      .send({ ancienMotDePasse: 'Mauvais123', nouveauMotDePasse: 'Nouveau2026!' });
    expect(res.status).toBe(401);
    expect(res.body.erreur.code).toBe('MOT_DE_PASSE_INCORRECT');
  });

  test('SW-06 nouveau mot de passe identique (400)', async () => {
    const res = await api()
      .put('/api/v1/utilisateurs/moi/mot-de-passe')
      .set(auth(jeton))
      .send({ ancienMotDePasse: MDP, nouveauMotDePasse: MDP });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('MOT_DE_PASSE_IDENTIQUE');
  });

  test('SW-06 nouveau mot de passe faible (400)', async () => {
    const res = await api()
      .put('/api/v1/utilisateurs/moi/mot-de-passe')
      .set(auth(jeton))
      .send({ ancienMotDePasse: MDP, nouveauMotDePasse: 'court' });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION_ECHOUEE');
  });

  test('SW-06 change le mot de passe (204) puis la connexion fonctionne', async () => {
    const res = await api()
      .put('/api/v1/utilisateurs/moi/mot-de-passe')
      .set(auth(jeton))
      .send({ ancienMotDePasse: MDP, nouveauMotDePasse: 'Nouveau2026!' });
    expect(res.status).toBe(204);
    await expect(login(KARIM, 'Nouveau2026!')).resolves.toEqual(expect.any(String));
    await expect(login(KARIM, MDP)).rejects.toThrow();
  });
});

test('SW-01 le compte créé se connecte et a une boîte vide', async () => {
  await api().post('/api/v1/utilisateurs').send({ courriel: 'vide@example.com', motDePasse: 'Bienvenue1', nom: 'Vide', prenom: 'Boite' });
  const jeton = await login('vide@example.com', 'Bienvenue1');
  const d = await dossiers(jeton);
  expect(d['Réception'].nbMessages).toBe(0);
});
