const pool = require('../config/database');

/**
 * Middleware para autorizar acciones según el rol del usuario.
 *
 * Ejemplo:
 * permitirRoles('Superadministrador', 'Tecnico')
 *
 * La comparación no distingue mayúsculas ni minúsculas.
 */
const permitirRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        // Verificar que el usuario esté autenticado
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: 'No se encontró la sesión del usuario para verificar permisos'
            });
        }

        const rolUsuario = req.usuario.rol;

        const rolesNormalizados = rolesPermitidos.map(
            (rol) => String(rol).toLowerCase().trim()
        );

        // Comprobar si el usuario posee un rol autorizado
        if (
            !rolUsuario ||
            !rolesNormalizados.includes(
                String(rolUsuario).toLowerCase().trim()
            )
        ) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado: no tienes permisos para realizar esta acción'
            });
        }

        next();
    };
};

/**
 * Verifica que el usuario tenga asignada la sede solicitada.
 *
 * El Superadministrador posee acceso global.
 * Los demás usuarios deben estar asignados a la sede.
 */
const validarSedeAsignada = async (req, res, next) => {
    // No continuar si falta la sesión autenticada
    if (!req.usuario) {
        return res.status(401).json({
            success: false,
            message: 'Sesión no válida. Inicie sesión nuevamente.'
        });
    }

    try {
        const idUsuario = req.usuario.idUsuario;

        const rolUsuario = String(
            req.usuario.rol || ''
        ).toLowerCase().trim();

        // Únicamente el Superadministrador tiene acceso global
        if (rolUsuario === 'superadministrador') {
            return next();
        }

        // Obtener la sede desde params, body o query
        const idSede =
            req.params.idSede ||
            req.params.id_sede ||
            req.body?.id_sede ||
            req.query.id_sede;

        if (!idSede) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar el id de la sede para validar permisos de acceso'
            });
        }

        // Verificar asignación del usuario a la sede
        const consulta = `
            SELECT id_sede
            FROM public.usuario_sede
            WHERE id_usuario = $1
              AND id_sede = $2
            LIMIT 1
        `;

        const resultado = await pool.query(
            consulta,
            [idUsuario, idSede]
        );

        if (resultado.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado: no estás asignado a esta sede'
            });
        }

        return next();

    } catch (error) {
        // Registrar detalles únicamente en el servidor
        console.error('Error al validar la sede del usuario:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno al verificar los permisos de sede'
        });
    }
};

/**
 * Verifica que el usuario tenga asignado el laboratorio.
 *
 * El Superadministrador posee acceso global.
 * Los demás usuarios deben tener una asignación válida
 * en usuario_sede y usuario_laboratorio.
 */
const validarLaboratorioAsignado = async (req, res, next) => {
    if (!req.usuario) {
        return res.status(401).json({
            success: false,
            message: 'Sesión no válida. Inicie sesión nuevamente.'
        });
    }

    try {
        const idUsuario = req.usuario.idUsuario;

        const rolUsuario = String(
            req.usuario.rol || ''
        ).toLowerCase().trim();

        // Únicamente el Superadministrador tiene acceso global
        if (rolUsuario === 'superadministrador') {
            return next();
        }

        // Obtener el laboratorio desde params, body o query
        const idLaboratorio =
            req.params.idLaboratorio ||
            req.params.id_laboratorio ||
            req.body?.id_laboratorio ||
            req.query.id_laboratorio;

        if (!idLaboratorio) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar el id del laboratorio para validar permisos de acceso'
            });
        }

        // Verificar laboratorio asignado a través de la sede
        const consulta = `
            SELECT ul.id_laboratorio
            FROM public.usuario_laboratorio ul
            INNER JOIN public.usuario_sede us
                ON ul.id_usuario_sede = us.id_usuario_sede
            WHERE us.id_usuario = $1
              AND ul.id_laboratorio = $2
              AND ul.id_sede = us.id_sede
            LIMIT 1
        `;

        const resultado = await pool.query(
            consulta,
            [idUsuario, idLaboratorio]
        );

        if (resultado.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado: no estás asignado a este laboratorio'
            });
        }

        return next();

    } catch (error) {
        // Nunca exponer detalles internos de PostgreSQL al cliente
        console.error(
            'Error al validar el laboratorio del usuario:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Error interno al verificar los permisos de laboratorio'
        });
    }
};

module.exports = {
    permitirRoles,
    validarSedeAsignada,
    validarLaboratorioAsignado
};
