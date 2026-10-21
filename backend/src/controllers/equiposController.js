
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

// Obtener un equipo específico por su ID
const obtenerEquipoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que el ID sea un número entero positivo
    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del equipo no es válido'
      });
    }

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

      WHERE e.id_equipo = $1
    `, [id]);

    // Comprobar si el equipo existe
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    res.json({
      success: true,
      data: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al obtener equipo por ID:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error al consultar el equipo'
    });
  }
};

// Exportar las funciones
module.exports = {
  obtenerEquipos,
  obtenerEquipoPorId
};
