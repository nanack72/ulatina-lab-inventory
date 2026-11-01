const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Middleware para proteger rutas y validar la sesión
const verificarToken = async (req, res, next) => {

    // Verificamos que exista la clave JWT
    if (!process.env.JWT_SECRET) {
        console.error('ERROR: JWT_SECRET no está configurado');

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }

    // Obtenemos el encabezado de autorización
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Acceso denegado: falta el token de autenticación'
        });
    }

    // Extraemos el token Bearer
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();

    let decoded;

    // 1. Verificar firma, algoritmo y vencimiento del JWT
    try {
        decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ['HS256'] }
        );
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Token inválido o expirado. Inicie sesión nuevamente.'
        });
    }

    // 2. Comprobar que tenga un jti UUID válido
    const formatoUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
        !decoded.jti ||
        typeof decoded.jti !== 'string' ||
        !formatoUUID.test(decoded.jti) ||
        !Number.isInteger(decoded.idUsuario) ||
        !Number.isInteger(decoded.exp)
    ) {
        return res.status(401).json({
            success: false,
            message: 'Sesión inválida. Inicie sesión nuevamente.'
        });
    }

    // 3. Consultar revocación y estado actual del usuario
    try {
        const query = `
            SELECT
                u.id_usuario,
                u.id_rol,
                u.nombre_completo,
                u.correo_institucional,
                u.activo,
                r.nombre AS rol,
                EXISTS (
                    SELECT 1
                    FROM public.token_revocado tr
                    WHERE tr.jti = $2::uuid
                ) AS revocado
            FROM public.usuario u
            INNER JOIN public.rol r
                ON r.id_rol = u.id_rol
            WHERE u.id_usuario = $1
            LIMIT 1
        `;

        const resultado = await pool.query(query, [
            decoded.idUsuario,
            decoded.jti
        ]);

        // Usuario eliminado o inexistente
        if (resultado.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Sesión no válida. Inicie sesión nuevamente.'
            });
        }

        const usuario = resultado.rows[0];

        // Usuario desactivado
        if (!usuario.activo) {
            return res.status(401).json({
                success: false,
                message: 'La cuenta no está activa.'
            });
        }

        // Token revocado
        if (usuario.revocado) {
            return res.status(401).json({
                success: false,
                message: 'La sesión fue cerrada. Inicie sesión nuevamente.'
            });
        }

        // 4. Cargar el usuario con su rol ACTUAL
        req.usuario = {
            idUsuario: usuario.id_usuario,
            idRol: usuario.id_rol,
            nombre: usuario.nombre_completo,
            correo: usuario.correo_institucional,
            rol: usuario.rol,
            jti: decoded.jti,
            exp: decoded.exp
        };

        // Todo correcto: permitir continuar
        return next();

    } catch (error) {
        // Si PostgreSQL falla, NO permitimos el acceso
        console.error('Error al validar sesión:', error);

        return res.status(500).json({
            success: false,
            message: 'No fue posible validar la sesión.'
        });
    }
};

module.exports = { verificarToken };
