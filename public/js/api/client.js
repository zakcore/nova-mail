// fetch wrapper: token, JSON, error envelope → ApiError.
import { API_BASE_URL } from './config.js';
import { getSession, clearSession } from '../session.js';

const MESSAGES_GENERIQUES = {
  400: 'Les données envoyées sont invalides.',
  401: 'Courriel ou mot de passe incorrect.',
  403: "Cette opération n'est pas autorisée.",
  404: "L'élément demandé est introuvable.",
  409: 'Cet élément existe déjà.',
  413: 'Le fichier est trop volumineux (10 Mo maximum).',
  415: "Ce type de fichier n'est pas accepté.",
  500: 'Une erreur est survenue sur le serveur. Réessayez plus tard.',
};

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const erreurReseau = () => new ApiError(0, 'RESEAU', 'Impossible de joindre le serveur. Vérifiez votre connexion.');

function enTetesAuth() {
  const session = getSession();
  return session ? { Authorization: `Bearer ${session.jeton}` } : {};
}

// Builds an ApiError from a non-2xx response; an expired session redirects to the login page.
async function lireErreur(res) {
  let erreur = {};
  try {
    erreur = (await res.json()).erreur || {};
  } catch {
    // body is not JSON: use the generic message
  }
  if (res.status === 401 && (erreur.code === 'JETON_ABSENT' || erreur.code === 'JETON_INVALIDE')) {
    clearSession();
    window.location.href = 'index.html?expire=1';
    return null;
  }
  return new ApiError(
    res.status,
    erreur.code || 'ERREUR',
    erreur.message || MESSAGES_GENERIQUES[res.status] || MESSAGES_GENERIQUES[500],
    erreur.details || []
  );
}

const enAttenteInfinie = () => new Promise(() => {});

export async function request(method, path, { body, query, form } = {}) {
  const url = new URL(API_BASE_URL + path, window.location.origin);
  if (query) {
    for (const [cle, valeur] of Object.entries(query)) {
      if (valeur !== undefined && valeur !== null && valeur !== '') url.searchParams.set(cle, valeur);
    }
  }
  const headers = enTetesAuth();
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw erreurReseau();
  }
  if (!res.ok) {
    const erreur = await lireErreur(res);
    if (!erreur) return enAttenteInfinie(); // redirecting to the login page
    throw erreur;
  }
  if (res.status === 204) return null;
  return res.json();
}

// A plain link cannot send the token: download with fetch, then save the blob.
export async function telecharger(url, nomFichier) {
  let res;
  try {
    res = await fetch(url, { headers: enTetesAuth() });
  } catch {
    throw erreurReseau();
  }
  if (!res.ok) {
    const erreur = await lireErreur(res);
    if (!erreur) return enAttenteInfinie();
    throw erreur;
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = objectUrl;
  lien.download = nomFichier;
  lien.hidden = true;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}
