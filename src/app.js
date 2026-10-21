// Builds the Express app (exported without listening, for the tests).
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { errorHandler, notFoundApi } = require('./errors');

const app = express();
app.disable('x-powered-by');

if (config.corsOrigin) {
  app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['Location', 'Content-Disposition'] }));
}
app.use(express.json({ limit: '1mb' }));

const api = express.Router();
api.use('/auth', require('./routes/auth.routes'));
api.use('/utilisateurs', require('./routes/utilisateurs.routes'));
api.use('/contacts', require('./routes/contacts.routes'));
api.use('/dossiers', require('./routes/dossiers.routes'));
api.use('/messages', require('./routes/messages.routes'));
api.use('/pieces-jointes', require('./routes/pieces.routes'));
app.use('/api/v1', api);

app.use('/api', notFoundApi);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(errorHandler);

module.exports = app;
