const pool = require('../config/database');

// Middleware para autorizar acciones según el rol del usuario (ej: 'Administrador', 'Tecnico')
// Se le pasan los roles que tienen permiso para entrar a la ruta.
// Por ejemplo: permitirRoles('Administrador') o permitirRoles('Administrador', 'Tecnico')
const permitirRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        // Nos aseguramos de que antes haya pasado por el middleware de autenticación
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: 'No se encontró la sesión del usuario para verificar permisos'
            });
        }

        // Revisamos si el rol del usuario que viene en el token está dentro de la lista permitida
        const rolUsuario = req.usuario.rol;
        if (!rolesPermitidos.includes(rolUsuario)) {
            return res.status(403).json({
                success: false,
                message: `Acceso denegado: tu rol (${rolUsuario}) no tiene permisos para realizar esta acción`
            });
        }

        // Si el rol tiene permiso, dejamos continuar la petición
        next();
    };
};

// Middleware para asegurar que un técnico solo modifique equipos de su sede asignada
// El Administrador tiene permiso global en cualquier sede, pero los técnicos solo en las suyas.
const validarSedeAsignada = async (req, res, next) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const rolUsuario = req.usuario.rol;

        // El rol Administrador no tiene restricciones de sede, puede gestionar todo
        if (rolUsuario === 'Administrador') {
            return next();
        }

        // Buscamos el id de la sede de donde venga en la petición (en la URL, en el body o en query params)
        const idSede = req.params.idSede || req.body.id_sede || req.query.id_sede;

        if (!idSede) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar el id de la sede para validar permisos de acceso'
            });
        }

        // Consultamos en la tabla usuario_sede si este usuario está asignado a esa sede
        const consulta = `
            SELECT id_sede 
            FROM public.usuario_sede 
            WHERE id_usuario = $1 AND id_sede = $2
            LIMIT 1
        `;
        const resultado = await pool.query(consulta, [idUsuario, idSede]);

        // Si la consulta viene vacía, significa que no trabaja en esa sede
        if (resultado.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado: no estás asignado a esta sede'
            });
        }

        // Si está asignado, le damos luz verde para continuar
        next();

    } catch (error) {
        console.error('Error al validar la sede del usuario:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error interno al verificar los permisos de sede',
            error: error.message
        });
    }
};

module.exports = {
    permitirRoles,
    validarSedeAsignada
};
