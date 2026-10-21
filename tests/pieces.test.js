const fs = require('fs');
const { api, auth, login, reinitialiser, db, config, ALEX, SOPHIE, KARIM } = require('./setup/helpers');

let alex;
let sophie;
let karim;
beforeAll(async () => {
  await reinitialiser();
  [alex, sophie, karim] = await Promise.all([login(ALEX), login(SOPHIE), login(KARIM)]);
});
afterAll(async () => {
  await db.close();
  fs.rmSync(config.upload.dir, { recursive: true, force: true });
});

const CONTENU_PDF = Buffer.from('%PDF-1.4\n% fichier de test Nova Mail\n');

describe('SW-23 – Téléverser une pièce jointe', () => {
  test('SW-23 retourne un identifiant temporaire (201)', async () => {
    const res = await api()
      .post('/api/v1/pieces-jointes')
      .set(auth(alex))
      .attach('fichier', CONTENU_PDF, { filename: 'rapport été.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      idPiece: expect.stringMatching(/^[0-9a-f-]{36}$/),
      nomFichier: 'rapport été.pdf',
      typeMime: 'application/pdf',
      tailleOctets: CONTENU_PDF.length,
    });
    expect(res.body).not.toHaveProperty('cheminStockage');
  });

  test('SW-23 fichier de plus de 10 Mo (413)', async () => {
    const gros = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41);
    const res = await api()
      .post('/api/v1/pieces-jointes')
      .set(auth(alex))
      .attach('fichier', gros, { filename: 'gros.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
    expect(res.body.erreur.code).toBe('FICHIER_TROP_VOLUMINEUX');
  });

  test('SW-23 fichier .exe (415)', async () => {
    const res = await api()
      .post('/api/v1/pieces-jointes')
      .set(auth(alex))
      .attach('fichier', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(415);
    expect(res.body.erreur.code).toBe('TYPE_NON_SUPPORTE');
  });

  test('SW-23 aucun fichier (400)', async () => {
    const res = await api().post('/api/v1/pieces-jointes').set(auth(alex)).field('autre', 'x');
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION_ECHOUEE');
  });

  test("SW-17 refuse la pièce téléversée par un autre utilisateur (400)", async () => {
    const up = await api()
      .post('/api/v1/pieces-jointes')
      .set(auth(sophie))
      .attach('fichier', CONTENU_PDF, { filename: 'a.pdf', contentType: 'application/pdf' });
    const res = await api()
      .post('/api/v1/messages')
      .set(auth(alex))
      .send({ destinataires: [SOPHIE], objet: 'X', contenu: 'Y', piecesJointes: [up.body.idPiece] });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('PIECE_JOINTE_INVALIDE');
  });
});

describe('SW-24 – Télécharger une pièce jointe', () => {
  let idMessageAlex;
  let pieceAlex;
  let idMessageSophie;
  let pieceSophie;

  beforeAll(async () => {
    const up = await api()
      .post('/api/v1/pieces-jointes')
      .set(auth(alex))
      .attach('fichier', CONTENU_PDF, { filename: 'ordre_du_jour.pdf', contentType: 'application/pdf' });
    const envoi = await api()
      .post('/api/v1/messages')
      .set(auth(alex))
      .send({ destinataires: [SOPHIE], objet: 'Avec pièce jointe', contenu: 'Voir le fichier.', piecesJointes: [up.body.idPiece] });
    expect(envoi.status).toBe(201);
    expect(envoi.body.nbPiecesJointes).toBe(1);
    idMessageAlex = envoi.body.idMessage;
    pieceAlex = (await api().get(`/api/v1/messages/${idMessageAlex}`).set(auth(alex))).body.piecesJointes[0];

    const boite = await api().get('/api/v1/messages').query({ recherche: 'Avec pièce jointe' }).set(auth(sophie));
    idMessageSophie = boite.body.donnees[0].idMessage;
    expect(boite.body.donnees[0].nbPiecesJointes).toBe(1);
    pieceSophie = (await api().get(`/api/v1/messages/${idMessageSophie}`).set(auth(sophie))).body.piecesJointes[0];
  });

  test("SW-20 décrit la pièce jointe avec son url", () => {
    expect(pieceAlex).toEqual({
      idPiece: expect.any(Number),
      nomFichier: 'ordre_du_jour.pdf',
      typeMime: 'application/pdf',
      tailleOctets: CONTENU_PDF.length,
      url: `/api/v1/messages/${idMessageAlex}/pieces-jointes/${pieceAlex.idPiece}`,
    });
  });

  test("SW-24 l'expéditeur et le destinataire téléchargent les mêmes octets (200)", async () => {
    const binaire = (res, cb) => {
      const morceaux = [];
      res.on('data', (c) => morceaux.push(c));
      res.on('end', () => cb(null, Buffer.concat(morceaux)));
    };
    const a = await api().get(pieceAlex.url).set(auth(alex)).buffer(true).parse(binaire);
    const s = await api().get(pieceSophie.url).set(auth(sophie)).buffer(true).parse(binaire);
    expect(a.status).toBe(200);
    expect(s.status).toBe(200);
    expect(a.headers['content-type']).toMatch(/^application\/pdf/);
    expect(a.headers['content-disposition']).toMatch(/attachment; filename="ordre_du_jour\.pdf"/);
    expect(Buffer.compare(a.body, CONTENU_PDF)).toBe(0);
    expect(Buffer.compare(s.body, CONTENU_PDF)).toBe(0);
  });

  test('SW-24 un troisième utilisateur (404)', async () => {
    const res = await api().get(pieceAlex.url).set(auth(karim));
    expect(res.status).toBe(404);
    expect(res.body.erreur.code).toBe('RESSOURCE_INTROUVABLE');
  });

  test("SW-24 pièce d'un autre message (404)", async () => {
    const res = await api().get(`/api/v1/messages/1/pieces-jointes/${pieceAlex.idPiece}`).set(auth(alex));
    expect(res.status).toBe(404);
  });

  test('SW-22 le fichier reste tant que la copie de Sophie le référence', async () => {
    await api().delete(`/api/v1/messages/${idMessageAlex}`).set(auth(alex));
    const res = await api().get(pieceSophie.url).set(auth(sophie));
    expect(res.status).toBe(200);
  });
});
