// Header user, sidebar folders and counters, "+ Nouveau dossier", logout.
import { getProfil, listerDossiers, creerDossier } from '../api/services.js';
import { getSession, updateUtilisateur, logout } from '../session.js';
import { remplirAvatar } from './avatar.js';
import { toastErreur, toastApresNavigation } from './toast.js';
import { afficherErreurs, effacerErreurs, pendantEnvoi, valeur } from './forms.js';

let dossierActif = null;
let dossiersCache = [];

export function afficherUtilisateur(utilisateur) {
  document.getElementById('user-name').textContent = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(' ');
  remplirAvatar(document.getElementById('user-avatar'), utilisateur);
}

// Marks the active item: a nav key ('reception', 'envoyes', …) or a folder id.
export function definirActif({ nav, idDossier } = {}) {
  dossierActif = idDossier ?? null;
  document.querySelectorAll('#sidebar .sidebar-link').forEach((lien) => {
    const actif = (nav && lien.dataset.nav === nav) || (dossierActif !== null && lien.dataset.dossier === String(dossierActif));
    lien.classList.toggle('is-active', Boolean(actif));
    if (actif) lien.setAttribute('aria-current', 'page');
    else lien.removeAttribute('aria-current');
  });
}

function lienDossier(dossier) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'sidebar-link';
  a.href = `dossier.html?id=${dossier.idDossier}`;
  a.dataset.dossier = String(dossier.idDossier);
  a.textContent = dossier.nom;
  if (dossier.nbNonLus > 0) {
    const badge = document.createElement('span');
    badge.className = 'badge-count';
    badge.textContent = `(${dossier.nbNonLus})`;
    a.append(' ', badge);
  }
  if (String(dossier.idDossier) === String(dossierActif)) {
    a.classList.add('is-active');
    a.setAttribute('aria-current', 'page');
  }
  li.append(a);
  return li;
}

// SW-13: Réception counter + Archives and personal folders. Returns the folders.
export async function rafraichirSidebar() {
  try {
    const { donnees } = await listerDossiers();
    dossiersCache = donnees;
    const reception = donnees.find((d) => d.type === 'systeme' && d.nom === 'Réception');
    const compteur = document.getElementById('count-reception');
    compteur.hidden = !reception || reception.nbNonLus === 0;
    compteur.textContent = reception ? `(${reception.nbNonLus})` : '';

    const visibles = donnees.filter((d) => !(d.type === 'systeme' && (d.nom === 'Réception' || d.nom === 'Envoyés')));
    document.getElementById('folder-list').replaceChildren(...visibles.map(lienDossier));
    return donnees;
  } catch (err) {
    toastErreur(err);
    return dossiersCache;
  }
}

export const dossiers = () => dossiersCache;

function brancherNouveauDossier() {
  const form = document.getElementById('new-folder-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    effacerErreurs(form);
    const nom = valeur(form, 'nom');
    if (!nom) {
      afficherErreurs(form, [{ champ: 'nom', probleme: 'Le nom du dossier est obligatoire.' }]);
      return;
    }
    await pendantEnvoi(form, async () => {
      try {
        const dossier = await creerDossier(nom);
        toastApresNavigation(`Dossier « ${dossier.nom} » créé`);
        window.location.href = `dossier.html?id=${dossier.idDossier}`;
      } catch (err) {
        if (err.code === 'DOSSIER_EXISTANT') {
          afficherErreurs(form, [{ champ: 'nom', probleme: 'Un dossier porte déjà ce nom.' }]);
        } else if (!afficherErreurs(form, err.details)) {
          toastErreur(err);
        }
      }
    });
  });
  document.querySelector('[data-open-modal="modal-new-folder"]').addEventListener('click', () => {
    form.reset();
    effacerErreurs(form);
  });
}

// Called once by every app page after requireSession().
export async function initSidebar({ nav, idDossier } = {}) {
  const session = getSession();
  if (session) afficherUtilisateur(session.utilisateur);
  definirActif({ nav, idDossier });

  document.getElementById('logout-link').addEventListener('click', (event) => {
    event.preventDefault();
    logout();
  });
  brancherNouveauDossier();

  getProfil()
    .then((utilisateur) => {
      updateUtilisateur(utilisateur);
      afficherUtilisateur(utilisateur);
    })
    .catch(() => {});
  return rafraichirSidebar();
}
