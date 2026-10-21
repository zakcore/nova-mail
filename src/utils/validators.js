// Validation rules of section 5.7. Each helper pushes problems into a shared list
// so that all field errors of one request are returned together.
const { ApiError, introuvable } = require('../errors');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9 +()\-]{7,20}$/;

class Validateur {
  constructor() {
    this.details = [];
  }

  erreur(champ, probleme) {
    this.details.push({ champ, probleme });
    return undefined;
  }

  texte(champ, valeur, { min = 1, max, libelle }) {
    if (typeof valeur !== 'string' || valeur.trim().length < min) {
      return this.erreur(champ, `${libelle} est obligatoire.`);
    }
    const v = valeur.trim();
    if (max && v.length > max) return this.erreur(champ, `${libelle} ne doit pas dépasser ${max} caractères.`);
    return v;
  }

  courriel(champ, valeur) {
    if (typeof valeur !== 'string' || valeur.trim() === '') {
      return this.erreur(champ, "L'adresse courriel est obligatoire.");
    }
    const v = valeur.trim().toLowerCase();
    if (v.length > 190) return this.erreur(champ, "L'adresse courriel ne doit pas dépasser 190 caractères.");
    if (!EMAIL_RE.test(v)) return this.erreur(champ, "Le format de l'adresse courriel est invalide.");
    return v;
  }

  motDePasse(champ, valeur) {
    if (typeof valeur !== 'string' || valeur === '') {
      return this.erreur(champ, 'Le mot de passe est obligatoire.');
    }
    if (valeur.length < 8 || !/[A-Z]/.test(valeur) || !/[a-z]/.test(valeur) || !/[0-9]/.test(valeur)) {
      return this.erreur(
        champ,
        'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.'
      );
    }
    return valeur;
  }

  // Optional phone: undefined / null / '' → null
  telephone(champ, valeur) {
    if (valeur === undefined || valeur === null || (typeof valeur === 'string' && valeur.trim() === '')) return null;
    if (typeof valeur !== 'string' || !PHONE_RE.test(valeur.trim())) {
      return this.erreur(champ, 'Le numéro de téléphone est invalide (7 à 20 chiffres, espaces, +, -, parenthèses).');
    }
    return valeur.trim();
  }

  // Optional photo URL: undefined / null / '' → null
  photo(champ, valeur) {
    if (valeur === undefined || valeur === null || (typeof valeur === 'string' && valeur.trim() === '')) return null;
    if (typeof valeur !== 'string') return this.erreur(champ, "L'adresse de la photo est invalide.");
    const v = valeur.trim();
    if (v.length > 255) return this.erreur(champ, "L'adresse de la photo ne doit pas dépasser 255 caractères.");
    if (!/^(\/|https?:\/\/)/i.test(v)) {
      return this.erreur(champ, "L'adresse de la photo doit commencer par /, http:// ou https://.");
    }
    return v;
  }

  // Array of 1 to 20 valid emails, duplicates removed
  destinataires(champ, valeur) {
    if (!Array.isArray(valeur) || valeur.length === 0) {
      return this.erreur(champ, 'Au moins un destinataire est obligatoire.');
    }
    const uniques = [];
    for (const item of valeur) {
      const v = typeof item === 'string' ? item.trim().toLowerCase() : '';
      if (!EMAIL_RE.test(v) || v.length > 190) {
        return this.erreur(champ, `Adresse invalide : ${typeof item === 'string' ? item : String(item)}`);
      }
      if (!uniques.includes(v)) uniques.push(v);
    }
    if (uniques.length > 20) return this.erreur(champ, 'Un message ne peut pas avoir plus de 20 destinataires.');
    return uniques;
  }

  verifier() {
    if (this.details.length > 0) {
      throw new ApiError(400, 'VALIDATION_ECHOUEE', undefined, this.details);
    }
  }
}

// Path ids: positive integers, otherwise 404 (section 5.7)
function idChemin(valeur) {
  if (!/^[1-9][0-9]{0,15}$/.test(String(valeur))) throw introuvable();
  return Number(valeur);
}

module.exports = { Validateur, idChemin, EMAIL_RE, PHONE_RE };
