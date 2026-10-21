// SW-12 to SW-16
const db = require('../db');
const { ApiError, introuvable } = require('../errors');
const { Validateur } = require('../utils/validators');
const mappers = require('../utils/mappers');
const messages = require('./messages.service');

const ORDRE_SYSTEME = ['Réception', 'Envoyés', 'Archives'];

async function lireDossier(idUtilisateur, idDossier) {
  const rows = await db.query('SELECT * FROM dossiers WHERE id_dossier = ? AND id_utilisateur = ?', [
    idDossier,
    idUtilisateur,
  ]);
  if (rows.length === 0) throw introuvable();
  return rows[0];
}

// SW-12
async function creerDossier(idUtilisateur, data = {}) {
  const v = new Validateur();
  const nom = v.texte('nom', data.nom, { max: 80, libelle: 'Le nom du dossier' });
  v.verifier();

  // Case- and accent-insensitive with the script's collation: also blocks Réception / Envoyés / Archives.
  const existe = await db.query('SELECT 1 FROM dossiers WHERE id_utilisateur = ? AND nom = ?', [idUtilisateur, nom]);
  if (existe.length > 0) {
    throw new ApiError(409, 'DOSSIER_EXISTANT', undefined, [{ champ: 'nom', probleme: 'Un dossier porte déjà ce nom.' }]);
  }
  const res = await db.query(
    "INSERT INTO dossiers (id_utilisateur, nom, type, cree_le) VALUES (?, ?, 'personnel', UTC_TIMESTAMP())",
    [idUtilisateur, nom]
  );
  return mappers.dossier({ id_dossier: res.insertId, nom, type: 'personnel', nb_messages: 0, nb_non_lus: 0 });
}

// SW-13 – counts computed with one grouped query
async function listerDossiers(idUtilisateur) {
  const dossiers = await db.query('SELECT id_dossier, nom, type FROM dossiers WHERE id_utilisateur = ?', [idUtilisateur]);
  const sys = await messages.dossiersSysteme(idUtilisateur);
  const groupes = await db.query(
    `SELECT id_dossier, direction, COUNT(*) AS nb, SUM(etat = 'recu') AS non_lus
     FROM messages WHERE id_utilisateur = ? GROUP BY id_dossier, direction`,
    [idUtilisateur]
  );

  const compte = new Map(dossiers.map((d) => [d.id_dossier, { nb: 0, nonLus: 0 }]));
  for (const g of groupes) {
    // NULL folder = default box; Réception only holds received messages, Envoyés only sent ones (6.3)
    const cible = g.id_dossier ?? (g.direction === 'recu' ? sys.reception : sys.envoyes);
    if (cible === sys.reception && g.direction !== 'recu') continue;
    if (cible === sys.envoyes && g.direction !== 'envoye') continue;
    const c = compte.get(cible);
    if (!c) continue;
    c.nb += Number(g.nb);
    if (g.direction === 'recu') c.nonLus += Number(g.non_lus);
  }

  const rang = (d) => (d.type === 'systeme' ? ORDRE_SYSTEME.indexOf(d.nom) : ORDRE_SYSTEME.length);
  dossiers.sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));

  return {
    donnees: dossiers.map((d) =>
      mappers.dossier({ ...d, nb_messages: compte.get(d.id_dossier).nb, nb_non_lus: compte.get(d.id_dossier).nonLus })
    ),
  };
}

// SW-14 – messages go back to their default box, then the folder is deleted
async function supprimerDossier(idUtilisateur, idDossier) {
  const dossier = await lireDossier(idUtilisateur, idDossier);
  if (dossier.type === 'systeme') throw new ApiError(403, 'DOSSIER_SYSTEME');
  const sys = await messages.dossiersSysteme(idUtilisateur);

  await db.transaction(async (conn) => {
    await conn.query(
      `UPDATE messages SET id_dossier = CASE direction WHEN 'recu' THEN ? ELSE ? END
       WHERE id_dossier = ? AND id_utilisateur = ?`,
      [sys.reception ?? null, sys.envoyes ?? null, idDossier, idUtilisateur]
    );
    await conn.query('DELETE FROM dossiers WHERE id_dossier = ? AND id_utilisateur = ?', [idDossier, idUtilisateur]);
  });
}

// SW-15
async function contenuDossier(idUtilisateur, idDossier, query = {}) {
  const dossier = await lireDossier(idUtilisateur, idDossier);
  const liste = await messages.listerDansDossier(idUtilisateur, idDossier, query);
  return {
    dossier: { idDossier: dossier.id_dossier, nom: dossier.nom, type: dossier.type },
    ...liste,
  };
}

// SW-16 – idempotent
async function ajouterMessage(idUtilisateur, idDossier, idMessage) {
  await lireDossier(idUtilisateur, idDossier);
  const rows = await db.query('SELECT direction FROM messages WHERE id_message = ? AND id_utilisateur = ?', [
    idMessage,
    idUtilisateur,
  ]);
  if (rows.length === 0) throw introuvable();

  const sys = await messages.dossiersSysteme(idUtilisateur);
  const { direction } = rows[0];
  if ((direction === 'recu' && idDossier === sys.envoyes) || (direction === 'envoye' && idDossier === sys.reception)) {
    throw new ApiError(400, 'DEPLACEMENT_INVALIDE');
  }
  await db.query('UPDATE messages SET id_dossier = ? WHERE id_message = ? AND id_utilisateur = ?', [
    idDossier,
    idMessage,
    idUtilisateur,
  ]);
}

module.exports = { creerDossier, listerDossiers, supprimerDossier, contenuDossier, ajouterMessage };
