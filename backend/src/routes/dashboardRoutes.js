const express = require('express');
const router = express.Router();

const {
  obtenerActividadReciente
} = require('../controllers/dashboardController');

const { verificarToken } = require('../middlewares/authMiddleware');

// Todas las rutas requieren sesión válida
router.use(verificarToken);

// GET /api/dashboard/actividad
router.get('/actividad', obtenerActividadReciente);

module.exports = router;