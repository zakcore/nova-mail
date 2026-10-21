// envoyes.html – SW-19
import { listerMessagesEnvoyes } from '../api/services.js';
import { requireSession } from '../session.js';
import { initSidebar } from '../components/sidebar.js';
import { afficherToastDiffere } from '../components/toast.js';
import { creerPagination } from '../components/pagination.js';
import { afficherChargement, afficherMessages, afficherErreurListe } from '../components/messageList.js';
import { debounce } from '../format.js';

if (requireSession()) {
  afficherToastDiffere();
  initSidebar({ nav: 'envoyes' });

  const liste = document.getElementById('message-list');
  const recherche = document.getElementById('search-messages');
  const etat = { page: 1, recherche: '' };
  let requete = 0;

  const pagination = creerPagination(document.getElementById('pagination'), (page) => {
    etat.page = page;
    charger();
  });

  async function charger() {
    const numero = ++requete;
    afficherChargement(liste);
    try {
      const res = await listerMessagesEnvoyes({ recherche: etat.recherche, page: etat.page });
      if (numero !== requete) return;
      const vide = etat.recherche ? 'Aucun message ne correspond à votre recherche.' : 'Aucun message envoyé.';
      afficherMessages(liste, res.donnees, { vide, cible: 'envoyes' });
      pagination.afficher(res.pagination);
    } catch (err) {
      if (numero !== requete) return;
      afficherErreurListe(liste, err);
      pagination.masquer();
    }
  }

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
