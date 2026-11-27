const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { tieneAccesoGlobal } = require('../utils/alcanceUsuario');

// Normalización consistente para comparar textos sin distinguir mayúsculas ni tildes
const normalizarTexto = (texto) =>
  String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

// Clasificación de estados alineada con Inventario e Inicio:
// evita contar "No operativo" o "Inoperativo" como operativo.
const esEstadoOperativo = (estado) => ['operativo', 'activo'].includes(normalizarTexto(estado));

const esEstadoMantenimiento = (estado) => {
  const n = normalizarTexto(estado);
  return /\bmantenimiento\b/.test(n) && !/^(no|sin)\b/.test(n);
};

const esEstadoDanado = (estado) => {
  const n = normalizarTexto(estado);
  return /\bdanad[oa]s?\b/.test(n) && !/^(no|sin)\b/.test(n);
};

// Filtro SQL para limitar la consulta a las sedes y laboratorios asignados al usuario
const FILTRO_LABORATORIO_ASIGNADO = `
  EXISTS (
    SELECT 1
    FROM public.usuario_sede us
    INNER JOIN public.usuario_laboratorio ul
      ON us.id_usuario_sede = ul.id_usuario_sede
    WHERE us.id_usuario = $1
      AND us.id_sede = l.id_sede
      AND ul.id_sede = l.id_sede
      AND ul.id_laboratorio = l.id_laboratorio
  )
`;

// Únicamente el Superadministrador tiene vista global; los demás roles ven solo sus laboratorios asignados
const alcanceUsuario = (usuario) => {
  if (tieneAccesoGlobal(usuario)) {
    return { condicion: 'TRUE', params: [] };
  }

  return {
    condicion: FILTRO_LABORATORIO_ASIGNADO,
    params: [Number(usuario?.idUsuario)],
  };
};

const MAX_INT_PG = 2147483647;

const falloFiltro = (message) => Object.assign(new Error(message), { status: 400 });

const parsearIdOpcional = (valor, etiqueta) => {
  if (valor === undefined || valor === null || valor === '') return null;
  if (
    !['string', 'number'].includes(typeof valor) ||
    !/^[1-9]\d*$/.test(String(valor).trim()) ||
    Number(valor) > MAX_INT_PG
  ) {
    throw falloFiltro(`Seleccione un valor válido para ${etiqueta}.`);
  }
  return Number(valor);
};

const parsearFechaOpcional = (valor, etiqueta) => {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string') {
    throw falloFiltro(`Fecha ${etiqueta} inválida. Use AAAA-MM-DD.`);
  }
  const limpia = valor.trim();
  if (!limpia) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(limpia) ||
    !Number.isFinite(Date.parse(limpia)) ||
    new Date(limpia).toISOString().slice(0, 10) !== limpia
  ) {
    throw falloFiltro(`Fecha ${etiqueta} inválida. Use AAAA-MM-DD.`);
  }
  return limpia;
};

const parsearFiltrosExportacion = (query = {}) => {
  const idSede = parsearIdOpcional(query.id_sede, 'sede');
  const idLaboratorio = parsearIdOpcional(query.id_laboratorio, 'laboratorio');
  const fechaDesde = parsearFechaOpcional(query.fecha_desde, 'inicial');
  const fechaHasta = parsearFechaOpcional(query.fecha_hasta, 'final');

  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw falloFiltro('La fecha inicial no puede ser posterior a la final.');
  }

  return { idSede, idLaboratorio, fechaDesde, fechaHasta };
};

// Consulta de inventario con su laboratorio, categoría y estado
const consultarInventario = async (usuario, filtros = {}) => {
  const { condicion, params } = alcanceUsuario(usuario);
  const condiciones = [condicion];
  const valores = [...params];

  if (filtros.idSede !== null && filtros.idSede !== undefined) {
    valores.push(filtros.idSede);
    condiciones.push(`l.id_sede = $${valores.length}`);
  }

  if (filtros.idLaboratorio !== null && filtros.idLaboratorio !== undefined) {
    valores.push(filtros.idLaboratorio);
    condiciones.push(`l.id_laboratorio = $${valores.length}`);
  }

  const resultado = await pool.query(
    `SELECT
       e.id_equipo,
       e.placa_institucional,
       e.numero_serie,
       e.nombre,
       e.marca,
       e.modelo,
       e.anio,
       c.nombre AS categoria,
       es.nombre AS estado,
       l.codigo AS codigo_laboratorio,
       l.nombre AS laboratorio,
       s.nombre AS sede,
       e.ubicacion_detalle
     FROM (SELECT * FROM public.equipo WHERE eliminado_en IS NULL) e
     INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
     INNER JOIN public.sede s ON l.id_sede = s.id_sede
     INNER JOIN public.categoria c ON e.id_categoria = c.id_categoria
     INNER JOIN public.estado es ON e.id_estado = es.id_estado
     WHERE ${condiciones.join(' AND ')}
     ORDER BY s.nombre, l.codigo, e.nombre, e.id_equipo`,
    valores
  );

  return resultado.rows;
};

// Consulta de intervenciones técnicas (bitácora de mantenimientos)
const consultarMantenimientos = async (usuario, filtrosOIdLab = null) => {
  const filtros =
    typeof filtrosOIdLab === 'number'
      ? { idLaboratorio: filtrosOIdLab }
      : filtrosOIdLab && typeof filtrosOIdLab === 'object'
        ? filtrosOIdLab
        : {};

  const { condicion, params } = alcanceUsuario(usuario);
  const condiciones = [condicion];
  const valores = [...params];

  if (filtros.idSede !== null && filtros.idSede !== undefined) {
    valores.push(filtros.idSede);
    condiciones.push(`l.id_sede = $${valores.length}`);
  }

  if (filtros.idLaboratorio !== null && filtros.idLaboratorio !== undefined) {
    valores.push(filtros.idLaboratorio);
    condiciones.push(`l.id_laboratorio = $${valores.length}`);
  }

  if (filtros.fechaDesde) {
    valores.push(`${filtros.fechaDesde}T00:00:00-06:00`);
    condiciones.push(`bm.fecha_mantenimiento >= $${valores.length}::timestamptz`);
  }

  if (filtros.fechaHasta) {
    valores.push(`${filtros.fechaHasta}T23:59:59.999999-06:00`);
    condiciones.push(`bm.fecha_mantenimiento <= $${valores.length}::timestamptz`);
  }

  const resultado = await pool.query(
    `SELECT
       bm.id_bitacora,
       bm.fecha_mantenimiento,
       bm.tipo_mantenimiento,
       bm.estado_mantenimiento,
       bm.motivo_falla,
       bm.descripcion_trabajo,
       bm.horas_invertidas,
       u.nombre_completo AS tecnico,
       e.id_equipo,
       e.placa_institucional,
       e.nombre AS nombre_equipo,
       l.id_laboratorio,
       l.codigo AS codigo_laboratorio,
       l.nombre AS laboratorio,
       s.nombre AS sede
     FROM public.bitacora_mantenimiento bm
     INNER JOIN public.equipo e ON bm.id_equipo = e.id_equipo
     INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
     INNER JOIN public.sede s ON l.id_sede = s.id_sede
     INNER JOIN public.usuario u ON bm.id_usuario_tecnico = u.id_usuario
     WHERE ${condiciones.join(' AND ')}
     ORDER BY bm.fecha_mantenimiento DESC, bm.id_bitacora DESC`,
    valores
  );

  return resultado.rows;
};

// Consulta de reportes de incidencias técnicas
const consultarIncidencias = async (usuario, filtros = {}) => {
  const { condicion, params } = alcanceUsuario(usuario);
  const condiciones = [condicion];
  const valores = [...params];

  if (filtros.idSede !== null && filtros.idSede !== undefined) {
    valores.push(filtros.idSede);
    condiciones.push(`l.id_sede = $${valores.length}`);
  }

  if (filtros.idLaboratorio !== null && filtros.idLaboratorio !== undefined) {
    valores.push(filtros.idLaboratorio);
    condiciones.push(`l.id_laboratorio = $${valores.length}`);
  }

  if (filtros.fechaDesde) {
    valores.push(`${filtros.fechaDesde}T00:00:00-06:00`);
    condiciones.push(`ir.fecha_reporte >= $${valores.length}::timestamptz`);
  }

  if (filtros.fechaHasta) {
    valores.push(`${filtros.fechaHasta}T23:59:59.999999-06:00`);
    condiciones.push(`ir.fecha_reporte <= $${valores.length}::timestamptz`);
  }

  const resultado = await pool.query(
    `SELECT
       ir.id_incidencia,
       ir.fecha_reporte,
       ir.titulo,
       ir.descripcion_falla,
       ir.prioridad,
       ir.estado_incidencia,
       u.nombre_completo AS reportado_por,
       e.id_equipo,
       e.placa_institucional,
       e.nombre AS nombre_equipo,
       l.id_laboratorio,
       l.codigo AS codigo_laboratorio,
       l.nombre AS laboratorio,
       s.nombre AS sede
     FROM public.incidencia_reporte ir
     INNER JOIN public.equipo e ON ir.id_equipo = e.id_equipo
     INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
     INNER JOIN public.sede s ON l.id_sede = s.id_sede
     INNER JOIN public.usuario u ON ir.id_usuario_reporta = u.id_usuario
     WHERE ${condiciones.join(' AND ')}
     ORDER BY ir.fecha_reporte DESC, ir.id_incidencia DESC`,
    valores
  );

  return resultado.rows;
};

// 1. RESUMEN GENERAL
// GET /api/reportes/resumen-general

const obtenerResumenGeneral = async (req, res) => {
  try {
    const { condicion, params } = alcanceUsuario(req.usuario);

    const [totalRes, estadosRes, tiposRes, labsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM (SELECT * FROM public.equipo WHERE eliminado_en IS NULL) e
         INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
         WHERE ${condicion}`,
        params
      ),
      pool.query(
        `SELECT es.nombre AS estado, COUNT(*)::int AS cantidad
         FROM (SELECT * FROM public.equipo WHERE eliminado_en IS NULL) e
         INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
         INNER JOIN public.estado es ON e.id_estado = es.id_estado
         WHERE ${condicion}
         GROUP BY es.nombre
         ORDER BY cantidad DESC, es.nombre`,
        params
      ),
      pool.query(
        `SELECT bm.tipo_mantenimiento AS tipo, COUNT(*)::int AS cantidad
         FROM public.bitacora_mantenimiento bm
         INNER JOIN public.equipo e ON bm.id_equipo = e.id_equipo
         INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
         WHERE ${condicion}
         GROUP BY bm.tipo_mantenimiento`,
        params
      ),
      pool.query(
        `SELECT
           l.id_laboratorio,
           l.id_sede,
           l.codigo,
           l.nombre,
           COUNT(e.id_equipo)::int AS cantidad_equipos
         FROM public.laboratorio l
         LEFT JOIN public.equipo e ON e.id_laboratorio = l.id_laboratorio AND e.eliminado_en IS NULL
         WHERE ${condicion}
         GROUP BY l.id_laboratorio, l.id_sede, l.codigo, l.nombre
         ORDER BY cantidad_equipos DESC, l.codigo`,
        params
      ),
    ]);

    const porEstado = estadosRes.rows;

    // Sumar por familia de estado sin falsos positivos (ej. "No operativo" != "Operativo")
    const sumarEstado = (predicado) =>
      porEstado.filter((f) => predicado(f.estado)).reduce((acc, f) => acc + f.cantidad, 0);

    const contarTipo = (tipo) =>
      tiposRes.rows.find((f) => (f.tipo || '').toLowerCase() === tipo)?.cantidad || 0;

    const preventivos = contarTipo('preventivo');
    const correctivos = contarTipo('correctivo');

    return res.status(200).json({
      success: true,
      data: {
        total_equipos: totalRes.rows[0].total,
        equipos_por_estado: {
          operativo: sumarEstado(esEstadoOperativo),
          en_mantenimiento: sumarEstado(esEstadoMantenimiento),
          danado: sumarEstado(esEstadoDanado),
          detalle: porEstado,
        },
        mantenimientos: {
          preventivos,
          correctivos,
          total: preventivos + correctivos,
        },
        equipos_por_laboratorio: labsRes.rows,
      },
    });
  } catch (error) {
    console.error('Error en resumen general:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Error al generar el resumen general',
    });
  }
};

// 2. MANTENIMIENTOS POR LABORATORIO
// GET /api/reportes/mantenimientos-laboratorio/:id_laboratorio

const obtenerMantenimientosPorLaboratorio = async (req, res) => {
  try {
    const { id_laboratorio } = req.params;

    if (!/^[1-9]\d*$/.test(id_laboratorio)) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del laboratorio no es válido',
      });
    }

    const idLaboratorio = Number(id_laboratorio);

    const laboratorio = await pool.query(
      `SELECT id_laboratorio, codigo, nombre
       FROM public.laboratorio
       WHERE id_laboratorio = $1`,
      [idLaboratorio]
    );

    if (laboratorio.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Laboratorio no encontrado',
      });
    }

    const filas = await consultarMantenimientos(req.usuario, idLaboratorio);

    return res.status(200).json({
      success: true,
      laboratorio: laboratorio.rows[0],
      total: filas.length,
      data: filas.map((f) => ({
        id_bitacora: f.id_bitacora,
        fecha: f.fecha_mantenimiento,
        tecnico: f.tecnico,
        equipo: {
          id_equipo: f.id_equipo,
          placa_institucional: f.placa_institucional,
          nombre: f.nombre_equipo,
        },
        tipo_mantenimiento: f.tipo_mantenimiento,
        estado_mantenimiento: f.estado_mantenimiento,
        horas_invertidas: f.horas_invertidas,
      })),
    });
  } catch (error) {
    console.error('Error en mantenimientos por laboratorio:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Error al consultar los mantenimientos del laboratorio',
    });
  }
};

// 3. EXPORTAR A EXCEL
// GET /api/reportes/exportar-excel?id_sede=&id_laboratorio=&fecha_desde=&fecha_hasta=

const exportarExcel = async (req, res) => {
  let filtros;
  try {
    filtros = parsearFiltrosExportacion(req.query);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }

  try {
    const [inventario, mantenimientos, incidencias] = await Promise.all([
      consultarInventario(req.usuario, filtros),
      consultarMantenimientos(req.usuario, filtros),
      consultarIncidencias(req.usuario, filtros),
    ]);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Sistema de Inventario ULatina';
    libro.created = new Date();

    const estilarEncabezado = (hoja) => {
      const fila = hoja.getRow(1);
      fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      fila.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F3864' },
      };
      hoja.views = [{ state: 'frozen', ySplit: 1 }];
      hoja.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hoja.columns.length },
      };
    };

    // Hoja 1: consolidado del inventario
    const hojaInv = libro.addWorksheet('Inventario');
    hojaInv.columns = [
      { header: 'Placa', key: 'placa_institucional', width: 22 },
      { header: 'Nombre', key: 'nombre', width: 40 },
      { header: 'Marca', key: 'marca', width: 16 },
      { header: 'Modelo', key: 'modelo', width: 22 },
      { header: 'Año', key: 'anio', width: 8 },
      { header: 'Serie', key: 'numero_serie', width: 20 },
      { header: 'Categoría', key: 'categoria', width: 28 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Laboratorio', key: 'codigo_laboratorio', width: 18 },
      { header: 'Sede', key: 'sede', width: 14 },
      { header: 'Ubicación', key: 'ubicacion_detalle', width: 36 },
    ];
    hojaInv.addRows(inventario);
    estilarEncabezado(hojaInv);

    // Hoja 2: historial de intervenciones técnicas
    const hojaMant = libro.addWorksheet('Mantenimientos');
    hojaMant.columns = [
      { header: 'Fecha', key: 'fecha_mantenimiento', width: 20 },
      { header: 'Sede', key: 'sede', width: 16 },
      { header: 'Laboratorio', key: 'codigo_laboratorio', width: 18 },
      { header: 'Placa', key: 'placa_institucional', width: 22 },
      { header: 'Equipo', key: 'nombre_equipo', width: 40 },
      { header: 'Tipo', key: 'tipo_mantenimiento', width: 14 },
      { header: 'Estado', key: 'estado_mantenimiento', width: 20 },
      { header: 'Técnico', key: 'tecnico', width: 28 },
      { header: 'Horas', key: 'horas_invertidas', width: 10 },
      { header: 'Motivo de falla', key: 'motivo_falla', width: 36 },
      { header: 'Trabajo realizado', key: 'descripcion_trabajo', width: 60 },
    ];
    hojaMant.addRows(mantenimientos);
    hojaMant.getColumn('fecha_mantenimiento').numFmt = 'yyyy-mm-dd hh:mm';
    estilarEncabezado(hojaMant);

    // Hoja 3: registro de incidencias técnicas
    const hojaInc = libro.addWorksheet('Incidencias');
    hojaInc.columns = [
      { header: 'Fecha', key: 'fecha_reporte', width: 20 },
      { header: 'Sede', key: 'sede', width: 16 },
      { header: 'Laboratorio', key: 'codigo_laboratorio', width: 18 },
      { header: 'Placa', key: 'placa_institucional', width: 22 },
      { header: 'Equipo', key: 'nombre_equipo', width: 40 },
      { header: 'Título', key: 'titulo', width: 32 },
      { header: 'Prioridad', key: 'prioridad', width: 14 },
      { header: 'Estado', key: 'estado_incidencia', width: 16 },
      { header: 'Reportado por', key: 'reportado_por', width: 28 },
      { header: 'Descripción de la falla', key: 'descripcion_falla', width: 60 },
    ];
    hojaInc.addRows(incidencias);
    hojaInc.getColumn('fecha_reporte').numFmt = 'yyyy-mm-dd hh:mm';
    estilarEncabezado(hojaInc);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="reporte_inventario_ulatina.xlsx"'
    );

    await libro.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error al exportar Excel:', error.message);

    if (res.headersSent) {
      return res.end();
    }

    return res.status(500).json({
      success: false,
      message: 'Error al generar el archivo Excel',
    });
  }
};

module.exports = {
  obtenerResumenGeneral,
  obtenerMantenimientosPorLaboratorio,
  exportarExcel,
};
