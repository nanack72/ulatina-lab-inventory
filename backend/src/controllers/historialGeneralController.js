const pool = require('../config/database');

async function obtenerHistorialGeneral(req, res) {
  try {
    const idUsuario = Number(req.usuario?.idUsuario);
    const rol = String(req.usuario?.rol || '').toLowerCase().trim();

    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    const tipo = String(req.query.tipo || 'todos');
    const busqueda = String(req.query.busqueda || '').trim();
    const desde = String(req.query.desde || '');
    const hasta = String(req.query.hasta || '');
    const pagina = Number(req.query.pagina || 1);

    if (!['todos', 'ubicacion', 'estado', 'modificacion'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de historial no válido'
      });
    }

    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000 ||
        busqueda.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros de búsqueda no válidos'
      });
    }

    const fechaValida = (fecha) => {
      if (!fecha) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
      const valor = new Date(`${fecha}T00:00:00Z`);
      return !Number.isNaN(valor.getTime()) &&
        valor.toISOString().slice(0, 10) === fecha;
    };

    if (!fechaValida(desde) || !fechaValida(hasta) ||
        (desde && hasta && desde > hasta)) {
      return res.status(400).json({
        success: false,
        message: 'Rango de fechas no válido'
      });
    }

    const limite = 5;
    const offset = (pagina - 1) * limite;

    const consulta = `
      WITH equipos_visibles AS (
        SELECT
          e.id_equipo,
          e.nombre,
          e.placa_institucional
        FROM public.equipo e
        INNER JOIN public.laboratorio l
          ON l.id_laboratorio = e.id_laboratorio
        WHERE $1::boolean OR EXISTS (
          SELECT 1
          FROM public.usuario_sede us
          INNER JOIN public.usuario_laboratorio ul
            ON ul.id_usuario_sede = us.id_usuario_sede
          WHERE us.id_usuario = $2
            AND us.id_sede = l.id_sede
            AND ul.id_sede = l.id_sede
            AND ul.id_laboratorio = e.id_laboratorio
        )
      ),
      movimientos AS (
        SELECT
          'ubicacion'::text AS tipo,
          hu.id_historial_ubicacion AS id_movimiento,
          hu.fecha,
          ev.id_equipo,
          ev.nombre AS nombre_equipo,
          ev.placa_institucional,
          COALESCE(u.nombre_completo, 'Sistema') AS usuario,
          CASE
            WHEN hu.id_laboratorio_origen IS NULL
             AND hu.ubicacion_detalle_anterior IS NULL
              THEN 'Asignación inicial'
            ELSE 'Cambio de ubicación'
          END AS accion,
          COALESCE(
            lo.nombre || COALESCE(' · ' || hu.ubicacion_detalle_anterior, ''),
            hu.ubicacion_detalle_anterior,
            'Sin ubicación anterior'
          ) AS valor_anterior,
          COALESCE(
            ld.nombre || COALESCE(' · ' || hu.ubicacion_detalle_nueva, ''),
            hu.ubicacion_detalle_nueva,
            'Sin ubicación'
          ) AS valor_nuevo
        FROM public.historial_ubicacion hu
        INNER JOIN equipos_visibles ev ON ev.id_equipo = hu.id_equipo
        LEFT JOIN public.usuario u ON u.id_usuario = hu.id_usuario
        LEFT JOIN public.laboratorio lo
          ON lo.id_laboratorio = hu.id_laboratorio_origen
        LEFT JOIN public.laboratorio ld
          ON ld.id_laboratorio = hu.id_laboratorio_destino

        UNION ALL

        SELECT
          'estado'::text,
          he.id_historial_estado,
          he.fecha,
          ev.id_equipo,
          ev.nombre,
          ev.placa_institucional,
          COALESCE(u.nombre_completo, 'Sistema'),
          CASE
            WHEN he.id_estado_anterior IS NULL THEN 'Estado inicial'
            ELSE 'Cambio de estado'
          END,
          COALESCE(ea.nombre, 'Sin estado anterior'),
          COALESCE(en.nombre, 'Sin estado')
        FROM public.historial_estado he
        INNER JOIN equipos_visibles ev ON ev.id_equipo = he.id_equipo
        LEFT JOIN public.usuario u ON u.id_usuario = he.id_usuario
        LEFT JOIN public.estado ea ON ea.id_estado = he.id_estado_anterior
        LEFT JOIN public.estado en ON en.id_estado = he.id_estado_nuevo

        UNION ALL

        SELECT
          'modificacion'::text,
          hc.id_historial_cambio,
          hc.fecha,
          ev.id_equipo,
          ev.nombre,
          ev.placa_institucional,
          COALESCE(u.nombre_completo, 'Sistema'),
          'Modificación: ' || hc.campo_modificado,
          COALESCE(hc.valor_anterior, 'Sin valor anterior'),
          COALESCE(hc.valor_nuevo, 'Sin valor')
        FROM public.historial_cambio hc
        INNER JOIN equipos_visibles ev ON ev.id_equipo = hc.id_equipo
        LEFT JOIN public.usuario u ON u.id_usuario = hc.id_usuario
      )
      SELECT
        m.*,
        COUNT(*) OVER()::integer AS total_registros
      FROM movimientos m
      WHERE ($3::text = 'todos' OR m.tipo = $3)
        AND (
          $4::text = '' OR
          m.nombre_equipo ILIKE '%' || $4 || '%' OR
          COALESCE(m.placa_institucional, '') ILIKE '%' || $4 || '%' OR
          m.usuario ILIKE '%' || $4 || '%'
        )
        AND ($5::date IS NULL OR m.fecha >= $5::date)
        AND ($6::date IS NULL OR m.fecha < ($6::date + INTERVAL '1 day'))
      ORDER BY m.fecha DESC, m.tipo, m.id_movimiento DESC
      LIMIT $7 OFFSET $8
    `;

    const resultado = await pool.query(consulta, [
      rol === 'superadministrador',
      idUsuario,
      tipo,
      busqueda,
      desde || null,
      hasta || null,
      limite,
      offset
    ]);

    return res.status(200).json({
      success: true,
      data: resultado.rows.map(({ total_registros, ...registro }) => registro),
      total: resultado.rows[0]?.total_registros || 0,
      pagina,
      limite
    });

  } catch (error) {
    console.error('Error al consultar historial general:', error);

    return res.status(500).json({
      success: false,
      message: 'No fue posible consultar el historial general'
    });
  }
}

module.exports = { obtenerHistorialGeneral };
