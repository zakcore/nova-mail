// Promise-based wrapper over the existing #modal-confirm.
// ui.js still handles Annuler, Escape and the backdrop: closing the modal resolves false.

export function confirmer({ titre, message, libelle = 'Supprimer' }) {
  const modal = document.getElementById('modal-confirm');
  const ok = document.getElementById('modal-confirm-ok');
  const declencheur = document.activeElement;
  document.getElementById('modal-confirm-title').textContent = titre;
  document.getElementById('modal-confirm-text').textContent = message;
  ok.textContent = libelle;

  return new Promise((resolve) => {
    let reponse = false;
    const observateur = new MutationObserver(() => {
      if (modal.classList.contains('is-open')) return;
      observateur.disconnect();
      ok.removeEventListener('click', surOk);
      if (declencheur && document.contains(declencheur)) declencheur.focus();
      resolve(reponse);
    });
    function surOk() {
      reponse = true;
      modal.classList.remove('is-open');
    }
    ok.addEventListener('click', surOk);
    observateur.observe(modal, { attributes: true, attributeFilter: ['class'] });
    modal.classList.add('is-open');
    modal.querySelector('[data-close-modal]').focus();
  });
}

// Closes a modal through its "Annuler" button so ui.js restores the focus.
export function fermerModal(modal) {
  if (modal.classList.contains('is-open')) modal.querySelector('[data-close-modal]').click();
}
