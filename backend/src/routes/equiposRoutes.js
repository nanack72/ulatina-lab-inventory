
const express = require('express');
const router = express.Router();

// ==========================================
// CONTROLADOR DE EQUIPOS
// ==========================================

const {
  obtenerEquipos,
  obtenerEquipoPorId,
  crearEquipo,
  actualizarEquipo
} = require('../controllers/equiposController');

// ==========================================
// CONTROLADOR DE HISTORIALES
// ==========================================

const {
  obtenerHistorialUbicacion,
  obtenerHistorialEstados,
  obtenerHistorialCambios
} = require('../controllers/historialesController');

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN
// ==========================================

const {
  verificarToken
} = require('../middlewares/authMiddleware');

// Proteger todas las rutas de inventario.
// El usuario debe iniciar sesión y tener
// un token JWT válido.
router.use(verificarToken);

// ==========================================
// 1. CONSULTAR TODOS LOS EQUIPOS
// GET /api/equipos
// ==========================================

router.get('/', obtenerEquipos);

// ==========================================
// 2. REGISTRAR UN EQUIPO
// POST /api/equipos
// ==========================================

// El controlador valida el rol y laboratorio
// del usuario antes de registrar el equipo.
router.post('/', crearEquipo);

// ==========================================
// 3. ACTUALIZAR UN EQUIPO
// PUT /api/equipos/:id
// ==========================================

// El controlador verifica los permisos
// y registra los cambios mediante triggers.
router.put('/:id', actualizarEquipo);

// ==========================================
// 4. HISTORIAL DE UBICACIÓN
// GET /api/equipos/:id/historial-ubicacion
// ==========================================

router.get(
  '/:id/historial-ubicacion',
  obtenerHistorialUbicacion
);

// ==========================================
// 5. HISTORIAL DE ESTADOS
// GET /api/equipos/:id/historial-estados
// ==========================================

router.get(
  '/:id/historial-estados',
  obtenerHistorialEstados
);

// ==========================================
// 6. HISTORIAL DE MODIFICACIONES
// GET /api/equipos/:id/historial-cambios
// ==========================================

router.get(
  '/:id/historial-cambios',
  obtenerHistorialCambios
);

// ==========================================
// 7. CONSULTAR UN EQUIPO POR ID
// GET /api/equipos/:id
// ==========================================

router.get('/:id', obtenerEquipoPorId);

// ==========================================
// EXPORTAR RUTAS
// ==========================================

module.exports = router;
