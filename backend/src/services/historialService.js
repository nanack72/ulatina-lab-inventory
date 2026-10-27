const pool = require('../config/database');

/**
 * Registra un cambio en el historial de equipos usando el usuario autenticado.
 * 
 * Cumple con el requerimiento de auditoría (Punto 5):
 * Vincula directamente el ID del usuario (extraído del JWT en req.usuario.idUsuario)
 * con la tabla 'historial_cambio' de la base de datos Neon.
 *
 * @param {number} idEquipo - ID del equipo que se modifica
 * @param {number} idUsuario - ID del usuario autenticado (req.usuario.idUsuario)
 * @param {string} campoModificado - Atributo modificado (ej: 'id_estado', 'id_laboratorio', 'comentarios')
 * @param {string|number|null} valorAnterior - Valor previo al cambio
 * @param {string|number|null} valorNuevo - Valor posterior al cambio
 */
const registrarCambioEquipo = async (idEquipo, idUsuario, campoModificado, valorAnterior, valorNuevo) => {
    try {
        const query = `
            INSERT INTO public.historial_cambio 
                (id_equipo, id_usuario, campo_modificado, valor_anterior, valor_nuevo, fecha)
            VALUES 
                ($1, $2, $3, $4, $5, NOW())
            RETURNING id_historial_cambio, fecha;
        `;
        const res = await pool.query(query, [
            idEquipo,
            idUsuario,
            campoModificado,
            valorAnterior !== undefined && valorAnterior !== null ? String(valorAnterior) : null,
            valorNuevo !== undefined && valorNuevo !== null ? String(valorNuevo) : null
        ]);
        return res.rows[0];
    } catch (error) {
        console.error('Error al registrar historial de cambio de equipo:', error.message);
        throw error;
    }
};

module.exports = {
    registrarCambioEquipo
};
