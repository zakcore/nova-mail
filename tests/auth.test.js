const { api, auth, login, reinitialiser, db, MDP, ALEX } = require('./setup/helpers');

beforeAll(reinitialiser);
afterAll(() => db.close());

describe('SW-02 – Se connecter', () => {
  test('SW-02 retourne un jeton (200)', async () => {
    const res = await api().post('/api/v1/auth/connexion').send({ courriel: ALEX, motDePasse: MDP });
    expect(res.status).toBe(200);
    expect(res.body.jeton).toEqual(expect.any(String));
    expect(res.body.typeJeton).toBe('Bearer');
    expect(new Date(res.body.expireLe).getTime()).toBeGreaterThan(Date.now());
    expect(res.body.utilisateur).toEqual({
      idUtilisateur: 1,
      courriel: ALEX,
      nom: 'Moreau',
      prenom: 'Alex',
      photoProfil: '/images/profils/user1.jpg',
    });
  });

  test('SW-02 accepte le courriel en majuscules (200)', async () => {
    const res = await api().post('/api/v1/auth/connexion').send({ courriel: ' ALEX.Moreau@Example.com ', motDePasse: MDP });
    expect(res.status).toBe(200);
  });

  test('SW-02 refuse un mauvais mot de passe (401)', async () => {
    const res = await api().post('/api/v1/auth/connexion').send({ courriel: ALEX, motDePasse: 'Mauvais123' });
    expect(res.status).toBe(401);
    expect(res.body.erreur.code).toBe('IDENTIFIANTS_INVALIDES');
  });

  test('SW-02 courriel inconnu : même réponse que le mauvais mot de passe (401)', async () => {
    const inconnu = await api().post('/api/v1/auth/connexion').send({ courriel: 'personne@example.com', motDePasse: MDP });
    const mauvais = await api().post('/api/v1/auth/connexion').send({ courriel: ALEX, motDePasse: 'Mauvais123' });
    expect(inconnu.status).toBe(401);
    expect(inconnu.body).toEqual(mauvais.body);
  });

  test('SW-02 champ manquant (400)', async () => {
    const res = await api().post('/api/v1/auth/connexion').send({ courriel: ALEX });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION_ECHOUEE');
    expect(res.body.erreur.details).toEqual([expect.objectContaining({ champ: 'motDePasse' })]);
  });

  test('SW-02 JSON invalide (400)', async () => {
    const res = await api().post('/api/v1/auth/connexion').set('Content-Type', 'application/json').send('{pas du json');
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('JSON_INVALIDE');
  });
});

describe('SW-03 – Se déconnecter', () => {
  test('SW-03 révoque le jeton (204 puis 401)', async () => {
    const jeton = await login(ALEX);
    const res = await api().post('/api/v1/auth/deconnexion').set(auth(jeton));
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const apres = await api().get('/api/v1/utilisateurs/moi').set(auth(jeton));
    expect(apres.status).toBe(401);
    expect(apres.body.erreur.code).toBe('JETON_INVALIDE');
  });

  test('SW-03 sans jeton (401)', async () => {
    const res = await api().post('/api/v1/auth/deconnexion');
    expect(res.status).toBe(401);
    expect(res.body.erreur.code).toBe('JETON_ABSENT');
  });
});
