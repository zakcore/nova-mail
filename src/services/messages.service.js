// SW-17 to SW-22, SW-24 and the shared message-box queries used by dossiers.service.
const fs = require('fs');
const db = require('../db');
const { ApiError, introuvable } = require('../errors');
const { Validateur } = require('../utils/validators');
const { pagination, tri, motifRecherche, enveloppe, invalide } = require('../utils/pagination');
const mappers = require('../utils/mappers');
const pieces = require('./pieces.service');

const TRI_MESSAGES = { envoyeLe: 'm.envoye_le', objet: 'm.objet' };

// Names come from utilisateurs first, then from the owner's contacts (section 5.2).
const SELECT_MESSAGE = `
  SELECT m.*,
         COALESCE(ue.nom, ce.nom) AS exp_nom, COALESCE(ue.prenom, ce.prenom) AS exp_prenom,
         COALESCE(ud.nom, cd.nom) AS dest_nom, COALESCE(ud.prenom, cd.prenom) AS dest_prenom,
         (SELECT COUNT(*) FROM pieces_jointes p WHERE p.id_message = m.id_message) AS nb_pieces
  FROM messages m
  LEFT JOIN utilisateurs ue ON ue.courriel = m.expediteur_courriel
  LEFT JOIN contacts ce ON ce.id_utilisateur = m.id_utilisateur AND ce.courriel = m.expediteur_courriel
  LEFT JOIN utilisateurs ud ON ud.courriel = m.destinataire_courriel
  LEFT JOIN contacts cd ON cd.id_utilisateur = m.id_utilisateur AND cd.courriel = m.destinataire_courriel`;

// Runs a query on the pool or on a transaction connection.
async function run(conn, sql, params) {
  if (!conn || conn === db) return db.query(sql, params);
  const [rows] = await conn.query(sql, params);
  return rows;
}

// { reception, envoyes, archives } folder ids of a user
async function dossiersSysteme(idUtilisateur, conn) {
  const rows = await run(conn, "SELECT id_dossier, nom FROM dossiers WHERE id_utilisateur = ? AND type = 'systeme'", [
    idUtilisateur,
  ]);
  const ids = {};
  for (const r of rows) {
    if (r.nom === 'Réception') ids.reception = r.id_dossier;
    else if (r.nom === 'Envoyés') ids.envoyes = r.id_dossier;
    else if (r.nom === 'Archives') ids.archives = r.id_dossier;
  }
  return ids;
}

// SQL condition for the content of a folder (section 6.3)
function conditionDossier(idDossier, sys) {
  if (idDossier === sys.reception) {
    return { sql: "m.direction = 'recu' AND (m.id_dossier = ? OR m.id_dossier IS NULL)", params: [idDossier] };
  }
  if (idDossier === sys.envoyes) {
    return { sql: "m.direction = 'envoye' AND (m.id_dossier = ? OR m.id_dossier IS NULL)", params: [idDossier] };
  }
  return { sql: 'm.id_dossier = ?', params: [idDossier] };
}

function avecDossierEffectif(row, sys) {
  row.id_dossier_effectif = row.id_dossier ?? (row.direction === 'recu' ? sys.reception : sys.envoyes);
  return row;
}

// Paginated list of the messages matching a folder condition (+ optional filters).
async function listerDansDossier(idUtilisateur, idDossier, query = {}, { etat, sys: sysConnu } = {}) {
  const page = pagination(query);
  const ordre = tri(query.tri, TRI_MESSAGES, '-envoyeLe', 'm.id_message DESC');
  const sys = sysConnu || (await dossiersSysteme(idUtilisateur));
  const dossier = conditionDossier(idDossier, sys);

  const conditions = ['m.id_utilisateur = ?', dossier.sql];
  const params = [idUtilisateur, ...dossier.params];
  if (etat === 'lu') conditions.push("m.etat = 'lu'");
  if (etat === 'nonlu') conditions.push("m.etat = 'recu'");
  const motif = motifRecherche(query.recherche);
  if (motif) {
    conditions.push('(m.objet LIKE ? OR m.contenu LIKE ?)');
    params.push(motif, motif);
  }
  const where = conditions.join(' AND ');

  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM messages m WHERE ${where}`, params);
  const rows = await db.query(`${SELECT_MESSAGE} WHERE ${where} ORDER BY ${ordre} LIMIT ? OFFSET ?`, [
    ...params,
    page.taille,
    page.offset,
  ]);
  return enveloppe(
    rows.map((r) => mappers.messageListe(avecDossierEffectif(r, sys))),
    page,
    Number(total)
  );
}

// SW-18 / SW-19
async function listerMessages(idUtilisateur, query = {}) {
  const boite = query.boite === undefined || query.boite === '' ? 'reception' : query.boite;
  if (boite !== 'reception' && boite !== 'envoi') throw invalide();
  const etat = query.etat === undefined || query.etat === '' ? undefined : query.etat;
  if (etat !== undefined && (boite !== 'reception' || (etat !== 'lu' && etat !== 'nonlu'))) throw invalide();

  const sys = await dossiersSysteme(idUtilisateur);
  const idDossier = boite === 'reception' ? sys.reception : sys.envoyes;
  return listerDansDossier(idUtilisateur, idDossier, query, { etat, sys });
}

async function lireLigne(idUtilisateur, idMessage, conn) {
  const rows = await run(conn, `${SELECT_MESSAGE} WHERE m.id_message = ? AND m.id_utilisateur = ?`, [
    idMessage,
    idUtilisateur,
  ]);
  if (rows.length === 0) throw introuvable();
  return rows[0];
}

// SW-20 (does not change etat)
async function getMessage(idUtilisateur, idMessage) {
  const row = await lireLigne(idUtilisateur, idMessage);
  const sys = await dossiersSysteme(idUtilisateur);
  const pj = await db.query(
    'SELECT id_piece, nom_fichier, type_mime, taille_octets FROM pieces_jointes WHERE id_message = ? ORDER BY id_piece',
    [idMessage]
  );
  return mappers.messageComplet(avecDossierEffectif(row, sys), pj);
}

// SW-21
async function marquerLu(idUtilisateur, idMessage, data = {}) {
  if (typeof data.lu !== 'boolean') {
    throw new ApiError(400, 'VALIDATION_ECHOUEE', undefined, [
      { champ: 'lu', probleme: 'La valeur doit être true ou false.' },
    ]);
  }
  const rows = await db.query('SELECT direction FROM messages WHERE id_message = ? AND id_utilisateur = ?', [
    idMessage,
    idUtilisateur,
  ]);
  if (rows.length === 0) throw introuvable();
  if (rows[0].direction !== 'recu') throw new ApiError(400, 'ETAT_NON_APPLICABLE');

  const etat = data.lu ? 'lu' : 'recu';
  await db.query('UPDATE messages SET etat = ? WHERE id_message = ? AND id_utilisateur = ?', [
    etat,
    idMessage,
    idUtilisateur,
  ]);
  return { idMessage, etat };
}

// SW-22 – the other user's copy is not affected; a file is removed once nothing references it.
async function supprimerMessage(idUtilisateur, idMessage) {
  const fichiers = await db.transaction(async (conn) => {
    const [pj] = await conn.query(
      `SELECT DISTINCT p.chemin_stockage FROM pieces_jointes p
       JOIN messages m ON m.id_message = p.id_message
       WHERE m.id_message = ? AND m.id_utilisateur = ?`,
      [idMessage, idUtilisateur]
    );
    const [res] = await conn.query('DELETE FROM messages WHERE id_message = ? AND id_utilisateur = ?', [
      idMessage,
      idUtilisateur,
    ]);
    if (res.affectedRows === 0) throw introuvable();

    const orphelins = [];
    for (const { chemin_stockage: chemin } of pj) {
      const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM pieces_jointes WHERE chemin_stockage = ?', [chemin]);
      if (Number(n) === 0) orphelins.push(chemin);
    }
    return orphelins;
  });
  fichiers.forEach(pieces.supprimerFichier);
}

// SW-17
async function envoyerMessage(idUtilisateur, courrielExpediteur, data = {}) {
  const v = new Validateur();
  const destinataires = v.destinataires('destinataires', data.destinataires);
  const objet = v.texte('objet', data.objet, { max: 255, libelle: "L'objet" });
  const contenu = v.texte('contenu', data.contenu, { libelle: 'Le contenu du message' });
  v.verifier();
  const pj = pieces.reserver(idUtilisateur, data.piecesJointes);

  const idsMessages = await db.transaction(async (conn) => {
    const sys = await dossiersSysteme(idUtilisateur, conn);
    const [[{ maintenant }]] = await conn.query('SELECT UTC_TIMESTAMP() AS maintenant');
    const ids = [];

    const insererPieces = async (idMessage) => {
      for (const p of pj) {
        await conn.query(
          `INSERT INTO pieces_jointes (id_message, nom_fichier, type_mime, taille_octets, chemin_stockage)
           VALUES (?, ?, ?, ?, ?)`,
          [idMessage, p.nomFichier, p.typeMime, p.tailleOctets, p.cheminStockage]
        );
      }
    };

    for (const destinataire of destinataires) {
      // 1. sent copy
      const [envoi] = await conn.query(
        `INSERT INTO messages (id_utilisateur, id_dossier, expediteur_courriel, destinataire_courriel,
                               objet, contenu, direction, etat, envoye_le)
         VALUES (?, ?, ?, ?, ?, ?, 'envoye', 'envoye', ?)`,
        [idUtilisateur, sys.envoyes ?? null, courrielExpediteur, destinataire, objet, contenu, maintenant]
      );
      ids.push(envoi.insertId);
      await insererPieces(envoi.insertId);

      // 2. received copy when the recipient is a platform user
      const [users] = await conn.query('SELECT id_utilisateur FROM utilisateurs WHERE courriel = ?', [destinataire]);
      if (users.length > 0) {
        const idDest = users[0].id_utilisateur;
        const sysDest = await dossiersSysteme(idDest, conn);
        const [recu] = await conn.query(
          `INSERT INTO messages (id_utilisateur, id_dossier, expediteur_courriel, destinataire_courriel,
                                 objet, contenu, direction, etat, envoye_le)
           VALUES (?, ?, ?, ?, ?, ?, 'recu', 'recu', ?)`,
          [idDest, sysDest.reception ?? null, courrielExpediteur, destinataire, objet, contenu, maintenant]
        );
        await insererPieces(recu.insertId);
      }
    }
    return ids;
  });
  pieces.liberer(pj.map((p) => p.idPiece));

  const sys = await dossiersSysteme(idUtilisateur);
  const premier = await lireLigne(idUtilisateur, idsMessages[0]);
  return { ...mappers.messageListe(avecDossierEffectif(premier, sys)), idsMessages };
}

// SW-24 – returns the file to send, or 404
async function pieceATelecharger(idUtilisateur, idMessage, idPiece) {
  const rows = await db.query(
    `SELECT p.nom_fichier, p.type_mime, p.chemin_stockage FROM pieces_jointes p
     JOIN messages m ON m.id_message = p.id_message
     WHERE p.id_piece = ? AND p.id_message = ? AND m.id_utilisateur = ?`,
    [idPiece, idMessage, idUtilisateur]
  );
  if (rows.length === 0) throw introuvable();
  const chemin = pieces.cheminFichier(rows[0].chemin_stockage);
  if (!fs.existsSync(chemin)) throw introuvable();
  return { chemin, nomFichier: rows[0].nom_fichier, typeMime: rows[0].type_mime };
}

module.exports = {
  dossiersSysteme,
  listerDansDossier,
  listerMessages,
  getMessage,
  marquerLu,
  supprimerMessage,
  envoyerMessage,
  pieceATelecharger,
};
