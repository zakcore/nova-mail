# Nova Mail – Web Services, Tests, Consumption and Publication (spec for Claude Code)

This file is the specification for the **remaining steps** of the "Projet Services Web" course project (messaging application "Nova Mail"). Read it fully before writing code, then follow the phases in section 11. All text visible to the user (UI labels, error messages returned by the API) **must be in French**. Code, file names and comments may be in English.

---

## 0. Context

### 0.1 Already done – do NOT change

| Deliverable | Where | Rule |
|---|---|---|
| Functionality list (16 items) | section 0.3 | Implement exactly these. |
| MySQL script (tables + data) | `database/script_mysql.sql` | Use as is. Do not alter tables or data. |
| MongoDB script | separate deliverable | Not used by the services. |
| Web services design (24 services) | section 6 | It is the contract: URIs, methods, field names, status codes. Do not rename anything. |
| User interface (static HTML/CSS) | `public/` | Keep the look. Only wire it to the API (section 9). |

### 0.2 What is left (this file)

| Step | Points | Section |
|---|---|---|
| Développement des services web | 30 | 3 to 7 |
| Tests des services web | 5 | 8 |
| Consommation des services web | 20 | 9 |
| Publication des services web et du site web | 5 | 10 |

### 0.3 The 16 functionalities

Créer un compte · Se connecter · Modifier son profil · Envoyer un message · Afficher la liste des messages reçus · Afficher la liste des messages envoyés · Consulter un message · Marquer un message comme lu ou non lu · Créer un dossier · Ajouter un message à un dossier · Supprimer un dossier · Afficher le contenu d'un dossier · Créer un contact · Modifier les informations d'un contact · Lister les contacts · Supprimer les contacts.

Bonus from the project statement: attachments (pièces jointes).

### 0.4 Out of scope

Drafts (brouillons), "mot de passe oublié", reply/forward, real SMTP delivery to external domains, photo upload (photos are URLs), any endpoint not listed in section 6.

---

## 1. Stack

- **Node.js 20 LTS** or newer, **Express 4**, CommonJS modules.
- **MySQL 8** through `mysql2/promise` (connection pool, parameterized queries only).
- Dependencies (keep to this list): `express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `multer`, `dotenv`, `cors`.
- Dev dependencies: `jest`, `supertest`.
- No ORM, no TypeScript, no front-end framework.

Why `bcryptjs` and not `bcrypt`: no native build, works on Windows lab machines.

---

## 2. Project structure

Start by moving the existing files into this layout (section 11, phase 1):

```
nova-mail/
├── CLAUDE.md                      # this file
├── README.md                      # how to install, run, test, deploy (written in phase 7)
├── PUBLICATION.md                 # public URL + demo accounts (written in phase 6)
├── package.json
├── .env.example
├── .gitignore                     # node_modules, .env, uploads/
├── database/
│   ├── script_mysql.sql           # the existing MySQL script, unchanged
│   └── init.js                    # npm run db:init (section 4.2)
├── src/
│   ├── server.js                  # starts the HTTP server
│   ├── app.js                     # builds the Express app (exported for tests)
│   ├── config.js                  # reads .env
│   ├── db.js                      # mysql2 pool + transaction helper
│   ├── errors.js                  # ApiError + error-handling middleware
│   ├── middleware/
│   │   ├── auth.js                # JWT verification (section 5.4)
│   │   └── upload.js              # multer config (section 6.6)
│   ├── utils/
│   │   ├── validators.js          # email, phone, password, lengths
│   │   ├── mappers.js             # DB row → JSON (section 5.2)
│   │   └── pagination.js          # page/taille/tri parsing (section 5.3)
│   ├── routes/
│   │   ├── auth.routes.js         # SW-02, SW-03
│   │   ├── utilisateurs.routes.js # SW-01, SW-04, SW-05, SW-06
│   │   ├── contacts.routes.js     # SW-07 to SW-11
│   │   ├── dossiers.routes.js     # SW-12 to SW-16
│   │   ├── messages.routes.js     # SW-17 to SW-22, SW-24
│   │   └── pieces.routes.js       # SW-23
│   └── services/                  # business logic + SQL, one file per resource
│       ├── utilisateurs.service.js
│       ├── contacts.service.js
│       ├── dossiers.service.js
│       ├── messages.service.js
│       └── pieces.service.js
├── uploads/                       # stored attachment files (git-ignored)
├── tests/
│   ├── setup/                     # test database reset, helpers
│   └── *.test.js                  # one file per family (section 8)
├── postman/
│   ├── nova-mail.postman_collection.json
│   └── nova-mail.postman_environment.json
└── public/                        # the existing UI (section 9)
```

Routes only read the request, call a service, and send the response. Services contain the rules and the SQL. Every service function takes `idUtilisateur` (from the token) as its first argument.

---

## 3. Configuration

`.env.example`:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=messagerie_web
DB_SSL=false
JWT_SECRET=change-me-with-a-long-random-string
JWT_EXPIRES_MINUTES=60
BCRYPT_ROUNDS=12
UPLOAD_DIR=uploads
UPLOAD_MAX_MB=10
CORS_ORIGIN=http://127.0.0.1:5500
```

- `config.js` fails at startup with a clear message if `JWT_SECRET` or `DB_*` are missing.
- `DB_SSL=true` enables `ssl: { rejectUnauthorized: true }` in the pool (needed by most hosted MySQL providers).
- `CORS_ORIGIN` is only for development when the UI is opened with Live Server. In production the UI is served by Express on the same origin.

`package.json` scripts:

```json
{
  "start": "node src/server.js",
  "dev": "node --watch src/server.js",
  "db:init": "node database/init.js",
  "test": "jest --runInBand"
}
```

---

## 4. Database

### 4.1 Pool (`src/db.js`)

- `mysql2/promise` pool with `timezone: 'Z'`, `charset: 'utf8mb4'`, `connectionLimit: 10`.
- On each new connection run `SET time_zone = '+00:00'`. All dates are stored and returned in UTC.
- New dates are written with `UTC_TIMESTAMP()`.
- Export `query(sql, params)` and `transaction(async (conn) => { ... })` (begin, commit, rollback on error, always release).
- Every SQL statement uses `?` placeholders. Never concatenate user input into SQL. Sort columns come from a whitelist (section 5.3).

### 4.2 Initialization (`database/init.js`, `npm run db:init`)

1. Read `database/script_mysql.sql`.
2. If `DB_NAME` is not `messagerie_web`, replace every occurrence of `messagerie_web` in the script text with `DB_NAME` (used for the test database and some hosts).
3. Connect **without** a default database, with `multipleStatements: true`, and execute the script.
4. The script stores placeholder hashes (`$2b$12$EXEMPLEHASH…`) that are not valid bcrypt hashes. Replace them: `UPDATE utilisateurs SET mot_de_passe_hash = ?` with `bcrypt.hash('Nova2026!', BCRYPT_ROUNDS)`.
5. Print the control counts: 5 utilisateurs, 50 contacts, 15 dossiers, 100 reçus, 50 envoyés.

Demo accounts after init: the 5 users of the script (`alex.moreau@example.com`, `sophie.martin@example.com`, `karim.diallo@example.com`, `emma.roy@example.com`, `lucas.bernard@example.com`), password **`Nova2026!`**.

Some hosted MySQL services forbid `DROP DATABASE` / `CREATE DATABASE`. In that case `init.js` accepts `--sans-creation`: it removes the `DROP DATABASE`, `CREATE DATABASE` and `USE` lines, adds `DROP TABLE IF EXISTS` for the 5 tables right after `SET FOREIGN_KEY_CHECKS = 0;`, and runs the rest on the database given by `DB_NAME`.

Export `initialiser({ nomBase, rounds, silencieux })` from `init.js` so the tests can reuse it (section 8.1), and only run it from the command line when `require.main === module`.

The script file uses Windows line endings (`\r\n`): normalize them to `\n` before editing its text.

### 4.3 Schema reminder (from the script)

- `utilisateurs(id_utilisateur, courriel UNIQUE, mot_de_passe_hash, nom, prenom, photo_profil, telephone, cree_le, modifie_le)`
- `contacts(id_contact, id_utilisateur, nom, prenom, courriel, photo_profil, telephone_mobile, telephone_fixe, telephone_pro, cree_le)`, unique `(id_utilisateur, courriel)`
- `dossiers(id_dossier, id_utilisateur, nom, type ENUM('systeme','personnel'), cree_le)`, unique `(id_utilisateur, nom)`
- `messages(id_message, id_utilisateur, id_dossier NULL, expediteur_courriel, destinataire_courriel, objet, contenu, direction ENUM('recu','envoye'), etat ENUM('envoye','recu','lu'), envoye_le)`
- `pieces_jointes(id_piece, id_message NOT NULL, nom_fichier, type_mime, taille_octets, chemin_stockage)`

A message row belongs to **one** user (`id_utilisateur`): the sender's copy and the recipient's copy are two different rows. `etat = 'recu'` means "received and not read".

---

## 5. API conventions

### 5.1 General

- Base path: `/api/v1`. JSON in UTF-8. `express.json({ limit: '1mb' })`.
- Dates in ISO 8601 UTC: `2026-08-03T14:30:00.000Z`.
- `201` responses for creations also set `Location` (for example `/api/v1/contacts/51`).
- `204` responses have no body.
- Every request except SW-01 and SW-02 requires `Authorization: Bearer <jeton>`.

### 5.2 Field mapping (`utils/mappers.js`)

DB columns are snake_case, the API is camelCase. Never return `mot_de_passe_hash` or `chemin_stockage`.

**Utilisateur**

```json
{ "idUtilisateur": 1, "courriel": "alex.moreau@example.com", "nom": "Moreau", "prenom": "Alex",
  "photoProfil": "/images/profils/user1.jpg", "telephone": "+1 514 555-1001",
  "creeLe": "2026-08-01T12:00:00.000Z" }
```

**Contact** (the three phone columns are grouped)

```json
{ "idContact": 1, "nom": "Contact1", "prenom": "Utilisateur1", "courriel": "contact1_1@example.net",
  "photoProfil": "/images/contacts/c1_1.jpg",
  "telephones": { "mobile": "+1 438 555-1001", "fixe": "+1 514 555-1001", "professionnel": "+1 450 555-1001" } }
```

**Dossier** (`nbMessages`, `nbNonLus` are computed, section 6.4)

```json
{ "idDossier": 1, "nom": "Réception", "type": "systeme", "nbMessages": 20, "nbNonLus": 8 }
```

**Message, list item**

```json
{ "idMessage": 20,
  "expediteur":   { "courriel": "contact1_10@example.net", "nom": null, "prenom": null },
  "destinataire": { "courriel": "alex.moreau@example.com", "nom": "Moreau", "prenom": "Alex" },
  "objet": "Message reçu 20", "extrait": "Contenu du message reçu numéro 20 pour utilisateur 1.",
  "direction": "recu", "etat": "recu", "envoyeLe": "2026-08-03T20:00:00.000Z",
  "idDossier": 1, "nbPiecesJointes": 0 }
```

**Message, full** (SW-20): same as the list item but `contenu` replaces `extrait`, and `piecesJointes` replaces `nbPiecesJointes`:

```json
"piecesJointes": [ { "idPiece": 7, "nomFichier": "rapport.pdf", "typeMime": "application/pdf",
                     "tailleOctets": 184320, "url": "/api/v1/messages/21/pieces-jointes/7" } ]
```

Rules:
- `extrait`: first 150 characters of `contenu`, cut on a word boundary, followed by `…` when cut.
- Names in `expediteur` / `destinataire`: look up the email in `utilisateurs` first, then in the current user's `contacts`; if not found, `nom` and `prenom` are `null`. Do it in SQL with `LEFT JOIN`s, not one query per row.

### 5.3 Collections, pagination, sort, search

Every collection returns:

```json
{ "donnees": [ ... ], "pagination": { "page": 1, "taille": 20, "total": 100, "nbPages": 5 } }
```

- `page`: integer ≥ 1, default 1.
- `taille`: integer 1 to 100, default 20.
- `nbPages`: `Math.max(1, Math.ceil(total / taille))`.
- `tri`: a field name, `-` prefix for descending. Allowed values only (anything else → 400):
  - messages: `envoyeLe` (default `-envoyeLe`), `objet`;
  - contacts: `nom` (default, secondary sort `prenom`), `prenom`, `courriel`.
- `recherche`: trimmed, case-insensitive `LIKE '%…%'` (escape `%` and `_`): on `objet` + `contenu` for messages, on `nom` + `prenom` + `courriel` for contacts.
- SW-13 (dossiers) is not paginated but uses the same `{ "donnees": [...] }` envelope.

Invalid `page`, `taille`, `tri`, `boite` or `etat` → 400 `PARAMETRE_INVALIDE`.

### 5.4 Authentication (`middleware/auth.js`)

- SW-02 issues a JWT (HS256, `JWT_SECRET`) with payload `{ idUtilisateur, courriel }`, a random `jti` (`crypto.randomUUID()`), and expiry `JWT_EXPIRES_MINUTES`.
- The middleware reads `Authorization: Bearer <jeton>`:
  - missing or not Bearer → 401 `JETON_ABSENT`;
  - invalid signature, expired, or `jti` revoked → 401 `JETON_INVALIDE`;
  - user no longer exists → 401 `JETON_INVALIDE`.
- On success, `req.utilisateur = { idUtilisateur, courriel, jti, exp }`.
- Revocation (SW-03): an in-memory `Map(jti → exp)`; expired entries are purged every 10 minutes. Losing it on restart is acceptable (tokens expire after 60 minutes).

### 5.5 Ownership rule

Every query on contacts, dossiers, messages and pièces jointes filters on `id_utilisateur = req.utilisateur.idUtilisateur`. A resource that exists but belongs to another user returns **404**, never 403, so its existence is not revealed.

### 5.6 Errors (`errors.js`)

Every non-2xx response has this body:

```json
{ "erreur": { "code": "VALIDATION_ECHOUEE", "message": "Les données envoyées sont invalides.",
              "details": [ { "champ": "courriel", "probleme": "Le format de l'adresse courriel est invalide." } ] } }
```

`details` is present only for validation errors. Codes:

| Status | Code | Message (French, returned to the client) |
|---|---|---|
| 400 | `VALIDATION_ECHOUEE` | Les données envoyées sont invalides. |
| 400 | `PARAMETRE_INVALIDE` | Un paramètre de la requête est invalide. |
| 400 | `JSON_INVALIDE` | Le corps de la requête n'est pas un JSON valide. |
| 400 | `ETAT_NON_APPLICABLE` | Seuls les messages reçus peuvent être marqués comme lus ou non lus. |
| 400 | `DEPLACEMENT_INVALIDE` | Ce message ne peut pas être placé dans ce dossier. |
| 400 | `PIECE_JOINTE_INVALIDE` | Une pièce jointe est introuvable ou expirée. |
| 400 | `MOT_DE_PASSE_IDENTIQUE` | Le nouveau mot de passe doit être différent de l'ancien. |
| 401 | `JETON_ABSENT` | Authentification requise. |
| 401 | `JETON_INVALIDE` | Votre session a expiré. Veuillez vous reconnecter. |
| 401 | `IDENTIFIANTS_INVALIDES` | Courriel ou mot de passe incorrect. |
| 401 | `MOT_DE_PASSE_INCORRECT` | Le mot de passe actuel est incorrect. |
| 403 | `DOSSIER_SYSTEME` | Les dossiers système ne peuvent pas être modifiés ni supprimés. |
| 404 | `RESSOURCE_INTROUVABLE` | L'élément demandé est introuvable. |
| 409 | `COURRIEL_DEJA_UTILISE` | Un compte utilise déjà cette adresse courriel. |
| 409 | `CONTACT_EXISTANT` | Ce courriel existe déjà dans vos contacts. |
| 409 | `DOSSIER_EXISTANT` | Un dossier porte déjà ce nom. |
| 413 | `FICHIER_TROP_VOLUMINEUX` | Le fichier dépasse la taille maximale de 10 Mo. |
| 415 | `TYPE_NON_SUPPORTE` | Ce type de fichier n'est pas accepté. |
| 500 | `ERREUR_INTERNE` | Une erreur est survenue sur le serveur. |

- `ApiError(status, code, message?, details?)` uses the table message when `message` is omitted.
- The error middleware also maps: JSON parse errors → `JSON_INVALIDE`; multer `LIMIT_FILE_SIZE` → 413; MySQL `ER_DUP_ENTRY` → 409 with the code of the resource (fallback safety; services should check first); anything else → 500, logging the stack on the server only.
- Unknown routes under `/api` → 404 `RESSOURCE_INTROUVABLE`.

### 5.7 Validation rules (`utils/validators.js`)

Collect **all** field errors of a request and return them together in `details`.

| Field | Rule |
|---|---|
| courriel | required, trimmed, lower-cased, `^[^@\s]+@[^@\s]+\.[^@\s]+$`, max 190 |
| motDePasse | min 8 characters, at least one uppercase, one lowercase, one digit |
| nom, prenom | required, trimmed, 1 to 80 characters |
| telephone, mobile, fixe, professionnel | optional (`null` or empty → `null`), `^[0-9 +()\-]{7,20}$` |
| photoProfil | optional, max 255, must start with `/` or `http://` or `https://` |
| objet | required, trimmed, 1 to 255 |
| contenu | required, not empty after trim |
| destinataires | array of 1 to 20 valid emails, duplicates removed |
| nom du dossier | required, trimmed, 1 to 80 |
| ids in the path | positive integers, otherwise 404 |

Unknown body fields are ignored.

---

## 6. The 24 web services

| Id | Method | URI | Success | Token |
|---|---|---|---|---|
| SW-01 | POST | `/utilisateurs` | 201 | No |
| SW-02 | POST | `/auth/connexion` | 200 | No |
| SW-03 | POST | `/auth/deconnexion` | 204 | Yes |
| SW-04 | GET | `/utilisateurs/moi` | 200 | Yes |
| SW-05 | PUT | `/utilisateurs/moi` | 200 | Yes |
| SW-06 | PUT | `/utilisateurs/moi/mot-de-passe` | 204 | Yes |
| SW-07 | POST | `/contacts` | 201 | Yes |
| SW-08 | GET | `/contacts` | 200 | Yes |
| SW-09 | GET | `/contacts/{idContact}` | 200 | Yes |
| SW-10 | PUT | `/contacts/{idContact}` | 200 | Yes |
| SW-11 | DELETE | `/contacts/{idContact}` | 204 | Yes |
| SW-12 | POST | `/dossiers` | 201 | Yes |
| SW-13 | GET | `/dossiers` | 200 | Yes |
| SW-14 | DELETE | `/dossiers/{idDossier}` | 204 | Yes |
| SW-15 | GET | `/dossiers/{idDossier}/messages` | 200 | Yes |
| SW-16 | PUT | `/dossiers/{idDossier}/messages/{idMessage}` | 204 | Yes |
| SW-17 | POST | `/messages` | 201 | Yes |
| SW-18 | GET | `/messages?boite=reception` | 200 | Yes |
| SW-19 | GET | `/messages?boite=envoi` | 200 | Yes |
| SW-20 | GET | `/messages/{idMessage}` | 200 | Yes |
| SW-21 | PATCH | `/messages/{idMessage}/etat` | 200 | Yes |
| SW-22 | DELETE | `/messages/{idMessage}` | 204 | Yes |
| SW-23 | POST | `/pieces-jointes` | 201 | Yes |
| SW-24 | GET | `/messages/{idMessage}/pieces-jointes/{idPiece}` | 200 | Yes |

Add a comment `// SW-xx` above each route handler.

### 6.1 Accounts and authentication

**SW-01 – Créer un compte**
- Body: `{ courriel, motDePasse, nom, prenom, telephone? }`. Validate (5.7).
- 409 `COURRIEL_DEJA_UTILISE` if the email exists.
- In one transaction: insert the user with `bcrypt.hash(motDePasse, BCRYPT_ROUNDS)`, then the 3 system folders "Réception", "Envoyés", "Archives".
- 201 with the Utilisateur representation and `Location: /api/v1/utilisateurs/moi`.

**SW-02 – Se connecter**
- Body: `{ courriel, motDePasse }`. Missing field → 400 `VALIDATION_ECHOUEE`.
- Unknown email or wrong password → 401 `IDENTIFIANTS_INVALIDES` (same response for both cases). Still run a bcrypt compare against a dummy hash when the email is unknown, so timing does not reveal accounts.
- 200: `{ "jeton": "...", "typeJeton": "Bearer", "expireLe": "<ISO>", "utilisateur": { idUtilisateur, courriel, nom, prenom, photoProfil } }`.

**SW-03 – Se déconnecter**: revoke the token's `jti` (5.4). 204.

**SW-04 – Consulter son profil**: 200 with the Utilisateur representation.

**SW-05 – Modifier son profil**
- Body: `{ nom, prenom, telephone?, photoProfil? }`. `courriel` and `motDePasse` in the body are ignored.
- PUT semantics: an omitted optional field becomes `null`.
- 200 with the updated representation.

**SW-06 – Changer son mot de passe**
- Body: `{ ancienMotDePasse, nouveauMotDePasse }`.
- Wrong `ancienMotDePasse` → 401 `MOT_DE_PASSE_INCORRECT`. Weak new password → 400 `VALIDATION_ECHOUEE`. Same as old → 400 `MOT_DE_PASSE_IDENTIQUE`.
- 204.

### 6.2 Contacts

**SW-07 – Créer un contact**
- Body: `{ nom, prenom, courriel, photoProfil?, telephones?: { mobile?, fixe?, professionnel? } }`.
- 409 `CONTACT_EXISTANT` if the user already has a contact with this email.
- 201 with the Contact representation and `Location`.

**SW-08 – Lister les contacts**: query `recherche`, `page`, `taille`, `tri` (5.3). 200 with the paginated envelope.

**SW-09 – Consulter un contact**: 200, or 404 if not found / not owned.

**SW-10 – Modifier un contact**: same body and validation as SW-07, full replacement (omitted optional fields become `null`). 409 `CONTACT_EXISTANT` if the new email belongs to **another** contact of the user. 200 with the updated representation.

**SW-11 – Supprimer un contact**: 204. Messages are not affected.

### 6.3 Message boxes and folders – rules

- Every user has three **system** folders: Réception, Envoyés, Archives. They cannot be created, renamed or deleted through the API.
- A message row is in exactly one folder (`id_dossier`). Default folder: Réception for `direction = 'recu'`, Envoyés for `direction = 'envoye'`. A row with `id_dossier = NULL` is treated as being in its default folder.
- **Réception** contents = `direction = 'recu' AND (id_dossier = <Réception> OR id_dossier IS NULL)`.
- **Envoyés** contents = `direction = 'envoye' AND (id_dossier = <Envoyés> OR id_dossier IS NULL)`.
- Any other folder = `id_dossier = <id>`.
- Moving a message to Archives or a personal folder removes it from Réception / Envoyés, like a real mail client.

### 6.4 Folders

**SW-12 – Créer un dossier**
- Body: `{ nom }`. 409 `DOSSIER_EXISTANT` if the user already has a folder with this name (the unique key is case-insensitive with the script's collation; check before inserting). This also blocks "Réception", "Envoyés" and "Archives".
- Created with `type = 'personnel'`. 201 with the Dossier representation (`nbMessages: 0, nbNonLus: 0`) and `Location`.

**SW-13 – Lister les dossiers**
- Order: Réception, Envoyés, Archives, then personal folders sorted by name.
- `nbMessages` = number of messages in the folder (6.3); `nbNonLus` = among them, `direction = 'recu' AND etat = 'recu'`.
- Compute the counts in one or two grouped queries, not one query per folder.

**SW-14 – Supprimer un dossier**
- System folder → 403 `DOSSIER_SYSTEME`.
- In one transaction: move its messages back to their default folder (received → Réception, sent → Envoyés), then delete the folder. 204.

**SW-15 – Afficher le contenu d'un dossier**
- Query `page`, `taille`, `tri`. Contents follow 6.3.
- 200: the paginated envelope plus `"dossier": { idDossier, nom, type }`.

**SW-16 – Ajouter un message à un dossier**
- Both the folder and the message must belong to the user (else 404).
- A received message cannot go into Envoyés, a sent message cannot go into Réception → 400 `DEPLACEMENT_INVALIDE`.
- Sets `id_dossier`. Idempotent. 204.

### 6.5 Messages

**SW-17 – Envoyer un message**
- Body: `{ destinataires: [emails], objet, contenu, piecesJointes?: [idPiece] }`.
- Each `idPiece` must be a pending upload of this user (6.6), else 400 `PIECE_JOINTE_INVALIDE`.
- In one transaction, with `envoye_le = UTC_TIMESTAMP()` and for **each** recipient:
  1. insert the **sent copy**: `id_utilisateur` = sender, `id_dossier` = sender's Envoyés, `expediteur_courriel` = sender's email, `destinataire_courriel` = recipient, `direction = 'envoye'`, `etat = 'envoye'`;
  2. if the recipient is a user of the platform, insert the **received copy**: `id_utilisateur` = recipient, `id_dossier` = recipient's Réception, `direction = 'recu'`, `etat = 'recu'`;
  3. for each attachment, insert one `pieces_jointes` row per created copy, all pointing to the same stored file.
- Recipients who are not platform users are accepted: only the sent copy exists.
- After commit, remove the used ids from the pending uploads.
- 201: the list-item representation of the first sent copy, plus `"idsMessages": [ ...ids of all sent copies ]`.

**SW-18 / SW-19 – Lister les messages reçus / envoyés** (`GET /messages`)
- `boite`: `reception` (default) or `envoi`; anything else → 400.
- `etat`: optional, `lu` or `nonlu`, only with `boite=reception`.
- `recherche`, `page`, `taille`, `tri` (5.3).
- Contents follow 6.3 (Réception or Envoyés). 200 with the paginated envelope.

**SW-20 – Consulter un message**: 200 with the full representation. Does **not** change `etat` (the client calls SW-21).

**SW-21 – Marquer comme lu ou non lu**
- Body: `{ "lu": true }` or `{ "lu": false }`; `lu` must be a boolean, else 400 `VALIDATION_ECHOUEE`.
- Sent message → 400 `ETAT_NON_APPLICABLE`.
- Sets `etat` to `'lu'` or `'recu'`. 200: `{ "idMessage": 152, "etat": "lu" }`.

**SW-22 – Supprimer un message**
- Deletes the user's row (its `pieces_jointes` rows go with the `ON DELETE CASCADE`). The other user's copy is not affected.
- Delete a stored file only when no remaining `pieces_jointes` row references its `chemin_stockage`.
- 204.

### 6.6 Attachments (bonus)

The script's `pieces_jointes.id_message` is `NOT NULL`, so an uploaded file cannot be stored in that table before the message exists. Pending uploads are therefore kept outside the database until SW-17.

**SW-23 – Téléverser une pièce jointe**
- `multipart/form-data`, field `fichier`, one file, max `UPLOAD_MAX_MB` (10) → else 413.
- Accepted MIME types: `application/pdf`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `text/plain`, Word, Excel and PowerPoint (`.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`), `application/zip` → else 415.
- Stored in `UPLOAD_DIR` under a random name (`crypto.randomUUID()` + original extension). The original name is kept only as metadata. Multer gives `originalname` decoded as latin1: convert it with `Buffer.from(originalname, 'latin1').toString('utf8')`, otherwise accented file names are garbled.
- Store only the generated file name in `chemin_stockage`, and always resolve it with `path.join(UPLOAD_DIR, path.basename(chemin_stockage))`.
- Kept in an in-memory `Map(idPiece → { idUtilisateur, nomFichier, typeMime, tailleOctets, cheminStockage, creeLe })`, where `idPiece` is a temporary string (`crypto.randomUUID()`). Entries older than 24 h are purged with their file.
- 201: `{ "idPiece": "6f1c…", "nomFichier": "rapport.pdf", "typeMime": "application/pdf", "tailleOctets": 184320 }`.
- Once the message is sent, the attachment gets its numeric `id_piece` from the table (returned by SW-20).

**SW-24 – Télécharger une pièce jointe**
- The message must belong to the user and the piece to the message, else 404.
- Respond with `res.download(chemin, nomFichier)` and the stored `Content-Type`. If the file is missing on disk → 404.

---

## 7. Express app (`src/app.js`)

Order of middleware:
1. `cors({ origin: CORS_ORIGIN })` only when `CORS_ORIGIN` is set.
2. `express.json({ limit: '1mb' })`.
3. API routers under `/api/v1`.
4. 404 handler for `/api/*`.
5. `express.static('public')` for the UI; `/` serves `public/index.html`.
6. Error middleware (last).

`app.js` exports the app without listening; `server.js` calls `listen(PORT)` and logs `Nova Mail : http://localhost:<PORT>`.

---

## 8. Tests des services web (5 points)

### 8.1 Automated tests (Jest + Supertest)

- Separate database `messagerie_web_test`, reset with `initialiser()` from `database/init.js` in a `beforeAll` of each test file. Close the pool in `afterAll` (`db.close()`), otherwise Jest does not exit.
- `config.js` reads the environment when it is first required, so the test settings must be in place before that: put them in `tests/setup/env.js` and register it in `package.json` under `"jest": { "setupFiles": ["<rootDir>/tests/setup/env.js"] }`. It sets `DB_NAME=messagerie_web_test`, `BCRYPT_ROUNDS=4`, a test `JWT_SECRET`, `UPLOAD_DIR=uploads-test` (deleted after the attachment tests). `dotenv` does not override variables that are already set, so `.env` still provides the DB host, user and password.
- `tests/setup/helpers.js`: `login(courriel)` returning the token, `auth(token)` header helper.
- One file per family: `auth.test.js`, `utilisateurs.test.js`, `contacts.test.js`, `dossiers.test.js`, `messages.test.js`, `pieces.test.js`, `securite.test.js`.
- Each test name starts with its service id: `SW-07 crée un contact (201)`.

Minimum cases (each service has at least one nominal case and its main errors):

| Service | Cases |
|---|---|
| SW-01 | 201 + 3 system folders created; 400 invalid email / weak password with `details`; 409 existing email |
| SW-02 | 200 with token; 401 wrong password; 401 unknown email (same body as wrong password) |
| SW-03 | 204, then the same token gets 401 |
| SW-04 | 200, no `motDePasseHash` in the body; 401 without token |
| SW-05 | 200 updated; omitted `telephone` becomes `null`; 400 empty `nom` |
| SW-06 | 204 then login with new password works; 401 wrong old password; 400 same password |
| SW-07 | 201 with `telephones` grouped; 409 duplicate email; 400 invalid phone |
| SW-08 | 10 contacts for Alex; `recherche` filters; `taille=3&page=2` returns the right slice; 400 `tri=motDePasse` |
| SW-09 | 200; 404 for Sophie's contact read by Alex |
| SW-10 | 200 full replacement; 409 email of another contact |
| SW-11 | 204 then 404 |
| SW-12 | 201; 409 duplicate; 409 "Archives" |
| SW-13 | Alex: Réception 20 / 8 non lus, Envoyés 10, Archives 0, in that order |
| SW-14 | 204 and its messages back in Réception; 403 on Réception |
| SW-15 | content of a personal folder after SW-16; envelope has `dossier` |
| SW-16 | 204 and the message leaves Réception; 400 received message into Envoyés; 404 other user's folder |
| SW-17 | Alex → Sophie: Alex's Envoyés +1, Sophie's Réception +1 with `etat: recu`; external recipient: sent copy only; 2 recipients → `idsMessages` length 2; 400 no recipient |
| SW-18 | 20 for Alex; `etat=nonlu` → 8; `recherche`; 400 `boite=xyz` |
| SW-19 | 10 for Alex, all `etat: envoye` |
| SW-20 | 200 with `contenu`; does not change `etat`; 404 other user's message |
| SW-21 | `lu: true` then `lu: false`; 400 on a sent message; 400 `lu: "oui"` |
| SW-22 | 204 then 404; the recipient's copy still exists |
| SW-23 | 201 with temporary id; 413 over 10 MB (use a generated buffer); 415 `.exe` |
| SW-24 | after sending with an attachment, both sender and recipient download the same bytes; 404 for a third user |
| Security | every protected route returns 401 without token and with a forged token; SQL-like input in `recherche` (`' OR 1=1 --`) returns 0 results, not an error |

`npm test` must pass with 0 failures.

### 8.2 Postman collection (for the in-class validation)

- `postman/nova-mail.postman_collection.json`: one folder per family, one request per service, named `SW-xx – <titre>`.
- `postman/nova-mail.postman_environment.json`: `baseUrl = http://localhost:3000/api/v1`, `jeton` (empty).
- The SW-02 request saves `jeton` with `pm.environment.set`. Protected requests use `Authorization: Bearer {{jeton}}` at collection level.
- Each request has `pm.test` scripts for the status code and the key fields.
- Requests that create something store the new id in a variable used by the following requests (create contact → read → modify → delete).
- Values that must be unique (new account email, contact email, folder name) are generated in a pre-request script from `Date.now()`, so the collection can be run several times without `db:init` in between. Every object the collection creates is deleted by a later request, except the test account.
- SW-06 (success case) runs on the account created by SW-01, with its own token variable `jetonNouveau`, so Alex's password never changes. SW-21 sets message 1 to `lu: false` then back to `lu: true` (its original state).
- SW-23 uploads `postman/fichiers/exemple.pdf` (a small PDF committed in the repository) through a `form-data` field `fichier` of type `file` with `src: "postman/fichiers/exemple.pdf"`. Write in the collection description that in the Postman app this file may need to be selected again in the request's Body tab.
- The whole collection runs green in the Collection Runner, in order, right after `npm run db:init`. Check it from the command line too: `npx newman run postman/nova-mail.postman_collection.json -e postman/nova-mail.postman_environment.json`, run twice in a row.

---

## 9. Consommation des services web (20 points)

Wire the existing UI in `public/` to the API. **Read every file in `public/` before changing anything** and list the pages, the containers (`id`s) and form fields (`name`s) you find. The UI was built from a spec that used these names; adapt to what is actually there.

### 9.1 Rules

- Do not change the visual design. Only remove the static sample rows and the demo-only blocks, and add the few elements listed below.
- Keep `js/ui.js` (modals, mobile menu, tabs).
- Vanilla JavaScript, ES modules (`<script type="module">`), no framework.
- The UI is served by Express on the same origin: the API base is `/api/v1` (relative). In `js/api/config.js`, export `API_BASE_URL = '/api/v1'`.
- Insert API data with `textContent` or `document.createElement`, never `innerHTML` with API data.
- Ids pass between pages in the query string: `message.html?id=21`, `dossier.html?id=16`, `nouveau.html?a=sophie.martin@example.com`. Links to `dossier.html` without an id (sidebar placeholders) are replaced by real links built from SW-13.

### 9.2 Files to add in `public/js/`

```
js/
├── ui.js                 # existing, keep
├── api/
│   ├── config.js         # API_BASE_URL
│   ├── client.js         # request(): token, JSON, errors (9.3)
│   └── services.js       # one function per SW-01..SW-24
├── session.js            # sessionStorage, requireSession(), logout()
├── format.js             # dates, sizes, initials (9.6)
├── components/
│   ├── sidebar.js        # user, folders, counters, new folder, logout
│   ├── messageList.js    # shared by reception, envoyes, dossier
│   ├── toast.js          # success / error notifications
│   ├── confirm.js        # promise-based wrapper over the existing confirm modal
│   └── pagination.js
└── pages/
    ├── login.js  reception.js  envoyes.js  message.js
    ├── nouveau.js  dossier.js  contacts.js  profil.js
```

Function names in `services.js`: `creerCompte`, `seConnecter`, `seDeconnecter`, `getProfil`, `modifierProfil`, `changerMotDePasse`, `creerContact`, `listerContacts`, `getContact`, `modifierContact`, `supprimerContact`, `creerDossier`, `listerDossiers`, `supprimerDossier`, `listerMessagesDossier`, `ajouterMessageADossier`, `envoyerMessage`, `listerMessagesRecus`, `listerMessagesEnvoyes`, `getMessage`, `marquerLu`, `supprimerMessage`, `televerserPieceJointe`, `telechargerPieceJointe`.

### 9.3 `client.js`

- `request(method, path, { body, query, form })`: adds `Authorization` when a session exists, `Content-Type: application/json` except for `FormData`, returns parsed JSON or `null` on 204.
- Non-2xx → throws `ApiError { status, code, message, details }` read from the error body.
- 401 with code `JETON_ABSENT` or `JETON_INVALIDE` → clear the session and go to `index.html?expire=1`. Other 401 codes (`IDENTIFIANTS_INVALIDES`, `MOT_DE_PASSE_INCORRECT`) are thrown normally so the page can show them.
- Network failure → `ApiError` status 0, message "Impossible de joindre le serveur. Vérifiez votre connexion."
- `telechargerPieceJointe(url, nomFichier)`: `fetch` with the token, `blob()`, temporary object URL, click a hidden `<a download>`. A plain link cannot send the token.

### 9.4 Session (`session.js`)

- After SW-02: store `{ jeton, expireLe, utilisateur }` in `sessionStorage` under `novamail.session`.
- `requireSession()` at the top of every page except `index.html`: no session or `expireLe` past → `index.html`.
- `index.html` with a valid session → `reception.html`.
- `logout()`: SW-03 (ignore errors), clear storage, go to `index.html`.

### 9.5 Pages

For every page: show "Chargement…" while waiting, an empty state when the list is empty, and errors as toasts (or under the field when `details` has a `champ` matching a form field: red border + message, `aria-invalid="true"`). Disable submit buttons during the request.

**Sidebar (every app page)**: header name and initials from the session (refreshed by SW-04 on load); Réception counter = `nbNonLus` of Réception from SW-13; folder list = Archives + personal folders, each linking to `dossier.html?id=…` with its `nbNonLus` when > 0; "+ Nouveau dossier" modal → SW-12 → toast "Dossier « X » créé" → go to the new folder (409 → error under the field); "Déconnexion" → `logout()`. Refresh the sidebar after any action that changes counters or folders.

**`index.html`**: remove the static error example. Login → SW-02 → `reception.html` (401 → "Courriel ou mot de passe incorrect." above the button). Sign-up → client validation (5.7 rules + password confirmation) → SW-01 → SW-02 with the same credentials → `reception.html` with toast "Bienvenue dans Nova Mail !" (409 → error under the email). `?expire=1` → "Votre session a expiré. Veuillez vous reconnecter."

**`reception.html`**: SW-18. Turn one sample row into a `<template>` and remove the other static rows. Tabs "Tous" / "Non lus" (`etat=nonlu`). Search with 300 ms debounce, back to page 1. Pagination. Unread rows bold with the dot; 📎 when `nbPiecesJointes > 0`. Row action button → SW-21 → update the row in place and the counter; must not open the message (`stopPropagation`). Row click → `message.html?id=…&depuis=reception`. Empty: "Aucun message reçu." / "Aucun message ne correspond à votre recherche."

**`envoyes.html`**: SW-19, same component, *Destinataire* column, state "Envoyé", no read action. Empty: "Aucun message envoyé."

**`message.html`**: SW-20. If received and `etat = 'recu'`, call SW-21 `lu: true` right away and refresh the counter. Header "De :", "À :" ("Prénom Nom <courriel>" when names are known), "Le :" full date. Body in the existing pre-wrap block. Attachments list with "Télécharger" (9.3); hide the section when empty. "Marquer comme non lu" only for received messages → SW-21 `lu: false` → back. "Classer dans un dossier": `<select>` filled from SW-13, excluding the current folder and the invalid default box (6.4 SW-16) → SW-16 → toast "Message déplacé dans « X »". "Supprimer" → confirm → SW-22 → toast → back. "← Retour" goes back to the `depuis` page (reception, envoyes, or `dossier&idDossier=…`), default reception. 404 → "Ce message est introuvable." with a link to the inbox.

**`nouveau.html`**: remove the static suggestions example and the sample chip. *Destinataire* accepts several emails separated by `,` or `;`; prefill from `?a=`. Autocomplete: after 2 characters and 300 ms, SW-08 `recherche` → up to 5 suggestions "Prénom Nom <courriel>" in the existing dropdown style; click inserts the email. JOINDRE → hidden `<input type="file" multiple>` → each file: client check 10 Mo → SW-23 → chip "📎 nom (taille) ✕" ("Envoi du fichier…" while uploading; ✕ removes it). ENVOYER disabled during uploads → validation → SW-17 → toast "Message envoyé" → `envoyes.html`. Leaving with text typed → confirm "Quitter sans envoyer ? Le message sera perdu."

**`dossier.html?id=…`**: SW-15. Title = folder name, line "Dossier personnel · N messages" or "Dossier système · N messages". "Supprimer le dossier" visible only for personal folders → existing confirm modal (folder name in the text) → SW-14 → toast "Dossier supprimé" → `reception.html`. Remove the "Exemple : dossier vide" section; use a real empty state "Aucun message dans ce dossier. Ouvrez un message et utilisez « Classer dans un dossier » pour l'ajouter ici." Missing or unknown id → `reception.html`.

**`contacts.html`**: SW-08 sorted by name, search with debounce, pagination. Row: avatar (photo or initials), "Prénom Nom", "courriel • mobile" (or fixe, or professionnel). Clicking the email → `nouveau.html?a=…`. "+ AJOUTER" → empty modal → SW-07 → toast "Contact ajouté". "Modifier" → modal "Chargement…" → SW-09 fills it → SW-10 with the full representation → toast "Contact modifié". 409 → error under the email. "Suppr." → confirm with the contact's name → SW-11 → toast "Contact supprimé". Photo: next to the existing "Choisir une photo" preview, add a text field *URL de la photo* (there is no photo upload service); the preview updates live, initials when empty or the image fails.

**`profil.html`**: SW-04 fills the form; email read-only. Same *URL de la photo* field as contacts. ENREGISTRER enabled only after a change → SW-05 → toast "Profil mis à jour" → update header and session. "CHANGER MOT DE PASSE" modal → client checks (rule, confirmation, different) → SW-06 → toast "Mot de passe modifié" (401 → error under *Mot de passe actuel*).

**Toast**: if the UI has none, add one in `components.css` using the existing tokens: bottom-right, 3 s, `role="status"` for success, `role="alert"` for errors.

### 9.6 Formatting (`format.js`)

`Intl.DateTimeFormat('fr-CA')`, browser time zone.
- Lists: today → `10:42`; yesterday → `Hier`; this year → `21 août`; older → `21 août 2025`.
- Message view: `lundi 3 août 2026 à 21 h 00`.
- Sizes: `850 o`, `180 Ko`, `2,4 Mo`.
- Initials: first letter of prénom + nom, uppercase; fallback first letter of the email.

---

## 10. Publication (5 points)

Goal: one public HTTPS URL serving both the site and the API.

### 10.1 Preparation

- Git repository pushed to GitHub, with `.gitignore` covering `node_modules/`, `.env`, `uploads/`.
- `package.json` has `"engines": { "node": ">=20" }`.
- Express listens on `process.env.PORT`.
- The app works from a fresh clone with only `npm install`, a `.env`, `npm run db:init` and `npm start`.

### 10.2 Hosting

Default target: **Railway**, one project with a Node service (from the GitHub repository) and a MySQL database. Alternative: **Render** (web service) + **Aiven for MySQL**. Free plans and trial credits change often: check the current offers before choosing, and write the choice in `PUBLICATION.md`.

Steps:
1. Create the MySQL database and note its connection values.
2. Run `npm run db:init` once from the local machine with a `.env` pointing to the hosted database (`DB_SSL=true` if required; `--sans-creation` if the host forbids `CREATE DATABASE`).
3. Create the web service from the GitHub repository: build `npm install`, start `npm start`.
4. Set the environment variables on the host (all of section 3 except `CORS_ORIGIN`; a new long random `JWT_SECRET`).
5. Deploy, open the URL, log in as Alex.
6. Run the Postman collection against the public URL (change `baseUrl`), all green.

Known limit to state in `PUBLICATION.md`: on these hosts the local disk is temporary, so uploaded attachments can disappear after a redeploy or restart. Acceptable for a course project.

### 10.3 `PUBLICATION.md`

Public URL, hosting provider, demo accounts and password, how to redeploy, the limit above, and the date of the last successful Postman run.

---

## 11. Phases

Work phase by phase. At the end of each phase, run the checks before moving on, and stop to report if a check fails.

1. **Setup**: create the structure (section 2), move the existing UI into `public/` and the MySQL script into `database/script_mysql.sql`, `package.json`, `.env.example`, `config.js`, `db.js`, `init.js`. Check: `npm run db:init` prints the control counts; `npm start` serves `public/index.html`.
2. **Foundations**: `errors.js`, validators, mappers, pagination, auth middleware, app wiring. Check: unknown `/api/v1/x` returns the 404 error body.
3. **Services by family**, in this order: accounts/auth (SW-01 to SW-06) → contacts (SW-07 to SW-11) → folders (SW-12 to SW-16) → messages (SW-17 to SW-22) → attachments (SW-23, SW-24). Check after each family with quick `curl` calls.
4. **Tests**: Jest suite (8.1) green, then the Postman collection (8.2) green in the Runner.
5. **Consumption**: shared modules first (client, services, session, format, sidebar, messageList, toast), then pages in this order: index → reception → message → envoyes → nouveau → dossier → contacts → profil. Check each page in the browser with Alex before the next one.
6. **Publication** (section 10) and `PUBLICATION.md`.
7. **README.md** and the final checklist (section 12).

---

## 12. Final checklist

**Services**
- [ ] The 24 services respond with the URIs, fields and status codes of section 6.
- [ ] No response contains `mot_de_passe_hash`, `motDePasseHash` or `chemin_stockage`.
- [ ] A user can never read or change another user's data (404).
- [ ] All SQL uses placeholders; sort fields are whitelisted.
- [ ] Error bodies always follow 5.6, in French.

**Tests**
- [ ] `npm test`: all green, every service covered (8.1 table).
- [ ] Postman collection: all green in the Runner after `npm run db:init`, locally and on the public URL.

**Consumption** (logged in as `alex.moreau@example.com` / `Nova2026!`)
- [ ] Sign-up of a new account lands on an empty inbox; existing email shows the error under the field.
- [ ] Inbox: 20 messages, 8 unread, counter "Réception (8)"; "Non lus" shows 8; search works; row button toggles read state.
- [ ] Opening an unread message marks it read (counter 7); "Marquer comme non lu" brings it back to 8.
- [ ] Envoyés: 10 messages.
- [ ] Send to Sophie with an attachment: in Alex's Envoyés; Sophie (other browser or private window) sees it unread with 📎 and can download the file.
- [ ] Create folder "Projet SW", move a message into it (it leaves the inbox), open the folder, delete it (the message returns to Réception). System folders have no delete button.
- [ ] Contacts: list of 10, search, add with three phones and a photo URL, modify, delete.
- [ ] Profile: change first name and phone (header updates), change password (wrong current password shows the error).
- [ ] Token removed or expired → redirect to the login page with the session message.
- [ ] No sample data left in the HTML, no console errors, no `innerHTML` with API data.

**Publication**
- [ ] Public HTTPS URL serves the site and the API; demo accounts work.
- [ ] `README.md` and `PUBLICATION.md` are complete.
