const pool = require('../config/database');

const LIMITE_POR_DEFECTO = 8;
const LIMITE_MAXIMO = 20;

// Comprobar acceso global (mismo criterio que equipos)
const tieneAccesoGlobal = (usuario) => {
  return usuario?.rol?.toLowerCase().trim() ===
    'superadministrador';
};

// =====================================================
// ACTIVIDAD RECIENTE
// GET /api/dashboard/actividad?limite=8
//
// Une los últimos movimientos de tres fuentes:
//  - historial_estado       -> registro / cambio de estado
//  - historial_ubicacion    -> traslados
//  - bitacora_mantenimiento -> mantenimientos
//
// Solo incluye equipos a los que el usuario tiene acceso.
// =====================================================

const obtenerActividadReciente = async (req, res) => {
  try {
    const idUsuario = Number(req.usuario?.idUsuario);

    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    // Validar el límite solicitado
    let limite = LIMITE_POR_DEFECTO;

    if (req.query.limite !== undefined) {
      const valor = req.query.limite;

      if (
        typeof valor !== 'string' ||
        !/^[1-9]\d*$/.test(valor) ||
        Number(valor) > LIMITE_MAXIMO
      ) {
        return res.status(400).json({
          success: false,
          message: `El límite debe ser un entero entre 1 y ${LIMITE_MAXIMO}`
        });
      }

      limite = Number(valor);
    }

    const valores = [limite];
    let restriccion = '';

    if (!tieneAccesoGlobal(req.usuario)) {
      valores.push(idUsuario);

      restriccion = `
        WHERE EXISTS (
          SELECT 1
          FROM public.usuario_sede us
          INNER JOIN public.usuario_laboratorio ul
            ON us.id_usuario_sede = ul.id_usuario_sede
          WHERE us.id_usuario = $2
            AND us.id_sede = l.id_sede
            AND ul.id_sede = l.id_sede
            AND ul.id_laboratorio = e.id_laboratorio
        )
      `;
    }

    const resultado = await pool.query(
      `
      WITH equipos_visibles AS (
        SELECT
          e.id_equipo,
          e.nombre,
          e.placa_institucional
        FROM public.equipo e
        INNER JOIN public.laboratorio l
          ON e.id_laboratorio = l.id_laboratorio
        ${restriccion}
      ),
      movimientos AS (
        (
          SELECT
            CASE
              WHEN he.id_estado_anterior IS NULL
                THEN 'registro'
              ELSE 'cambio_estado'
            END AS tipo,
            he.fecha::timestamptz AS fecha,
            ev.id_equipo,
            ev.nombre,
            ev.placa_institucional,
            en.nombre AS detalle
          FROM public.historial_estado he
          INNER JOIN equipos_visibles ev
            ON ev.id_equipo = he.id_equipo
          LEFT JOIN public.estado en
            ON en.id_estado = he.id_estado_nuevo
          ORDER BY he.fecha DESC
          LIMIT $1
        )
        UNION ALL
        (
          SELECT
            'traslado' AS tipo,
            hu.fecha::timestamptz AS fecha,
            ev.id_equipo,
            ev.nombre,
            ev.placa_institucional,
            ld.nombre AS detalle
          FROM public.historial_ubicacion hu
          INNER JOIN equipos_visibles ev
            ON ev.id_equipo = hu.id_equipo
          LEFT JOIN public.laboratorio ld
            ON ld.id_laboratorio = hu.id_laboratorio_destino
          -- La asignación inicial ya aparece como "registro"
          WHERE NOT (
            hu.id_laboratorio_origen IS NULL
            AND hu.ubicacion_detalle_anterior IS NULL
          )
          ORDER BY hu.fecha DESC
          LIMIT $1
        )
        UNION ALL
        (
          SELECT
            'mantenimiento' AS tipo,
            bm.fecha_mantenimiento::timestamptz AS fecha,
            ev.id_equipo,
            ev.nombre,
            ev.placa_institucional,
            bm.estado_mantenimiento AS detalle
          FROM public.bitacora_mantenimiento bm
          INNER JOIN equipos_visibles ev
            ON ev.id_equipo = bm.id_equipo
          ORDER BY bm.fecha_mantenimiento DESC
          LIMIT $1
        )
      )
      SELECT
        tipo,
        fecha,
        id_equipo,
        nombre,
        placa_institucional,
        detalle
      FROM movimientos
      ORDER BY fecha DESC
      LIMIT $1
      `,
      valores
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al obtener la actividad reciente:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar la actividad reciente'
    });
  }
};

module.exports = { obtenerActividadReciente };