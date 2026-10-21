// multer configuration for SW-23 (section 6.6).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const { ApiError } = require('../errors');

const TYPES_ACCEPTES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed', // what Windows browsers send for .zip
]);

// Multer decodes the original name as latin1.
const nomOriginal = (file) => Buffer.from(file.originalname, 'latin1').toString('utf8');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    fs.mkdir(config.upload.dir, { recursive: true }, (err) => cb(err, config.upload.dir));
  },
  filename(req, file, cb) {
    const ext = path.extname(nomOriginal(file)).toLowerCase();
    cb(null, crypto.randomUUID() + (/^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ''));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxMb * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (TYPES_ACCEPTES.has(file.mimetype)) cb(null, true);
    else cb(new ApiError(415, 'TYPE_NON_SUPPORTE'));
  },
});

module.exports = { televersement: upload.single('fichier'), nomOriginal, TYPES_ACCEPTES };
