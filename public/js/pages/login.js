// index.html – SW-02 (connexion) and SW-01 (création de compte)
import { seConnecter, creerCompte } from '../api/services.js';
import { getSession, saveSession } from '../session.js';
import { toastErreur, toastApresNavigation, afficherToastDiffere } from '../components/toast.js';
import { afficherErreurs, effacerErreurs, pendantEnvoi, valeur } from '../components/forms.js';
import { COURRIEL_RE, TELEPHONE_RE, motDePasseValide } from '../format.js';

if (getSession()) window.location.replace('reception.html');

afficherToastDiffere();
if (new URLSearchParams(window.location.search).get('expire') === '1') {
  document.getElementById('session-expired').hidden = false;
}

async function connecter(courriel, motDePasse) {
  const session = await seConnecter(courriel, motDePasse);
  saveSession(session);
}

/* ---------- Connexion ---------- */

const loginForm = document.getElementById('login-form');
const loginErreur = document.getElementById('login-error');
const loginBouton = loginForm.querySelector('[type="submit"]');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  effacerErreurs(loginForm);
  loginErreur.hidden = true;

  const courriel = valeur(loginForm, 'courriel');
  const motDePasse = loginForm.elements.motDePasse.value;
  const details = [];
  if (!courriel) details.push({ champ: 'courriel', probleme: "L'adresse courriel est obligatoire." });
  else if (!COURRIEL_RE.test(courriel)) details.push({ champ: 'courriel', probleme: "Le format de l'adresse courriel est invalide." });
  if (!motDePasse) details.push({ champ: 'motDePasse', probleme: 'Le mot de passe est obligatoire.' });
  if (details.length) {
    afficherErreurs(loginForm, details);
    return;
  }

  loginBouton.textContent = 'Connexion…';
  await pendantEnvoi(loginForm, async () => {
    try {
      await connecter(courriel, motDePasse);
      window.location.href = 'reception.html';
    } catch (err) {
      if (err.status === 401) {
        loginErreur.textContent = 'Courriel ou mot de passe incorrect.';
        loginErreur.hidden = false;
      } else if (!afficherErreurs(loginForm, err.details)) {
        toastErreur(err);
      }
    }
  });
  loginBouton.textContent = 'Se connecter';
});

/* ---------- Création de compte ---------- */

const signupForm = document.getElementById('signup-form');
const signupBouton = signupForm.querySelector('[type="submit"]');

function validerInscription(d) {
  const details = [];
  if (!d.prenom) details.push({ champ: 'prenom', probleme: 'Le prénom est obligatoire.' });
  if (!d.nom) details.push({ champ: 'nom', probleme: 'Le nom est obligatoire.' });
  if (!d.courriel) details.push({ champ: 'courriel', probleme: "L'adresse courriel est obligatoire." });
  else if (!COURRIEL_RE.test(d.courriel)) details.push({ champ: 'courriel', probleme: "Le format de l'adresse courriel est invalide." });
  if (d.telephone && !TELEPHONE_RE.test(d.telephone)) {
    details.push({ champ: 'telephone', probleme: 'Le numéro de téléphone est invalide (7 à 20 chiffres, espaces, +, -, parenthèses).' });
  }
  if (!motDePasseValide(d.motDePasse)) {
    details.push({ champ: 'motDePasse', probleme: 'Le mot de passe ne respecte pas la règle ci-dessus.' });
  }
  if (d.confirmation !== d.motDePasse) {
    details.push({ champ: 'confirmation', probleme: 'Les mots de passe ne correspondent pas.' });
  }
  return details;
}

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  effacerErreurs(signupForm);

  const donnees = {
    prenom: valeur(signupForm, 'prenom'),
    nom: valeur(signupForm, 'nom'),
    courriel: valeur(signupForm, 'courriel'),
    telephone: valeur(signupForm, 'telephone') || null,
    motDePasse: signupForm.elements.motDePasse.value,
    confirmation: signupForm.elements.confirmation.value,
  };
  const details = validerInscription(donnees);
  if (details.length) {
    afficherErreurs(signupForm, details);
    return;
  }

  signupBouton.textContent = 'Création…';
  await pendantEnvoi(signupForm, async () => {
    try {
      const { confirmation, ...compte } = donnees;
      await creerCompte(compte);
      await connecter(compte.courriel, compte.motDePasse);
      toastApresNavigation('Bienvenue dans Nova Mail !');
      window.location.href = 'reception.html';
    } catch (err) {
      if (err.code === 'COURRIEL_DEJA_UTILISE') {
        afficherErreurs(signupForm, [{ champ: 'courriel', probleme: 'Un compte utilise déjà cette adresse courriel.' }]);
      } else if (!afficherErreurs(signupForm, err.details)) {
        toastErreur(err);
      }
    }
  });
  signupBouton.textContent = 'Créer mon compte';
});
