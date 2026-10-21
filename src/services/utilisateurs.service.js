// SW-01, SW-02, SW-04, SW-05, SW-06
const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('../db');
const { ApiError, introuvable } = require('../errors');
const { Validateur } = require('../utils/validators');
const mappers = require('../utils/mappers');
const { emettreJeton } = require('../middleware/auth');

const DOSSIERS_SYSTEME = ['Réception', 'Envoyés', 'Archives'];

// Compared when the email is unknown, so the response time does not reveal which accounts exist.
const HASH_FACTICE = bcrypt.hashSync('compte-inexistant', config.bcryptRounds);

async function lireUtilisateur(idUtilisateur) {
  const rows = await db.query('SELECT * FROM utilisateurs WHERE id_utilisateur = ?', [idUtilisateur]);
  if (rows.length === 0) throw introuvable();
  return mappers.utilisateur(rows[0]);
}

// SW-01
async function creerCompte(data = {}) {
  const v = new Validateur();
  const courriel = v.courriel('courriel', data.courriel);
  const motDePasse = v.motDePasse('motDePasse', data.motDePasse);
  const nom = v.texte('nom', data.nom, { max: 80, libelle: 'Le nom' });
  const prenom = v.texte('prenom', data.prenom, { max: 80, libelle: 'Le prénom' });
  const telephone = v.telephone('telephone', data.telephone);
  v.verifier();

  const existe = await db.query('SELECT 1 FROM utilisateurs WHERE courriel = ?', [courriel]);
  if (existe.length > 0) {
    throw new ApiError(409, 'COURRIEL_DEJA_UTILISE', undefined, [
      { champ: 'courriel', probleme: 'Un compte utilise déjà cette adresse courriel.' },
    ]);
  }

  const hash = await bcrypt.hash(motDePasse, config.bcryptRounds);
  const id = await db.transaction(async (conn) => {
    const [res] = await conn.query(
      `INSERT INTO utilisateurs (courriel, mot_de_passe_hash, nom, prenom, telephone, cree_le, modifie_le)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [courriel, hash, nom, prenom, telephone]
    );
    const idUtilisateur = res.insertId;
    await conn.query(
      `INSERT INTO dossiers (id_utilisateur, nom, type, cree_le) VALUES ${DOSSIERS_SYSTEME.map(() => "(?, ?, 'systeme', UTC_TIMESTAMP())").join(', ')}`,
      DOSSIERS_SYSTEME.flatMap((nomDossier) => [idUtilisateur, nomDossier])
    );
    return idUtilisateur;
  });
  return lireUtilisateur(id);
}

// SW-02
async function seConnecter(data = {}) {
  const v = new Validateur();
  if (typeof data.courriel !== 'string' || data.courriel.trim() === '') {
    v.erreur('courriel', "L'adresse courriel est obligatoire.");
  }
  if (typeof data.motDePasse !== 'string' || data.motDePasse === '') {
    v.erreur('motDePasse', 'Le mot de passe est obligatoire.');
  }
  v.verifier();

  const rows = await db.query('SELECT * FROM utilisateurs WHERE courriel = ?', [data.courriel.trim().toLowerCase()]);
  const user = rows[0];
  const ok = await bcrypt.compare(data.motDePasse, user ? user.mot_de_passe_hash : HASH_FACTICE);
  if (!user || !ok) throw new ApiError(401, 'IDENTIFIANTS_INVALIDES');

  const { jeton, expireLe } = emettreJeton(user);
  const u = mappers.utilisateur(user);
  return {
    jeton,
    typeJeton: 'Bearer',
    expireLe,
    utilisateur: {
      idUtilisateur: u.idUtilisateur,
      courriel: u.courriel,
      nom: u.nom,
      prenom: u.prenom,
      photoProfil: u.photoProfil,
    },
  };
}

// SW-04
function getProfil(idUtilisateur) {
  return lireUtilisateur(idUtilisateur);
}

// SW-05 (PUT: omitted optional fields become null; courriel / motDePasse are ignored)
async function modifierProfil(idUtilisateur, data = {}) {
  const v = new Validateur();
  const nom = v.texte('nom', data.nom, { max: 80, libelle: 'Le nom' });
  const prenom = v.texte('prenom', data.prenom, { max: 80, libelle: 'Le prénom' });
  const telephone = v.telephone('telephone', data.telephone);
  const photoProfil = v.photo('photoProfil', data.photoProfil);
  v.verifier();

  await db.query(
    `UPDATE utilisateurs SET nom = ?, prenom = ?, telephone = ?, photo_profil = ?, modifie_le = UTC_TIMESTAMP()
     WHERE id_utilisateur = ?`,
    [nom, prenom, telephone, photoProfil, idUtilisateur]
  );
  return lireUtilisateur(idUtilisateur);
}

// SW-06
async function changerMotDePasse(idUtilisateur, data = {}) {
  const v = new Validateur();
  if (typeof data.ancienMotDePasse !== 'string' || data.ancienMotDePasse === '') {
    v.erreur('ancienMotDePasse', 'Le mot de passe actuel est obligatoire.');
  }
  const nouveau = v.motDePasse('nouveauMotDePasse', data.nouveauMotDePasse);
  v.verifier();

  const rows = await db.query('SELECT mot_de_passe_hash FROM utilisateurs WHERE id_utilisateur = ?', [idUtilisateur]);
  if (rows.length === 0) throw introuvable();
  const ok = await bcrypt.compare(data.ancienMotDePasse, rows[0].mot_de_passe_hash);
  if (!ok) {
    throw new ApiError(401, 'MOT_DE_PASSE_INCORRECT', undefined, [
      { champ: 'ancienMotDePasse', probleme: 'Le mot de passe actuel est incorrect.' },
    ]);
  }
  if (nouveau === data.ancienMotDePasse) throw new ApiError(400, 'MOT_DE_PASSE_IDENTIQUE');

  const hash = await bcrypt.hash(nouveau, config.bcryptRounds);
  await db.query('UPDATE utilisateurs SET mot_de_passe_hash = ?, modifie_le = UTC_TIMESTAMP() WHERE id_utilisateur = ?', [
    hash,
    idUtilisateur,
  ]);
}

module.exports = { creerCompte, seConnecter, getProfil, modifierProfil, changerMotDePasse };
