// message.html?id=…&depuis=… – SW-20, SW-21, SW-13, SW-16, SW-22, SW-24
import { getMessage, marquerLu, ajouterMessageADossier, supprimerMessage, telechargerPieceJointe } from '../api/services.js';
import { requireSession } from '../session.js';
import { initSidebar, rafraichirSidebar } from '../components/sidebar.js';
import { toast, toastErreur, toastApresNavigation } from '../components/toast.js';
import { confirmer } from '../components/confirm.js';
import { adresseComplete, dateComplete, taille } from '../format.js';

const params = new URLSearchParams(window.location.search);
const idMessage = params.get('id');
const depuis = params.get('depuis');
const idDossierOrigine = params.get('idDossier');

// Where "← Retour" goes, and which sidebar item is active
function origine() {
  if (depuis === 'envoyes') return { url: 'envoyes.html', nav: 'envoyes' };
  if (depuis === 'dossier' && /^\d+$/.test(idDossierOrigine || '')) {
    return { url: `dossier.html?id=${idDossierOrigine}`, idDossier: idDossierOrigine };
  }
  return { url: 'reception.html', nav: 'reception' };
}

if (requireSession()) {
  const retour = origine();
  const dossiersPromesse = initSidebar({ nav: retour.nav, idDossier: retour.idDossier });
  document.getElementById('back-link').href = retour.url;

  const chargement = document.getElementById('message-loading');
  const detail = document.getElementById('message-detail');
  let message;

  function introuvable() {
    chargement.hidden = true;
    detail.hidden = true;
    document.getElementById('message-not-found').hidden = false;
  }

  function afficherPieces(pieces) {
    const section = document.getElementById('attachments-section');
    section.hidden = pieces.length === 0;
    document.getElementById('attachments-title').textContent = `Pièces jointes (${pieces.length})`;
    document.getElementById('attachment-list').replaceChildren(
      ...pieces.map((piece) => {
        const li = document.createElement('li');
        li.className = 'attachment';
        const icone = document.createElement('span');
        icone.setAttribute('aria-hidden', 'true');
        icone.textContent = '📎';
        const nom = document.createElement('span');
        nom.className = 'attachment-name';
        const tailleEl = document.createElement('span');
        tailleEl.className = 'attachment-size';
        tailleEl.textContent = ` – ${taille(piece.tailleOctets)}`;
        nom.append(piece.nomFichier, tailleEl);
        const lien = document.createElement('a');
        lien.href = piece.url;
        lien.textContent = 'Télécharger';
        lien.setAttribute('aria-label', `Télécharger ${piece.nomFichier}`);
        lien.addEventListener('click', async (event) => {
          event.preventDefault();
          try {
            await telechargerPieceJointe(piece.url, piece.nomFichier);
          } catch (err) {
            toastErreur(err);
          }
        });
        li.append(icone, nom, lien);
        return li;
      })
    );
  }

  // Folders a message may go to: not its current one, not the box of the other direction (SW-16)
  function remplirDossiers(dossiers) {
    const interdit = message.direction === 'recu' ? 'Envoyés' : 'Réception';
    const choix = dossiers.filter(
      (d) => d.idDossier !== message.idDossier && !(d.type === 'systeme' && d.nom === interdit)
    );
    const select = document.getElementById('move-folder');
    select.replaceChildren(
      ...choix.map((d) => {
        const option = document.createElement('option');
        option.value = d.idDossier;
        option.textContent = d.nom;
        return option;
      })
    );
    document.getElementById('move-section').hidden = choix.length === 0;
  }

  async function charger() {
    try {
      message = await getMessage(idMessage);
    } catch (err) {
      if (err.status === 404) introuvable();
      else {
        chargement.textContent = err.message;
      }
      return;
    }

    document.title = `${message.objet} – Nova Mail`;
    document.getElementById('message-subject').textContent = message.objet;
    document.getElementById('message-from').textContent = adresseComplete(message.expediteur);
    document.getElementById('message-to').textContent = adresseComplete(message.destinataire);
    document.getElementById('message-date').textContent = dateComplete(message.envoyeLe);
    document.getElementById('message-body').textContent = message.contenu;
    document.getElementById('btn-unread').hidden = message.direction !== 'recu';
    afficherPieces(message.piecesJointes);
    remplirDossiers(await dossiersPromesse);

    chargement.hidden = true;
    detail.hidden = false;

    // Opening an unread message marks it read
    if (message.direction === 'recu' && message.etat === 'recu') {
      try {
        await marquerLu(message.idMessage, true);
        message.etat = 'lu';
        rafraichirSidebar();
      } catch (err) {
        toastErreur(err);
      }
    }
  }

  const boutonNonLu = document.getElementById('btn-unread');
  boutonNonLu.addEventListener('click', async () => {
    boutonNonLu.disabled = true;
    try {
      await marquerLu(message.idMessage, false);
      toastApresNavigation('Message marqué comme non lu');
      window.location.href = retour.url;
    } catch (err) {
      toastErreur(err);
      boutonNonLu.disabled = false;
    }
  });

  document.getElementById('move-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const select = document.getElementById('move-folder');
    const idDossier = Number(select.value);
    const nom = select.selectedOptions[0]?.textContent;
    if (!idDossier) return;
    const bouton = event.currentTarget.querySelector('[type="submit"]');
    bouton.disabled = true;
    try {
      await ajouterMessageADossier(idDossier, message.idMessage);
      message.idDossier = idDossier;
      toast(`Message déplacé dans « ${nom} »`);
      remplirDossiers(await rafraichirSidebar());
    } catch (err) {
      toastErreur(err);
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const ok = await confirmer({ titre: 'Supprimer le message', message: 'Supprimer ce message ? Cette action est définitive.' });
    if (!ok) return;
    try {
      await supprimerMessage(message.idMessage);
      toastApresNavigation('Message supprimé');
      window.location.href = retour.url;
    } catch (err) {
      toastErreur(err);
    }
  });

  if (!/^\d+$/.test(idMessage || '')) introuvable();
  else charger();
}
