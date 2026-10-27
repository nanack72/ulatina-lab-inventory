const pool = require('../config/database');

// Validar el identificador de un equipo
const validarId = (id) => {
  return /^[1-9]\d*$/.test(id) &&
    Number.isSafeInteger(Number(id));
};

// Verificar si el equipo existe
const verificarEquipo = async (id) => {
  const resultado = await pool.query(
    'SELECT id_equipo FROM public.equipo WHERE id_equipo = $1',
    [Number(id)]
  );

  return resultado.rowCount > 0;
};

// Consultar historial de ubicación
const obtenerHistorialUbicacion = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del equipo no es válido'
      });
    }

    if (!(await verificarEquipo(id))) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    const resultado = await pool.query(
      `SELECT *
       FROM public.historial_ubicacion
       WHERE id_equipo = $1`,
      [Number(id)]
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al consultar historial de ubicación:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de ubicación'
    });
  }
};

// Consultar historial de estados
const obtenerHistorialEstados = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del equipo no es válido'
      });
    }

    if (!(await verificarEquipo(id))) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    const resultado = await pool.query(
      `SELECT *
       FROM public.historial_estado
       WHERE id_equipo = $1`,
      [Number(id)]
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al consultar historial de estados:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de estados'
    });
  }
};

// Consultar historial de modificaciones generales
const obtenerHistorialCambios = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validarId(id)) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del equipo no es válido'
      });
    }

    if (!(await verificarEquipo(id))) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    const resultado = await pool.query(
      `SELECT *
       FROM public.historial_cambio
       WHERE id_equipo = $1`,
      [Number(id)]
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al consultar historial de cambios:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de cambios'
    });
  }
};

// Exportar los tres controladores
module.exports = {
  obtenerHistorialUbicacion,
  obtenerHistorialEstados,
  obtenerHistorialCambios
};
