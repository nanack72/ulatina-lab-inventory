const pool = require('../config/database');

// Obtener todos los laboratorios con su sede
const obtenerLaboratorios = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        l.id_laboratorio,
        l.codigo,
        l.nombre,
        l.id_sede,
        s.nombre AS nombre_sede
      FROM public.laboratorio l
      INNER JOIN public.sede s
        ON l.id_sede = s.id_sede
      ORDER BY s.nombre ASC, l.nombre ASC
    `);

    res.json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error('Error al obtener laboratorios:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error al consultar los laboratorios'
    });
  }
};

module.exports = { obtenerLaboratorios };