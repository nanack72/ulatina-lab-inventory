const express = require('express');
const router = express.Router();

const {
  obtenerResumenGeneral,
  obtenerMantenimientosPorLaboratorio,
  exportarExcel
} = require('../controllers/reportesController');

const { verificarToken } = require('../middlewares/authMiddleware');
const {
  permitirRoles,
  validarLaboratorioAsignado
} = require('../middlewares/permisosMiddleware');

/**
 * Módulo de reportería analítica (Semana 9)
 *
 * Todas las rutas requieren JWT válido y uno de los roles permitidos.
 * Los técnicos solo obtienen datos de los laboratorios que tienen
 * asignados en usuario_laboratorio; los demás roles tienen vista global.
 */

router.use(verificarToken);
router.use(
  permitirRoles(
    'Superadministrador',
    'Coordinador',
    'Director',
    'Tecnico',
    'Técnico'
  )
);

// validarLaboratorioAsignado solo se exige a los técnicos. El middleware
// existente deja pasar únicamente a Administrador/Superadministrador, por lo
// que aplicarlo a Coordinador o Director les bloquearía el acceso global.
const laboratorioAsignadoSoloTecnico = (req, res, next) => {
  const rol = (req.usuario?.rol || '').toLowerCase().trim();

  if (rol === 'tecnico' || rol === 'técnico') {
    return validarLaboratorioAsignado(req, res, next);
  }

  return next();
};

// GET /api/reportes/resumen-general
router.get('/resumen-general', obtenerResumenGeneral);

// GET /api/reportes/mantenimientos-laboratorio/:id_laboratorio
router.get(
  '/mantenimientos-laboratorio/:id_laboratorio',
  laboratorioAsignadoSoloTecnico,
  obtenerMantenimientosPorLaboratorio
);

// GET /api/reportes/exportar-excel
router.get('/exportar-excel', exportarExcel);

module.exports = router;

