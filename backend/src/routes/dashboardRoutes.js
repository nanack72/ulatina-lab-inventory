const express = require('express');
const router = express.Router();

const { obtenerActividadReciente } = require('../controllers/dashboardController');

const { verificarToken } = require('../middlewares/authMiddleware');

// Todas las rutas requieren sesión válida
router.use(verificarToken);

// GET /api/dashboard/actividad
router.get('/actividad', obtenerActividadReciente);
router.get('/equipos-revision', async (req, res) => {
  try {
    const { listarEquiposRevision } = require('../services/equiposRevision');
    const pool = require('../config/database');
    res.json(await listarEquiposRevision(pool, req.query, req.usuario));
  } catch (error) {
    if (!error.status) console.error('Error al consultar equipos por revisar:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'No fue posible consultar los equipos por revisar.',
    });
  }
});

module.exports = router;
