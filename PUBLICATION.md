# Publication – Nova Mail

## Adresse publique

**https://nova-mail-dz7s.onrender.com**

Une seule adresse HTTPS sert le site web et l'API :

- Site : https://nova-mail-dz7s.onrender.com/
- API : https://nova-mail-dz7s.onrender.com/api/v1

Code source : https://github.com/zakcore/nova-mail

## Hébergement

| Élément | Fournisseur | Offre |
|---|---|---|
| Application Node.js (site + API) | [Render](https://render.com), service web, région Virginia (US East) | Gratuite : 0,1 CPU, 512 Mo |
| Base MySQL 8.4 | [Aiven for MySQL](https://aiven.io/free-mysql-database), DigitalOcean New York | Gratuite : 1 CPU, 1 Go RAM, 1 Go de stockage |

Pourquoi ce choix plutôt que Railway : l'offre Railway ne donne qu'un crédit d'essai unique de 5 $, puis 1 $ d'utilisation par mois, ce qui ne suffit pas à garder un service Node et une base MySQL en ligne pendant la correction. Render et Aiven ont chacun une offre gratuite sans limite de durée (offres vérifiées en octobre 2026).

La connexion à MySQL est chiffrée (TLS) et le certificat du serveur est vérifié avec l'autorité de certification du projet Aiven (`DB_SSL_CA`).

## Comptes de démonstration

Mot de passe commun : **`Nova2026!`**

| Utilisateur | Courriel |
|---|---|
| Alex Moreau | alex.moreau@example.com |
| Sophie Martin | sophie.martin@example.com |
| Karim Diallo | karim.diallo@example.com |
| Emma Roy | emma.roy@example.com |
| Lucas Bernard | lucas.bernard@example.com |

## Variables d'environnement sur Render

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=messagerie_web`, `DB_SSL=true`, `DB_SSL_CA` (certificat Aiven sur une ligne, avec `\n`), `JWT_SECRET` (valeur aléatoire propre à la production), `JWT_EXPIRES_MINUTES=60`, `BCRYPT_ROUNDS=10`, `UPLOAD_DIR=uploads`, `UPLOAD_MAX_MB=10`. `PORT` est fourni par Render ; `CORS_ORIGIN` n'est pas utilisé (site et API sur la même origine).

`BCRYPT_ROUNDS` vaut 10 en production (12 en local) : l'instance gratuite n'a que 0,1 CPU et `bcryptjs` hache en JavaScript, un coût de 12 rendrait chaque connexion lente. Un coût de 10 reste conforme au minimum recommandé par l'OWASP.

## Redéployer

- **Code** : chaque `git push` sur `main` redéploie automatiquement le service (Auto-Deploy « On Commit »). Sinon : tableau de bord Render → service `nova-mail` → *Manual Deploy* → *Deploy latest commit*.
- **Variables** : tableau de bord Render → *Environment*, puis enregistrer (un redéploiement suit).
- **Réinitialiser les données** : depuis un poste local, avec un fichier `.env` pointant vers la base Aiven (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=messagerie_web`, `DB_SSL=true`, `DB_SSL_CA=ca.pem`, `BCRYPT_ROUNDS=10`) :

  ```bash
  npm run db:init
  ```

  Le certificat `ca.pem` se télécharge dans la console Aiven (service MySQL → *Overview* → *CA certificate*).

## Limites connues

- **Mise en veille** : l'instance gratuite de Render s'arrête après environ 15 minutes sans trafic. La première visite suivante prend de 30 à 60 secondes, le temps du redémarrage ; ouvrir le site une minute avant une démonstration.
- **Pièces jointes temporaires** : le disque de Render n'est pas persistant. Les fichiers joints sont effacés à chaque redéploiement, redémarrage ou mise en veille ; le message reste, mais le téléchargement de sa pièce jointe renvoie alors 404. Acceptable pour un projet de cours ; une version de production stockerait les fichiers dans un service d'objets (S3 ou équivalent).
- **Base gratuite Aiven** : 1 Go de stockage, un seul nœud (pas de haute disponibilité). Aiven peut éteindre un service gratuit inactif longtemps, après un courriel d'avertissement ; il se rallume depuis la console.
- **Photos de profil** : les chemins du jeu de données (`/images/profils/…`) n'existent pas ; l'interface affiche alors les initiales.

## Dernière vérification

**21 octobre 2026, 05 h 30 UTC**, contre https://nova-mail-dz7s.onrender.com/api/v1 :

- Collection Postman (Newman), exécutée deux fois de suite : 43 requêtes, 79 assertions, **0 échec** à chaque exécution.
- Parcours complet dans un navigateur (connexion, boîte de réception, lecture, envoi avec pièce jointe vers Sophie et téléchargement par Sophie, dossiers, contacts, profil, session expirée, création de compte, affichage à 375 px) : 60 vérifications, **toutes réussies**.
- Les données ont ensuite été réinitialisées (`npm run db:init`) : 5 utilisateurs, 50 contacts, 15 dossiers, 100 reçus, 50 envoyés.

```bash
npx newman run postman/nova-mail.postman_collection.json -e postman/nova-mail.postman_environment.json --env-var baseUrl=https://nova-mail-dz7s.onrender.com/api/v1
```
