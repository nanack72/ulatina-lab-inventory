const pool = require('../config/database');

// Middleware para autorizar acciones según el rol del usuario (ej: 'Administrador', 'Tecnico', 'Encargado')
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

        const rolUsuario = req.usuario.rol;
        const rolesNormalizados = rolesPermitidos.map(r => r.toLowerCase().trim());

        // Comprobación flexible (insensible a mayúsculas/minúsculas)
        if (!rolUsuario || !rolesNormalizados.includes(rolUsuario.toLowerCase().trim())) {
            return res.status(403).json({
                success: false,
                message: `Acceso denegado: tu rol (${rolUsuario || 'Sin rol'}) no tiene permisos para realizar esta acción`
            });
        }

        // Si el rol tiene permiso, dejamos continuar la petición
        next();
    };
};

// Middleware para asegurar que un usuario solo modifique recursos de su sede asignada.
// El Administrador tiene permiso global en cualquier sede.
const validarSedeAsignada = async (req, res, next) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const rolUsuario = req.usuario.rol || '';

        // El rol Administrador no tiene restricciones de sede, puede gestionar todo
        if (rolUsuario.toLowerCase() === 'administrador' || rolUsuario.toLowerCase() === 'admin') {
            return next();
        }

        // Buscamos el id de la sede en params, body o query params
        const idSede = req.params.idSede || req.params.id_sede || req.body.id_sede || req.query.id_sede;

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

        // Si la consulta viene vacía, no tiene asignada esa sede
        if (resultado.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado: no estás asignado a esta sede'
            });
        }

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

// Middleware para asegurar que un usuario solo acceda a laboratorios asignados.
// Se valida en la tabla usuario_laboratorio vinculada a través de usuario_sede.
// El Administrador tiene permiso global a todos los laboratorios.
const validarLaboratorioAsignado = async (req, res, next) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const rolUsuario = req.usuario.rol || '';

        // El rol Administrador tiene acceso total a todos los laboratorios
        if (rolUsuario.toLowerCase() === 'administrador' || rolUsuario.toLowerCase() === 'admin') {
            return next();
        }

        // Buscamos el id del laboratorio en params, body o query params
        const idLaboratorio = req.params.idLaboratorio || req.params.id_laboratorio || req.body.id_laboratorio || req.query.id_laboratorio;

        if (!idLaboratorio) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar el id del laboratorio para validar permisos de acceso'
            });
        }

        // Consultamos en usuario_laboratorio a través de usuario_sede
        const consulta = `
            SELECT ul.id_laboratorio
            FROM public.usuario_laboratorio ul
            INNER JOIN public.usuario_sede us ON ul.id_usuario_sede = us.id_usuario_sede
            WHERE us.id_usuario = $1 AND ul.id_laboratorio = $2
            LIMIT 1
        `;
        const resultado = await pool.query(consulta, [idUsuario, idLaboratorio]);

        // Si la consulta viene vacía, no tiene asignado ese laboratorio
        if (resultado.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado: no estás asignado a este laboratorio'
            });
        }

        next();

    } catch (error) {
        console.error('Error al validar el laboratorio del usuario:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error interno al verificar los permisos de laboratorio',
            error: error.message
        });
    }
};

module.exports = {
    permitirRoles,
    validarSedeAsignada,
    validarLaboratorioAsignado
};
