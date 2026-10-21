const jwt = require('jsonwebtoken');
const { api, auth, login, reinitialiser, db, ALEX } = require('./setup/helpers');

let jeton;
beforeAll(async () => {
  await reinitialiser();
  jeton = await login(ALEX);
});
afterAll(() => db.close());

const ROUTES_PROTEGEES = [
  ['post', '/api/v1/auth/deconnexion'], // SW-03
  ['get', '/api/v1/utilisateurs/moi'], // SW-04
  ['put', '/api/v1/utilisateurs/moi'], // SW-05
  ['put', '/api/v1/utilisateurs/moi/mot-de-passe'], // SW-06
  ['post', '/api/v1/contacts'], // SW-07
  ['get', '/api/v1/contacts'], // SW-08
  ['get', '/api/v1/contacts/1'], // SW-09
  ['put', '/api/v1/contacts/1'], // SW-10
  ['delete', '/api/v1/contacts/1'], // SW-11
  ['post', '/api/v1/dossiers'], // SW-12
  ['get', '/api/v1/dossiers'], // SW-13
  ['delete', '/api/v1/dossiers/1'], // SW-14
  ['get', '/api/v1/dossiers/1/messages'], // SW-15
  ['put', '/api/v1/dossiers/3/messages/1'], // SW-16
  ['post', '/api/v1/messages'], // SW-17
  ['get', '/api/v1/messages?boite=reception'], // SW-18
  ['get', '/api/v1/messages?boite=envoi'], // SW-19
  ['get', '/api/v1/messages/1'], // SW-20
  ['patch', '/api/v1/messages/1/etat'], // SW-21
  ['delete', '/api/v1/messages/1'], // SW-22
  ['post', '/api/v1/pieces-jointes'], // SW-23
  ['get', '/api/v1/messages/1/pieces-jointes/1'], // SW-24
];

// Same payload as a real token, but signed with another secret
const jetonForge = jwt.sign({ idUtilisateur: 1, courriel: ALEX }, 'un-autre-secret', { expiresIn: 600, jwtid: 'forge' });
// Valid signature but already expired
const jetonExpire = () =>
  jwt.sign({ idUtilisateur: 1, courriel: ALEX, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET, {
    jwtid: 'expire',
  });

describe('Sécurité – authentification obligatoire', () => {
  test.each(ROUTES_PROTEGEES)('Sécurité %s %s sans jeton (401)', async (methode, url) => {
    const res = await api()[methode](url);
    expect(res.status).toBe(401);
    expect(res.body.erreur.code).toBe('JETON_ABSENT');
  });

  test.each(ROUTES_PROTEGEES)('Sécurité %s %s avec un jeton forgé (401)', async (methode, url) => {
    const res = await api()[methode](url).set(auth(jetonForge));
    expect(res.status).toBe(401);
    expect(res.body.erreur.code).toBe('JETON_INVALIDE');
  });

  test('Sécurité jeton expiré (401)', async () => {
    const res = await api().get('/api/v1/utilisateurs/moi').set(auth(jetonExpire()));
    expect(res.status).toBe(401);
    expect(res.body.erreur.code).toBe('JETON_INVALIDE');
  });

  test('Sécurité en-tête sans « Bearer » (401)', async () => {
    const res = await api().get('/api/v1/utilisateurs/moi').set('Authorization', jeton);
    expect(res.status).toBe(401);
    expect(res.body.erreur.code).toBe('JETON_ABSENT');
  });
});

describe('Sécurité – injection SQL et paramètres', () => {
  test("Sécurité recherche « ' OR 1=1 -- » dans les messages : 0 résultat, pas d'erreur", async () => {
    const res = await api().get('/api/v1/messages').query({ recherche: "' OR 1=1 --" }).set(auth(jeton));
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(0);
  });

  test("Sécurité recherche « ' OR 1=1 -- » dans les contacts : 0 résultat, pas d'erreur", async () => {
    const res = await api().get('/api/v1/contacts').query({ recherche: "' OR 1=1 --" }).set(auth(jeton));
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(0);
  });

  test('Sécurité « % » et « _ » sont cherchés littéralement', async () => {
    const pourcent = await api().get('/api/v1/messages').query({ recherche: '%' }).set(auth(jeton));
    const souligne = await api().get('/api/v1/contacts').query({ recherche: '_' }).set(auth(jeton));
    expect(pourcent.body.pagination.total).toBe(0);
    expect(souligne.body.pagination.total).toBe(10); // contact1_x@example.net contains a real "_"
  });

  test('Sécurité tri par une expression SQL (400)', async () => {
    const res = await api().get('/api/v1/messages').query({ tri: 'envoye_le; DROP TABLE messages' }).set(auth(jeton));
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('PARAMETRE_INVALIDE');
  });

  test('Sécurité route inconnue sous /api (404)', async () => {
    const res = await api().get('/api/v1/inexistant');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erreur: { code: 'RESSOURCE_INTROUVABLE', message: "L'élément demandé est introuvable." } });
  });

  test('Sécurité aucune réponse ne contient de hachage ni de chemin de stockage', async () => {
    const reponses = await Promise.all([
      api().get('/api/v1/utilisateurs/moi').set(auth(jeton)),
      api().get('/api/v1/messages').set(auth(jeton)),
      api().get('/api/v1/messages/1').set(auth(jeton)),
      api().get('/api/v1/contacts').set(auth(jeton)),
    ]);
    for (const r of reponses) {
      expect(r.text).not.toMatch(/mot_de_passe_hash|motDePasseHash|chemin_stockage|cheminStockage|\$2[aby]\$/);
    }
  });
});
