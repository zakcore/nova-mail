// Reads the environment once (.env does not override variables that are already set).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const required = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(
    `Configuration incomplète : variable(s) manquante(s) ${missing.join(', ')}. ` +
      'Copiez .env.example vers .env et complétez-le.'
  );
}

const env = process.env;

// Optional CA certificate for hosted MySQL (Aiven…): PEM text (\n allowed) or a path to a .pem file.
function lireCertificat(valeur) {
  if (!valeur) return undefined;
  if (valeur.includes('-----BEGIN')) return valeur.replace(/\\n/g, '\n');
  const fs = require('fs');
  const chemin = path.resolve(__dirname, '..', valeur);
  if (!fs.existsSync(chemin)) throw new Error(`Configuration : certificat DB_SSL_CA introuvable (${chemin}).`);
  return fs.readFileSync(chemin, 'utf8');
}

const config = {
  port: Number(env.PORT) || 3000,
  db: {
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true',
    sslCa: lireCertificat(env.DB_SSL_CA),
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresMinutes: Number(env.JWT_EXPIRES_MINUTES) || 60,
  },
  bcryptRounds: Number(env.BCRYPT_ROUNDS) || 12,
  upload: {
    dir: path.resolve(__dirname, '..', env.UPLOAD_DIR || 'uploads'),
    maxMb: Number(env.UPLOAD_MAX_MB) || 10,
  },
  corsOrigin: env.CORS_ORIGIN || '',
};

// mysql2 "ssl" option: certificate always verified, against DB_SSL_CA when given.
config.db.sslOptions = config.db.ssl
  ? { rejectUnauthorized: true, ...(config.db.sslCa ? { ca: config.db.sslCa } : {}) }
  : undefined;

module.exports = config;
