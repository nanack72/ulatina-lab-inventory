const express = require('express');
const router = express.Router();

const {
  crearMantenimiento,
  obtenerMantenimientos,
  obtenerMantenimientoPorId,
  obtenerHistorialPorEquipo,
  actualizarEstadoMantenimiento
} = require('../controllers/mantenimientosController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { permitirRoles } = require('../middlewares/permisosMiddleware');

/**
 * Rutas para el Módulo de Bitácora de Mantenimientos Técnicos (Semana 7)
 * 
 * Todas las rutas requieren un token JWT válido (verificarToken).
 * Las operaciones de mutación (POST, PATCH) están restringidas a roles 'Administrador' y 'Tecnico'.
 */

// 1. POST /api/mantenimientos -> Registrar mantenimiento preventivo/correctivo
router.post(
  '/',
  verificarToken,
  permitirRoles('Administrador', 'Tecnico'),
  crearMantenimiento
);

// 2. GET /api/mantenimientos -> Consultar lista de mantenimientos con filtros
router.get(
  '/',
  verificarToken,
  obtenerMantenimientos
);

// 3. GET /api/mantenimientos/equipo/:idEquipo -> Cronología e historial de intervenciones por equipo
// NOTA IMPORTANTE: Esta ruta se define ANTES de /:id para evitar que Express interprete 'equipo' como un parámetro :id
router.get(
  '/equipo/:idEquipo',
  verificarToken,
  obtenerHistorialPorEquipo
);

// 4. GET /api/mantenimientos/:id -> Consultar detalle completo de un mantenimiento por ID
router.get(
  '/:id',
  verificarToken,
  obtenerMantenimientoPorId
);

// 5. PATCH /api/mantenimientos/:id/estado -> Actualizar estado de mantenimiento y/o horas invertidas
router.patch(
  '/:id/estado',
  verificarToken,
  permitirRoles('Administrador', 'Tecnico'),
  actualizarEstadoMantenimiento
);

module.exports = router;
