// reception.html – SW-18, SW-21
import { listerMessagesRecus } from '../api/services.js';
import { requireSession } from '../session.js';
import { initSidebar, rafraichirSidebar } from '../components/sidebar.js';
import { afficherToastDiffere } from '../components/toast.js';
import { creerPagination } from '../components/pagination.js';
import { afficherChargement, afficherMessages, afficherErreurListe } from '../components/messageList.js';
import { debounce } from '../format.js';

if (requireSession()) {
  afficherToastDiffere();
  initSidebar({ nav: 'reception' });

  const liste = document.getElementById('message-list');
  const recherche = document.getElementById('search-messages');
  const etat = { page: 1, etat: '', recherche: '' };
  let requete = 0;

  const pagination = creerPagination(document.getElementById('pagination'), (page) => {
    etat.page = page;
    charger();
  });

  async function charger() {
    const numero = ++requete;
    afficherChargement(liste);
    try {
      const res = await listerMessagesRecus({ etat: etat.etat, recherche: etat.recherche, page: etat.page });
      if (numero !== requete) return; // a newer search is running
      const vide = etat.recherche ? 'Aucun message ne correspond à votre recherche.' : etat.etat ? 'Aucun message non lu.' : 'Aucun message reçu.';
      afficherMessages(liste, res.donnees, { vide, cible: 'reception', surChangementEtat: rafraichirSidebar });
      pagination.afficher(res.pagination);
    } catch (err) {
      if (numero !== requete) return;
      afficherErreurListe(liste, err);
      pagination.masquer();
    }
  }

  document.querySelectorAll('.tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      etat.etat = tab.dataset.etat;
      etat.page = 1;
      charger();
    });
  });

  recherche.addEventListener(
    'input',
    debounce(() => {
      etat.recherche = recherche.value.trim();
      etat.page = 1;
      charger();
    }, 300)
  );

  charger();
}
