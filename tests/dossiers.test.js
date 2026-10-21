const { api, auth, login, dossiers, reinitialiser, db, ALEX, SOPHIE } = require('./setup/helpers');

let jeton;
beforeAll(async () => {
  await reinitialiser();
  jeton = await login(ALEX);
});
afterAll(() => db.close());

describe('SW-13 – Lister les dossiers', () => {
  test("SW-13 Alex : Réception 20 / 8 non lus, Envoyés 10, Archives 0, dans cet ordre", async () => {
    const res = await api().get('/api/v1/dossiers').set(auth(jeton));
    expect(res.status).toBe(200);
    expect(res.body.donnees).toEqual([
      { idDossier: 1, nom: 'Réception', type: 'systeme', nbMessages: 20, nbNonLus: 8 },
      { idDossier: 2, nom: 'Envoyés', type: 'systeme', nbMessages: 10, nbNonLus: 0 },
      { idDossier: 3, nom: 'Archives', type: 'systeme', nbMessages: 0, nbNonLus: 0 },
    ]);
    expect(res.body).not.toHaveProperty('pagination');
  });
});

describe('SW-12 – Créer un dossier', () => {
  test('SW-12 crée un dossier personnel (201)', async () => {
    const res = await api().post('/api/v1/dossiers').set(auth(jeton)).send({ nom: '  Projet SW ' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/dossiers/${res.body.idDossier}`);
    expect(res.body).toEqual({ idDossier: expect.any(Number), nom: 'Projet SW', type: 'personnel', nbMessages: 0, nbNonLus: 0 });
  });

  test('SW-12 nom déjà utilisé, sans tenir compte de la casse (409)', async () => {
    const res = await api().post('/api/v1/dossiers').set(auth(jeton)).send({ nom: 'projet sw' });
    expect(res.status).toBe(409);
    expect(res.body.erreur.code).toBe('DOSSIER_EXISTANT');
  });

  test('SW-12 « Archives » est réservé (409)', async () => {
    const res = await api().post('/api/v1/dossiers').set(auth(jeton)).send({ nom: 'Archives' });
    expect(res.status).toBe(409);
    expect(res.body.erreur.code).toBe('DOSSIER_EXISTANT');
  });

  test('SW-12 nom vide (400)', async () => {
    const res = await api().post('/api/v1/dossiers').set(auth(jeton)).send({ nom: '' });
    expect(res.status).toBe(400);
    expect(res.body.erreur.details).toEqual([expect.objectContaining({ champ: 'nom' })]);
  });

  test('SW-13 les dossiers personnels suivent les dossiers système, triés par nom', async () => {
    await api().post('/api/v1/dossiers').set(auth(jeton)).send({ nom: 'Aaa premier' });
    const res = await api().get('/api/v1/dossiers').set(auth(jeton));
    expect(res.body.donnees.map((d) => d.nom)).toEqual(['Réception', 'Envoyés', 'Archives', 'Aaa premier', 'Projet SW']);
  });
});

describe('SW-16 – Ajouter un message à un dossier', () => {
  test('SW-16 déplace le message, qui quitte la Réception (204)', async () => {
    const { 'Projet SW': projet } = await dossiers(jeton);
    const res = await api().put(`/api/v1/dossiers/${projet.idDossier}/messages/20`).set(auth(jeton));
    expect(res.status).toBe(204);

    const reception = await api().get('/api/v1/messages').set(auth(jeton));
    expect(reception.body.pagination.total).toBe(19);
    expect(reception.body.donnees.map((m) => m.idMessage)).not.toContain(20);

    const apres = await dossiers(jeton);
    expect(apres['Réception']).toMatchObject({ nbMessages: 19, nbNonLus: 7 });
    expect(apres['Projet SW']).toMatchObject({ nbMessages: 1, nbNonLus: 1 });
  });

  test('SW-16 est idempotent (204)', async () => {
    const { 'Projet SW': projet } = await dossiers(jeton);
    const res = await api().put(`/api/v1/dossiers/${projet.idDossier}/messages/20`).set(auth(jeton));
    expect(res.status).toBe(204);
    expect((await dossiers(jeton))['Projet SW'].nbMessages).toBe(1);
  });

  test('SW-16 message reçu vers Envoyés (400)', async () => {
    const res = await api().put('/api/v1/dossiers/2/messages/19').set(auth(jeton));
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('DEPLACEMENT_INVALIDE');
  });

  test('SW-16 message envoyé vers Réception (400)', async () => {
    const res = await api().put('/api/v1/dossiers/1/messages/21').set(auth(jeton));
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('DEPLACEMENT_INVALIDE');
  });

  test("SW-16 dossier d'un autre utilisateur (404)", async () => {
    const res = await api().put('/api/v1/dossiers/6/messages/19').set(auth(jeton));
    expect(res.status).toBe(404);
  });

  test("SW-16 message d'un autre utilisateur (404)", async () => {
    const res = await api().put('/api/v1/dossiers/3/messages/31').set(auth(jeton));
    expect(res.status).toBe(404);
  });
});

describe("SW-15 – Afficher le contenu d'un dossier", () => {
  test('SW-15 liste le contenu du dossier personnel avec son en-tête (200)', async () => {
    const { 'Projet SW': projet } = await dossiers(jeton);
    const res = await api().get(`/api/v1/dossiers/${projet.idDossier}/messages`).set(auth(jeton));
    expect(res.status).toBe(200);
    expect(res.body.dossier).toEqual({ idDossier: projet.idDossier, nom: 'Projet SW', type: 'personnel' });
    expect(res.body.pagination).toEqual({ page: 1, taille: 20, total: 1, nbPages: 1 });
    expect(res.body.donnees[0]).toMatchObject({ idMessage: 20, idDossier: projet.idDossier, objet: 'Message reçu 20' });
  });

  test('SW-15 Réception paginée (200)', async () => {
    const res = await api().get('/api/v1/dossiers/1/messages?taille=5&page=4').set(auth(jeton));
    expect(res.body.dossier.nom).toBe('Réception');
    expect(res.body.pagination).toEqual({ page: 4, taille: 5, total: 19, nbPages: 4 });
    expect(res.body.donnees).toHaveLength(4);
  });

  test("SW-15 dossier d'un autre utilisateur (404)", async () => {
    const res = await api().get('/api/v1/dossiers/4/messages').set(auth(jeton));
    expect(res.status).toBe(404);
  });
});

describe('SW-14 – Supprimer un dossier', () => {
  test('SW-14 dossier système (403)', async () => {
    const res = await api().delete('/api/v1/dossiers/1').set(auth(jeton));
    expect(res.status).toBe(403);
    expect(res.body.erreur.code).toBe('DOSSIER_SYSTEME');
  });

  test('SW-14 supprime le dossier et replace ses messages dans Réception / Envoyés (204)', async () => {
    const { 'Projet SW': projet } = await dossiers(jeton);
    await api().put(`/api/v1/dossiers/${projet.idDossier}/messages/21`).set(auth(jeton)); // a sent one too

    const res = await api().delete(`/api/v1/dossiers/${projet.idDossier}`).set(auth(jeton));
    expect(res.status).toBe(204);

    const apres = await dossiers(jeton);
    expect(apres['Projet SW']).toBeUndefined();
    expect(apres['Réception']).toMatchObject({ nbMessages: 20, nbNonLus: 8 });
    expect(apres['Envoyés'].nbMessages).toBe(10);
    const msg = await api().get('/api/v1/messages/20').set(auth(jeton));
    expect(msg.body.idDossier).toBe(1);
  });

  test("SW-14 dossier d'un autre utilisateur (404)", async () => {
    const sophie = await login(SOPHIE);
    const cree = await api().post('/api/v1/dossiers').set(auth(sophie)).send({ nom: 'Privé' });
    const res = await api().delete(`/api/v1/dossiers/${cree.body.idDossier}`).set(auth(jeton));
    expect(res.status).toBe(404);
  });
});
