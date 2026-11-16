const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');

// Procesa el inicio de sesión del usuario.
const login = async (req, res) => {
    const { correo, contrasena } = req.body || {};

    if (
        typeof correo !== 'string' ||
        typeof contrasena !== 'string' ||
        !correo.trim() ||
        !contrasena
    ) {
        return res.status(400).json({
            success: false,
            message: 'Debe ingresar correo y contraseña'
        });
    }

    try {
        // Obtener los datos actuales del usuario y su permiso.
        const query = `
            SELECT
                u.id_usuario,
                u.id_rol,
                u.nombre_completo,
                u.correo_institucional,
                u.contrasena_hash,
                u.activo,
                u.permiso_inventario,
                r.nombre AS rol
            FROM public.usuario u
            INNER JOIN public.rol r
                ON u.id_rol = r.id_rol
            WHERE LOWER(u.correo_institucional) = LOWER($1)
            LIMIT 1
        `;

        const resultado = await pool.query(query, [
            correo.trim()
        ]);

        if (resultado.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const usuario = resultado.rows[0];

        if (!usuario.activo) {
            return res.status(403).json({
                success: false,
                message: 'Usuario inactivo. Contacte al administrador.'
            });
        }

        const contrasenaValida = await bcrypt.compare(
            contrasena,
            usuario.contrasena_hash
        );

        if (!contrasenaValida) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error(
                'ERROR CRÍTICO: JWT_SECRET no está configurado.'
            );

            return res.status(500).json({
                success: false,
                message: 'Error interno de configuración del servidor'
            });
        }

        // El permiso se consulta en PostgreSQL mediante authMiddleware.
        const token = jwt.sign(
            {
                idUsuario: usuario.id_usuario,
                nombre: usuario.nombre_completo,
                correo: usuario.correo_institucional,
                idRol: usuario.id_rol,
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '8h',
                jwtid: crypto.randomUUID(),
                algorithm: 'HS256'
            }
        );

        // Nunca devolver el hash de la contraseña.
        return res.json({
            success: true,
            message: 'Inicio de sesión exitoso',
            token,
            usuario: {
                idUsuario: usuario.id_usuario,
                nombre: usuario.nombre_completo,
                correo: usuario.correo_institucional,
                rol: usuario.rol,
                permiso_inventario: usuario.permiso_inventario
            }
        });
    } catch (error) {
        console.error('Error en login:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor al procesar el login'
        });
    }
};

// Devuelve los datos cargados por authMiddleware.
const obtenerPerfil = (req, res) => {
    return res.json({
        success: true,
        usuario: req.usuario
    });
};

// Cierra la sesión revocando el token.
const logout = async (req, res) => {
    const { idUsuario, jti, exp } = req.usuario;

    try {
        await pool.query(
            `
            INSERT INTO public.token_revocado
                (jti, id_usuario, expira_en)
            VALUES
                ($1::uuid, $2, to_timestamp($3))
            ON CONFLICT (jti) DO NOTHING
            `,
            [jti, idUsuario, exp]
        );

        return res.status(200).json({
            success: true,
            message: 'Sesión cerrada correctamente'
        });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);

        return res.status(500).json({
            success: false,
            message: 'No fue posible cerrar la sesión de forma segura'
        });
    }
};

// Cambia la contraseña de la cuenta autenticada.
const cambiarContrasena = async (req, res) => {
    const idUsuario = req.usuario.idUsuario;
    const { contrasenaActual, contrasenaNueva } = req.body || {};

    if (
        typeof contrasenaActual !== 'string' ||
        typeof contrasenaNueva !== 'string' ||
        !contrasenaActual ||
        !contrasenaNueva
    ) {
        return res.status(400).json({
            success: false,
            message: 'Debe ingresar la contraseña actual y la nueva.'
        });
    }

    if (
        contrasenaNueva.length < 12 ||
        Buffer.byteLength(contrasenaNueva, 'utf8') > 72
    ) {
        return res.status(400).json({
            success: false,
            message:
                'La nueva contraseña debe tener al menos 12 caracteres y no superar 72 bytes.'
        });
    }

    if (contrasenaActual === contrasenaNueva) {
        return res.status(400).json({
            success: false,
            message: 'La nueva contraseña debe ser diferente de la actual.'
        });
    }

    try {
        const resultado = await pool.query(
            `
            SELECT contrasena_hash
            FROM public.usuario
            WHERE id_usuario = $1
              AND activo = true
            `,
            [idUsuario]
        );

        if (resultado.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'La cuenta no está disponible.'
            });
        }

        const hashActual = resultado.rows[0].contrasena_hash;

        const esCorrecta = await bcrypt.compare(
            contrasenaActual,
            hashActual
        );

        if (!esCorrecta) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña actual es incorrecta.'
            });
        }

        const hashNuevo = await bcrypt.hash(
            contrasenaNueva,
            12
        );

        const actualizacion = await pool.query(
            `
            UPDATE public.usuario
            SET contrasena_hash = $1
            WHERE id_usuario = $2
              AND activo = true
              AND contrasena_hash = $3
            RETURNING id_usuario
            `,
            [hashNuevo, idUsuario, hashActual]
        );

        if (actualizacion.rowCount === 0) {
            return res.status(409).json({
                success: false,
                message:
                    'La contraseña fue modificada durante la operación. Intente nuevamente.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Contraseña actualizada correctamente.'
        });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);

        return res.status(500).json({
            success: false,
            message: 'No fue posible actualizar la contraseña.'
        });
    }
};

module.exports = {
    login,
    obtenerPerfil,
    logout,
    cambiarContrasena
};