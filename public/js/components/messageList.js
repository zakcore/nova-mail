// Message table shared by reception, envoyes and dossier (built from <template id="message-row-template">).
import { marquerLu } from '../api/services.js';
import { dateListe, nomAffiche } from '../format.js';
import { toastErreur } from './toast.js';

const LIBELLE_ETAT = { envoye: 'Envoyé', recu: 'Non lu', lu: 'Lu' };

function etatLigne(li, message) {
  const nonLu = message.direction === 'recu' && message.etat === 'recu';
  li.classList.toggle('is-unread', nonLu);
  const point = li.querySelector('.cell-dot');
  if (point) point.textContent = nonLu ? '●' : '';
  li.querySelector('.cell-state').textContent = LIBELLE_ETAT[message.etat] || '';

  const bouton = li.querySelector('.row-action');
  if (!bouton) return;
  bouton.hidden = message.direction !== 'recu';
  const libelle = nonLu ? 'Marquer comme lu' : 'Marquer comme non lu';
  bouton.textContent = nonLu ? '✉' : '●';
  bouton.setAttribute('aria-label', libelle);
  bouton.title = libelle;
}

// cible: 'reception' | 'envoyes' | 'dossier' (decides the "De / À" column and the back link)
function creerLigne(template, message, { cible, idDossier, surChangementEtat }) {
  const li = template.content.firstElementChild.cloneNode(true);
  const params = new URLSearchParams({ id: message.idMessage, depuis: cible });
  if (cible === 'dossier') params.set('idDossier', idDossier);
  li.querySelector('.message-row-link').href = `message.html?${params}`;

  const envoye = message.direction === 'envoye';
  const personne = nomAffiche(envoye ? message.destinataire : message.expediteur);
  li.querySelector('.cell-from').textContent = envoye && cible === 'dossier' ? `À : ${personne}` : personne;
  li.querySelector('.subject').textContent = message.objet;
  li.querySelector('.excerpt').textContent = message.extrait ? `– ${message.extrait}` : '';
  li.querySelector('.attach').hidden = !(message.nbPiecesJointes > 0);
  const date = li.querySelector('.cell-date');
  date.textContent = dateListe(message.envoyeLe);
  date.title = new Date(message.envoyeLe).toLocaleString('fr-CA');
  etatLigne(li, message);

  const bouton = li.querySelector('.row-action');
  if (bouton && !envoye) {
    bouton.addEventListener('click', async (event) => {
      event.stopPropagation();
      bouton.disabled = true;
      try {
        const res = await marquerLu(message.idMessage, message.etat === 'recu');
        message.etat = res.etat;
        etatLigne(li, message);
        surChangementEtat?.(message);
      } catch (err) {
        toastErreur(err);
      } finally {
        bouton.disabled = false;
      }
    });
  }
  return li;
}

function ligneEtat(texte, classe) {
  const li = document.createElement('li');
  li.className = classe;
  li.textContent = texte;
  return li;
}

export function afficherChargement(liste) {
  liste.setAttribute('aria-busy', 'true');
  liste.replaceChildren(ligneEtat('Chargement…', 'list-state'));
}

export function afficherMessages(liste, messages, { vide, ...options }) {
  liste.removeAttribute('aria-busy');
  if (messages.length === 0) {
    liste.replaceChildren(ligneEtat(vide, 'empty-state'));
    return;
  }
  const template = document.getElementById('message-row-template');
  liste.replaceChildren(...messages.map((m) => creerLigne(template, m, options)));
}

export function afficherErreurListe(liste, err) {
  liste.removeAttribute('aria-busy');
  liste.replaceChildren(ligneEtat(err.message, 'empty-state'));
}
