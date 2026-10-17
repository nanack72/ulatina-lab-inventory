const pool = require('../config/database');

// Obtener todos los equipos con su información relacionada
const obtenerEquipos = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        e.id_equipo,
        e.nombre,
        e.numero_serie,
        e.placa_institucional,
        e.marca,
        e.modelo,
        e.anio,
        e.caracteristicas,
        e.comentarios,
        e.ubicacion_detalle,

        e.id_categoria,
        c.nombre AS categoria,

        e.id_estado,
        es.nombre AS estado,

        e.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS laboratorio,

        s.id_sede,
        s.nombre AS sede

      FROM public.equipo e

      INNER JOIN public.categoria c
        ON e.id_categoria = c.id_categoria

      INNER JOIN public.estado es
        ON e.id_estado = es.id_estado

      INNER JOIN public.laboratorio l
        ON e.id_laboratorio = l.id_laboratorio

      INNER JOIN public.sede s
        ON l.id_sede = s.id_sede

      ORDER BY e.id_equipo DESC
    `);

    res.json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error('Error al obtener equipos:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error al consultar los equipos'
    });
  }
};

module.exports = { obtenerEquipos };