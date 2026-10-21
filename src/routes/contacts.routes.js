const express = require('express');
const { asyncHandler } = require('../errors');
const { exigerJeton } = require('../middleware/auth');
const { idChemin } = require('../utils/validators');
const contacts = require('../services/contacts.service');

const router = express.Router();
router.use(exigerJeton);

// SW-07 – Créer un contact
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const contact = await contacts.creerContact(req.utilisateur.idUtilisateur, req.body);
    res.status(201).location(`/api/v1/contacts/${contact.idContact}`).json(contact);
  })
);

// SW-08 – Lister les contacts
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await contacts.listerContacts(req.utilisateur.idUtilisateur, req.query));
  })
);

// SW-09 – Consulter un contact
router.get(
  '/:idContact',
  asyncHandler(async (req, res) => {
    res.json(await contacts.getContact(req.utilisateur.idUtilisateur, idChemin(req.params.idContact)));
  })
);

// SW-10 – Modifier un contact
router.put(
  '/:idContact',
  asyncHandler(async (req, res) => {
    const id = idChemin(req.params.idContact);
    res.json(await contacts.modifierContact(req.utilisateur.idUtilisateur, id, req.body));
  })
);

// SW-11 – Supprimer un contact
router.delete(
  '/:idContact',
  asyncHandler(async (req, res) => {
    await contacts.supprimerContact(req.utilisateur.idUtilisateur, idChemin(req.params.idContact));
    res.status(204).end();
  })
);

module.exports = router;
