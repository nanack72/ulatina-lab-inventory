const pool = require('../config/database');
const { verificarAccesoEquipo } = require('../utils/accesoEquipos');

const PRIORIDADES_VALIDAS = ['Baja', 'Media', 'Alta', 'Crítica', 'Critica'];
const ESTADOS_VALIDOS = ['Abierta', 'En Revisión', 'En Revision', 'Resuelta', 'Descartada'];

const normalizar = (texto) =>
  String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const esUsuarioAdmin = (rol) =>
  ['superadministrador', 'administrador', 'admin', 'coordinador', 'director'].includes(
    (rol || '').toLowerCase().trim()
  );

/**
 * 1. REGISTRAR INCIDENCIA
 * POST /api/incidencias
 */
const crearIncidencia = async (req, res) => {
  try {
    const { id_equipo, titulo, descripcion_falla, prioridad } = req.body;

    if (!id_equipo || !titulo?.trim() || !descripcion_falla?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Los campos id_equipo, titulo y descripcion_falla son obligatorios'
      });
    }

    const prioridadValida = PRIORIDADES_VALIDAS.find(
      (p) => normalizar(p) === normalizar(prioridad || 'Media')
    ) || 'Media';

    // Verificar que el equipo exista
    const equipoRes = await pool.query(
      `SELECT id_equipo, id_laboratorio, nombre
       FROM public.equipo
       WHERE id_equipo = $1`,
      [Number(id_equipo)]
    );

    if (equipoRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'El equipo seleccionado no existe en el inventario'
      });
    }

    // Si es técnico, validar asignación al laboratorio
    if (!esUsuarioAdmin(req.usuario.rol)) {
      const acceso = await verificarAccesoEquipo(Number(id_equipo), req.usuario);
      if (!acceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no estás asignado al laboratorio de este equipo'
        });
      }
    }

    const resultado = await pool.query(
      `INSERT INTO public.incidencia_reporte
         (id_equipo, id_usuario_reporta, titulo, descripcion_falla, prioridad, estado_incidencia, fecha_reporte)
       VALUES ($1, $2, $3, $4, $5, 'Abierta', CURRENT_TIMESTAMP)
       RETURNING id_incidencia, id_equipo, id_usuario_reporta, titulo,
                 descripcion_falla, prioridad, estado_incidencia, fecha_reporte`,
      [
        Number(id_equipo),
        Number(req.usuario.idUsuario),
        titulo.trim(),
        descripcion_falla.trim(),
        prioridadValida
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Incidencia técnica registrada correctamente',
      data: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar incidencia:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al registrar la incidencia'
    });
  }
};

/**
 * 2. LISTAR INCIDENCIAS
 * GET /api/incidencias
 */
const obtenerIncidencias = async (req, res) => {
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

    if (id_laboratorio) {
      valores.push(Number(id_laboratorio));
      condiciones.push(`l.id_laboratorio = $${valores.length}`);
    }

    if (estado) {
      valores.push(estado);
      condiciones.push(`ir.estado_incidencia = $${valores.length}`);
    }

    if (prioridad) {
      valores.push(prioridad);
      condiciones.push(`ir.prioridad = $${valores.length}`);
    }

    if (busqueda && busqueda.trim()) {
      valores.push(`%${busqueda.trim()}%`);
      condiciones.push(`(
        ir.titulo ILIKE $${valores.length} OR
        e.nombre ILIKE $${valores.length} OR
        e.placa_institucional ILIKE $${valores.length}
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
      data: resultado.rows
    });
  } catch (error) {
    console.error('Error al consultar incidencias:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el registro de incidencias'
    });
  }
};

/**
 * 3. ACTUALIZAR ESTADO DE INCIDENCIA
 * PATCH /api/incidencias/:id/estado
 */
const actualizarEstadoIncidencia = async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevo_estado } = req.body;

    if (!id || !nuevo_estado) {
      return res.status(400).json({
        success: false,
        message: 'El id de la incidencia y el nuevo_estado son requeridos'
      });
    }

    const estadoValido = ESTADOS_VALIDOS.find(
      (e) => normalizar(e) === normalizar(nuevo_estado)
    );

    if (!estadoValido) {
      return res.status(400).json({
        success: false,
        message: "El estado debe ser 'Abierta', 'En Revisión', 'Resuelta' o 'Descartada'"
      });
    }

    const resultado = await pool.query(
      `UPDATE public.incidencia_reporte
       SET estado_incidencia = $1
       WHERE id_incidencia = $2
       RETURNING id_incidencia, id_equipo, titulo, estado_incidencia`,
      [estadoValido, Number(id)]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incidencia técnica no encontrada'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Estado de incidencia actualizado correctamente',
      data: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar estado de incidencia:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al actualizar la incidencia'
    });
  }
};

module.exports = {
  crearIncidencia,
  obtenerIncidencias,
  actualizarEstadoIncidencia
};
