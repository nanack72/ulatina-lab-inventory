const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
  login,
  obtenerPerfil,
  logout,
  cambiarContrasena,
} = require('../controllers/authController');

const { verificarToken } = require('../middlewares/authMiddleware');

// Máximo de intentos de login por IP (solo cuentan los fallidos)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LOGIN) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos.',
  },
});

// Ruta pública para iniciar sesión
router.post('/login', limiteLogin, login);

// Ruta protegida para consultar el perfil
router.get('/perfil', verificarToken, obtenerPerfil);

// Ruta protegida para cerrar sesión y revocar el JWT
router.post('/logout', verificarToken, logout);

// Cambiar la contraseña del usuario autenticado
router.patch('/mi-contrasena', verificarToken, cambiarContrasena);

module.exports = router;
