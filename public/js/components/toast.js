// Success / error notifications, bottom-right, 3 seconds.
const CLE_DIFFERE = 'novamail.toast';

function region() {
  let r = document.querySelector('.toast-region');
  if (!r) {
    r = document.createElement('div');
    r.className = 'toast-region';
    document.body.append(r);
  }
  return r;
}

export function toast(message, type = 'succes') {
  const el = document.createElement('div');
  el.className = type === 'erreur' ? 'toast toast--error' : 'toast';
  el.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
  el.textContent = message;
  region().append(el);
  setTimeout(() => el.remove(), 3000);
}

export const toastErreur = (erreur) => toast(erreur?.message || 'Une erreur est survenue.', 'erreur');

// Shown on the next page (after a redirect).
export function toastApresNavigation(message) {
  sessionStorage.setItem(CLE_DIFFERE, message);
}

export function afficherToastDiffere() {
  const message = sessionStorage.getItem(CLE_DIFFERE);
  if (message) {
    sessionStorage.removeItem(CLE_DIFFERE);
    toast(message);
  }
}
