// DB rows (snake_case) → API JSON (camelCase). Never exposes mot_de_passe_hash or chemin_stockage.

const iso = (d) => (d instanceof Date ? d.toISOString() : d ? new Date(d).toISOString() : null);

function utilisateur(row) {
  return {
    idUtilisateur: row.id_utilisateur,
    courriel: row.courriel,
    nom: row.nom,
    prenom: row.prenom,
    photoProfil: row.photo_profil,
    telephone: row.telephone,
    creeLe: iso(row.cree_le),
  };
}

function contact(row) {
  return {
    idContact: row.id_contact,
    nom: row.nom,
    prenom: row.prenom,
    courriel: row.courriel,
    photoProfil: row.photo_profil,
    telephones: {
      mobile: row.telephone_mobile,
      fixe: row.telephone_fixe,
      professionnel: row.telephone_pro,
    },
  };
}

function dossier(row) {
  return {
    idDossier: row.id_dossier,
    nom: row.nom,
    type: row.type,
    nbMessages: Number(row.nb_messages || 0),
    nbNonLus: Number(row.nb_non_lus || 0),
  };
}

// First 150 characters, cut on a word boundary, followed by … when cut.
function extrait(contenu, max = 150) {
  const texte = String(contenu || '').replace(/\s+/g, ' ').trim();
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > 0 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

// Row from messages.service (with exp_nom, exp_prenom, dest_nom, dest_prenom, nb_pieces).
function messageBase(row) {
  return {
    idMessage: row.id_message,
    expediteur: { courriel: row.expediteur_courriel, nom: row.exp_nom ?? null, prenom: row.exp_prenom ?? null },
    destinataire: { courriel: row.destinataire_courriel, nom: row.dest_nom ?? null, prenom: row.dest_prenom ?? null },
    objet: row.objet,
  };
}

function messageListe(row) {
  return {
    ...messageBase(row),
    extrait: extrait(row.contenu),
    direction: row.direction,
    etat: row.etat,
    envoyeLe: iso(row.envoye_le),
    idDossier: row.id_dossier_effectif ?? row.id_dossier,
    nbPiecesJointes: Number(row.nb_pieces || 0),
  };
}

function pieceJointe(row, idMessage) {
  return {
    idPiece: row.id_piece,
    nomFichier: row.nom_fichier,
    typeMime: row.type_mime,
    tailleOctets: Number(row.taille_octets),
    url: `/api/v1/messages/${idMessage}/pieces-jointes/${row.id_piece}`,
  };
}

function messageComplet(row, pieces) {
  return {
    ...messageBase(row),
    contenu: row.contenu,
    direction: row.direction,
    etat: row.etat,
    envoyeLe: iso(row.envoye_le),
    idDossier: row.id_dossier_effectif ?? row.id_dossier,
    piecesJointes: pieces.map((p) => pieceJointe(p, row.id_message)),
  };
}

module.exports = { iso, utilisateur, contact, dossier, extrait, messageListe, messageComplet, pieceJointe };
