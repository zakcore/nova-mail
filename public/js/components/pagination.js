// Drives the existing <nav class="pagination"> (‹ Précédent · Page x sur y · Suivant ›).

export function creerPagination(nav, surChangement) {
  const precedent = nav.querySelector('[data-page="precedent"]');
  const suivant = nav.querySelector('[data-page="suivant"]');
  const info = nav.querySelector('.pagination-info');
  let etat = { page: 1, nbPages: 1 };

  precedent.addEventListener('click', () => etat.page > 1 && surChangement(etat.page - 1));
  suivant.addEventListener('click', () => etat.page < etat.nbPages && surChangement(etat.page + 1));

  return {
    afficher({ page, nbPages }) {
      etat = { page, nbPages };
      info.textContent = `Page ${page} sur ${nbPages}`;
      precedent.disabled = page <= 1;
      suivant.disabled = page >= nbPages;
      nav.hidden = nbPages <= 1;
    },
    masquer() {
      nav.hidden = true;
    },
  };
}
