const pool = require('../config/database');

// Obtener todas las categorías
const obtenerCategorias = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        id_categoria,
        nombre,
        descripcion
      FROM public.categoria
      ORDER BY nombre ASC
    `);

    res.json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });
  } catch (error) {
    console.error('Error al obtener categorías:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error al consultar las categorías'
    });
  }
};

module.exports = { obtenerCategorias };