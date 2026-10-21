// Dates, sizes, names and initials (fr-CA, browser time zone).

const deux = (n) => String(n).padStart(2, '0');
const heure = (d) => `${deux(d.getHours())}:${deux(d.getMinutes())}`;
const memeJour = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const fmtJourMois = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' });
const fmtJourMoisAnnee = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtComplet = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Lists: 10:42 · Hier · 21 août · 21 août 2025
export function dateListe(iso) {
  const d = new Date(iso);
  const maintenant = new Date();
  if (memeJour(d, maintenant)) return heure(d);
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (memeJour(d, hier)) return 'Hier';
  return (d.getFullYear() === maintenant.getFullYear() ? fmtJourMois : fmtJourMoisAnnee).format(d);
}

// Message view: lundi 3 août 2026 à 21 h 00
export function dateComplete(iso) {
  const d = new Date(iso);
  return `${fmtComplet.format(d)} à ${deux(d.getHours())} h ${deux(d.getMinutes())}`;
}

// 850 o · 180 Ko · 2,4 Mo
export function taille(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export function initiales({ prenom, nom, courriel } = {}) {
  const i = `${(prenom || '').trim().charAt(0)}${(nom || '').trim().charAt(0)}`;
  return (i || (courriel || '?').charAt(0)).toUpperCase();
}

// "Prénom Nom" when known, otherwise the email
export function nomAffiche({ prenom, nom, courriel } = {}) {
  const complet = [prenom, nom].filter(Boolean).join(' ');
  return complet || courriel || '';
}

// "Prénom Nom <courriel>" when names are known
export function adresseComplete(personne = {}) {
  const complet = [personne.prenom, personne.nom].filter(Boolean).join(' ');
  return complet ? `${complet} <${personne.courriel}>` : personne.courriel;
}

export const COURRIEL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const TELEPHONE_RE = /^[0-9 +()\-]{7,20}$/;
export const motDePasseValide = (v) => v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v);

export function debounce(fn, delai = 300) {
  let minuterie;
  return (...args) => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => fn(...args), delai);
  };
}
