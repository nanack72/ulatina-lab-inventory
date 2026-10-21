const express = require('express');
const router = express.Router();

const {
  obtenerEquipos,
  obtenerEquipoPorId
} = require('../controllers/equiposController');

// Consultar todos los equipos
router.get('/', obtenerEquipos);

// Consultar un equipo específico
router.get('/:id', obtenerEquipoPorId);

module.exports = router;
