const express = require('express');
const { asyncHandler } = require('../errors');
const { exigerJeton } = require('../middleware/auth');
const { idChemin } = require('../utils/validators');
const dossiers = require('../services/dossiers.service');

const router = express.Router();
router.use(exigerJeton);

// SW-12 – Créer un dossier
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const dossier = await dossiers.creerDossier(req.utilisateur.idUtilisateur, req.body);
    res.status(201).location(`/api/v1/dossiers/${dossier.idDossier}`).json(dossier);
  })
);

// SW-13 – Lister les dossiers
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await dossiers.listerDossiers(req.utilisateur.idUtilisateur));
  })
);

// SW-14 – Supprimer un dossier
router.delete(
  '/:idDossier',
  asyncHandler(async (req, res) => {
    await dossiers.supprimerDossier(req.utilisateur.idUtilisateur, idChemin(req.params.idDossier));
    res.status(204).end();
  })
);

// SW-15 – Afficher le contenu d'un dossier
router.get(
  '/:idDossier/messages',
  asyncHandler(async (req, res) => {
    const id = idChemin(req.params.idDossier);
    res.json(await dossiers.contenuDossier(req.utilisateur.idUtilisateur, id, req.query));
  })
);

// SW-16 – Ajouter un message à un dossier
router.put(
  '/:idDossier/messages/:idMessage',
  asyncHandler(async (req, res) => {
    const idDossier = idChemin(req.params.idDossier);
    const idMessage = idChemin(req.params.idMessage);
    await dossiers.ajouterMessage(req.utilisateur.idUtilisateur, idDossier, idMessage);
    res.status(204).end();
  })
);

module.exports = router;
