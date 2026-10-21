// SW-07 to SW-11
const db = require('../db');
const { ApiError, introuvable } = require('../errors');
const { Validateur } = require('../utils/validators');
const { pagination, tri, motifRecherche, enveloppe } = require('../utils/pagination');
const mappers = require('../utils/mappers');

const TRI_CONTACTS = { nom: 'c.nom', prenom: 'c.prenom', courriel: 'c.courriel' };

function valider(data = {}) {
  const v = new Validateur();
  const nom = v.texte('nom', data.nom, { max: 80, libelle: 'Le nom' });
  const prenom = v.texte('prenom', data.prenom, { max: 80, libelle: 'Le prénom' });
  const courriel = v.courriel('courriel', data.courriel);
  const photoProfil = v.photo('photoProfil', data.photoProfil);
  let tel = data.telephones;
  if (tel === undefined || tel === null) tel = {};
  if (typeof tel !== 'object' || Array.isArray(tel)) {
    v.erreur('telephones', 'Les téléphones doivent être un objet { mobile, fixe, professionnel }.');
    tel = {};
  }
  const mobile = v.telephone('mobile', tel.mobile);
  const fixe = v.telephone('fixe', tel.fixe);
  const professionnel = v.telephone('professionnel', tel.professionnel);
  v.verifier();
  return { nom, prenom, courriel, photoProfil, mobile, fixe, professionnel };
}

const doublon = () =>
  new ApiError(409, 'CONTACT_EXISTANT', undefined, [
    { champ: 'courriel', probleme: 'Ce courriel existe déjà dans vos contacts.' },
  ]);

async function lireContact(idUtilisateur, idContact) {
  const rows = await db.query('SELECT * FROM contacts WHERE id_contact = ? AND id_utilisateur = ?', [
    idContact,
    idUtilisateur,
  ]);
  if (rows.length === 0) throw introuvable();
  return mappers.contact(rows[0]);
}

// SW-07
async function creerContact(idUtilisateur, data) {
  const c = valider(data);
  const existe = await db.query('SELECT 1 FROM contacts WHERE id_utilisateur = ? AND courriel = ?', [
    idUtilisateur,
    c.courriel,
  ]);
  if (existe.length > 0) throw doublon();

  const res = await db.query(
    `INSERT INTO contacts (id_utilisateur, nom, prenom, courriel, photo_profil,
                           telephone_mobile, telephone_fixe, telephone_pro, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [idUtilisateur, c.nom, c.prenom, c.courriel, c.photoProfil, c.mobile, c.fixe, c.professionnel]
  );
  return lireContact(idUtilisateur, res.insertId);
}

// SW-08
async function listerContacts(idUtilisateur, query = {}) {
  const page = pagination(query);
  const secondaire = { nom: 'c.prenom ASC', prenom: 'c.nom ASC', courriel: '' };
  const champ = String(query.tri || 'nom').replace(/^-/, '');
  const ordre = tri(query.tri, TRI_CONTACTS, 'nom', [secondaire[champ], 'c.id_contact ASC'].filter(Boolean).join(', '));

  const conditions = ['c.id_utilisateur = ?'];
  const params = [idUtilisateur];
  const motif = motifRecherche(query.recherche);
  if (motif) {
    conditions.push("(c.nom LIKE ? OR c.prenom LIKE ? OR c.courriel LIKE ? OR CONCAT(c.prenom, ' ', c.nom) LIKE ?)");
    params.push(motif, motif, motif, motif);
  }
  const where = conditions.join(' AND ');

  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM contacts c WHERE ${where}`, params);
  const rows = await db.query(`SELECT c.* FROM contacts c WHERE ${where} ORDER BY ${ordre} LIMIT ? OFFSET ?`, [
    ...params,
    page.taille,
    page.offset,
  ]);
  return enveloppe(rows.map(mappers.contact), page, Number(total));
}

// SW-09
function getContact(idUtilisateur, idContact) {
  return lireContact(idUtilisateur, idContact);
}

// SW-10 (full replacement)
async function modifierContact(idUtilisateur, idContact, data) {
  await lireContact(idUtilisateur, idContact);
  const c = valider(data);
  const autre = await db.query(
    'SELECT 1 FROM contacts WHERE id_utilisateur = ? AND courriel = ? AND id_contact <> ?',
    [idUtilisateur, c.courriel, idContact]
  );
  if (autre.length > 0) throw doublon();

  await db.query(
    `UPDATE contacts SET nom = ?, prenom = ?, courriel = ?, photo_profil = ?,
            telephone_mobile = ?, telephone_fixe = ?, telephone_pro = ?
     WHERE id_contact = ? AND id_utilisateur = ?`,
    [c.nom, c.prenom, c.courriel, c.photoProfil, c.mobile, c.fixe, c.professionnel, idContact, idUtilisateur]
  );
  return lireContact(idUtilisateur, idContact);
}

// SW-11
async function supprimerContact(idUtilisateur, idContact) {
  const res = await db.query('DELETE FROM contacts WHERE id_contact = ? AND id_utilisateur = ?', [
    idContact,
    idUtilisateur,
  ]);
  if (res.affectedRows === 0) throw introuvable();
}

module.exports = { creerContact, listerContacts, getContact, modifierContact, supprimerContact };
