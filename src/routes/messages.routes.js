const express = require('express');
const { asyncHandler } = require('../errors');
const { exigerJeton } = require('../middleware/auth');
const { idChemin } = require('../utils/validators');
const messages = require('../services/messages.service');

const router = express.Router();
router.use(exigerJeton);

// SW-17 – Envoyer un message
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { idUtilisateur, courriel } = req.utilisateur;
    const message = await messages.envoyerMessage(idUtilisateur, courriel, req.body);
    res.status(201).location(`/api/v1/messages/${message.idMessage}`).json(message);
  })
);

// SW-18 – Lister les messages reçus (?boite=reception)
// SW-19 – Lister les messages envoyés (?boite=envoi)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await messages.listerMessages(req.utilisateur.idUtilisateur, req.query));
  })
);

// SW-20 – Consulter un message
router.get(
  '/:idMessage',
  asyncHandler(async (req, res) => {
    res.json(await messages.getMessage(req.utilisateur.idUtilisateur, idChemin(req.params.idMessage)));
  })
);

// SW-21 – Marquer un message comme lu ou non lu
router.patch(
  '/:idMessage/etat',
  asyncHandler(async (req, res) => {
    const id = idChemin(req.params.idMessage);
    res.json(await messages.marquerLu(req.utilisateur.idUtilisateur, id, req.body));
  })
);

// SW-22 – Supprimer un message
router.delete(
  '/:idMessage',
  asyncHandler(async (req, res) => {
    await messages.supprimerMessage(req.utilisateur.idUtilisateur, idChemin(req.params.idMessage));
    res.status(204).end();
  })
);

// SW-24 – Télécharger une pièce jointe
router.get(
  '/:idMessage/pieces-jointes/:idPiece',
  asyncHandler(async (req, res, next) => {
    const idMessage = idChemin(req.params.idMessage);
    const idPiece = idChemin(req.params.idPiece);
    const piece = await messages.pieceATelecharger(req.utilisateur.idUtilisateur, idMessage, idPiece);
    res.type(piece.typeMime);
    res.download(piece.chemin, piece.nomFichier, (err) => {
      if (err && !res.headersSent) next(err);
    });
  })
);

module.exports = router;
