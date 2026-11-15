const pool = require('../config/database');

const {
  puedeRegistrarInventario,
} = require('../utils/permisosInventario');

// GET /api/laboratorios
// Devuelve los laboratorios autorizados para los
// formularios de registro y edición de inventario.
const obtenerLaboratorios = async (req, res) => {
  try {
    const usuario = req.usuario;

    if (!usuario || !usuario.idUsuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      });
    }

    const idUsuario = Number(usuario.idUsuario);

    if (
      !Number.isSafeInteger(idUsuario) ||
      idUsuario <= 0
    ) {
      return res.status(401).json({
        success: false,
        message: 'Sesión de usuario no válida',
      });
    }

    const rol = String(usuario.rol || '')
      .toLowerCase()
      .trim();

    const esSuperAdministrador =
      rol === 'superadministrador';

    // Registro y edición pueden cargar los laboratorios.
    // El permiso de edición incluye el de registro.
    if (!puedeRegistrarInventario(usuario)) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene permisos para utilizar los formularios de inventario.',
      });
    }

    const consulta = `
      SELECT
        l.id_laboratorio,
        l.codigo,
        l.nombre,
        l.id_sede,
        s.nombre AS nombre_sede
      FROM public.laboratorio l
      INNER JOIN public.sede s
        ON s.id_sede = l.id_sede
      WHERE (
        $2::boolean
        OR EXISTS (
          SELECT 1
          FROM public.usuario_sede us
          INNER JOIN public.usuario_laboratorio ul
            ON ul.id_usuario_sede = us.id_usuario_sede
          WHERE us.id_usuario = $1
            AND us.id_sede = l.id_sede
            AND ul.id_sede = l.id_sede
            AND ul.id_laboratorio = l.id_laboratorio
        )
      )
      ORDER BY s.nombre ASC, l.nombre ASC
    `;

    const resultado = await pool.query(consulta, [
      idUsuario,
      esSuperAdministrador,
    ]);

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows,
    });
  } catch (error) {
    console.error(
      'Error al obtener laboratorios:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar los laboratorios',
    });
  }
};

module.exports = { obtenerLaboratorios };