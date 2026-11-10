const ExcelJS = require('exceljs');
const pool = require('../config/database');

// Los técnicos solo ven sus laboratorios; la dirección y coordinación ven todo
const esTecnico = (usuario) =>
  ['tecnico', 'técnico'].includes(
    (usuario?.rol || '').toLowerCase().trim()
  );

// Filtro SQL para limitar la consulta a los laboratorios asignados al técnico
const FILTRO_TECNICO = `
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

// Ajusta las condiciones de búsqueda según el rol del usuario
const alcanceUsuario = (usuario) => {
  if (esTecnico(usuario)) {
    return {
      condicion: FILTRO_TECNICO,
      params: [Number(usuario.idUsuario)]
    };
  }

  return { condicion: 'TRUE', params: [] };
};

// Consulta de inventario con su laboratorio, categoría y estado
const consultarInventario = async (usuario) => {
  const { condicion, params } = alcanceUsuario(usuario);

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
     FROM public.equipo e
     INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
     INNER JOIN public.sede s ON l.id_sede = s.id_sede
     INNER JOIN public.categoria c ON e.id_categoria = c.id_categoria
     INNER JOIN public.estado es ON e.id_estado = es.id_estado
     WHERE ${condicion}
     ORDER BY s.nombre, l.codigo, e.nombre, e.id_equipo`,
    params
  );

  return resultado.rows;
};

// Consulta de intervenciones técnicas (bitácora de mantenimientos)
const consultarMantenimientos = async (usuario, idLaboratorio = null) => {
  const { condicion, params } = alcanceUsuario(usuario);
  const valores = [...params];
  let filtroLab = '';

  if (idLaboratorio !== null) {
    valores.push(idLaboratorio);
    filtroLab = `AND l.id_laboratorio = $${valores.length}`;
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
       l.nombre AS laboratorio
     FROM public.bitacora_mantenimiento bm
     INNER JOIN public.equipo e ON bm.id_equipo = e.id_equipo
     INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
     INNER JOIN public.usuario u ON bm.id_usuario_tecnico = u.id_usuario
     WHERE ${condicion}
     ${filtroLab}
     ORDER BY bm.fecha_mantenimiento DESC, bm.id_bitacora DESC`,
    valores
  );

  return resultado.rows;
};

// =====================================================
// 1. RESUMEN GENERAL
// GET /api/reportes/resumen-general
// =====================================================

const obtenerResumenGeneral = async (req, res) => {
  try {
    const { condicion, params } = alcanceUsuario(req.usuario);

    const [totalRes, estadosRes, tiposRes, labsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM public.equipo e
         INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
         WHERE ${condicion}`,
        params
      ),
      pool.query(
        `SELECT es.nombre AS estado, COUNT(*)::int AS cantidad
         FROM public.equipo e
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
           l.codigo,
           l.nombre,
           COUNT(e.id_equipo)::int AS cantidad_equipos
         FROM public.laboratorio l
         LEFT JOIN public.equipo e ON e.id_laboratorio = l.id_laboratorio
         WHERE ${condicion}
         GROUP BY l.id_laboratorio, l.codigo, l.nombre
         ORDER BY cantidad_equipos DESC, l.codigo`,
        params
      )
    ]);

    const porEstado = estadosRes.rows;

    // Sumar por familia de estado (operativo, en mantenimiento, dañado)
    const sumarEstado = (patron) =>
      porEstado
        .filter((f) => patron.test(f.estado.toLowerCase()))
        .reduce((acc, f) => acc + f.cantidad, 0);

    const contarTipo = (tipo) =>
      tiposRes.rows.find(
        (f) => (f.tipo || '').toLowerCase() === tipo
      )?.cantidad || 0;

    const preventivos = contarTipo('preventivo');
    const correctivos = contarTipo('correctivo');

    return res.status(200).json({
      success: true,
      data: {
        total_equipos: totalRes.rows[0].total,
        equipos_por_estado: {
          operativo: sumarEstado(/operativ/),
          en_mantenimiento: sumarEstado(/mantenimiento/),
          danado: sumarEstado(/da[ñn]ad/),
          detalle: porEstado
        },
        mantenimientos: {
          preventivos,
          correctivos,
          total: preventivos + correctivos
        },
        equipos_por_laboratorio: labsRes.rows
      }
    });
  } catch (error) {
    console.error('Error en resumen general:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Error al generar el resumen general'
    });
  }
};

// =====================================================
// 2. MANTENIMIENTOS POR LABORATORIO
// GET /api/reportes/mantenimientos-laboratorio/:id_laboratorio
// =====================================================

const obtenerMantenimientosPorLaboratorio = async (req, res) => {
  try {
    const { id_laboratorio } = req.params;

    if (!/^[1-9]\d*$/.test(id_laboratorio)) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del laboratorio no es válido'
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
        message: 'Laboratorio no encontrado'
      });
    }

    const filas = await consultarMantenimientos(
      req.usuario,
      idLaboratorio
    );

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
          nombre: f.nombre_equipo
        },
        tipo_mantenimiento: f.tipo_mantenimiento,
        estado_mantenimiento: f.estado_mantenimiento,
        horas_invertidas: f.horas_invertidas
      }))
    });
  } catch (error) {
    console.error(
      'Error en mantenimientos por laboratorio:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar los mantenimientos del laboratorio'
    });
  }
};

// =====================================================
// 3. EXPORTAR A EXCEL
// GET /api/reportes/exportar-excel
// =====================================================

const exportarExcel = async (req, res) => {
  try {
    const [inventario, mantenimientos] = await Promise.all([
      consultarInventario(req.usuario),
      consultarMantenimientos(req.usuario)
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
        fgColor: { argb: 'FF1F3864' }
      };
      hoja.views = [{ state: 'frozen', ySplit: 1 }];
      hoja.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hoja.columns.length }
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
      { header: 'Ubicación', key: 'ubicacion_detalle', width: 36 }
    ];
    hojaInv.addRows(inventario);
    estilarEncabezado(hojaInv);

    // Hoja 2: historial de intervenciones técnicas
    const hojaMant = libro.addWorksheet('Mantenimientos');
    hojaMant.columns = [
      { header: 'Fecha', key: 'fecha_mantenimiento', width: 20 },
      { header: 'Laboratorio', key: 'codigo_laboratorio', width: 18 },
      { header: 'Placa', key: 'placa_institucional', width: 22 },
      { header: 'Equipo', key: 'nombre_equipo', width: 40 },
      { header: 'Tipo', key: 'tipo_mantenimiento', width: 14 },
      { header: 'Estado', key: 'estado_mantenimiento', width: 20 },
      { header: 'Técnico', key: 'tecnico', width: 28 },
      { header: 'Horas', key: 'horas_invertidas', width: 10 },
      { header: 'Motivo de falla', key: 'motivo_falla', width: 36 },
      { header: 'Trabajo realizado', key: 'descripcion_trabajo', width: 60 }
    ];
    hojaMant.addRows(mantenimientos);
    hojaMant.getColumn('fecha_mantenimiento').numFmt = 'yyyy-mm-dd hh:mm';
    estilarEncabezado(hojaMant);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="reporte_mantenimientos_ulatina.xlsx"'
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
      message: 'Error al generar el archivo Excel'
    });
  }
};

module.exports = {
  obtenerResumenGeneral,
  obtenerMantenimientosPorLaboratorio,
  exportarExcel
};

