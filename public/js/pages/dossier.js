// dossier.html?id=… – SW-15, SW-14, SW-21
import { listerMessagesDossier, supprimerDossier } from '../api/services.js';
import { requireSession } from '../session.js';
import { initSidebar, rafraichirSidebar } from '../components/sidebar.js';
import { afficherToastDiffere, toastErreur, toastApresNavigation } from '../components/toast.js';
import { confirmer } from '../components/confirm.js';
import { creerPagination } from '../components/pagination.js';
import { afficherChargement, afficherMessages, afficherErreurListe } from '../components/messageList.js';

const idDossier = new URLSearchParams(window.location.search).get('id');

if (!/^\d+$/.test(idDossier || '')) {
  window.location.replace('reception.html');
} else if (requireSession()) {
  afficherToastDiffere();
  initSidebar({ idDossier });

  const liste = document.getElementById('message-list');
  const titre = document.getElementById('folder-title');
  const sousTitre = document.getElementById('folder-subtitle');
  const boutonSupprimer = document.getElementById('btn-delete-folder');
  let dossier;
  let page = 1;

  const pagination = creerPagination(document.getElementById('pagination'), (p) => {
    page = p;
    charger();
  });

  async function charger() {
    afficherChargement(liste);
    try {
      const res = await listerMessagesDossier(idDossier, { page });
      dossier = res.dossier;
      document.title = `${dossier.nom} – Nova Mail`;
      titre.textContent = dossier.nom;
      const n = res.pagination.total;
      sousTitre.textContent = `Dossier ${dossier.type === 'personnel' ? 'personnel' : 'système'} · ${n} message${n > 1 ? 's' : ''}`;
      boutonSupprimer.hidden = dossier.type !== 'personnel';
      afficherMessages(liste, res.donnees, {
        vide: 'Aucun message dans ce dossier. Ouvrez un message et utilisez « Classer dans un dossier » pour l’ajouter ici.',
        cible: 'dossier',
        idDossier,
        surChangementEtat: rafraichirSidebar,
      });
      pagination.afficher(res.pagination);
    } catch (err) {
      if (err.status === 404) {
        window.location.replace('reception.html');
        return;
      }
      afficherErreurListe(liste, err);
      pagination.masquer();
    }
  }

  boutonSupprimer.addEventListener('click', async () => {
    const ok = await confirmer({
      titre: 'Supprimer le dossier',
      message: `Supprimer le dossier « ${dossier.nom} » ? Les messages qu'il contient seront replacés dans Réception ou Envoyés.`,
    });
    if (!ok) return;
    try {
      await supprimerDossier(dossier.idDossier);
      toastApresNavigation('Dossier supprimé');
      window.location.href = 'reception.html';
    } catch (err) {
      toastErreur(err);
    }
  });

  charger();
}
