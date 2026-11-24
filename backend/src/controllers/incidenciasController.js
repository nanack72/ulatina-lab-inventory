const pool = require('../config/database');
const { verificarAccesoEquipo } = require('../utils/accesoEquipos');

// Valores canónicos con tilde
const PRIORIDADES_VALIDAS = ['Baja', 'Media', 'Alta', 'Crítica'];
const ESTADOS_VALIDOS = ['Abierta', 'En Revisión', 'Resuelta', 'Descartada'];

const normalizar = (texto) =>
  String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const esIdValido = (valor) =>
  ['string', 'number'].includes(typeof valor) &&
  Number(valor) <= 2147483647 &&
  /^[1-9]\d*$/.test(String(valor ?? '').trim()) &&
  Number.isSafeInteger(Number(valor));

const esUsuarioAdmin = (rol) =>
  ['superadministrador', 'administrador', 'admin', 'coordinador', 'director'].includes(
    normalizar(rol)
  );

/**
 * 1. REGISTRAR INCIDENCIA
 * POST /api/incidencias
 */
const crearIncidencia = async (req, res) => {
  const b = req.body;
  if (
    !b ||
    typeof b !== 'object' ||
    Array.isArray(b) ||
    typeof b.titulo !== 'string' ||
    typeof b.descripcion_falla !== 'string' ||
    b.descripcion_falla.length > 10000 ||
    (b.prioridad !== undefined && typeof b.prioridad !== 'string')
  )
    return res
      .status(400)
      .json({
        success: false,
        message: 'Envíe título, descripción y prioridad con tipos válidos.',
      });
  let cliente;
  let confirmado = false;
  try {
    const { id_equipo, titulo, descripcion_falla, prioridad } = req.body;

    if (!id_equipo || !titulo?.trim() || !descripcion_falla?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Seleccione un equipo e indique el título y la descripción de la falla.',
      });
    }

    if (!esIdValido(id_equipo)) {
      return res.status(400).json({
        success: false,
        message: 'Seleccione un equipo válido.',
      });
    }

    const tituloLimpio = titulo.trim();
    if (tituloLimpio.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'El título de la incidencia no puede exceder los 150 caracteres',
      });
    }

    const prioridadValida = PRIORIDADES_VALIDAS.find(
      (p) => normalizar(p) === normalizar(prioridad || 'Media')
    );

    if (!prioridadValida) {
      return res.status(400).json({
        success: false,
        message: "La prioridad debe ser 'Baja', 'Media', 'Alta' o 'Crítica'",
      });
    }

    const equipoId = Number(id_equipo);

    // Verificar que el equipo exista y no esté eliminado ni dado de baja
    cliente = await pool.connect();
    await cliente.query('BEGIN');
    const equipoRes = await cliente.query(
      `SELECT e.id_equipo, e.id_laboratorio, e.nombre, es.nombre AS estado_equipo
       FROM public.equipo e
       LEFT JOIN public.estado es ON e.id_estado = es.id_estado
       WHERE e.id_equipo = $1 AND e.eliminado_en IS NULL
       FOR SHARE OF e`,
      [equipoId]
    );

    if (equipoRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'El equipo seleccionado no existe en el inventario',
      });
    }

    const estadoActualEquipo = normalizar(equipoRes.rows[0].estado_equipo);
    if (
      estadoActualEquipo.includes('baja') ||
      estadoActualEquipo.includes('retirad') ||
      estadoActualEquipo.includes('eliminad')
    ) {
      return res.status(409).json({
        success: false,
        message: 'No se pueden registrar incidencias sobre un equipo dado de baja',
      });
    }

    // Si es técnico, validar asignación al laboratorio
    if (!esUsuarioAdmin(req.usuario.rol)) {
      const acceso = await verificarAccesoEquipo(equipoId, req.usuario);
      if (!acceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no está asignado al laboratorio de este equipo',
        });
      }
    }

    const resultado = await cliente.query(
      `INSERT INTO public.incidencia_reporte
         (id_equipo, id_usuario_reporta, titulo, descripcion_falla, prioridad, estado_incidencia, fecha_reporte)
       VALUES ($1, $2, $3, $4, $5, 'Abierta', CURRENT_TIMESTAMP)
       RETURNING id_incidencia, id_equipo, id_usuario_reporta, titulo,
                 descripcion_falla, prioridad, estado_incidencia, fecha_reporte`,
      [
        equipoId,
        Number(req.usuario.idUsuario),
        tituloLimpio,
        descripcion_falla.trim(),
        prioridadValida,
      ]
    );

    await cliente.query('COMMIT');
    confirmado = true;
    return res.status(201).json({
      success: true,
      message: 'Incidencia técnica registrada correctamente',
      data: resultado.rows[0],
    });
  } catch (error) {
    console.error('Error al registrar incidencia:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al registrar la incidencia',
    });
  } finally {
    if (cliente) {
      if (!confirmado) await cliente.query('ROLLBACK').catch(() => {});
      cliente.release();
    }
  }
};

/**
 * 2. LISTAR INCIDENCIAS
 * GET /api/incidencias
 */
const obtenerIncidencias = async (req, res) => {
  if (
    ['estado', 'prioridad', 'busqueda'].some(
      (c) =>
        req.query[c] !== undefined &&
        (typeof req.query[c] !== 'string' || req.query[c].length > 200)
    )
  )
    return res.status(400).json({ success: false, message: 'Filtros inválidos.' });
  try {
    const { estado, prioridad, busqueda, id_laboratorio } = req.query;

    const condiciones = ['1=1'];
    const valores = [];

    // Control de acceso RBAC
    if (!esUsuarioAdmin(req.usuario.rol)) {
      valores.push(Number(req.usuario.idUsuario));
      condiciones.push(`
        EXISTS (
          SELECT 1
          FROM public.usuario_sede us
          INNER JOIN public.usuario_laboratorio ul
            ON us.id_usuario_sede = ul.id_usuario_sede
          WHERE us.id_usuario = $${valores.length}
            AND us.id_sede = l.id_sede
            AND ul.id_sede = l.id_sede
            AND ul.id_laboratorio = l.id_laboratorio
        )
      `);
    }

    if (req.query.id_sede !== undefined && req.query.id_sede !== '') {
      if (!esIdValido(req.query.id_sede))
        return res.status(400).json({ success: false, message: 'Seleccione una sede válida.' });
      valores.push(Number(req.query.id_sede));
      condiciones.push(`l.id_sede = $${valores.length}`);
    }

    if (id_laboratorio !== undefined && id_laboratorio !== '') {
      if (!esIdValido(id_laboratorio)) {
        return res.status(400).json({
          success: false,
          message: 'Seleccione un laboratorio válido.',
        });
      }
      valores.push(Number(id_laboratorio));
      condiciones.push(`l.id_laboratorio = $${valores.length}`);
    }

    if (estado && estado.trim()) {
      const estadoCanonico =
        ESTADOS_VALIDOS.find((e) => normalizar(e) === normalizar(estado)) || estado.trim();
      valores.push(estadoCanonico);
      condiciones.push(`ir.estado_incidencia = $${valores.length}`);
    }

    if (prioridad && prioridad.trim()) {
      const prioCanonica =
        PRIORIDADES_VALIDAS.find((p) => normalizar(p) === normalizar(prioridad)) ||
        prioridad.trim();
      valores.push(prioCanonica);
      condiciones.push(`ir.prioridad = $${valores.length}`);
    }

    if (busqueda && busqueda.trim()) {
      const terminoSeguro = busqueda.trim().replace(/[\\%_]/g, '\\$&');
      valores.push(`%${terminoSeguro}%`);
      condiciones.push(`(
        ir.titulo ILIKE $${valores.length} ESCAPE '\\' OR
        e.nombre ILIKE $${valores.length} ESCAPE '\\' OR
        e.placa_institucional ILIKE $${valores.length} ESCAPE '\\'
      )`);
    }

    const consulta = `
      SELECT
        ir.id_incidencia,
        ir.titulo,
        ir.descripcion_falla,
        ir.prioridad,
        ir.estado_incidencia,
        ir.fecha_reporte,
        e.id_equipo,
        e.placa_institucional,
        e.nombre AS nombre_equipo,
        l.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS nombre_laboratorio,
        u.nombre_completo AS reportado_por
      FROM public.incidencia_reporte ir
      INNER JOIN public.equipo e ON ir.id_equipo = e.id_equipo
      INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
      INNER JOIN public.usuario u ON ir.id_usuario_reporta = u.id_usuario
      WHERE ${condiciones.join(' AND ')}
      ORDER BY
        CASE ir.prioridad
          WHEN 'Crítica' THEN 1
          WHEN 'Critica' THEN 1
          WHEN 'Alta' THEN 2
          WHEN 'Media' THEN 3
          ELSE 4
        END,
        ir.fecha_reporte DESC
    `;

    const resultado = await pool.query(consulta, valores);

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows,
    });
  } catch (error) {
    console.error('Error al consultar incidencias:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el registro de incidencias',
    });
  }
};

/**
 * 3. ACTUALIZAR ESTADO DE INCIDENCIA
 * PATCH /api/incidencias/:id/estado
 */
const actualizarEstadoIncidencia = async (req, res) => {
  if (!req.body || typeof req.body.nuevo_estado !== 'string')
    return res.status(400).json({ success: false, message: 'Indique un nuevo estado válido.' });
  try {
    const { id } = req.params;
    const { nuevo_estado } = req.body;

    if (!esIdValido(id) || !nuevo_estado) {
      return res.status(400).json({
        success: false,
        message: 'Seleccione una incidencia y el nuevo estado.',
      });
    }

    const estadoValido = ESTADOS_VALIDOS.find((e) => normalizar(e) === normalizar(nuevo_estado));

    if (!estadoValido) {
      return res.status(400).json({
        success: false,
        message: "El estado debe ser 'Abierta', 'En Revisión', 'Resuelta' o 'Descartada'",
      });
    }

    const idIncidencia = Number(id);

    // 1. Verificar existencia de la incidencia y obtener su id_equipo
    const incidenciaExistente = await pool.query(
      `SELECT id_incidencia, id_equipo
       FROM public.incidencia_reporte
       WHERE id_incidencia = $1`,
      [idIncidencia]
    );

    if (incidenciaExistente.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incidencia técnica no encontrada',
      });
    }

    // 2. Validar RBAC por laboratorio para usuarios técnicos (previene IDOR)
    if (!esUsuarioAdmin(req.usuario.rol)) {
      const tieneAcceso = await verificarAccesoEquipo(
        incidenciaExistente.rows[0].id_equipo,
        req.usuario
      );
      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no tiene permisos sobre el laboratorio de este equipo',
        });
      }
    }

    const resultado = await pool.query(
      `UPDATE public.incidencia_reporte
       SET estado_incidencia = $1
       WHERE id_incidencia = $2
       RETURNING id_incidencia, id_equipo, titulo, estado_incidencia`,
      [estadoValido, idIncidencia]
    );

    return res.status(200).json({
      success: true,
      message: 'Estado de incidencia actualizado correctamente',
      data: resultado.rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar estado de incidencia:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al actualizar la incidencia',
    });
  }
};

module.exports = {
  crearIncidencia,
  obtenerIncidencias,
  actualizarEstadoIncidencia,
};
