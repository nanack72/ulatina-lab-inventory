const express = require('express');
const router = express.Router();

// Traemos los métodos que programamos en el controlador y el middleware de seguridad
const { login, obtenerPerfil } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Ruta para iniciar sesión en el sistema.
// Es una ruta abierta (pública) porque el usuario aún no tiene sesión iniciada.
// Acá el usuario manda su correo y contraseña, y el controlador se encarga de revisar que la cuenta
// exista en la base de datos, validar la clave con bcrypt y devolverle el token de acceso.
router.post('/login', login);

// Ruta para ver los datos del usuario que está conectado actualmente.
// A diferencia del login, esta ruta sí va protegida porque necesitamos saber quién la está llamando.
// Le colocamos verificarToken en el medio para que sirva de filtro: si la persona no manda el token o
// ya se venció, la petición se frena ahí mismo y ni siquiera entra a obtenerPerfil.
// Si el token es correcto, el middleware deja pasar la solicitud y el controlador responde con los datos de req.usuario.
router.get('/perfil', verificarToken, obtenerPerfil);

module.exports = router;