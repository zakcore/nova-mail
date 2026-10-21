const express = require('express');
const { asyncHandler } = require('../errors');
const { exigerJeton, revoquer } = require('../middleware/auth');
const utilisateurs = require('../services/utilisateurs.service');

const router = express.Router();

// SW-02 – Se connecter
router.post(
  '/connexion',
  asyncHandler(async (req, res) => {
    res.json(await utilisateurs.seConnecter(req.body));
  })
);

// SW-03 – Se déconnecter
router.post('/deconnexion', exigerJeton, (req, res) => {
  revoquer(req.utilisateur.jti, req.utilisateur.exp);
  res.status(204).end();
});

module.exports = router;
