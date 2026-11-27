const { normalizarRol, tieneAccesoGlobal } = require('../utils/alcanceUsuario');

const ROLES_GLOBALES = ['superadministrador'];

const ROLES_OPERATIVOS = [
  'superadministrador',
  'administrador',
  'admin',
  'coordinador',
  'director',
  'tecnico',
];

const normalizarTexto = normalizarRol;

const esIdPositivo = (valor) =>
  ['string', 'number'].includes(typeof valor) &&
  /^[1-9]\d*$/.test(String(valor).trim()) &&
  Number.isSafeInteger(Number(valor)) &&
  Number(valor) <= 2147483647;

const fallo = (message, status = 409, datos = null) => {
  const error = new Error(message);
  error.status = status;
  if (datos) error.datos = datos;
  return error;
};

async function tablaExiste(cliente, nombreCalificado) {
  const resultado = await cliente.query('SELECT to_regclass($1) AS tabla', [
    nombreCalificado,
  ]);
  return Boolean(resultado.rows[0]?.tabla);
}

async function contarOrdenesAbiertas(cliente, idUsuario) {
  const existe = await tablaExiste(cliente, 'public.bitacora_mantenimiento');
  if (!existe) {
    return { existeTabla: false, total: 0 };
  }

  const resultado = await cliente.query(
    `
      SELECT COUNT(*)::int AS total
      FROM public.bitacora_mantenimiento
      WHERE id_usuario_tecnico = $1
        AND LOWER(TRIM(estado_mantenimiento)) IN ('en proceso', 'pendiente repuesto')
    `,
    [idUsuario]
  );

  return {
    existeTabla: true,
    total: Number(resultado.rows[0]?.total ?? 0),
  };
}

/**
 * RN15: Antes de desactivar un usuario con órdenes abiertas ('En Proceso' o
 * 'Pendiente Repuesto'), exige indicar un usuario sustituto activo y autorizado
 * y reasigna SOLO las órdenes abiertas dentro de la transacción actual,
 * conservando intacta la autoría de las órdenes 'Completado'.
 */
async function validarYReasignarOrdenesAbiertas(
  cliente,
  idUsuario,
  idTecnicoSustituto
) {
  const { existeTabla, total } = await contarOrdenesAbiertas(
    cliente,
    idUsuario
  );

  if (!existeTabla || total === 0) {
    return { reasignadas: 0, idSustituto: null };
  }

  const vacio =
    idTecnicoSustituto === undefined ||
    idTecnicoSustituto === null ||
    String(idTecnicoSustituto).trim() === '';

  if (vacio) {
    const etiqueta =
      total === 1
        ? '1 orden de mantenimiento abierta'
        : `${total} órdenes de mantenimiento abiertas`;
    throw fallo(
      `El usuario tiene ${etiqueta}. Debe seleccionar un usuario activo y autorizado para reasignarlas antes de desactivar la cuenta (RN15).`,
      409,
      {
        codigo: 'ORDENES_ABIERTAS',
        ordenes_abiertas: total,
      }
    );
  }

  if (!esIdPositivo(idTecnicoSustituto)) {
    throw fallo('El identificador del técnico sustituto no es válido.', 400);
  }

  const idSustituto = Number(idTecnicoSustituto);
  if (idSustituto === Number(idUsuario)) {
    throw fallo(
      'No puede reasignar las órdenes abiertas al mismo usuario que se desactiva (RN15).',
      400
    );
  }

  const resSustituto = await cliente.query(
    `
      SELECT u.id_usuario, u.activo, r.nombre AS rol
      FROM public.usuario u
      INNER JOIN public.rol r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = $1
      FOR UPDATE OF u
    `,
    [idSustituto]
  );

  if (resSustituto.rowCount === 0) {
    throw fallo('El técnico sustituto seleccionado no existe.', 404);
  }

  const sustituto = resSustituto.rows[0];
  if (!sustituto.activo) {
    throw fallo(
      'El usuario sustituto debe tener una cuenta activa para recibir órdenes abiertas (RN15).',
      409
    );
  }

  const rolSustituto = normalizarTexto(sustituto.rol);
  if (!ROLES_OPERATIVOS.includes(rolSustituto)) {
    throw fallo(
      'El usuario sustituto no tiene un rol autorizado para gestionar mantenimientos (RN15).',
      409
    );
  }

  // Si el sustituto no tiene acceso global (solo Superadministrador), comprobar que
  // tenga permiso sobre los laboratorios de las órdenes abiertas (cuando las tablas existan).
  if (!tieneAccesoGlobal(rolSustituto)) {
    const [hayEquipo, hayLab, hayUsuarioSede, hayUsuarioLab] =
      await Promise.all([
        tablaExiste(cliente, 'public.equipo'),
        tablaExiste(cliente, 'public.laboratorio'),
        tablaExiste(cliente, 'public.usuario_sede'),
        tablaExiste(cliente, 'public.usuario_laboratorio'),
      ]);

    if (hayEquipo && hayLab && hayUsuarioSede && hayUsuarioLab) {
      const sinAcceso = await cliente.query(
        `
          SELECT DISTINCT l.id_laboratorio
          FROM public.bitacora_mantenimiento bm
          INNER JOIN public.equipo e ON e.id_equipo = bm.id_equipo
          INNER JOIN public.laboratorio l ON l.id_laboratorio = e.id_laboratorio
          WHERE bm.id_usuario_tecnico = $1
            AND LOWER(TRIM(bm.estado_mantenimiento)) IN ('en proceso', 'pendiente repuesto')
            AND NOT EXISTS (
              SELECT 1
              FROM public.usuario_sede us
              INNER JOIN public.usuario_laboratorio ul
                ON ul.id_usuario_sede = us.id_usuario_sede
              WHERE us.id_usuario = $2
                AND us.id_sede = l.id_sede
                AND ul.id_laboratorio = l.id_laboratorio
            )
          LIMIT 1
        `,
        [idUsuario, idSustituto]
      );

      if (sinAcceso.rowCount > 0) {
        throw fallo(
          'El técnico sustituto no tiene acceso a todos los laboratorios de las órdenes abiertas. Seleccione un técnico asignado a esos laboratorios o un usuario con acceso global (RN15).',
          409
        );
      }
    }
  }

  const reasignacion = await cliente.query(
    `
      UPDATE public.bitacora_mantenimiento
      SET id_usuario_tecnico = $1
      WHERE id_usuario_tecnico = $2
        AND LOWER(TRIM(estado_mantenimiento)) IN ('en proceso', 'pendiente repuesto')
      RETURNING id_bitacora
    `,
    [idSustituto, idUsuario]
  );

  return {
    reasignadas: reasignacion.rowCount,
    idSustituto,
  };
}

module.exports = {
  ROLES_OPERATIVOS,
  ROLES_GLOBALES,
  normalizarTexto,
  contarOrdenesAbiertas,
  validarYReasignarOrdenesAbiertas,
};
