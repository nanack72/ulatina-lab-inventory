const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Proteger rutas y validar la sesión actual.
const verificarToken = async (req, res, next) => {
    if (!process.env.JWT_SECRET) {
        console.error('ERROR: JWT_SECRET no está configurado');

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }

    const authHeader = req.headers['authorization'];

    if (typeof authHeader !== 'string' || !authHeader.trim()) {
        return res.status(401).json({
            success: false,
            message: 'Acceso denegado: falta el token de autenticación'
        });
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();

    let decoded;

    // 1. Verificar firma, algoritmo y vencimiento del JWT.
    try {
        decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ['HS256'] }
        );
    } catch {
        return res.status(401).json({
            success: false,
            message: 'Token inválido o expirado. Inicie sesión nuevamente.'
        });
    }

    // 2. Comprobar los datos obligatorios de la sesión.
    const formatoUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
        !decoded ||
        typeof decoded !== 'object' ||
        typeof decoded.jti !== 'string' ||
        !formatoUUID.test(decoded.jti) ||
        !Number.isSafeInteger(decoded.idUsuario) ||
        decoded.idUsuario <= 0 ||
        !Number.isSafeInteger(decoded.exp)
    ) {
        return res.status(401).json({
            success: false,
            message: 'Sesión inválida. Inicie sesión nuevamente.'
        });
    }

    // 3. Consultar revocación, estado, rol y permiso actuales.
    try {
        const query = `
            SELECT
                u.id_usuario,
                u.id_rol,
                u.nombre_completo,
                u.correo_institucional,
                u.activo,
                u.permiso_inventario,
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

        if (resultado.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Sesión no válida. Inicie sesión nuevamente.'
            });
        }

        const usuario = resultado.rows[0];

        if (!usuario.activo) {
            return res.status(401).json({
                success: false,
                message: 'La cuenta no está activa.'
            });
        }

        if (usuario.revocado) {
            return res.status(401).json({
                success: false,
                message: 'La sesión fue cerrada. Inicie sesión nuevamente.'
            });
        }

        // Los permisos se obtienen de la base de datos,
        // no de valores enviados por el frontend.
        req.usuario = {
            idUsuario: usuario.id_usuario,
            idRol: usuario.id_rol,
            nombre: usuario.nombre_completo,
            correo: usuario.correo_institucional,
            rol: usuario.rol,
            permiso_inventario: usuario.permiso_inventario,
            jti: decoded.jti,
            exp: decoded.exp
        };
    } catch (error) {
        console.error('Error al validar sesión:', error);

        return res.status(500).json({
            success: false,
            message: 'No fue posible validar la sesión.'
        });
    }

    return next();
};

module.exports = { verificarToken };