const express = require('express');
const router = express.Router();

const {
  obtenerLaboratorios
} = require('../controllers/laboratoriosController');

// GET /api/laboratorios
router.get('/', obtenerLaboratorios);

module.exports = router;