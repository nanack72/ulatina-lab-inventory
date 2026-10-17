const express = require('express');
const router = express.Router();

const {
  obtenerEquipos
} = require('../controllers/equiposController');

// GET /api/equipos
router.get('/', obtenerEquipos);

module.exports = router;