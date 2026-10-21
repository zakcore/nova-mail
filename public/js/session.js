// Session stored in sessionStorage after SW-02.
import { seDeconnecter } from './api/services.js';

const CLE = 'novamail.session';

export function getSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(CLE));
    if (!session || !session.jeton || new Date(session.expireLe) <= new Date()) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveSession({ jeton, expireLe, utilisateur }) {
  sessionStorage.setItem(CLE, JSON.stringify({ jeton, expireLe, utilisateur }));
}

export function updateUtilisateur(utilisateur) {
  const session = getSession();
  if (session) saveSession({ ...session, utilisateur: { ...session.utilisateur, ...utilisateur } });
}

export function clearSession() {
  sessionStorage.removeItem(CLE);
}

// Every app page: no valid session → login page. Returns the session or null.
export function requireSession() {
  const session = getSession();
  if (!session) {
    clearSession();
    window.location.replace('index.html');
    return null;
  }
  return session;
}

export async function logout() {
  try {
    await seDeconnecter();
  } catch {
    // the session is cleared anyway
  }
  clearSession();
  window.location.href = 'index.html';
}
