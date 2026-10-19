const jwt = require('jsonwebtoken');

// Middleware para proteger rutas y validar la sesión
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Si no enviaron el token en los headers, frenamos la petición de una vez
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Acceso denegado: falta el token de autenticación'
        });
    }

    // Limpiamos el string por si viene con el prefijo "Bearer "
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();

    try {
        // Validamos la firma del token con nuestra clave del .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Guardamos los datos decodificados en la petición
        req.usuario = decoded; // Queda disponible idUsuario, idRol, correo, etc.

        next(); // Todo bien, continuamos al controlador
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Token inválido o expirado. Por favor, inicie sesión nuevamente.',
            error: error.message
        });
    }
};

module.exports = { verificarToken };