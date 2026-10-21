// nouveau.html?a=… – SW-17, SW-08 (autocomplete), SW-23 (attachments)
import { envoyerMessage, listerContacts, televerserPieceJointe } from '../api/services.js';
import { requireSession, logout } from '../session.js';
import { initSidebar } from '../components/sidebar.js';
import { toast, toastErreur, toastApresNavigation } from '../components/toast.js';
import { confirmer } from '../components/confirm.js';
import { afficherErreurs, effacerErreurs, valeur } from '../components/forms.js';
import { COURRIEL_RE, debounce, taille } from '../format.js';

const TAILLE_MAX = 10 * 1024 * 1024;

if (requireSession()) {
  initSidebar({ nav: 'nouveau' });

  const form = document.getElementById('compose-form');
  const champA = document.getElementById('compose-to');
  const suggestions = document.getElementById('compose-suggestions');
  const puces = document.getElementById('attachment-chips');
  const fichiers = document.getElementById('compose-files');
  const boutonEnvoyer = document.getElementById('btn-send');

  const pieces = new Map(); // chip element → idPiece (null while uploading)
  let envoisEnCours = 0;
  let envoiTermine = false;

  const prerempli = new URLSearchParams(window.location.search).get('a');
  if (prerempli) champA.value = `${prerempli}, `;
  const destinataireInitial = champA.value.trim();

  // Something the user typed or attached would be lost
  const aDuContenu = () =>
    !envoiTermine &&
    (valeur(form, 'objet') !== '' ||
      valeur(form, 'contenu') !== '' ||
      pieces.size > 0 ||
      champA.value.trim() !== destinataireInitial);

  /* ---------- Autocomplete (SW-08) ---------- */

  let choix = [];
  let selection = -1;

  const termeCourant = () => champA.value.split(/[,;]/).pop().trim();

  function fermerSuggestions() {
    suggestions.hidden = true;
    suggestions.replaceChildren();
    champA.setAttribute('aria-expanded', 'false');
    champA.removeAttribute('aria-activedescendant');
    choix = [];
    selection = -1;
  }

  function inserer(courriel) {
    const parties = champA.value.split(/([,;])/);
    parties[parties.length - 1] = parties.length > 1 ? ` ${courriel}` : courriel;
    champA.value = `${parties.join('')}, `;
    fermerSuggestions();
    champA.focus();
  }

  function surligner(index) {
    selection = index;
    [...suggestions.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) champA.setAttribute('aria-activedescendant', suggestions.children[index].id);
  }

  const chercher = debounce(async () => {
    const terme = termeCourant();
    if (terme.length < 2) {
      fermerSuggestions();
      return;
    }
    try {
      const { donnees } = await listerContacts({ recherche: terme, taille: 5 });
      if (terme !== termeCourant()) return;
      choix = donnees;
      if (choix.length === 0) {
        fermerSuggestions();
        return;
      }
      suggestions.replaceChildren(
        ...choix.map((c, i) => {
          const li = document.createElement('li');
          li.className = 'suggestion';
          li.id = `suggestion-${i}`;
          li.setAttribute('role', 'option');
          li.setAttribute('aria-selected', 'false');
          const courriel = document.createElement('span');
          courriel.className = 'suggestion-email';
          courriel.textContent = `<${c.courriel}>`;
          li.append(`${c.prenom} ${c.nom} `, courriel);
          li.addEventListener('mousedown', (event) => {
            event.preventDefault(); // keep the focus in the field
            inserer(c.courriel);
          });
          return li;
        })
      );
      suggestions.hidden = false;
      champA.setAttribute('aria-expanded', 'true');
      selection = -1;
    } catch {
      fermerSuggestions();
    }
  }, 300);

  champA.addEventListener('input', chercher);
  champA.addEventListener('blur', () => setTimeout(fermerSuggestions, 150));
  champA.addEventListener('keydown', (event) => {
    if (suggestions.hidden || choix.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      surligner((selection + 1) % choix.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      surligner((selection - 1 + choix.length) % choix.length);
    } else if (event.key === 'Enter' && selection >= 0) {
      event.preventDefault();
      inserer(choix[selection].courriel);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      fermerSuggestions();
    }
  });

  /* ---------- Attachments (SW-23) ---------- */

  function majEnvoi() {
    boutonEnvoyer.disabled = envoisEnCours > 0;
    puces.hidden = puces.children.length === 0;
  }

  function creerPuce(fichier) {
    const li = document.createElement('li');
    li.className = 'chip is-uploading';
    const texte = document.createElement('span');
    texte.textContent = `📎 ${fichier.name} – Envoi du fichier…`;
    const retirer = document.createElement('button');
    retirer.type = 'button';
    retirer.className = 'chip-remove';
    retirer.textContent = '✕';
    retirer.setAttribute('aria-label', `Retirer ${fichier.name}`);
    retirer.addEventListener('click', () => {
      pieces.delete(li);
      li.remove();
      majEnvoi();
    });
    li.append(texte, retirer);
    return { li, texte };
  }

  async function televerser(fichier) {
    if (fichier.size > TAILLE_MAX) {
      toast(`Le fichier dépasse 10 Mo. (${fichier.name})`, 'erreur');
      return;
    }
    const { li, texte } = creerPuce(fichier);
    puces.append(li);
    pieces.set(li, null);
    envoisEnCours += 1;
    majEnvoi();
    try {
      const piece = await televerserPieceJointe(fichier);
      if (!li.isConnected) return; // removed while uploading
      pieces.set(li, piece.idPiece);
      li.classList.remove('is-uploading');
      texte.textContent = `📎 ${piece.nomFichier} (${taille(piece.tailleOctets)})`;
    } catch (err) {
      pieces.delete(li);
      li.remove();
      toastErreur(err);
    } finally {
      envoisEnCours -= 1;
      majEnvoi();
    }
  }

  document.getElementById('btn-attach').addEventListener('click', () => fichiers.click());
  fichiers.addEventListener('change', () => {
    [...fichiers.files].forEach(televerser);
    fichiers.value = '';
  });

  /* ---------- Send (SW-17) ---------- */

  function valider() {
    const details = [];
    const destinataires = champA.value
      .split(/[,;]/)
      .map((a) => a.trim())
      .filter(Boolean);
    const invalide = destinataires.find((a) => !COURRIEL_RE.test(a));
    if (destinataires.length === 0) details.push({ champ: 'destinataires', probleme: 'Au moins un destinataire est obligatoire.' });
    else if (invalide) details.push({ champ: 'destinataires', probleme: `Adresse invalide : ${invalide}` });

    const objet = valeur(form, 'objet');
    if (!objet) details.push({ champ: 'objet', probleme: "L'objet est obligatoire." });
    else if (objet.length > 255) details.push({ champ: 'objet', probleme: "L'objet ne doit pas dépasser 255 caractères." });

    const contenu = form.elements.contenu.value;
    if (!contenu.trim()) details.push({ champ: 'contenu', probleme: 'Le message est vide.' });
    return { details, donnees: { destinataires, objet, contenu } };
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (envoisEnCours > 0) return;
    effacerErreurs(form);
    const { details, donnees } = valider();
    if (details.length) {
      afficherErreurs(form, details);
      return;
    }
    boutonEnvoyer.disabled = true;
    try {
      await envoyerMessage({ ...donnees, piecesJointes: [...pieces.values()].filter(Boolean) });
      envoiTermine = true;
      toastApresNavigation('Message envoyé');
      window.location.href = 'envoyes.html';
    } catch (err) {
      if (!afficherErreurs(form, err.details)) toastErreur(err);
      boutonEnvoyer.disabled = false;
    }
  });

  /* ---------- Leaving with unsent text ---------- */

  document.addEventListener(
    'click',
    async (event) => {
      const lien = event.target.closest('a[href]');
      if (!lien || !aDuContenu() || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      const ok = await confirmer({
        titre: 'Quitter sans envoyer',
        message: 'Quitter sans envoyer ? Le message sera perdu.',
        libelle: 'Quitter',
      });
      if (!ok) return;
      envoiTermine = true;
      if (lien.id === 'logout-link') logout();
      else window.location.href = lien.href;
    },
    true
  );

  window.addEventListener('beforeunload', (event) => {
    if (aDuContenu()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
