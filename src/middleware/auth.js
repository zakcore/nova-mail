// JWT verification (section 5.4) and the in-memory revocation list used by SW-03.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const db = require('../db');
const { ApiError } = require('../errors');

const revoques = new Map(); // jti → exp (seconds)

const purge = setInterval(() => {
  const maintenant = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revoques) {
    if (exp < maintenant) revoques.delete(jti);
  }
}, 10 * 60 * 1000);
purge.unref();

function emettreJeton(utilisateur) {
  const jti = crypto.randomUUID();
  const jeton = jwt.sign(
    { idUtilisateur: utilisateur.id_utilisateur, courriel: utilisateur.courriel },
    config.jwt.secret,
    { algorithm: 'HS256', expiresIn: config.jwt.expiresMinutes * 60, jwtid: jti }
  );
  const { exp } = jwt.decode(jeton);
  return { jeton, expireLe: new Date(exp * 1000).toISOString() };
}

function revoquer(jti, exp) {
  revoques.set(jti, exp);
}

async function exigerJeton(req, res, next) {
  try {
    const entete = req.get('Authorization') || '';
    const [type, jeton] = entete.split(' ');
    if (type !== 'Bearer' || !jeton) throw new ApiError(401, 'JETON_ABSENT');

    let payload;
    try {
      payload = jwt.verify(jeton, config.jwt.secret, { algorithms: ['HS256'] });
    } catch {
      throw new ApiError(401, 'JETON_INVALIDE');
    }
    if (!payload.jti || revoques.has(payload.jti) || !Number.isInteger(payload.idUtilisateur)) {
      throw new ApiError(401, 'JETON_INVALIDE');
    }

    const rows = await db.query('SELECT courriel FROM utilisateurs WHERE id_utilisateur = ?', [payload.idUtilisateur]);
    if (rows.length === 0) throw new ApiError(401, 'JETON_INVALIDE');

    req.utilisateur = {
      idUtilisateur: payload.idUtilisateur,
      courriel: rows[0].courriel,
      jti: payload.jti,
      exp: payload.exp,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { exigerJeton, emettreJeton, revoquer };
