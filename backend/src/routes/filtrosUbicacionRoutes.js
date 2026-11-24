const express = require('express');
const pool = require('../config/database');
const { verificarToken } = require('../middlewares/authMiddleware');
const router = express.Router();
router.get('/', verificarToken, async (req, res) => {
  try {
    const id = Number(req.usuario?.idUsuario);
    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(401).json({ success: false, message: 'Inicie sesión nuevamente.' });
    const global = String(req.usuario.rol).trim().toLowerCase() === 'superadministrador';
    const { rows } = await pool.query(
      `
      SELECT l.id_laboratorio, l.nombre, l.codigo, l.id_sede, s.nombre AS nombre_sede
      FROM public.laboratorio l JOIN public.sede s ON s.id_sede = l.id_sede
      WHERE $2::boolean OR EXISTS (
        SELECT 1 FROM public.usuario_sede us
        JOIN public.usuario_laboratorio ul ON ul.id_usuario_sede = us.id_usuario_sede
        WHERE us.id_usuario = $1 AND us.id_sede = l.id_sede
          AND ul.id_sede = l.id_sede AND ul.id_laboratorio = l.id_laboratorio
      ) ORDER BY s.nombre, l.nombre, l.id_laboratorio`,
      [id, global]
    );
    const sedes = [
      ...new Map(
        rows.map((l) => [l.id_sede, { id_sede: l.id_sede, nombre: l.nombre_sede }])
      ).values(),
    ];
    return res.json({ success: true, data: { sedes, laboratorios: rows } });
  } catch (error) {
    console.error('Error al cargar ubicaciones:', error.message);
    return res
      .status(500)
      .json({ success: false, message: 'No fue posible cargar las sedes y los laboratorios.' });
  }
});
module.exports = router;
