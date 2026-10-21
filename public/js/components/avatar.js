// Photo when the URL loads, initials otherwise.
import { initiales } from '../format.js';

export function remplirAvatar(el, personne = {}) {
  el.textContent = initiales(personne);
  const url = (personne.photoProfil || '').trim();
  el.dataset.photo = url;
  if (!/^(\/|https?:\/\/)/i.test(url)) return;

  const img = document.createElement('img');
  img.alt = '';
  img.addEventListener(
    'load',
    () => {
      if (el.dataset.photo === url) el.replaceChildren(img); // ignore an older, slower image
    },
    { once: true }
  );
  img.src = url; // on error the initials simply stay
}
