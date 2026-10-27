const express = require('express');
const router = express.Router();

const {
  obtenerEquipos,
  obtenerEquipoPorId
} = require('../controllers/equiposController');

const {
  obtenerHistorialUbicacion,
  obtenerHistorialEstados,
  obtenerHistorialCambios
} = require('../controllers/historialesController');

// Consultar todos los equipos
router.get('/', obtenerEquipos);

// Consultar historial de ubicación
router.get('/:id/historial-ubicacion', obtenerHistorialUbicacion);

// Consultar historial de estados
router.get('/:id/historial-estados', obtenerHistorialEstados);

// Consultar historial de modificaciones
router.get('/:id/historial-cambios', obtenerHistorialCambios);

// Consultar un equipo específico
router.get('/:id', obtenerEquipoPorId);

module.exports = router;
