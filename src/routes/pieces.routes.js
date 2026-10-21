const express = require('express');
const { asyncHandler } = require('../errors');
const { exigerJeton } = require('../middleware/auth');
const { televersement } = require('../middleware/upload');
const pieces = require('../services/pieces.service');

const router = express.Router();
router.use(exigerJeton);

// SW-23 – Téléverser une pièce jointe
router.post(
  '/',
  televersement,
  asyncHandler(async (req, res) => {
    res.status(201).json(pieces.enregistrer(req.utilisateur.idUtilisateur, req.file));
  })
);

module.exports = router;
