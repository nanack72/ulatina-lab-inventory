const pool = require('../config/database');
const { verificarAccesoEquipo } = require('../utils/accesoEquipos');

/**
 * Función auxiliar para verificar si el usuario tiene rol con acceso administrativo global.
 * Los administradores y superadministradores poseen acceso global sobre todas las sedes y laboratorios.
 * 
 * @param {string} rol - Nombre del rol obtenido desde req.usuario.rol
 * @returns {boolean}
 */
const esUsuarioAdministrador = (rol) => {
  const rolNormalizado = (rol || '').toLowerCase().trim();
  return (
    rolNormalizado === 'superadministrador' ||
    rolNormalizado === 'administrador' ||
    rolNormalizado === 'admin'
  );
};

/**
 * 1. REGISTRAR MANTENIMIENTO
 * POST /api/mantenimientos
 * 
 * Registra una intervención técnica (preventiva o correctiva) en bitacora_mantenimiento.
 * Si se solicita cambio de estado del equipo (id_nuevo_estado), se ejecuta una transacción atómica:
 * - Inserta en bitacora_mantenimiento
 * - Actualiza equipo.id_estado
 * - Inserta registro de auditoría en historial_estado
 */
const crearMantenimiento = async (req, res) => {
  const {
    id_equipo,
    tipo_mantenimiento,
    motivo_falla,
    descripcion_trabajo,
    horas_invertidas,
    estado_mantenimiento,
    id_nuevo_estado,
    motivo_cambio_estado
  } = req.body;

  // 1. Validar campos obligatorios
  if (!id_equipo || !tipo_mantenimiento || !descripcion_trabajo || !descripcion_trabajo.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Los campos id_equipo, tipo_mantenimiento y descripcion_trabajo son obligatorios'
    });
  }

  // 2. Validar que id_equipo sea un entero positivo
  const equipoId = parseInt(id_equipo, 10);
  if (isNaN(equipoId) || equipoId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'El identificador del equipo (id_equipo) debe ser un número entero positivo válido'
    });
  }

  // 3. Validar tipo de mantenimiento ('Preventivo' o 'Correctivo')
  const tiposValidos = ['Preventivo', 'Correctivo'];
  const tipoEncontrado = tiposValidos.find(
    (t) => t.toLowerCase() === tipo_mantenimiento.trim().toLowerCase()
  );
  if (!tipoEncontrado) {
    return res.status(400).json({
      success: false,
      message: "El tipo de mantenimiento debe ser 'Preventivo' o 'Correctivo'"
    });
  }

  // 4. Validar estado_mantenimiento (si se envía, debe ser válido; si no, por defecto 'Completado')
  const estadosMantenimientoValidos = ['Completado', 'En Proceso', 'Pendiente Repuesto'];
  let estadoMantenimientoFinal = 'Completado';

  if (estado_mantenimiento && estado_mantenimiento.trim()) {
    const estadoEncontrado = estadosMantenimientoValidos.find(
      (e) => e.toLowerCase() === estado_mantenimiento.trim().toLowerCase()
    );
    if (!estadoEncontrado) {
      return res.status(400).json({
        success: false,
        message: "El estado del mantenimiento debe ser 'Completado', 'En Proceso' o 'Pendiente Repuesto'"
      });
    }
    estadoMantenimientoFinal = estadoEncontrado;
  }

  // 5. Validar horas_invertidas (número mayor o igual a 0, por defecto 0.00)
  let horasFinales = 0.0;
  if (horas_invertidas !== undefined && horas_invertidas !== null && horas_invertidas !== '') {
    const parsedHoras = parseFloat(horas_invertidas);
    if (isNaN(parsedHoras) || parsedHoras < 0) {
      return res.status(400).json({
        success: false,
        message: 'Las horas invertidas deben ser un valor numérico mayor o igual a 0'
      });
    }
    horasFinales = Number(parsedHoras.toFixed(2));
  }

  // El técnico se obtiene directamente del token JWT decodificado en req.usuario (nunca del body)
  const idUsuarioTecnico = req.usuario.idUsuario;
  const esAdmin = esUsuarioAdministrador(req.usuario.rol);

  try {
    // 6. Consultar existencia del equipo y obtener información de su sede/laboratorio
    const equipoConsulta = await pool.query(
      `
      SELECT 
        e.id_equipo,
        e.nombre,
        e.id_estado,
        l.id_laboratorio,
        l.id_sede,
        s.nombre AS sede
      FROM public.equipo e
      INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
      INNER JOIN public.sede s ON l.id_sede = s.id_sede
      WHERE e.id_equipo = $1
      `,
      [equipoId]
    );

    if (equipoConsulta.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    const equipoExistente = equipoConsulta.rows[0];

    // 7. Control de Acceso por Laboratorio: Si no es Administrador / SuperAdministrador, validar acceso al equipo
    if (!esAdmin) {
      const tieneAcceso = await verificarAccesoEquipo(equipoId, req.usuario);

      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no estás asignado al laboratorio de este equipo'
        });
      }
    }

    // 8. Validar nuevo estado del equipo si fue suministrado
    let nuevoEstadoId = null;
    if (id_nuevo_estado !== undefined && id_nuevo_estado !== null && id_nuevo_estado !== '') {
      nuevoEstadoId = parseInt(id_nuevo_estado, 10);
      if (isNaN(nuevoEstadoId) || nuevoEstadoId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El id_nuevo_estado debe ser un número entero positivo válido'
        });
      }

      const estadoResult = await pool.query(
        'SELECT id_estado, nombre FROM public.estado WHERE id_estado = $1',
        [nuevoEstadoId]
      );

      if (estadoResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'El estado de equipo especificado (id_nuevo_estado) no existe'
        });
      }
    }

    // 9. Ejecución atómica de la transacción (BEGIN ... COMMIT / ROLLBACK)
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Establecer el usuario responsable en la sesión local de PostgreSQL para que los triggers
      // de auditoría de la base de datos (trg_historial_estado) capturen la trazabilidad
      await client.query("SELECT set_config('app.usuario_id', $1, true)", [String(idUsuarioTecnico)]);

      // Insertar registro en la bitácora de mantenimiento
      const insertBitacoraQuery = `
        INSERT INTO public.bitacora_mantenimiento (
          id_equipo,
          id_usuario_tecnico,
          tipo_mantenimiento,
          motivo_falla,
          descripcion_trabajo,
          horas_invertidas,
          estado_mantenimiento,
          fecha_mantenimiento
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *;
      `;

      const valoresBitacora = [
        equipoId,
        idUsuarioTecnico,
        tipoEncontrado,
        motivo_falla && motivo_falla.trim() ? motivo_falla.trim() : null,
        descripcion_trabajo.trim(),
        horasFinales,
        estadoMantenimientoFinal
      ];

      const resultadoBitacora = await client.query(insertBitacoraQuery, valoresBitacora);
      const mantenimientoCreado = resultadoBitacora.rows[0];

      // Si se especificó un nuevo estado y difiere del estado actual del equipo
      let auditoriaEstado = null;
      if (nuevoEstadoId && nuevoEstadoId !== equipoExistente.id_estado) {
        // Actualizar id_estado en equipo (dispara automáticamente el trigger trg_historial_estado)
        await client.query(
          'UPDATE public.equipo SET id_estado = $1 WHERE id_equipo = $2',
          [nuevoEstadoId, equipoId]
        );

        // Motivo descriptivo para el historial de trazabilidad
        const motivoFinal = (motivo_cambio_estado && motivo_cambio_estado.trim())
          ? motivo_cambio_estado.trim().slice(0, 255)
          : `Cambio de estado por mantenimiento #${mantenimientoCreado.id_bitacora} (${tipoEncontrado} - ${estadoMantenimientoFinal})`.slice(0, 255);

        // Actualizar el motivo en el registro de historial_estado generado por el trigger de la base de datos
        const resultadoHistorial = await client.query(
          `
          UPDATE public.historial_estado
          SET motivo = $1
          WHERE id_historial_estado = (
            SELECT id_historial_estado
            FROM public.historial_estado
            WHERE id_equipo = $2
            ORDER BY id_historial_estado DESC
            LIMIT 1
          )
          RETURNING *;
          `,
          [motivoFinal, equipoId]
        );

        auditoriaEstado = resultadoHistorial.rows[0];
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        message: 'Mantenimiento registrado exitosamente',
        data: {
          ...mantenimientoCreado,
          cambio_estado: auditoriaEstado
            ? {
                id_estado_anterior: equipoExistente.id_estado,
                id_estado_nuevo: nuevoEstadoId,
                historial: auditoriaEstado
              }
            : null
        }
      });

    } catch (transaccionError) {
      await client.query('ROLLBACK');
      throw transaccionError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error al registrar mantenimiento:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al registrar el mantenimiento',
      error: error.message
    });
  }
};

/**
 * 2. OBTENER LISTADO DE MANTENIMIENTOS CON FILTROS Y RESTRICCIÓN DE SEDE
 * GET /api/mantenimientos
 * 
 * Filtros soportados en query params:
 * - id_equipo
 * - tipo (Preventivo | Correctivo)
 * - estado (Completado | En Proceso | Pendiente Repuesto)
 * - fecha_desde
 * - fecha_hasta
 * - id_sede (opcional para administradores)
 * 
 * Si el usuario es técnico, se restringe automáticamente a las sedes asignadas
 * mediante INNER JOIN con equipo, laboratorio, sede y usuario_sede.
 */
const obtenerMantenimientos = async (req, res) => {
  try {
    const {
      id_equipo,
      tipo,
      estado,
      fecha_desde,
      fecha_hasta,
      id_sede
    } = req.query;

    const esAdmin = esUsuarioAdministrador(req.usuario.rol);
    const idUsuario = req.usuario.idUsuario;

    const params = [];
    let paramIndex = 1;

    let query = `
      SELECT
        bm.id_bitacora,
        bm.id_equipo,
        bm.id_usuario_tecnico,
        bm.tipo_mantenimiento,
        bm.motivo_falla,
        bm.descripcion_trabajo,
        bm.horas_invertidas,
        bm.fecha_mantenimiento,
        bm.estado_mantenimiento,

        e.nombre AS nombre_equipo,
        e.placa_institucional,
        e.numero_serie,
        e.marca,
        e.modelo,
        e.id_estado AS id_estado_equipo,
        es.nombre AS estado_equipo,

        u.nombre_completo AS nombre_tecnico,
        u.correo_institucional AS correo_tecnico,

        l.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS nombre_laboratorio,

        s.id_sede,
        s.nombre AS nombre_sede

      FROM public.bitacora_mantenimiento bm
      INNER JOIN public.equipo e ON bm.id_equipo = e.id_equipo
      INNER JOIN public.usuario u ON bm.id_usuario_tecnico = u.id_usuario
      INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
      INNER JOIN public.sede s ON l.id_sede = s.id_sede
      LEFT JOIN public.estado es ON e.id_estado = es.id_estado
    `;

    // Si el usuario no es Administrador / SuperAdministrador, se filtra automáticamente a sus laboratorios asignados
    if (!esAdmin) {
      query += `
        INNER JOIN public.usuario_sede us 
          ON s.id_sede = us.id_sede AND us.id_usuario = $${paramIndex++}
        INNER JOIN public.usuario_laboratorio ul 
          ON us.id_usuario_sede = ul.id_usuario_sede 
          AND ul.id_sede = l.id_sede 
          AND ul.id_laboratorio = e.id_laboratorio
      `;
      params.push(idUsuario);
    }

    const condiciones = [];

    // Filtro por ID de equipo
    if (id_equipo) {
      const equipoNum = parseInt(id_equipo, 10);
      if (!isNaN(equipoNum)) {
        condiciones.push(`bm.id_equipo = $${paramIndex++}`);
        params.push(equipoNum);
      }
    }

    // Filtro por tipo de mantenimiento ('Preventivo' | 'Correctivo')
    if (tipo && tipo.trim()) {
      condiciones.push(`LOWER(bm.tipo_mantenimiento) = LOWER($${paramIndex++})`);
      params.push(tipo.trim());
    }

    // Filtro por estado de mantenimiento
    if (estado && estado.trim()) {
      condiciones.push(`LOWER(bm.estado_mantenimiento) = LOWER($${paramIndex++})`);
      params.push(estado.trim());
    }

    // Filtro por fecha inicial (fecha_desde)
    if (fecha_desde && fecha_desde.trim()) {
      condiciones.push(`bm.fecha_mantenimiento >= $${paramIndex++}`);
      params.push(fecha_desde.trim());
    }

    // Filtro por fecha final (fecha_hasta)
    if (fecha_hasta && fecha_hasta.trim()) {
      let hasta = fecha_hasta.trim();
      // Si solo viene formato YYYY-MM-DD, abarcamos hasta el final del día
      if (/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
        hasta += ' 23:59:59.999';
      }
      condiciones.push(`bm.fecha_mantenimiento <= $${paramIndex++}`);
      params.push(hasta);
    }

    // Filtro por sede (útil para administradores)
    if (id_sede) {
      const sedeNum = parseInt(id_sede, 10);
      if (!isNaN(sedeNum)) {
        condiciones.push(`s.id_sede = $${paramIndex++}`);
        params.push(sedeNum);
      }
    }

    if (condiciones.length > 0) {
      query += ` WHERE ${condiciones.join(' AND ')} `;
    }

    query += ` ORDER BY bm.fecha_mantenimiento DESC `;

    const resultado = await pool.query(query, params);

    return res.json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error('Error al obtener mantenimientos:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar la lista de mantenimientos',
      error: error.message
    });
  }
};

/**
 * 3. OBTENER DETALLE COMPLETO DE UN MANTENIMIENTO POR ID
 * GET /api/mantenimientos/:id
 */
const obtenerMantenimientoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato numérico del ID
    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del mantenimiento no es válido'
      });
    }

    const consulta = `
      SELECT
        bm.id_bitacora,
        bm.id_equipo,
        bm.id_usuario_tecnico,
        bm.tipo_mantenimiento,
        bm.motivo_falla,
        bm.descripcion_trabajo,
        bm.horas_invertidas,
        bm.fecha_mantenimiento,
        bm.estado_mantenimiento,

        e.nombre AS nombre_equipo,
        e.placa_institucional,
        e.numero_serie,
        e.marca,
        e.modelo,
        e.anio,
        e.caracteristicas,
        e.comentarios,
        e.ubicacion_detalle,
        e.id_estado AS id_estado_equipo,
        es.nombre AS estado_equipo,

        u.nombre_completo AS nombre_tecnico,
        u.correo_institucional AS correo_tecnico,

        l.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS nombre_laboratorio,

        s.id_sede,
        s.nombre AS nombre_sede

      FROM public.bitacora_mantenimiento bm
      INNER JOIN public.equipo e ON bm.id_equipo = e.id_equipo
      INNER JOIN public.usuario u ON bm.id_usuario_tecnico = u.id_usuario
      INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
      INNER JOIN public.sede s ON l.id_sede = s.id_sede
      LEFT JOIN public.estado es ON e.id_estado = es.id_estado
      WHERE bm.id_bitacora = $1
    `;

    const resultado = await pool.query(consulta, [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de mantenimiento no encontrado'
      });
    }

    const mantenimiento = resultado.rows[0];

    // Control de Acceso por Laboratorio para técnicos
    const esAdmin = esUsuarioAdministrador(req.usuario.rol);
    if (!esAdmin) {
      const tieneAcceso = await verificarAccesoEquipo(mantenimiento.id_equipo, req.usuario);

      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no tienes permisos para consultar registros del laboratorio de este equipo'
        });
      }
    }

    return res.json({
      success: true,
      data: mantenimiento
    });

  } catch (error) {
    console.error('Error al obtener mantenimiento por ID:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el registro de mantenimiento',
      error: error.message
    });
  }
};

/**
 * 4. OBTENER HISTORIAL DE INTERVENCIONES POR EQUIPO (TRAZABILIDAD DE HARDWARE)
 * GET /api/mantenimientos/equipo/:idEquipo
 * 
 * Permite buscar tanto por ID numérico de equipo como por placa institucional.
 * Devuelve la información del equipo y la cronología completa de sus mantenimientos.
 */
const obtenerHistorialPorEquipo = async (req, res) => {
  try {
    const { idEquipo } = req.params;

    if (!idEquipo || !idEquipo.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar el identificador o placa institucional del equipo'
      });
    }

    const identificador = idEquipo.trim();
    const esNumero = /^[1-9]\d*$/.test(identificador);

    let whereClause = '';
    let queryParams = [];

    if (esNumero) {
      whereClause = '(e.id_equipo = $1 OR UPPER(e.placa_institucional) = UPPER($2))';
      queryParams = [parseInt(identificador, 10), identificador];
    } else {
      whereClause = 'UPPER(e.placa_institucional) = UPPER($1)';
      queryParams = [identificador];
    }

    // Consulta de información del equipo
    const consultaEquipo = `
      SELECT 
        e.id_equipo,
        e.nombre,
        e.placa_institucional,
        e.numero_serie,
        e.marca,
        e.modelo,
        e.anio,
        e.caracteristicas,
        e.comentarios,
        e.ubicacion_detalle,
        e.id_estado,
        es.nombre AS estado_actual,
        l.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS laboratorio,
        s.id_sede,
        s.nombre AS sede
      FROM public.equipo e
      INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
      INNER JOIN public.sede s ON l.id_sede = s.id_sede
      LEFT JOIN public.estado es ON e.id_estado = es.id_estado
      WHERE ${whereClause}
      LIMIT 1
    `;

    const resultadoEquipo = await pool.query(consultaEquipo, queryParams);

    if (resultadoEquipo.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    const equipo = resultadoEquipo.rows[0];

    // Control de Acceso por Laboratorio para técnicos
    const esAdmin = esUsuarioAdministrador(req.usuario.rol);
    if (!esAdmin) {
      const tieneAcceso = await verificarAccesoEquipo(equipo.id_equipo, req.usuario);

      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no tienes permisos sobre el laboratorio de este equipo'
        });
      }
    }

    // Cronología de mantenimientos realizados a este equipo específico
    const consultaHistorial = `
      SELECT
        bm.id_bitacora,
        bm.id_equipo,
        bm.id_usuario_tecnico,
        bm.tipo_mantenimiento,
        bm.motivo_falla,
        bm.descripcion_trabajo,
        bm.horas_invertidas,
        bm.fecha_mantenimiento,
        bm.estado_mantenimiento,
        u.nombre_completo AS nombre_tecnico,
        u.correo_institucional AS correo_tecnico
      FROM public.bitacora_mantenimiento bm
      INNER JOIN public.usuario u ON bm.id_usuario_tecnico = u.id_usuario
      WHERE bm.id_equipo = $1
      ORDER BY bm.fecha_mantenimiento DESC
    `;

    const resultadoHistorial = await pool.query(consultaHistorial, [equipo.id_equipo]);

    return res.json({
      success: true,
      equipo: {
        id_equipo: equipo.id_equipo,
        nombre: equipo.nombre,
        placa_institucional: equipo.placa_institucional,
        numero_serie: equipo.numero_serie,
        marca: equipo.marca,
        modelo: equipo.modelo,
        anio: equipo.anio,
        estado_actual: equipo.estado_actual,
        laboratorio: equipo.laboratorio,
        sede: equipo.sede
      },
      total: resultadoHistorial.rowCount,
      data: resultadoHistorial.rows
    });

  } catch (error) {
    console.error('Error al obtener historial por equipo:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de mantenimientos del equipo',
      error: error.message
    });
  }
};

/**
 * 5. ACTUALIZAR ESTADO DEL MANTENIMIENTO
 * PATCH /api/mantenimientos/:id/estado
 * 
 * Permite actualizar:
 * - estado_mantenimiento ('Completado' | 'En Proceso' | 'Pendiente Repuesto')
 * - descripcion_trabajo (detalle ampliado o comentarios técnicos)
 * - horas_invertidas (adición o ajuste de tiempo invertido)
 * - id_nuevo_estado (opcional: si se cambia el estado del equipo con esta actualización, ej: pasa a 'Operativo')
 */
const actualizarEstadoMantenimiento = async (req, res) => {
  const { id } = req.params;
  const {
    estado_mantenimiento,
    descripcion_trabajo,
    horas_invertidas,
    id_nuevo_estado,
    motivo_cambio_estado
  } = req.body;

  // 1. Validar ID de la bitácora
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'El identificador del mantenimiento no es válido'
    });
  }

  // 2. Validar que al menos se envíe un campo para actualizar
  if (
    estado_mantenimiento === undefined &&
    descripcion_trabajo === undefined &&
    horas_invertidas === undefined &&
    id_nuevo_estado === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: 'Debe proporcionar al menos un campo para actualizar (estado_mantenimiento, descripcion_trabajo, horas_invertidas o id_nuevo_estado)'
    });
  }

  // 3. Validar estado_mantenimiento si viene en la petición
  let estadoMantenimientoNormalizado = null;
  if (estado_mantenimiento !== undefined) {
    const estadosValidos = ['Completado', 'En Proceso', 'Pendiente Repuesto'];
    const estadoEncontrado = estadosValidos.find(
      (e) => e.toLowerCase() === String(estado_mantenimiento).trim().toLowerCase()
    );
    if (!estadoEncontrado) {
      return res.status(400).json({
        success: false,
        message: "El estado del mantenimiento debe ser 'Completado', 'En Proceso' o 'Pendiente Repuesto'"
      });
    }
    estadoMantenimientoNormalizado = estadoEncontrado;
  }

  // 4. Validar horas_invertidas si viene en la petición
  let horasValidadas = null;
  if (horas_invertidas !== undefined && horas_invertidas !== null && horas_invertidas !== '') {
    const parsedHoras = parseFloat(horas_invertidas);
    if (isNaN(parsedHoras) || parsedHoras < 0) {
      return res.status(400).json({
        success: false,
        message: 'Las horas invertidas deben ser un valor numérico mayor o igual a 0'
      });
    }
    horasValidadas = Number(parsedHoras.toFixed(2));
  }

  const esAdmin = esUsuarioAdministrador(req.usuario.rol);
  const idUsuario = req.usuario.idUsuario;

  try {
    // 5. Consultar existencia del mantenimiento y obtener datos de sede del equipo
    const consultaMantenimiento = await pool.query(
      `
      SELECT
        bm.*,
        e.id_equipo,
        e.nombre AS nombre_equipo,
        e.id_estado AS id_estado_equipo_actual,
        l.id_sede
      FROM public.bitacora_mantenimiento bm
      INNER JOIN public.equipo e ON bm.id_equipo = e.id_equipo
      INNER JOIN public.laboratorio l ON e.id_laboratorio = l.id_laboratorio
      WHERE bm.id_bitacora = $1
      `,
      [id]
    );

    if (consultaMantenimiento.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de mantenimiento no encontrado'
      });
    }

    const mantenimientoActual = consultaMantenimiento.rows[0];

    // 6. Validar permisos de laboratorio para técnicos
    if (!esAdmin) {
      const tieneAcceso = await verificarAccesoEquipo(mantenimientoActual.id_equipo, req.usuario);

      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no tienes permisos para modificar mantenimientos en el laboratorio de este equipo'
        });
      }
    }

    // 7. Validar id_nuevo_estado si se suministró
    let nuevoEstadoEquipoId = null;
    if (id_nuevo_estado !== undefined && id_nuevo_estado !== null && id_nuevo_estado !== '') {
      nuevoEstadoEquipoId = parseInt(id_nuevo_estado, 10);
      if (isNaN(nuevoEstadoEquipoId) || nuevoEstadoEquipoId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El id_nuevo_estado debe ser un número entero positivo válido'
        });
      }

      const estadoResult = await pool.query(
        'SELECT id_estado, nombre FROM public.estado WHERE id_estado = $1',
        [nuevoEstadoEquipoId]
      );

      if (estadoResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'El estado de equipo especificado (id_nuevo_estado) no existe'
        });
      }
    }

    // 8. Transacción atómica para actualizar bitácora y estado de hardware si aplica
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Establecer el usuario responsable en la sesión local de PostgreSQL para auditoría
      await client.query("SELECT set_config('app.usuario_id', $1, true)", [String(idUsuario)]);

      const nuevaDescripcion = (descripcion_trabajo !== undefined && descripcion_trabajo !== null)
        ? descripcion_trabajo.trim()
        : null;

      const updateQuery = `
        UPDATE public.bitacora_mantenimiento
        SET
          estado_mantenimiento = COALESCE($1, estado_mantenimiento),
          horas_invertidas = COALESCE($2, horas_invertidas),
          descripcion_trabajo = COALESCE($3, descripcion_trabajo)
        WHERE id_bitacora = $4
        RETURNING *;
      `;

      const resultadoUpdate = await client.query(updateQuery, [
        estadoMantenimientoNormalizado,
        horasValidadas,
        nuevaDescripcion,
        id
      ]);

      const mantenimientoActualizado = resultadoUpdate.rows[0];

      // Si cambia el estado del equipo, registrar en equipo e historial_estado
      let cambioEstadoInfo = null;
      if (
        nuevoEstadoEquipoId &&
        nuevoEstadoEquipoId !== mantenimientoActual.id_estado_equipo_actual
      ) {
        await client.query(
          'UPDATE public.equipo SET id_estado = $1 WHERE id_equipo = $2',
          [nuevoEstadoEquipoId, mantenimientoActual.id_equipo]
        );

        const motivoTexto = (motivo_cambio_estado && motivo_cambio_estado.trim())
          ? motivo_cambio_estado.trim().slice(0, 255)
          : `Actualización por mantenimiento #${id} a estado '${mantenimientoActualizado.estado_mantenimiento}'`.slice(0, 255);

        const histResult = await client.query(
          `
          UPDATE public.historial_estado
          SET motivo = $1
          WHERE id_historial_estado = (
            SELECT id_historial_estado
            FROM public.historial_estado
            WHERE id_equipo = $2
            ORDER BY id_historial_estado DESC
            LIMIT 1
          )
          RETURNING *;
          `,
          [motivoTexto, mantenimientoActual.id_equipo]
        );

        cambioEstadoInfo = {
          id_estado_anterior: mantenimientoActual.id_estado_equipo_actual,
          id_estado_nuevo: nuevoEstadoEquipoId,
          historial: histResult.rows[0]
        };
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Estado del mantenimiento actualizado exitosamente',
        data: {
          ...mantenimientoActualizado,
          cambio_estado: cambioEstadoInfo
        }
      });

    } catch (transaccionError) {
      await client.query('ROLLBACK');
      throw transaccionError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error al actualizar estado del mantenimiento:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al actualizar el mantenimiento',
      error: error.message
    });
  }
};

module.exports = {
  crearMantenimiento,
  obtenerMantenimientos,
  obtenerMantenimientoPorId,
  obtenerHistorialPorEquipo,
  actualizarEstadoMantenimiento
};
