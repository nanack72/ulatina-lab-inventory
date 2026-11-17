const express = require('express');
const router = express.Router();

const {
  subirEvidencia,
  obtenerEvidenciasPorBitacora
} = require('../controllers/evidenciasController');

const { verificarToken } = require('../middlewares/authMiddleware');
const { permitirRoles } = require('../middlewares/permisosMiddleware');
const { subirFoto } = require('../middlewares/uploadMiddleware');

/**
 * Evidencias fotográficas de mantenimientos.
 * Todas las rutas requieren JWT válido. El acceso por laboratorio
 * se valida en el controlador a partir de la bitácora indicada.
 */

router.use(verificarToken);

// POST /api/evidencias
// El JWT y el rol se validan ANTES de que multer escriba nada en disco.
router.post(
  '/',
  permitirRoles('SuperAdministrador', 'Administrador', 'Tecnico'),
  subirFoto,
  subirEvidencia
);

// GET /api/evidencias/bitacora/:id_bitacora
router.get('/bitacora/:id_bitacora', obtenerEvidenciasPorBitacora);

module.exports = router;

