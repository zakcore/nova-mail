const { api, auth, login, dossiers, reinitialiser, db, ALEX, SOPHIE } = require('./setup/helpers');

let alex;
let sophie;
beforeAll(async () => {
  await reinitialiser();
  alex = await login(ALEX);
  sophie = await login(SOPHIE);
});
afterAll(() => db.close());

describe('SW-18 – Lister les messages reçus', () => {
  test('SW-18 Alex a 20 messages reçus, du plus récent au plus ancien (200)', async () => {
    const res = await api().get('/api/v1/messages?boite=reception').set(auth(alex));
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, taille: 20, total: 20, nbPages: 1 });
    expect(res.body.donnees.map((m) => m.idMessage)).toEqual(Array.from({ length: 20 }, (_, i) => 20 - i));
    expect(res.body.donnees[0]).toEqual({
      idMessage: 20,
      expediteur: { courriel: 'contact1_10@example.net', nom: 'Contact10', prenom: 'Utilisateur1' },
      destinataire: { courriel: ALEX, nom: 'Moreau', prenom: 'Alex' },
      objet: 'Message reçu 20',
      extrait: 'Contenu du message reçu numéro 20 pour utilisateur 1.',
      direction: 'recu',
      etat: 'recu',
      envoyeLe: '2026-08-03T20:00:00.000Z',
      idDossier: 1,
      nbPiecesJointes: 0,
    });
  });

  test('SW-18 boite=reception par défaut', async () => {
    const res = await api().get('/api/v1/messages').set(auth(alex));
    expect(res.body.pagination.total).toBe(20);
  });

  test('SW-18 etat=nonlu retourne 8 messages', async () => {
    const res = await api().get('/api/v1/messages?etat=nonlu').set(auth(alex));
    expect(res.body.pagination.total).toBe(8);
    expect(res.body.donnees.every((m) => m.etat === 'recu')).toBe(true);
  });

  test('SW-18 etat=lu retourne 12 messages', async () => {
    const res = await api().get('/api/v1/messages?etat=lu').set(auth(alex));
    expect(res.body.pagination.total).toBe(12);
  });

  test('SW-18 recherche sur objet et contenu', async () => {
    const res = await api().get('/api/v1/messages').query({ recherche: 'numéro 7 pour' }).set(auth(alex));
    expect(res.body.donnees.map((m) => m.idMessage)).toEqual([7]);
  });

  test('SW-18 tri=objet', async () => {
    const res = await api().get('/api/v1/messages?tri=objet&taille=3').set(auth(alex));
    expect(res.body.donnees.map((m) => m.objet)).toEqual(['Message reçu 1', 'Message reçu 10', 'Message reçu 11']);
  });

  test('SW-18 boite invalide (400)', async () => {
    const res = await api().get('/api/v1/messages?boite=xyz').set(auth(alex));
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('PARAMETRE_INVALIDE');
  });

  test('SW-18 etat avec boite=envoi (400)', async () => {
    const res = await api().get('/api/v1/messages?boite=envoi&etat=lu').set(auth(alex));
    expect(res.status).toBe(400);
  });

  test('SW-18 page invalide (400)', async () => {
    const res = await api().get('/api/v1/messages?page=0').set(auth(alex));
    expect(res.status).toBe(400);
  });
});

describe('SW-19 – Lister les messages envoyés', () => {
  test('SW-19 Alex a 10 messages envoyés, tous à l’état envoye (200)', async () => {
    const res = await api().get('/api/v1/messages?boite=envoi').set(auth(alex));
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(10);
    expect(res.body.donnees.every((m) => m.etat === 'envoye' && m.direction === 'envoye' && m.idDossier === 2)).toBe(true);
    expect(res.body.donnees[0].destinataire).toEqual({ courriel: 'contact1_10@example.net', nom: 'Contact10', prenom: 'Utilisateur1' });
  });
});

describe('SW-20 – Consulter un message', () => {
  test("SW-20 retourne le contenu complet sans changer l'état (200)", async () => {
    const res = await api().get('/api/v1/messages/13').set(auth(alex));
    expect(res.status).toBe(200);
    expect(res.body.contenu).toBe('Contenu du message reçu numéro 13 pour utilisateur 1.');
    expect(res.body.piecesJointes).toEqual([]);
    expect(res.body).not.toHaveProperty('extrait');
    expect(res.body.etat).toBe('recu');

    const encore = await api().get('/api/v1/messages/13').set(auth(alex));
    expect(encore.body.etat).toBe('recu');
  });

  test("SW-20 message d'un autre utilisateur (404)", async () => {
    const res = await api().get('/api/v1/messages/31').set(auth(alex));
    expect(res.status).toBe(404);
    expect(res.body.erreur.code).toBe('RESSOURCE_INTROUVABLE');
  });
});

describe('SW-21 – Marquer comme lu ou non lu', () => {
  test('SW-21 lu: true puis lu: false (200)', async () => {
    let res = await api().patch('/api/v1/messages/13/etat').set(auth(alex)).send({ lu: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idMessage: 13, etat: 'lu' });
    expect((await dossiers(alex))['Réception'].nbNonLus).toBe(7);

    res = await api().patch('/api/v1/messages/13/etat').set(auth(alex)).send({ lu: false });
    expect(res.body).toEqual({ idMessage: 13, etat: 'recu' });
    expect((await dossiers(alex))['Réception'].nbNonLus).toBe(8);
  });

  test('SW-21 message envoyé (400)', async () => {
    const res = await api().patch('/api/v1/messages/21/etat').set(auth(alex)).send({ lu: true });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('ETAT_NON_APPLICABLE');
  });

  test('SW-21 lu doit être un booléen (400)', async () => {
    const res = await api().patch('/api/v1/messages/13/etat').set(auth(alex)).send({ lu: 'oui' });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION_ECHOUEE');
  });

  test("SW-21 message d'un autre utilisateur (404)", async () => {
    const res = await api().patch('/api/v1/messages/45/etat').set(auth(alex)).send({ lu: true });
    expect(res.status).toBe(404);
  });
});

describe('SW-17 – Envoyer un message', () => {
  test('SW-17 Alex → Sophie : copie envoyée chez Alex, copie non lue chez Sophie (201)', async () => {
    const avantSophie = await dossiers(sophie);
    const res = await api()
      .post('/api/v1/messages')
      .set(auth(alex))
      .send({ destinataires: [SOPHIE], objet: 'Réunion de projet', contenu: 'Bonjour Sophie,\npeux-tu valider ?' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/messages/${res.body.idMessage}`);
    expect(res.body).toMatchObject({
      expediteur: { courriel: ALEX, nom: 'Moreau', prenom: 'Alex' },
      destinataire: { courriel: SOPHIE, nom: 'Martin', prenom: 'Sophie' },
      objet: 'Réunion de projet',
      direction: 'envoye',
      etat: 'envoye',
      idDossier: 2,
      nbPiecesJointes: 0,
      idsMessages: [res.body.idMessage],
    });

    expect((await dossiers(alex))['Envoyés'].nbMessages).toBe(11);
    const apresSophie = await dossiers(sophie);
    expect(apresSophie['Réception'].nbMessages).toBe(avantSophie['Réception'].nbMessages + 1);
    expect(apresSophie['Réception'].nbNonLus).toBe(avantSophie['Réception'].nbNonLus + 1);

    const boite = await api().get('/api/v1/messages?taille=1').set(auth(sophie));
    expect(boite.body.donnees[0]).toMatchObject({ objet: 'Réunion de projet', etat: 'recu', direction: 'recu', idDossier: 4 });
  });

  test('SW-17 destinataire externe : seule la copie envoyée existe', async () => {
    const [{ n: avant }] = await db.query('SELECT COUNT(*) AS n FROM messages');
    const res = await api()
      .post('/api/v1/messages')
      .set(auth(alex))
      .send({ destinataires: ['quelqu.un@ailleurs.org'], objet: 'Externe', contenu: 'Bonjour' });
    expect(res.status).toBe(201);
    expect(res.body.destinataire).toEqual({ courriel: 'quelqu.un@ailleurs.org', nom: null, prenom: null });
    const [{ n: apres }] = await db.query('SELECT COUNT(*) AS n FROM messages');
    expect(Number(apres) - Number(avant)).toBe(1);
  });

  test('SW-17 deux destinataires → idsMessages de longueur 2 (doublons retirés)', async () => {
    const res = await api()
      .post('/api/v1/messages')
      .set(auth(alex))
      .send({ destinataires: [SOPHIE, 'emma.roy@example.com', 'SOPHIE.martin@example.com'], objet: 'Groupe', contenu: 'Salut' });
    expect(res.status).toBe(201);
    expect(res.body.idsMessages).toHaveLength(2);
  });

  test('SW-17 aucun destinataire (400)', async () => {
    const res = await api().post('/api/v1/messages').set(auth(alex)).send({ destinataires: [], objet: 'X', contenu: 'Y' });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION_ECHOUEE');
    expect(res.body.erreur.details).toEqual([expect.objectContaining({ champ: 'destinataires' })]);
  });

  test('SW-17 objet et contenu manquants, adresse invalide (400 avec tous les détails)', async () => {
    const res = await api().post('/api/v1/messages').set(auth(alex)).send({ destinataires: ['pas-valide'] });
    expect(res.status).toBe(400);
    expect(res.body.erreur.details.map((d) => d.champ).sort()).toEqual(['contenu', 'destinataires', 'objet']);
  });

  test('SW-17 pièce jointe inconnue (400)', async () => {
    const res = await api()
      .post('/api/v1/messages')
      .set(auth(alex))
      .send({ destinataires: [SOPHIE], objet: 'X', contenu: 'Y', piecesJointes: ['inexistante'] });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('PIECE_JOINTE_INVALIDE');
  });
});

describe('SW-22 – Supprimer un message', () => {
  test("SW-22 supprime la copie d'Alex (204 puis 404), la copie de Sophie existe toujours", async () => {
    const envoi = await api()
      .post('/api/v1/messages')
      .set(auth(alex))
      .send({ destinataires: [SOPHIE], objet: 'À supprimer', contenu: 'Test' });
    const idAlex = envoi.body.idMessage;

    const res = await api().delete(`/api/v1/messages/${idAlex}`).set(auth(alex));
    expect(res.status).toBe(204);
    expect((await api().get(`/api/v1/messages/${idAlex}`).set(auth(alex))).status).toBe(404);
    expect((await api().delete(`/api/v1/messages/${idAlex}`).set(auth(alex))).status).toBe(404);

    const chezSophie = await api().get('/api/v1/messages').query({ recherche: 'À supprimer' }).set(auth(sophie));
    expect(chezSophie.body.pagination.total).toBe(1);
  });

  test("SW-22 message d'un autre utilisateur (404)", async () => {
    const res = await api().delete('/api/v1/messages/31').set(auth(alex));
    expect(res.status).toBe(404);
    const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM messages WHERE id_message = 31');
    expect(Number(n)).toBe(1);
  });
});
