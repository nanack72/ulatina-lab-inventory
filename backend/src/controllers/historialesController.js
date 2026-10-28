const pool = require('../config/database');

const {
  verificarAccesoEquipo
} = require('../utils/accesoEquipos');

// Validar el identificador del equipo
const validarId = (id) => {
  return /^[1-9]\d*$/.test(id) &&
    Number.isSafeInteger(Number(id));
};

// Comprobar acceso antes de consultar el historial
const validarAccesoHistorial = async (req, res) => {
  const { id } = req.params;

  if (!validarId(id)) {
    res.status(400).json({
      success: false,
      message: 'El identificador del equipo no es válido'
    });

    return false;
  }

  if (!req.usuario?.idUsuario) {
    res.status(403).json({
      success: false,
      message: 'Usuario sin autorización válida'
    });

    return false;
  }

  const autorizado = await verificarAccesoEquipo(
    id,
    req.usuario
  );

  if (!autorizado) {
    res.status(404).json({
      success: false,
      message: 'Equipo no encontrado o sin acceso autorizado'
    });

    return false;
  }

  return true;
};

// Consultar historial de ubicación
const obtenerHistorialUbicacion = async (req, res) => {
  try {
    if (!(await validarAccesoHistorial(req, res))) {
      return;
    }

    const resultado = await pool.query(
      `SELECT *
       FROM public.historial_ubicacion
       WHERE id_equipo = $1`,
      [Number(req.params.id)]
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
    if (!(await validarAccesoHistorial(req, res))) {
      return;
    }

    const resultado = await pool.query(
      `SELECT *
       FROM public.historial_estado
       WHERE id_equipo = $1`,
      [Number(req.params.id)]
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

// Consultar historial de modificaciones
const obtenerHistorialCambios = async (req, res) => {
  try {
    if (!(await validarAccesoHistorial(req, res))) {
      return;
    }

    const resultado = await pool.query(
      `SELECT *
       FROM public.historial_cambio
       WHERE id_equipo = $1`,
      [Number(req.params.id)]
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

module.exports = {
  obtenerHistorialUbicacion,
  obtenerHistorialEstados,
  obtenerHistorialCambios
};
