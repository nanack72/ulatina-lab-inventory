const pool = require('../config/database');

// Validar que el usuario tenga permiso sobre el laboratorio
const validarLaboratorioInventario = async (req, res, next) => {
  try {
    const idUsuario = Number(req.usuario?.idUsuario);
    const rol = req.usuario?.rol?.toLowerCase().trim();
    const idLaboratorio = req.body?.id_laboratorio;

    // Verificar que el usuario esté autenticado
    if (
      !Number.isSafeInteger(idUsuario) ||
      idUsuario <= 0
    ) {
      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    // Validar el ID del laboratorio
    if (
      !/^[1-9]\d*$/.test(String(idLaboratorio ?? '')) ||
      !Number.isSafeInteger(Number(idLaboratorio))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Debe indicar un laboratorio válido'
      });
    }

    // Acceso global provisional para superadministrador
    if (rol === 'superadministrador') {
      return next();
    }

    // Comprobar las asignaciones de sede y laboratorio
    const resultado = await pool.query(
      `SELECT 1
       FROM public.usuario_sede us
       INNER JOIN public.usuario_laboratorio ul
         ON us.id_usuario_sede = ul.id_usuario_sede
       INNER JOIN public.laboratorio l
         ON ul.id_laboratorio = l.id_laboratorio
       WHERE us.id_usuario = $1
         AND ul.id_laboratorio = $2
         AND us.id_sede = l.id_sede
         AND ul.id_sede = l.id_sede
       LIMIT 1`,
      [idUsuario, Number(idLaboratorio)]
    );

    if (resultado.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: 'No tienes autorización para registrar equipos en este laboratorio'
      });
    }

    next();

  } catch (error) {
    console.error(
      'Error al validar permisos de inventario:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al verificar permisos de inventario'
    });
  }
};

module.exports = {
  validarLaboratorioInventario
};
