const pool = require('../config/database');

// Obtener todas las sedes
const obtenerSedes = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id_sede, nombre FROM public.sede ORDER BY nombre ASC'
    );

    res.json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });
  } catch (error) {
    console.error('Error al obtener sedes:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error al consultar las sedes'
    });
  }
};

module.exports = { obtenerSedes };