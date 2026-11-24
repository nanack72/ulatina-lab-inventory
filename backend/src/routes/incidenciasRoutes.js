const express = require('express');
const router = express.Router();

const {
  crearIncidencia,
  obtenerIncidencias,
  actualizarEstadoIncidencia,
} = require('../controllers/incidenciasController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { permitirRoles } = require('../middlewares/permisosMiddleware');

/**
 * Rutas para el Módulo de Reportes de Incidencias Técnicas.
 * Requieren JWT válido y control de roles por sede y laboratorio.
 */
const ROLES_OPERATIVOS = [
  'SuperAdministrador',
  'Superadministrador',
  'Administrador',
  'Coordinador',
  'Director',
  'Tecnico',
  'Técnico',
];

router.use(verificarToken);

// 1. GET /api/incidencias -> Listar incidencias con filtros
router.get('/', obtenerIncidencias);

// 2. POST /api/incidencias -> Registrar reporte de falla
router.post('/', permitirRoles(...ROLES_OPERATIVOS), crearIncidencia);

// 3. PATCH /api/incidencias/:id/estado -> Modificar estado operativo
router.patch('/:id/estado', permitirRoles(...ROLES_OPERATIVOS), actualizarEstadoIncidencia);

module.exports = router;
