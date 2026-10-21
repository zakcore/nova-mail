// contacts.html – SW-07 to SW-11
import { listerContacts, creerContact, getContact, modifierContact, supprimerContact } from '../api/services.js';
import { requireSession } from '../session.js';
import { initSidebar } from '../components/sidebar.js';
import { toast, toastErreur } from '../components/toast.js';
import { confirmer, fermerModal } from '../components/confirm.js';
import { creerPagination } from '../components/pagination.js';
import { afficherErreurs, effacerErreurs, pendantEnvoi, valeur } from '../components/forms.js';
import { remplirAvatar } from '../components/avatar.js';
import { COURRIEL_RE, TELEPHONE_RE, debounce } from '../format.js';

if (requireSession()) {
  initSidebar({ nav: 'contacts' });

  const liste = document.getElementById('contact-list');
  const template = document.getElementById('contact-row-template');
  const recherche = document.getElementById('search-contacts');
  const etat = { page: 1, recherche: '' };
  let requete = 0;

  const pagination = creerPagination(document.getElementById('pagination'), (page) => {
    etat.page = page;
    charger();
  });

  function ligneEtat(texte, classe) {
    const li = document.createElement('li');
    li.className = classe;
    li.textContent = texte;
    return li;
  }

  function creerLigne(contact) {
    const li = template.content.firstElementChild.cloneNode(true);
    const nomComplet = `${contact.prenom} ${contact.nom}`;
    remplirAvatar(li.querySelector('.avatar'), contact);
    li.querySelector('.contact-name').textContent = nomComplet;
    const courriel = li.querySelector('.contact-email');
    courriel.textContent = contact.courriel;
    courriel.href = `nouveau.html?a=${encodeURIComponent(contact.courriel)}`;
    const t = contact.telephones || {};
    const telephone = t.mobile || t.fixe || t.professionnel;
    li.querySelector('.contact-phone').textContent = telephone ? ` • ${telephone}` : '';

    const modifier = li.querySelector('[data-action="modifier"]');
    modifier.setAttribute('aria-label', `Modifier ${nomComplet}`);
    modifier.addEventListener('click', () => ouvrirModification(contact.idContact));

    const supprimer = li.querySelector('[data-action="supprimer"]');
    supprimer.setAttribute('aria-label', `Supprimer ${nomComplet}`);
    supprimer.addEventListener('click', async () => {
      const ok = await confirmer({ titre: 'Supprimer le contact', message: `Supprimer le contact « ${nomComplet} » ?` });
      if (!ok) return;
      try {
        await supprimerContact(contact.idContact);
        toast('Contact supprimé');
        li.remove();
        if (liste.children.length === 0 && etat.page > 1) etat.page -= 1;
        charger();
      } catch (err) {
        toastErreur(err);
      }
    });
    return li;
  }

  async function charger() {
    const numero = ++requete;
    liste.setAttribute('aria-busy', 'true');
    if (liste.children.length === 0) liste.replaceChildren(ligneEtat('Chargement…', 'list-state'));
    try {
      const res = await listerContacts({ recherche: etat.recherche, page: etat.page, tri: 'nom' });
      if (numero !== requete) return;
      liste.removeAttribute('aria-busy');
      if (res.donnees.length === 0) {
        const vide = etat.recherche
          ? 'Aucun contact ne correspond à votre recherche.'
          : 'Aucun contact. Cliquez sur « + AJOUTER » pour créer votre premier contact.';
        liste.replaceChildren(ligneEtat(vide, 'empty-state'));
      } else {
        liste.replaceChildren(...res.donnees.map(creerLigne));
      }
      pagination.afficher(res.pagination);
    } catch (err) {
      if (numero !== requete) return;
      liste.removeAttribute('aria-busy');
      liste.replaceChildren(ligneEtat(err.message, 'empty-state'));
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

  /* ---------- Contact modals (SW-07 / SW-09 / SW-10) ---------- */

  const formAjout = document.getElementById('modal-contact-form');
  const formModif = document.getElementById('modal-contact-edit-form');
  let idEnModification = null;

  function brancherPhoto(form) {
    const apercu = form.querySelector('[data-role="apercu"]');
    const maj = () =>
      remplirAvatar(apercu, {
        prenom: valeur(form, 'prenom'),
        nom: valeur(form, 'nom'),
        courriel: valeur(form, 'courriel'),
        photoProfil: valeur(form, 'photoProfil'),
      });
    // Debounced so the photo is not requested for every typed character
    const majDiffere = debounce(maj, 400);
    ['prenom', 'nom', 'photoProfil'].forEach((nom) => form.elements[nom].addEventListener('input', majDiffere));
    form.querySelector('[data-role="choisir-photo"]').addEventListener('click', () => form.elements.photoProfil.focus());
    return maj;
  }
  const majApercuAjout = brancherPhoto(formAjout);
  const majApercuModif = brancherPhoto(formModif);

  function lireFormulaire(form) {
    const donnees = {
      prenom: valeur(form, 'prenom'),
      nom: valeur(form, 'nom'),
      courriel: valeur(form, 'courriel'),
      photoProfil: valeur(form, 'photoProfil') || null,
      telephones: {
        mobile: valeur(form, 'mobile') || null,
        fixe: valeur(form, 'fixe') || null,
        professionnel: valeur(form, 'professionnel') || null,
      },
    };
    const details = [];
    if (!donnees.prenom) details.push({ champ: 'prenom', probleme: 'Le prénom est obligatoire.' });
    if (!donnees.nom) details.push({ champ: 'nom', probleme: 'Le nom est obligatoire.' });
    if (!donnees.courriel) details.push({ champ: 'courriel', probleme: "L'adresse courriel est obligatoire." });
    else if (!COURRIEL_RE.test(donnees.courriel)) details.push({ champ: 'courriel', probleme: "Le format de l'adresse courriel est invalide." });
    if (donnees.photoProfil && !/^(\/|https?:\/\/)/i.test(donnees.photoProfil)) {
      details.push({ champ: 'photoProfil', probleme: "L'adresse doit commencer par http://, https:// ou /." });
    }
    for (const [cle, tel] of Object.entries(donnees.telephones)) {
      if (tel && !TELEPHONE_RE.test(tel)) details.push({ champ: cle, probleme: 'Numéro de téléphone invalide.' });
    }
    return { donnees, details };
  }

  async function enregistrer(form, action, messageSucces) {
    effacerErreurs(form);
    const { donnees, details } = lireFormulaire(form);
    if (details.length) {
      afficherErreurs(form, details);
      return;
    }
    await pendantEnvoi(form, async () => {
      try {
        await action(donnees);
        fermerModal(form.closest('.modal'));
        toast(messageSucces);
        charger();
      } catch (err) {
        if (err.code === 'CONTACT_EXISTANT') {
          afficherErreurs(form, [{ champ: 'courriel', probleme: 'Ce courriel existe déjà dans vos contacts.' }]);
        } else if (!afficherErreurs(form, err.details)) {
          toastErreur(err);
        }
      }
    });
  }

  document.getElementById('btn-add-contact').addEventListener('click', () => {
    formAjout.reset();
    effacerErreurs(formAjout);
    majApercuAjout();
  });
  formAjout.addEventListener('submit', (event) => {
    event.preventDefault();
    enregistrer(formAjout, creerContact, 'Contact ajouté');
  });

  async function ouvrirModification(idContact) {
    idEnModification = idContact;
    formModif.reset();
    effacerErreurs(formModif);
    const chargement = formModif.querySelector('[data-role="chargement"]');
    const champs = formModif.querySelectorAll('input, [type="submit"]');
    chargement.hidden = false;
    champs.forEach((c) => (c.disabled = true));
    try {
      const c = await getContact(idContact);
      if (idEnModification !== idContact) return;
      const t = c.telephones || {};
      Object.entries({
        prenom: c.prenom,
        nom: c.nom,
        courriel: c.courriel,
        photoProfil: c.photoProfil,
        mobile: t.mobile,
        fixe: t.fixe,
        professionnel: t.professionnel,
      }).forEach(([nom, v]) => (formModif.elements[nom].value = v || ''));
      majApercuModif();
      chargement.hidden = true;
      champs.forEach((champ) => (champ.disabled = false));
      formModif.elements.prenom.focus();
    } catch (err) {
      fermerModal(formModif.closest('.modal'));
      toastErreur(err);
    }
  }

  formModif.addEventListener('submit', (event) => {
    event.preventDefault();
    // PUT replaces the whole contact: send the complete representation
    enregistrer(formModif, (donnees) => modifierContact(idEnModification, donnees), 'Contact modifié');
  });

  charger();
}
