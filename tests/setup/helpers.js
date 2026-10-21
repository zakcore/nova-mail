// Shared helpers for the API tests.
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const config = require('../../src/config');
const { initialiser } = require('../../database/init');

const MDP = 'Nova2026!';
const ALEX = 'alex.moreau@example.com';
const SOPHIE = 'sophie.martin@example.com';
const KARIM = 'karim.diallo@example.com';

// Rebuilds messagerie_web_test from the MySQL script.
function reinitialiser() {
  return initialiser({ nomBase: config.db.database, rounds: config.bcryptRounds, silencieux: true });
}

const api = () => request(app);
const auth = (jeton) => ({ Authorization: `Bearer ${jeton}` });

async function login(courriel, motDePasse = MDP) {
  const res = await api().post('/api/v1/auth/connexion').send({ courriel, motDePasse });
  if (res.status !== 200) throw new Error(`Connexion impossible pour ${courriel} (${res.status})`);
  return res.body.jeton;
}

// Folders of the user, indexed by name
async function dossiers(jeton) {
  const res = await api().get('/api/v1/dossiers').set(auth(jeton));
  return Object.fromEntries(res.body.donnees.map((d) => [d.nom, d]));
}

module.exports = { api, auth, login, dossiers, reinitialiser, db, config, MDP, ALEX, SOPHIE, KARIM };
