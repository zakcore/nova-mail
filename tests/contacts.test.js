const { api, auth, login, reinitialiser, db, ALEX, SOPHIE } = require('./setup/helpers');

let jeton;
beforeAll(async () => {
  await reinitialiser();
  jeton = await login(ALEX);
});
afterAll(() => db.close());

const contactValide = {
  nom: 'Tremblay',
  prenom: 'Julie',
  courriel: 'julie.tremblay@example.net',
  photoProfil: 'https://exemple.com/julie.jpg',
  telephones: { mobile: '+1 438 555-0106', fixe: '+1 514 555-0106', professionnel: '+1 450 555-0106' },
};

describe('SW-07 – Créer un contact', () => {
  test('SW-07 crée un contact avec les téléphones groupés (201)', async () => {
    const res = await api().post('/api/v1/contacts').set(auth(jeton)).send(contactValide);
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/contacts/${res.body.idContact}`);
    expect(res.body).toEqual({ idContact: expect.any(Number), ...contactValide });
  });

  test('SW-07 courriel déjà dans les contacts (409)', async () => {
    const res = await api()
      .post('/api/v1/contacts')
      .set(auth(jeton))
      .send({ ...contactValide, courriel: 'JULIE.Tremblay@example.net' });
    expect(res.status).toBe(409);
    expect(res.body.erreur.code).toBe('CONTACT_EXISTANT');
  });

  test('SW-07 téléphone invalide (400)', async () => {
    const res = await api()
      .post('/api/v1/contacts')
      .set(auth(jeton))
      .send({ ...contactValide, courriel: 'autre@example.net', telephones: { mobile: 'abc' } });
    expect(res.status).toBe(400);
    expect(res.body.erreur.details).toEqual([expect.objectContaining({ champ: 'mobile' })]);
  });
});

describe('SW-08 – Lister les contacts', () => {
  beforeAll(async () => {
    await reinitialiser();
    jeton = await login(ALEX);
  });

  test("SW-08 liste les 10 contacts d'Alex triés par nom (200)", async () => {
    const res = await api().get('/api/v1/contacts').set(auth(jeton));
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, taille: 20, total: 10, nbPages: 1 });
    const noms = res.body.donnees.map((c) => c.nom);
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b)));
    expect(res.body.donnees.every((c) => c.prenom === 'Utilisateur1')).toBe(true);
  });

  test('SW-08 recherche filtre les contacts', async () => {
    const res = await api().get('/api/v1/contacts').query({ recherche: 'contact1_10' }).set(auth(jeton));
    expect(res.body.donnees.map((c) => c.courriel)).toEqual(['contact1_10@example.net']);
  });

  test('SW-08 taille=3&page=2 retourne la bonne tranche', async () => {
    const tous = await api().get('/api/v1/contacts').set(auth(jeton));
    const res = await api().get('/api/v1/contacts?taille=3&page=2').set(auth(jeton));
    expect(res.body.pagination).toEqual({ page: 2, taille: 3, total: 10, nbPages: 4 });
    expect(res.body.donnees.map((c) => c.idContact)).toEqual(tous.body.donnees.slice(3, 6).map((c) => c.idContact));
  });

  test('SW-08 tri=-courriel trie en ordre décroissant', async () => {
    const asc = await api().get('/api/v1/contacts?tri=courriel').set(auth(jeton));
    const desc = await api().get('/api/v1/contacts?tri=-courriel').set(auth(jeton));
    const courriels = asc.body.donnees.map((c) => c.courriel);
    expect(courriels[0]).toBe('contact1_1@example.net');
    expect(desc.body.donnees.map((c) => c.courriel)).toEqual([...courriels].reverse());
  });

  test('SW-08 tri non autorisé (400)', async () => {
    const res = await api().get('/api/v1/contacts?tri=motDePasse').set(auth(jeton));
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('PARAMETRE_INVALIDE');
  });

  test('SW-08 taille hors limites (400)', async () => {
    const res = await api().get('/api/v1/contacts?taille=500').set(auth(jeton));
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('PARAMETRE_INVALIDE');
  });
});

describe('SW-09 – Consulter un contact', () => {
  test('SW-09 retourne le contact (200)', async () => {
    const res = await api().get('/api/v1/contacts/1').set(auth(jeton));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      idContact: 1,
      courriel: 'contact1_1@example.net',
      telephones: { mobile: '+1 438 555-1001', fixe: '+1 514 555-1001', professionnel: '+1 450 555-1001' },
    });
  });

  test("SW-09 le contact de Sophie lu par Alex (404)", async () => {
    const res = await api().get('/api/v1/contacts/11').set(auth(jeton));
    expect(res.status).toBe(404);
    expect(res.body.erreur.code).toBe('RESSOURCE_INTROUVABLE');
  });

  test('SW-09 identifiant non numérique (404)', async () => {
    const res = await api().get('/api/v1/contacts/abc').set(auth(jeton));
    expect(res.status).toBe(404);
  });
});

describe('SW-10 – Modifier un contact', () => {
  test('SW-10 remplace entièrement le contact (200)', async () => {
    const res = await api()
      .put('/api/v1/contacts/2')
      .set(auth(jeton))
      .send({ nom: 'Martin', prenom: 'Sophie', courriel: SOPHIE, telephones: { mobile: '+1 438 555-0101' } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      idContact: 2,
      nom: 'Martin',
      prenom: 'Sophie',
      courriel: SOPHIE,
      photoProfil: null,
      telephones: { mobile: '+1 438 555-0101', fixe: null, professionnel: null },
    });
  });

  test("SW-10 courriel d'un autre contact (409)", async () => {
    const res = await api()
      .put('/api/v1/contacts/2')
      .set(auth(jeton))
      .send({ nom: 'X', prenom: 'Y', courriel: 'contact1_3@example.net' });
    expect(res.status).toBe(409);
    expect(res.body.erreur.code).toBe('CONTACT_EXISTANT');
  });

  test("SW-10 contact d'un autre utilisateur (404)", async () => {
    const res = await api().put('/api/v1/contacts/12').set(auth(jeton)).send({ nom: 'X', prenom: 'Y', courriel: 'x@y.com' });
    expect(res.status).toBe(404);
  });
});

describe('SW-11 – Supprimer un contact', () => {
  test('SW-11 supprime le contact (204 puis 404)', async () => {
    const res = await api().delete('/api/v1/contacts/5').set(auth(jeton));
    expect(res.status).toBe(204);
    const apres = await api().get('/api/v1/contacts/5').set(auth(jeton));
    expect(apres.status).toBe(404);
  });

  test("SW-11 contact d'un autre utilisateur (404)", async () => {
    const res = await api().delete('/api/v1/contacts/15').set(auth(jeton));
    expect(res.status).toBe(404);
  });
});
