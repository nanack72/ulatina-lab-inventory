const express = require('express');
const router = express.Router();

const {
  obtenerLaboratorios
} = require('../controllers/laboratoriosController');

const {
  verificarToken
} = require('../middlewares/authMiddleware');

// GET /api/laboratorios
// Solo usuarios autenticados.
router.get('/', verificarToken, obtenerLaboratorios);

module.exports = router;
