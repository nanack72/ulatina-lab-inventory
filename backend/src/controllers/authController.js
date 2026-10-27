const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Procesa el inicio de sesión del usuario
const login = async (req, res) => {
    const { correo, contrasena } = req.body;

    // Validamos que vengan ambos campos
    if (!correo || !contrasena) {
        return res.status(400).json({
            success: false,
            message: 'Debe ingresar correo y contraseña'
        });
    }

    try {
        // Buscamos el usuario junto con el nombre de su rol
        const query = `
                SELECT
                    u.id_usuario,
                    u.id_rol,
                    u.nombre_completo,
                    u.correo_institucional,
                    u.contrasena_hash,
                    u.activo,
                    r.nombre AS rol
                FROM public.usuario u
                INNER JOIN public.rol r ON u.id_rol = r.id_rol
                WHERE LOWER(u.correo_institucional) = LOWER($1)
                LIMIT 1
            `;

        const resultado = await pool.query(query, [correo.trim()]);

        // Si no existe el correo
        if (resultado.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const usuario = resultado.rows[0];

        // Validamos si la cuenta está activa
        if (!usuario.activo) {
            return res.status(403).json({
                success: false,
                message: 'Usuario inactivo. Contacte al administrador.'
            });
        }

        // Comparamos la contraseña enviada con el hash de la base de datos
        const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
        if (!contrasenaValida) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Validamos que JWT_SECRET esté configurado en las variables de entorno
        if (!process.env.JWT_SECRET) {
            console.error('ERROR CRÍTICO: JWT_SECRET no está configurado en las variables de entorno (.env)');
            return res.status(500).json({
                success: false,
                message: 'Error de configuración del servidor: falta JWT_SECRET en las variables de entorno'
            });
        }

        // Armamos el token con los datos clave del usuario
        const token = jwt.sign(
            {
                idUsuario: usuario.id_usuario,
                nombre: usuario.nombre_completo,
                correo: usuario.correo_institucional,
                idRol: usuario.id_rol,
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        // Devolvemos el token y los datos básicos (sin el hash de la contraseña)
        res.json({
            success: true,
            message: 'Inicio de sesión exitoso',
            token,
            usuario: {
                idUsuario: usuario.id_usuario,
                nombre: usuario.nombre_completo,
                correo: usuario.correo_institucional,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al procesar el login',
            error: error.message
        });
    }
};

// Devuelve los datos del usuario logueado usando su token
const obtenerPerfil = (req, res) => {
    // req.usuario ya viene cargado gracias a authMiddleware
    res.json({
        success: true,
        usuario: req.usuario
    });
};

module.exports = {
    login,
    obtenerPerfil
};
