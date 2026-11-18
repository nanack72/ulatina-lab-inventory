const pool = require('../config/database');
const { consultarPaginaInventario } = require('../services/inventarioPaginado');

async function obtenerPaginaInventario(req, res) {
  try {
    return res.json(await consultarPaginaInventario(pool, req.query, req.usuario));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error al paginar inventario:', error);
    return res.status(500).json({ success: false, message: 'No se pudo cargar la página del inventario.' });
  }
}

module.exports = { obtenerPaginaInventario };
