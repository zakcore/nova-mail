// page / taille / tri / recherche parsing (section 5.3).
const { ApiError } = require('../errors');

const invalide = () => new ApiError(400, 'PARAMETRE_INVALIDE');

function entier(valeur, defaut, min, max) {
  if (valeur === undefined || valeur === '') return defaut;
  if (!/^[0-9]+$/.test(String(valeur))) throw invalide();
  const n = Number(valeur);
  if (n < min || n > max) throw invalide();
  return n;
}

// colonnes: { champApi: 'sql_expression' } – the whitelist. Returns an ORDER BY clause body.
function tri(valeur, colonnes, defaut, secondaire = '') {
  const brut = valeur === undefined || valeur === '' ? defaut : String(valeur);
  const desc = brut.startsWith('-');
  const champ = desc ? brut.slice(1) : brut;
  if (!Object.prototype.hasOwnProperty.call(colonnes, champ)) throw invalide();
  const ordre = `${colonnes[champ]} ${desc ? 'DESC' : 'ASC'}`;
  return secondaire ? `${ordre}, ${secondaire}` : ordre;
}

function pagination(query) {
  const page = entier(query.page, 1, 1, 1000000);
  const taille = entier(query.taille, 20, 1, 100);
  return { page, taille, offset: (page - 1) * taille };
}

// '%' and '_' are escaped so they match literally in LIKE.
function motifRecherche(valeur) {
  if (valeur === undefined || valeur === null) return null;
  if (typeof valeur !== 'string') throw invalide();
  const v = valeur.trim();
  if (v === '') return null;
  return `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function enveloppe(donnees, { page, taille }, total) {
  return {
    donnees,
    pagination: { page, taille, total, nbPages: Math.max(1, Math.ceil(total / taille)) },
  };
}

module.exports = { pagination, tri, motifRecherche, enveloppe, invalide };
