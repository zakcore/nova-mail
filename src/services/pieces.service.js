// SW-23 – pending uploads, kept in memory until SW-17 attaches them to a message (section 6.6).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { ApiError } = require('../errors');
const { nomOriginal } = require('../middleware/upload');

const DUREE_MAX_MS = 24 * 60 * 60 * 1000;
const enAttente = new Map(); // idPiece → { idUtilisateur, nomFichier, typeMime, tailleOctets, cheminStockage, creeLe }

// Only the generated file name is stored; it is always resolved inside UPLOAD_DIR.
function cheminFichier(cheminStockage) {
  return path.join(config.upload.dir, path.basename(cheminStockage));
}

function supprimerFichier(cheminStockage) {
  fs.unlink(cheminFichier(cheminStockage), () => {});
}

const purge = setInterval(() => {
  const limite = Date.now() - DUREE_MAX_MS;
  for (const [id, piece] of enAttente) {
    if (piece.creeLe < limite) {
      enAttente.delete(id);
      supprimerFichier(piece.cheminStockage);
    }
  }
}, 60 * 60 * 1000);
purge.unref();

// SW-23
function enregistrer(idUtilisateur, file) {
  if (!file) {
    throw new ApiError(400, 'VALIDATION_ECHOUEE', undefined, [
      { champ: 'fichier', probleme: 'Aucun fichier reçu (champ « fichier »).' },
    ]);
  }
  const idPiece = crypto.randomUUID();
  const piece = {
    idUtilisateur,
    nomFichier: nomOriginal(file).slice(0, 255),
    typeMime: file.mimetype,
    tailleOctets: file.size,
    cheminStockage: file.filename,
    creeLe: Date.now(),
  };
  enAttente.set(idPiece, piece);
  return { idPiece, nomFichier: piece.nomFichier, typeMime: piece.typeMime, tailleOctets: piece.tailleOctets };
}

// Used by SW-17: every id must be a pending upload of this user.
function reserver(idUtilisateur, ids) {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids)) throw new ApiError(400, 'PIECE_JOINTE_INVALIDE');
  const uniques = [...new Set(ids)];
  return uniques.map((id) => {
    const piece = typeof id === 'string' ? enAttente.get(id) : undefined;
    if (!piece || piece.idUtilisateur !== idUtilisateur) throw new ApiError(400, 'PIECE_JOINTE_INVALIDE');
    return { idPiece: id, ...piece };
  });
}

// After the message is committed: the file now belongs to pieces_jointes rows.
function liberer(ids) {
  ids.forEach((id) => enAttente.delete(id));
}

module.exports = { enregistrer, reserver, liberer, cheminFichier, supprimerFichier };
