const express = require('express');
const router = express.Router();

const {
  obtenerResumenGeneral,
  obtenerMantenimientosPorLaboratorio,
  exportarExcel,
} = require('../controllers/reportesController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { permitirRoles, validarLaboratorioAsignado } = require('../middlewares/permisosMiddleware');

/**
 * Módulo de reportería analítica (Semana 9)
 *
 * Todas las rutas requieren JWT válido y uno de los roles permitidos.
 * Únicamente el Superadministrador posee vista global; todos los demás roles
 * consultan únicamente los laboratorios asignados en usuario_laboratorio.
 */

router.use(verificarToken);
router.use(
  permitirRoles(
    'Superadministrador',
    'Administrador',
    'Coordinador',
    'Director',
    'Tecnico',
    'Técnico'
  )
);

// GET /api/reportes/resumen-general
router.get('/resumen-general', obtenerResumenGeneral);

// GET /api/reportes/mantenimientos-laboratorio/:id_laboratorio
router.get(
  '/mantenimientos-laboratorio/:id_laboratorio',
  validarLaboratorioAsignado,
  obtenerMantenimientosPorLaboratorio
);

// GET /api/reportes/exportar-excel
router.get('/exportar-excel', exportarExcel);

module.exports = router;
