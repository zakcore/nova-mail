const express = require('express');
const { asyncHandler } = require('../errors');
const { exigerJeton } = require('../middleware/auth');
const utilisateurs = require('../services/utilisateurs.service');

const router = express.Router();

// SW-01 – Créer un compte
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const utilisateur = await utilisateurs.creerCompte(req.body);
    res.status(201).location('/api/v1/utilisateurs/moi').json(utilisateur);
  })
);

// SW-04 – Consulter son profil
router.get(
  '/moi',
  exigerJeton,
  asyncHandler(async (req, res) => {
    res.json(await utilisateurs.getProfil(req.utilisateur.idUtilisateur));
  })
);

// SW-05 – Modifier son profil
router.put(
  '/moi',
  exigerJeton,
  asyncHandler(async (req, res) => {
    res.json(await utilisateurs.modifierProfil(req.utilisateur.idUtilisateur, req.body));
  })
);

// SW-06 – Changer son mot de passe
router.put(
  '/moi/mot-de-passe',
  exigerJeton,
  asyncHandler(async (req, res) => {
    await utilisateurs.changerMotDePasse(req.utilisateur.idUtilisateur, req.body);
    res.status(204).end();
  })
);

module.exports = router;
