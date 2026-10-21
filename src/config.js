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

const config = {
  port: Number(env.PORT) || 3000,
  db: {
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true',
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

module.exports = config;
