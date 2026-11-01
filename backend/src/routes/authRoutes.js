const express = require('express');
const router = express.Router();

const {
    login,
    obtenerPerfil,
    logout
} = require('../controllers/authController');

const {
    verificarToken
} = require('../middlewares/authMiddleware');

// Ruta pública para iniciar sesión
router.post('/login', login);

// Ruta protegida para consultar el perfil
router.get('/perfil', verificarToken, obtenerPerfil);

// Ruta protegida para cerrar sesión y revocar el JWT
router.post('/logout', verificarToken, logout);

module.exports = router;
