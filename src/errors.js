// ApiError and the error-handling middleware (error envelope of section 5.6).

const MESSAGES = {
  VALIDATION_ECHOUEE: 'Les données envoyées sont invalides.',
  PARAMETRE_INVALIDE: 'Un paramètre de la requête est invalide.',
  JSON_INVALIDE: "Le corps de la requête n'est pas un JSON valide.",
  ETAT_NON_APPLICABLE: 'Seuls les messages reçus peuvent être marqués comme lus ou non lus.',
  DEPLACEMENT_INVALIDE: 'Ce message ne peut pas être placé dans ce dossier.',
  PIECE_JOINTE_INVALIDE: 'Une pièce jointe est introuvable ou expirée.',
  MOT_DE_PASSE_IDENTIQUE: "Le nouveau mot de passe doit être différent de l'ancien.",
  JETON_ABSENT: 'Authentification requise.',
  JETON_INVALIDE: 'Votre session a expiré. Veuillez vous reconnecter.',
  IDENTIFIANTS_INVALIDES: 'Courriel ou mot de passe incorrect.',
  MOT_DE_PASSE_INCORRECT: 'Le mot de passe actuel est incorrect.',
  DOSSIER_SYSTEME: 'Les dossiers système ne peuvent pas être modifiés ni supprimés.',
  RESSOURCE_INTROUVABLE: "L'élément demandé est introuvable.",
  COURRIEL_DEJA_UTILISE: 'Un compte utilise déjà cette adresse courriel.',
  CONTACT_EXISTANT: 'Ce courriel existe déjà dans vos contacts.',
  DOSSIER_EXISTANT: 'Un dossier porte déjà ce nom.',
  FICHIER_TROP_VOLUMINEUX: 'Le fichier dépasse la taille maximale de 10 Mo.',
  TYPE_NON_SUPPORTE: "Ce type de fichier n'est pas accepté.",
  ERREUR_INTERNE: 'Une erreur est survenue sur le serveur.',
};

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || MESSAGES[code] || MESSAGES.ERREUR_INTERNE);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const introuvable = () => new ApiError(404, 'RESSOURCE_INTROUVABLE');

// Fallback when a unique key is hit despite the services' own checks.
function codeDoublon(err) {
  const msg = err.sqlMessage || '';
  if (msg.includes('uk_contact_courriel')) return 'CONTACT_EXISTANT';
  if (msg.includes('uk_dossier_nom')) return 'DOSSIER_EXISTANT';
  return 'COURRIEL_DEJA_UTILISE';
}

function versApiError(err) {
  if (err instanceof ApiError) return err;
  if (err.type === 'entity.parse.failed') return new ApiError(400, 'JSON_INVALIDE');
  if (err.type === 'entity.too.large') return new ApiError(413, 'VALIDATION_ECHOUEE', 'Le corps de la requête est trop volumineux.');
  if (err.code === 'LIMIT_FILE_SIZE') return new ApiError(413, 'FICHIER_TROP_VOLUMINEUX');
  if (err.name === 'MulterError') return new ApiError(400, 'VALIDATION_ECHOUEE');
  if (err.code === 'ER_DUP_ENTRY') return new ApiError(409, codeDoublon(err));
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let apiErr = versApiError(err);
  if (!apiErr) {
    console.error(err.stack || err);
    apiErr = new ApiError(500, 'ERREUR_INTERNE');
  }
  const body = { erreur: { code: apiErr.code, message: apiErr.message } };
  if (apiErr.details && apiErr.details.length > 0) body.erreur.details = apiErr.details;
  res.status(apiErr.status).json(body);
}

function notFoundApi(req, res, next) {
  next(introuvable());
}

// Express 4 does not catch rejected promises: forward them to the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, MESSAGES, introuvable, errorHandler, notFoundApi, asyncHandler };
