const pool = require('../config/database');

// Obtener todos los estados
const obtenerEstados = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        id_estado,
        nombre,
        descripcion
      FROM public.estado
      ORDER BY nombre ASC
    `);

    res.json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });
  } catch (error) {
    console.error('Error al obtener estados:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error al consultar los estados'
    });
  }
};

module.exports = { obtenerEstados };