// Loaded by Jest before any test file (package.json → jest.setupFiles).
// These values win over .env, which still provides DB_HOST / DB_USER / DB_PASSWORD.
process.env.DB_NAME = 'messagerie_web_test';
process.env.BCRYPT_ROUNDS = '4';
process.env.JWT_SECRET = 'secret-de-test-nova-mail-0123456789-abcdefghijklmnopqrstuvwxyz';
process.env.JWT_EXPIRES_MINUTES = '60';
process.env.UPLOAD_DIR = 'uploads-test';
process.env.UPLOAD_MAX_MB = '10';
process.env.CORS_ORIGIN = '';
