# Nova Mail

Application de messagerie du « Projet Services Web » : 24 services web REST (Node.js, Express, MySQL) et une interface web en HTML, CSS et JavaScript (sans framework) qui les consomme.

## Prérequis

- Node.js 20 ou plus récent
- MySQL 8

## Installation

```bash
npm install
cp .env.example .env        # puis compléter .env (voir ci-dessous)
npm run db:init             # crée la base messagerie_web et ses données
npm start                   # http://localhost:3000
```

Dans `.env`, au minimum : `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` et un `JWT_SECRET` long et aléatoire, par exemple :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `PORT` | Port HTTP | `3000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Connexion MySQL | `localhost`, `3306`, `root`, vide, `messagerie_web` |
| `DB_SSL` | `true` pour les MySQL hébergés qui exigent TLS | `false` |
| `JWT_SECRET` | Clé de signature des jetons | obligatoire |
| `JWT_EXPIRES_MINUTES` | Durée de validité d'un jeton | `60` |
| `BCRYPT_ROUNDS` | Coût du hachage des mots de passe | `12` |
| `UPLOAD_DIR`, `UPLOAD_MAX_MB` | Dossier et taille maximale des pièces jointes | `uploads`, `10` |
| `CORS_ORIGIN` | Seulement si l'interface est ouverte avec Live Server | vide |

`npm run db:init` exécute `database/script_mysql.sql` (inchangé), remplace les mots de passe d'exemple et affiche le contrôle : 5 utilisateurs, 50 contacts, 15 dossiers, 100 reçus, 50 envoyés. Si l'hébergeur interdit `CREATE DATABASE` : `npm run db:init -- --sans-creation`.

## Comptes de démonstration

Mot de passe commun : **`Nova2026!`**

| Utilisateur | Courriel |
|---|---|
| Alex Moreau | alex.moreau@example.com |
| Sophie Martin | sophie.martin@example.com |
| Karim Diallo | karim.diallo@example.com |
| Emma Roy | emma.roy@example.com |
| Lucas Bernard | lucas.bernard@example.com |

Chaque compte a 10 contacts, 20 messages reçus (8 non lus) et 10 messages envoyés.

## Écrans

L'interface est servie par Express sur la même origine que l'API (`/api/v1`).

| Page | Fonctionnalités | Services |
|---|---|---|
| `index.html` | Se connecter, créer un compte | SW-01, SW-02 |
| `reception.html` | Messages reçus, filtre non lus, recherche, marquer lu / non lu | SW-18, SW-21 |
| `envoyes.html` | Messages envoyés, recherche | SW-19 |
| `message.html?id=…` | Consulter, marquer non lu, classer dans un dossier, supprimer, télécharger les pièces jointes | SW-20, SW-21, SW-16, SW-22, SW-24 |
| `nouveau.html` | Envoyer un message, autocomplétion des contacts, pièces jointes | SW-17, SW-08, SW-23 |
| `dossier.html?id=…` | Contenu d'un dossier, supprimer un dossier personnel | SW-15, SW-14 |
| `contacts.html` | Lister, rechercher, créer, modifier, supprimer les contacts | SW-07 à SW-11 |
| `profil.html` | Modifier son profil, changer son mot de passe | SW-04, SW-05, SW-06 |
| Menu latéral (toutes les pages) | Dossiers et compteurs, créer un dossier, déconnexion | SW-13, SW-12, SW-03 |

## Services web

Base : `/api/v1`. Toutes les routes sauf SW-01 et SW-02 exigent `Authorization: Bearer <jeton>`.

| Id | Méthode et URI | Succès |
|---|---|---|
| SW-01 | `POST /utilisateurs` | 201 |
| SW-02 | `POST /auth/connexion` | 200 |
| SW-03 | `POST /auth/deconnexion` | 204 |
| SW-04 | `GET /utilisateurs/moi` | 200 |
| SW-05 | `PUT /utilisateurs/moi` | 200 |
| SW-06 | `PUT /utilisateurs/moi/mot-de-passe` | 204 |
| SW-07 | `POST /contacts` | 201 |
| SW-08 | `GET /contacts?recherche=&page=&taille=&tri=` | 200 |
| SW-09 | `GET /contacts/{idContact}` | 200 |
| SW-10 | `PUT /contacts/{idContact}` | 200 |
| SW-11 | `DELETE /contacts/{idContact}` | 204 |
| SW-12 | `POST /dossiers` | 201 |
| SW-13 | `GET /dossiers` | 200 |
| SW-14 | `DELETE /dossiers/{idDossier}` | 204 |
| SW-15 | `GET /dossiers/{idDossier}/messages` | 200 |
| SW-16 | `PUT /dossiers/{idDossier}/messages/{idMessage}` | 204 |
| SW-17 | `POST /messages` | 201 |
| SW-18 | `GET /messages?boite=reception&etat=&recherche=` | 200 |
| SW-19 | `GET /messages?boite=envoi&recherche=` | 200 |
| SW-20 | `GET /messages/{idMessage}` | 200 |
| SW-21 | `PATCH /messages/{idMessage}/etat` | 200 |
| SW-22 | `DELETE /messages/{idMessage}` | 204 |
| SW-23 | `POST /pieces-jointes` (multipart, champ `fichier`) | 201 |
| SW-24 | `GET /messages/{idMessage}/pieces-jointes/{idPiece}` | 200 |

Toute erreur renvoie `{ "erreur": { "code", "message", "details"? } }` avec un message en français.

## Tests

### Tests automatisés (Jest + Supertest)

```bash
npm test
```

Les tests utilisent une base séparée, `messagerie_web_test`, recréée au début de chaque fichier (les paramètres de test sont dans `tests/setup/env.js`). Un fichier par famille : `auth`, `utilisateurs`, `contacts`, `dossiers`, `messages`, `pieces`, `securite`.

### Collection Postman

- `postman/nova-mail.postman_collection.json` et `postman/nova-mail.postman_environment.json`
- Importer les deux fichiers, choisir l'environnement « Nova Mail – local », puis lancer la collection dans le Collection Runner, dans l'ordre, après `npm run db:init`.
- La collection peut être relancée plusieurs fois de suite : les valeurs uniques sont générées et tout ce qu'elle crée est supprimé (sauf le compte de test).
- SW-23 envoie `postman/fichiers/exemple.pdf` ; dans l'application Postman, il peut falloir sélectionner ce fichier à nouveau dans l'onglet Body.

En ligne de commande :

```bash
npx newman run postman/nova-mail.postman_collection.json -e postman/nova-mail.postman_environment.json
```

Pour une autre adresse : `--env-var baseUrl=https://…/api/v1`.

## Structure

```
database/        script MySQL (inchangé) et init.js
src/             app.js, server.js, config, db, errors
  middleware/    auth (JWT), upload (multer)
  routes/        une route par service, commentée // SW-xx
  services/      règles et SQL, un fichier par ressource
  utils/         validation, pagination, conversion des lignes en JSON
public/          interface web (HTML, CSS, js/api, js/components, js/pages)
tests/           tests Jest
postman/         collection, environnement et fichier d'exemple
```

## Publication

Version en ligne : **https://nova-mail-dz7s.onrender.com** (Render + Aiven for MySQL). Détails, redéploiement et limites : `PUBLICATION.md`.
