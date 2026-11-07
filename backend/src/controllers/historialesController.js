const pool = require('../config/database');

const {
  verificarAccesoEquipo,
} = require('../utils/accesoEquipos');

// ==========================================
// VALIDAR IDENTIFICADOR
// ==========================================

const validarId = (id) => {
  return /^[1-9]\d*$/.test(id) &&
    Number.isSafeInteger(Number(id));
};

// ==========================================
// VERIFICAR ACCESO AL EQUIPO
// ==========================================

const validarAccesoHistorial = async (req, res) => {
  const { id } = req.params;

  if (!validarId(id)) {
    res.status(400).json({
      success: false,
      message: 'El identificador del equipo no es válido',
    });

    return false;
  }

  if (!req.usuario?.idUsuario) {
    res.status(403).json({
      success: false,
      message: 'Usuario sin autorización válida',
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
      message: 'Equipo no encontrado o sin acceso autorizado',
    });

    return false;
  }

  return true;
};

// ==========================================
// HISTORIAL DE UBICACIONES
// ==========================================

const obtenerHistorialUbicacion = async (req, res) => {
  try {
    if (!(await validarAccesoHistorial(req, res))) {
      return;
    }

    const resultado = await pool.query(
      `
      SELECT
        hu.id_historial_ubicacion,
        hu.id_equipo,

        hu.id_laboratorio_origen,
        hu.id_laboratorio_destino,
        hu.id_usuario,

        hu.ubicacion_detalle_anterior,
        hu.ubicacion_detalle_nueva,
        hu.fecha,

        u.nombre_completo AS nombre_usuario,

        lo.nombre AS nombre_laboratorio_origen,
        ld.nombre AS nombre_laboratorio_destino,

        so.nombre AS nombre_sede_origen,
        sd.nombre AS nombre_sede_destino,

        CASE
          WHEN hu.id_laboratorio_origen IS NULL
            AND hu.ubicacion_detalle_anterior IS NULL
            THEN 'asignacion_inicial'

          WHEN hu.id_laboratorio_origen IS DISTINCT FROM
               hu.id_laboratorio_destino
            THEN 'traslado_laboratorio'

          ELSE 'cambio_ubicacion'
        END AS tipo_movimiento

      FROM public.historial_ubicacion hu

      LEFT JOIN public.usuario u
        ON u.id_usuario = hu.id_usuario

      LEFT JOIN public.laboratorio lo
        ON lo.id_laboratorio =
           hu.id_laboratorio_origen

      LEFT JOIN public.laboratorio ld
        ON ld.id_laboratorio =
           hu.id_laboratorio_destino

      LEFT JOIN public.sede so
        ON so.id_sede = lo.id_sede

      LEFT JOIN public.sede sd
        ON sd.id_sede = ld.id_sede

      WHERE hu.id_equipo = $1

      ORDER BY
        hu.fecha DESC,
        hu.id_historial_ubicacion DESC
      `,
      [Number(req.params.id)]
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows,
    });

  } catch (error) {
    console.error(
      'Error al consultar historial de ubicación:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de ubicación',
    });
  }
};

// ==========================================
// HISTORIAL DE ESTADOS
// ==========================================

const obtenerHistorialEstados = async (req, res) => {
  try {
    if (!(await validarAccesoHistorial(req, res))) {
      return;
    }

    const resultado = await pool.query(
      `
      SELECT *
      FROM public.historial_estado
      WHERE id_equipo = $1
      `,
      [Number(req.params.id)]
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows,
    });

  } catch (error) {
    console.error(
      'Error al consultar historial de estados:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de estados',
    });
  }
};

// ==========================================
// HISTORIAL DE MODIFICACIONES
// ==========================================

const obtenerHistorialCambios = async (req, res) => {
  try {
    if (!(await validarAccesoHistorial(req, res))) {
      return;
    }

    const resultado = await pool.query(
      `
      SELECT *
      FROM public.historial_cambio
      WHERE id_equipo = $1
      `,
      [Number(req.params.id)]
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows,
    });

  } catch (error) {
    console.error(
      'Error al consultar historial de cambios:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de cambios',
    });
  }
};

// ==========================================
// EXPORTACIONES
// ==========================================

module.exports = {
  obtenerHistorialUbicacion,
  obtenerHistorialEstados,
  obtenerHistorialCambios,
};
