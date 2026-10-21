// profil.html – SW-04, SW-05, SW-06
import { getProfil, modifierProfil, changerMotDePasse } from '../api/services.js';
import { requireSession, updateUtilisateur } from '../session.js';
import { initSidebar, afficherUtilisateur } from '../components/sidebar.js';
import { toast, toastErreur } from '../components/toast.js';
import { fermerModal } from '../components/confirm.js';
import { afficherErreurs, effacerErreurs, pendantEnvoi, valeur } from '../components/forms.js';
import { remplirAvatar } from '../components/avatar.js';
import { TELEPHONE_RE, motDePasseValide, debounce } from '../format.js';

if (requireSession()) {
  initSidebar({ nav: 'profil' });

  const form = document.getElementById('profile-form');
  const boutonEnregistrer = document.getElementById('btn-save-profile');
  const avatar = document.getElementById('profile-avatar');
  const CHAMPS = ['prenom', 'nom', 'telephone', 'photoProfil'];
  let initial = {};

  const lire = () => Object.fromEntries(CHAMPS.map((c) => [c, valeur(form, c)]));
  const modifie = () => CHAMPS.some((c) => lire()[c] !== (initial[c] || ''));

  function majApercu() {
    remplirAvatar(avatar, { ...lire(), courriel: form.elements.courriel.value });
  }

  function remplir(utilisateur) {
    initial = utilisateur;
    CHAMPS.forEach((c) => (form.elements[c].value = utilisateur[c] || ''));
    form.elements.courriel.value = utilisateur.courriel;
    majApercu();
    boutonEnregistrer.disabled = true;
  }

  async function charger() {
    try {
      remplir(await getProfil());
      document.getElementById('profile-loading').hidden = true;
      form.hidden = false;
    } catch (err) {
      document.getElementById('profile-loading').textContent = err.message;
    }
  }

  // Debounced so the photo is not requested for every typed character
  const majApercuDiffere = debounce(majApercu, 400);
  form.addEventListener('input', () => {
    boutonEnregistrer.disabled = !modifie();
    majApercuDiffere();
  });
  document.getElementById('btn-change-photo').addEventListener('click', () => form.elements.photoProfil.focus());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!modifie()) return;
    effacerErreurs(form);
    const d = lire();
    const details = [];
    if (!d.prenom) details.push({ champ: 'prenom', probleme: 'Le prénom est obligatoire.' });
    if (!d.nom) details.push({ champ: 'nom', probleme: 'Le nom est obligatoire.' });
    if (d.telephone && !TELEPHONE_RE.test(d.telephone)) details.push({ champ: 'telephone', probleme: 'Numéro de téléphone invalide.' });
    if (d.photoProfil && !/^(\/|https?:\/\/)/i.test(d.photoProfil)) {
      details.push({ champ: 'photoProfil', probleme: "L'adresse doit commencer par http://, https:// ou /." });
    }
    if (details.length) {
      afficherErreurs(form, details);
      return;
    }
    await pendantEnvoi(form, async () => {
      try {
        const utilisateur = await modifierProfil({
          prenom: d.prenom,
          nom: d.nom,
          telephone: d.telephone || null,
          photoProfil: d.photoProfil || null,
        });
        remplir(utilisateur);
        updateUtilisateur(utilisateur);
        afficherUtilisateur(utilisateur);
        toast('Profil mis à jour');
      } catch (err) {
        if (!afficherErreurs(form, err.details)) toastErreur(err);
      }
    });
    boutonEnregistrer.disabled = !modifie();
  });

  /* ---------- Password (SW-06) ---------- */

  const formMdp = document.getElementById('password-form');
  document.querySelector('[data-open-modal="modal-password"]').addEventListener('click', () => {
    formMdp.reset();
    effacerErreurs(formMdp);
  });

  formMdp.addEventListener('submit', async (event) => {
    event.preventDefault();
    effacerErreurs(formMdp);
    const ancien = formMdp.elements.ancienMotDePasse.value;
    const nouveau = formMdp.elements.nouveauMotDePasse.value;
    const confirmation = formMdp.elements.confirmation.value;
    const details = [];
    if (!ancien) details.push({ champ: 'ancienMotDePasse', probleme: 'Le mot de passe actuel est obligatoire.' });
    if (!motDePasseValide(nouveau)) details.push({ champ: 'nouveauMotDePasse', probleme: 'Le mot de passe ne respecte pas la règle ci-dessus.' });
    else if (nouveau === ancien) details.push({ champ: 'nouveauMotDePasse', probleme: "Le nouveau mot de passe doit être différent de l'ancien." });
    if (confirmation !== nouveau) details.push({ champ: 'confirmation', probleme: 'Les mots de passe ne correspondent pas.' });
    if (details.length) {
      afficherErreurs(formMdp, details);
      return;
    }
    await pendantEnvoi(formMdp, async () => {
      try {
        await changerMotDePasse(ancien, nouveau);
        fermerModal(formMdp.closest('.modal'));
        toast('Mot de passe modifié');
      } catch (err) {
        if (err.code === 'MOT_DE_PASSE_INCORRECT') {
          afficherErreurs(formMdp, [{ champ: 'ancienMotDePasse', probleme: 'Mot de passe actuel incorrect.' }]);
        } else if (err.code === 'MOT_DE_PASSE_IDENTIQUE') {
          afficherErreurs(formMdp, [{ champ: 'nouveauMotDePasse', probleme: err.message }]);
        } else if (!afficherErreurs(formMdp, err.details)) {
          toastErreur(err);
        }
      }
    });
  });

  charger();
}
