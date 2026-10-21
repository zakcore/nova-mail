// One function per web service (SW-01 to SW-24).
import { request, telecharger } from './client.js';

const enc = encodeURIComponent;

// SW-01
export const creerCompte = (data) => request('POST', '/utilisateurs', { body: data });
// SW-02
export const seConnecter = (courriel, motDePasse) => request('POST', '/auth/connexion', { body: { courriel, motDePasse } });
// SW-03
export const seDeconnecter = () => request('POST', '/auth/deconnexion');
// SW-04
export const getProfil = () => request('GET', '/utilisateurs/moi');
// SW-05
export const modifierProfil = (data) => request('PUT', '/utilisateurs/moi', { body: data });
// SW-06
export const changerMotDePasse = (ancienMotDePasse, nouveauMotDePasse) =>
  request('PUT', '/utilisateurs/moi/mot-de-passe', { body: { ancienMotDePasse, nouveauMotDePasse } });

// SW-07
export const creerContact = (data) => request('POST', '/contacts', { body: data });
// SW-08
export const listerContacts = ({ recherche, page, taille, tri } = {}) =>
  request('GET', '/contacts', { query: { recherche, page, taille, tri } });
// SW-09
export const getContact = (id) => request('GET', `/contacts/${enc(id)}`);
// SW-10
export const modifierContact = (id, data) => request('PUT', `/contacts/${enc(id)}`, { body: data });
// SW-11
export const supprimerContact = (id) => request('DELETE', `/contacts/${enc(id)}`);

// SW-12
export const creerDossier = (nom) => request('POST', '/dossiers', { body: { nom } });
// SW-13
export const listerDossiers = () => request('GET', '/dossiers');
// SW-14
export const supprimerDossier = (id) => request('DELETE', `/dossiers/${enc(id)}`);
// SW-15
export const listerMessagesDossier = (id, { page, taille, tri } = {}) =>
  request('GET', `/dossiers/${enc(id)}/messages`, { query: { page, taille, tri } });
// SW-16
export const ajouterMessageADossier = (idDossier, idMessage) =>
  request('PUT', `/dossiers/${enc(idDossier)}/messages/${enc(idMessage)}`);

// SW-17
export const envoyerMessage = ({ destinataires, objet, contenu, piecesJointes }) =>
  request('POST', '/messages', { body: { destinataires, objet, contenu, piecesJointes } });
// SW-18
export const listerMessagesRecus = ({ etat, recherche, page, taille, tri } = {}) =>
  request('GET', '/messages', { query: { boite: 'reception', etat, recherche, page, taille, tri } });
// SW-19
export const listerMessagesEnvoyes = ({ recherche, page, taille, tri } = {}) =>
  request('GET', '/messages', { query: { boite: 'envoi', recherche, page, taille, tri } });
// SW-20
export const getMessage = (id) => request('GET', `/messages/${enc(id)}`);
// SW-21
export const marquerLu = (id, lu) => request('PATCH', `/messages/${enc(id)}/etat`, { body: { lu } });
// SW-22
export const supprimerMessage = (id) => request('DELETE', `/messages/${enc(id)}`);

// SW-23
export function televerserPieceJointe(fichier) {
  const form = new FormData();
  form.append('fichier', fichier);
  return request('POST', '/pieces-jointes', { form });
}
// SW-24 (url as returned by SW-20 in piecesJointes[].url)
export const telechargerPieceJointe = (url, nomFichier) => telecharger(url, nomFichier);
