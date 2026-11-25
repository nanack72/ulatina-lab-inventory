const pool = require('../config/database');
const { listarMantenimientos } = require('../services/mantenimientosListado');
const { validarEntradaMantenimiento } = require('../utils/validacionMantenimiento');
const { verificarAccesoEquipo } = require('../utils/accesoEquipos');

const normalizarTexto = (texto) =>
  String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Roles con visibilidad global sobre sedes y laboratorios.
 * Coherente con incidencias, evidencias y reportes.
 *
 * @param {string} rol - Rol actual del usuario
 * @returns {boolean}
 */
const esUsuarioAdministrador = (rol) =>
  ['superadministrador', 'administrador', 'admin', 'coordinador', 'director'].includes(
    normalizarTexto(rol)
  );

const esEstadoBaja = (nombreEstado) => {
  const n = normalizarTexto(nombreEstado);
  return n.includes('baja') || n.includes('retirad') || n.includes('eliminad');
};

/**
 * Busca un estado en public.estado por nombre (insensible a mayúsculas/tildes).
 * Si se indica descripcionSiCrear y aún no existe en el catálogo, lo crea.
 */
const resolverEstadoPorNombre = async (client, nombreBuscado, descripcionSiCrear = null) => {
  const consulta = await client.query(
    `
        SELECT id_estado, nombre
        FROM public.estado
        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
        LIMIT 1
        `,
    [nombreBuscado]
  );

  if (consulta.rowCount > 0) {
    return consulta.rows[0];
  }

  if (descripcionSiCrear) {
    const creado = await client.query(
      `
            INSERT INTO public.estado (nombre, descripcion)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            RETURNING id_estado, nombre
            `,
      [nombreBuscado, descripcionSiCrear]
    );

    if (creado.rowCount > 0) {
      return creado.rows[0];
    }

    const reintento = await client.query(
      `
            SELECT id_estado, nombre
            FROM public.estado
            WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
            LIMIT 1
            `,
      [nombreBuscado]
    );

    return reintento.rows[0] || null;
  }

  return null;
};

/**
 * Valida las evidencias fotográficas requeridas antes de marcar una orden
 * como Completado (RN14 y RU09):
 * - Correctivo: exige al menos una foto 'Antes' y una foto 'Después'.
 * - Preventivo: exige al menos una fotografía de evidencia.
 */
const validarEvidenciasParaCierre = async (client, idBitacora, tipoMantenimiento) => {
  const evidenciasRes = await client.query(
    `
        SELECT tipo_evidencia
        FROM public.evidencia_fotografica
        WHERE id_bitacora = $1
        `,
    [idBitacora]
  );

  const tipos = evidenciasRes.rows.map((fila) => normalizarTexto(fila.tipo_evidencia));

  if (normalizarTexto(tipoMantenimiento) === 'correctivo') {
    const faltantes = [];
    if (!tipos.includes('antes')) faltantes.push('Antes');
    if (!tipos.includes('despues')) faltantes.push('Después');

    if (faltantes.length > 0) {
      return {
        valido: false,
        mensaje: `Para finalizar un mantenimiento correctivo debe adjuntar evidencia fotográfica "Antes" y "Después". Faltan: ${faltantes.join(' y ')}.`,
      };
    }

    return { valido: true };
  }

  if (tipos.length === 0) {
    return {
      valido: false,
      mensaje:
        'Para finalizar una orden de mantenimiento debe adjuntar al menos una fotografía de evidencia.',
    };
  }

  return { valido: true };
};

/**
 * 1. REGISTRAR MANTENIMIENTO
 * POST /api/mantenimientos
 *
 * Registra una intervención técnica preventiva o correctiva.
 *
 * Si se solicita un cambio de estado del equipo, se realiza
 * una transacción que:
 * - Inserta la bitácora de mantenimiento.
 * - Actualiza el estado del equipo.
 * - Registra la trazabilidad mediante el trigger de PostgreSQL.
 *
 * Los usuarios no superadministradores deben tener acceso
 * al laboratorio al que pertenece el equipo.
 */
const crearMantenimiento = async (req, res) => {
  const invalido = validarEntradaMantenimiento(req.body, false);
  if (invalido) return res.status(400).json({ success: false, message: invalido });
  const {
    id_equipo,
    tipo_mantenimiento,
    motivo_falla,
    descripcion_trabajo,
    horas_invertidas,
    estado_mantenimiento,
    id_nuevo_estado,
    motivo_cambio_estado,
  } = req.body;

  // 1. Validar campos obligatorios
  if (!id_equipo || !tipo_mantenimiento || !descripcion_trabajo || !descripcion_trabajo.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Seleccione un equipo y el tipo de mantenimiento, e indique el trabajo realizado.',
    });
  }

  // 2. Validar identificador del equipo
  const equipoId = parseInt(id_equipo, 10);

  if (isNaN(equipoId) || equipoId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Seleccione un equipo válido.',
    });
  }

  // 3. Validar tipo de mantenimiento
  const tiposValidos = ['Preventivo', 'Correctivo'];

  const tipoEncontrado = tiposValidos.find(
    (tipo) => tipo.toLowerCase() === tipo_mantenimiento.trim().toLowerCase()
  );

  if (!tipoEncontrado) {
    return res.status(400).json({
      success: false,
      message: "El tipo de mantenimiento debe ser 'Preventivo' o 'Correctivo'",
    });
  }

  // 4. Validar estado del mantenimiento
  // Por defecto inicia 'En Proceso' porque requiere evidencia previa al cierre (RN14).
  const estadosMantenimientoValidos = ['Completado', 'En Proceso', 'Pendiente Repuesto'];

  let estadoMantenimientoFinal = 'En Proceso';

  if (estado_mantenimiento && estado_mantenimiento.trim()) {
    const estadoEncontrado = estadosMantenimientoValidos.find(
      (estado) => estado.toLowerCase() === estado_mantenimiento.trim().toLowerCase()
    );

    if (!estadoEncontrado) {
      return res.status(400).json({
        success: false,
        message:
          "El estado del mantenimiento debe ser 'Completado', 'En Proceso' o 'Pendiente Repuesto'",
      });
    }

    estadoMantenimientoFinal = estadoEncontrado;
  }

  if (estadoMantenimientoFinal === 'Completado') {
    return res.status(400).json({
      success: false,
      message:
        'No es posible registrar una orden directamente como Completado porque requiere evidencia fotográfica previa. Registre la orden en "En Proceso", adjunte la evidencia y luego finalícela.',
    });
  }

  // 5. Validar horas invertidas
  let horasFinales = 0.0;

  if (horas_invertidas !== undefined && horas_invertidas !== null && horas_invertidas !== '') {
    const parsedHoras = parseFloat(horas_invertidas);

    if (isNaN(parsedHoras) || parsedHoras < 0) {
      return res.status(400).json({
        success: false,
        message: 'Las horas invertidas deben ser un valor numérico mayor o igual a 0',
      });
    }

    horasFinales = Number(parsedHoras.toFixed(2));
  }

  // El usuario responsable se obtiene del JWT validado
  const idUsuarioTecnico = req.usuario.idUsuario;
  const esAdmin = esUsuarioAdministrador(req.usuario.rol);

  try {
    // 6. Consultar existencia y ubicación del equipo
    const equipoConsulta = await pool.query(
      `
            SELECT
                e.id_equipo,
                e.nombre,
                e.id_estado,
                e.eliminado_en,
                l.id_laboratorio,
                l.id_sede,
                s.nombre AS sede
            FROM public.equipo e
            INNER JOIN public.laboratorio l
                ON e.id_laboratorio = l.id_laboratorio
            INNER JOIN public.sede s
                ON l.id_sede = s.id_sede
            WHERE e.id_equipo = $1
            `,
      [equipoId]
    );

    if (equipoConsulta.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado',
      });
    }

    const equipoExistente = equipoConsulta.rows[0];

    if (equipoExistente.eliminado_en !== null && equipoExistente.eliminado_en !== undefined) {
      return res.status(409).json({
        success: false,
        message: 'No se pueden registrar mantenimientos sobre un equipo eliminado del inventario',
      });
    }

    // 7. Control de acceso por laboratorio
    // El Superadministrador tiene acceso global.
    // Los demás usuarios deben estar autorizados.
    if (!esAdmin) {
      const tieneAcceso = await verificarAccesoEquipo(equipoId, req.usuario);

      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no está asignado al laboratorio de este equipo',
        });
      }
    }

    // 8. Validar nuevo estado del equipo
    let nuevoEstadoId = null;

    if (id_nuevo_estado !== undefined && id_nuevo_estado !== null && id_nuevo_estado !== '') {
      nuevoEstadoId = parseInt(id_nuevo_estado, 10);

      if (isNaN(nuevoEstadoId) || nuevoEstadoId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Seleccione un estado válido.',
        });
      }

      const estadoResult = await pool.query(
        `
                SELECT id_estado, nombre
                FROM public.estado
                WHERE id_estado = $1
                `,
        [nuevoEstadoId]
      );

      if (estadoResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'El estado seleccionado no está disponible.',
        });
      }
    }

    // 9. Transacción de mantenimiento, concurrencia (RN16), estado automático (RF21/RN12) y auditoría
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Bloquear la fila del equipo para proteger contra solicitudes simultáneas (RN16)
      const equipoBloqueadoRes = await client.query(
        `
                SELECT
                    e.id_equipo,
                    e.id_estado,
                    e.eliminado_en,
                    es.nombre AS estado_actual
                FROM public.equipo e
                LEFT JOIN public.estado es
                    ON e.id_estado = es.id_estado
                WHERE e.id_equipo = $1
                FOR UPDATE OF e
                `,
        [equipoId]
      );

      if (equipoBloqueadoRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Equipo no encontrado',
        });
      }

      const equipoBloqueado = equipoBloqueadoRes.rows[0];

      // Impedir mantenimientos nuevos sobre equipos eliminados lógicamente
      if (equipoBloqueado.eliminado_en !== null && equipoBloqueado.eliminado_en !== undefined) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'No se pueden registrar mantenimientos sobre un equipo eliminado del inventario',
        });
      }

      // Impedir mantenimientos nuevos sobre equipos dados de baja
      if (esEstadoBaja(equipoBloqueado.estado_actual)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'No se pueden registrar mantenimientos sobre un equipo dado de baja',
        });
      }

      // RN16: impedir abrir un segundo correctivo mientras ya exista uno en curso
      if (tipoEncontrado === 'Correctivo') {
        const correctivoActivo = await client.query(
          `
                    SELECT id_bitacora, estado_mantenimiento
                    FROM public.bitacora_mantenimiento
                    WHERE id_equipo = $1
                      AND LOWER(tipo_mantenimiento) = 'correctivo'
                      AND LOWER(estado_mantenimiento) IN ('en proceso', 'pendiente repuesto')
                    LIMIT 1
                    `,
          [equipoId]
        );

        if (correctivoActivo.rowCount > 0) {
          const ordenActiva = correctivoActivo.rows[0];
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: `El equipo ya cuenta con un mantenimiento correctivo activo (orden #${ordenActiva.id_bitacora} - ${ordenActiva.estado_mantenimiento}). Debe finalizarlo antes de registrar uno nuevo.`,
          });
        }

        // RF21 / RN12: al abrir un correctivo, pasar el equipo automáticamente a 'En mantenimiento'
        if (!nuevoEstadoId) {
          const estadoMantenimiento = await resolverEstadoPorNombre(
            client,
            'En mantenimiento',
            'Equipo retirado temporalmente del uso por mantenimiento correctivo'
          );

          if (estadoMantenimiento) {
            nuevoEstadoId = estadoMantenimiento.id_estado;
          }
        }
      }

      // Usuario responsable para los triggers de auditoría
      await client.query("SELECT set_config('app.usuario_id', $1, true)", [
        String(idUsuarioTecnico),
      ]);

      // Registrar mantenimiento
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
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    CURRENT_TIMESTAMP
                )
                RETURNING *;
            `;

      const valoresBitacora = [
        equipoId,
        idUsuarioTecnico,
        tipoEncontrado,
        motivo_falla && motivo_falla.trim() ? motivo_falla.trim() : null,
        descripcion_trabajo.trim(),
        horasFinales,
        estadoMantenimientoFinal,
      ];

      const resultadoBitacora = await client.query(insertBitacoraQuery, valoresBitacora);

      const mantenimientoCreado = resultadoBitacora.rows[0];

      let auditoriaEstado = null;

      // Cambiar estado del equipo si corresponde
      if (nuevoEstadoId && nuevoEstadoId !== equipoBloqueado.id_estado) {
        await client.query(
          `
                    UPDATE public.equipo
                    SET id_estado = $1
                    WHERE id_equipo = $2
                    `,
          [nuevoEstadoId, equipoId]
        );

        // Descripción del cambio para el historial
        const motivoFinal =
          motivo_cambio_estado && motivo_cambio_estado.trim()
            ? motivo_cambio_estado.trim().slice(0, 255)
            : `Cambio automático por mantenimiento #${mantenimientoCreado.id_bitacora} (${tipoEncontrado} - ${estadoMantenimientoFinal})`.slice(
                0,
                255
              );

        // Completar el motivo del historial generado por el trigger
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
                id_estado_anterior: equipoBloqueado.id_estado,
                id_estado_nuevo: nuevoEstadoId,
                historial: auditoriaEstado,
              }
            : null,
        },
      });
    } catch (transaccionError) {
      await client.query('ROLLBACK');
      throw transaccionError;
    } finally {
      client.release();
    }
  } catch (error) {
    // Los detalles técnicos quedan solo en el servidor
    console.error('Error al registrar mantenimiento:', error);

    return res.status(500).json({
      success: false,
      message: 'Error interno al registrar el mantenimiento',
    });
  }
};

/**
 * 2. OBTENER LISTADO DE MANTENIMIENTOS
 * GET /api/mantenimientos
 *
 * Permite filtrar por:
 * - id_equipo
 * - tipo
 * - estado
 * - fecha_desde
 * - fecha_hasta
 * - id_sede
 *
 * Para usuarios no superadministradores, se restringen
 * los resultados a las sedes y laboratorios asignados.
 */
const obtenerMantenimientos = async (req, res) => {
  try {
    const resultado = await listarMantenimientos(pool, req.query, req.usuario);

    if (Array.isArray(resultado.data) && resultado.data.length > 0) {
      const ids = resultado.data
        .map((m) => Number(m.id_bitacora))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (ids.length > 0) {
        const conteosRes = await pool.query(
          `SELECT id_bitacora, COUNT(*)::int AS total_evidencias
                     FROM public.evidencia_fotografica
                     WHERE id_bitacora = ANY($1::int[])
                     GROUP BY id_bitacora`,
          [ids]
        );
        const mapaConteos = new Map(
          conteosRes.rows.map((r) => [Number(r.id_bitacora), Number(r.total_evidencias)])
        );
        resultado.data = resultado.data.map((m) => ({
          ...m,
          total_evidencias: mapaConteos.get(Number(m.id_bitacora)) ?? 0,
        }));
      }
    }

    return res.json(resultado);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    console.error('Error al consultar mantenimientos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar mantenimientos.',
    });
  }
};

/**
 * 3. OBTENER MANTENIMIENTO POR ID
 * GET /api/mantenimientos/:id
 *
 * Los usuarios no superadministradores deben tener
 * acceso al laboratorio del equipo correspondiente.
 */
const obtenerMantenimientoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Seleccione un mantenimiento válido.',
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
                s.nombre AS nombre_sede,

                (
                    SELECT COUNT(*)::int
                    FROM public.evidencia_fotografica ev
                    WHERE ev.id_bitacora = bm.id_bitacora
                ) AS total_evidencias

            FROM public.bitacora_mantenimiento bm

            INNER JOIN public.equipo e
                ON bm.id_equipo = e.id_equipo

            INNER JOIN public.usuario u
                ON bm.id_usuario_tecnico = u.id_usuario

            INNER JOIN public.laboratorio l
                ON e.id_laboratorio = l.id_laboratorio

            INNER JOIN public.sede s
                ON l.id_sede = s.id_sede

            LEFT JOIN public.estado es
                ON e.id_estado = es.id_estado

            WHERE bm.id_bitacora = $1
        `;

    const resultado = await pool.query(consulta, [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de mantenimiento no encontrado',
      });
    }

    const mantenimiento = resultado.rows[0];

    // Validación por laboratorio
    const esAdmin = esUsuarioAdministrador(req.usuario.rol);

    if (!esAdmin) {
      const tieneAcceso = await verificarAccesoEquipo(mantenimiento.id_equipo, req.usuario);

      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message:
            'Acceso denegado: no tiene permisos para consultar registros del laboratorio de este equipo',
        });
      }
    }

    return res.json({
      success: true,
      data: mantenimiento,
    });
  } catch (error) {
    console.error('Error al obtener mantenimiento por ID:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el registro de mantenimiento',
    });
  }
};

/**
 * 4. OBTENER HISTORIAL DE MANTENIMIENTOS POR EQUIPO
 * GET /api/mantenimientos/equipo/:idEquipo
 *
 * Permite buscar por ID de equipo o placa institucional.
 * Comprueba permisos por laboratorio antes de devolver
 * los registros históricos.
 */
const obtenerHistorialPorEquipo = async (req, res) => {
  try {
    const { idEquipo } = req.params;

    if (!idEquipo || !idEquipo.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar el identificador o placa institucional del equipo',
      });
    }

    const identificador = idEquipo.trim();
    const esNumero = /^[1-9]\d*$/.test(identificador);

    let whereClause = '';
    let queryParams = [];

    if (esNumero) {
      whereClause = `
                (
                    e.id_equipo = $1
                    OR UPPER(e.placa_institucional) = UPPER($2)
                )
            `;

      queryParams = [parseInt(identificador, 10), identificador];
    } else {
      whereClause = `
                UPPER(e.placa_institucional) = UPPER($1)
            `;

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

            INNER JOIN public.laboratorio l
                ON e.id_laboratorio = l.id_laboratorio

            INNER JOIN public.sede s
                ON l.id_sede = s.id_sede

            LEFT JOIN public.estado es
                ON e.id_estado = es.id_estado

            WHERE ${whereClause}
            LIMIT 1
        `;

    const resultadoEquipo = await pool.query(consultaEquipo, queryParams);

    if (resultadoEquipo.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado',
      });
    }

    const equipo = resultadoEquipo.rows[0];

    // Control de acceso por laboratorio
    const esAdmin = esUsuarioAdministrador(req.usuario.rol);

    if (!esAdmin) {
      const tieneAcceso = await verificarAccesoEquipo(equipo.id_equipo, req.usuario);

      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no tiene permisos sobre el laboratorio de este equipo',
        });
      }
    }

    // Cronología de mantenimientos del equipo
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

            INNER JOIN public.usuario u
                ON bm.id_usuario_tecnico = u.id_usuario

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
        sede: equipo.sede,
      },
      total: resultadoHistorial.rowCount,
      data: resultadoHistorial.rows,
    });
  } catch (error) {
    console.error('Error al obtener historial por equipo:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de mantenimientos del equipo',
    });
  }
};

/**
 * 5. ACTUALIZAR ESTADO DEL MANTENIMIENTO
 * PATCH /api/mantenimientos/:id/estado
 *
 * Permite actualizar:
 * - estado_mantenimiento
 * - descripcion_trabajo
 * - horas_invertidas
 * - id_nuevo_estado
 *
 * Comprueba acceso al laboratorio antes de modificar
 * la bitácora y, si corresponde, el estado del equipo.
 */
const actualizarEstadoMantenimiento = async (req, res) => {
  const invalido = validarEntradaMantenimiento(req.body, true);
  if (invalido) return res.status(400).json({ success: false, message: invalido });
  const { id } = req.params;

  const {
    estado_mantenimiento,
    descripcion_trabajo,
    horas_invertidas,
    id_nuevo_estado,
    motivo_cambio_estado,
  } = req.body;

  // 1. Validar identificador de bitácora
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'Seleccione un mantenimiento válido.',
    });
  }

  // 2. Validar que exista al menos un campo para actualizar
  if (
    estado_mantenimiento === undefined &&
    descripcion_trabajo === undefined &&
    horas_invertidas === undefined &&
    id_nuevo_estado === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: 'Indique qué desea actualizar: estado, trabajo realizado u horas invertidas.',
    });
  }

  // 3. Validar estado del mantenimiento
  let estadoMantenimientoNormalizado = null;

  if (estado_mantenimiento !== undefined) {
    const estadosValidos = ['Completado', 'En Proceso', 'Pendiente Repuesto'];

    const estadoEncontrado = estadosValidos.find(
      (estado) => estado.toLowerCase() === String(estado_mantenimiento).trim().toLowerCase()
    );

    if (!estadoEncontrado) {
      return res.status(400).json({
        success: false,
        message:
          "El estado del mantenimiento debe ser 'Completado', 'En Proceso' o 'Pendiente Repuesto'",
      });
    }

    estadoMantenimientoNormalizado = estadoEncontrado;
  }

  // 4. Validar horas invertidas
  let horasValidadas = null;

  if (horas_invertidas !== undefined && horas_invertidas !== null && horas_invertidas !== '') {
    const parsedHoras = parseFloat(horas_invertidas);

    if (isNaN(parsedHoras) || parsedHoras < 0) {
      return res.status(400).json({
        success: false,
        message: 'Las horas invertidas deben ser un valor numérico mayor o igual a 0',
      });
    }

    horasValidadas = Number(parsedHoras.toFixed(2));
  }

  const esAdmin = esUsuarioAdministrador(req.usuario.rol);
  const idUsuario = req.usuario.idUsuario;

  try {
    // 5. Consultar mantenimiento y estado actual del equipo
    const consultaMantenimiento = await pool.query(
      `
            SELECT
                bm.*,
                e.id_equipo,
                e.nombre AS nombre_equipo,
                e.id_estado AS id_estado_equipo_actual,
                l.id_sede

            FROM public.bitacora_mantenimiento bm

            INNER JOIN public.equipo e
                ON bm.id_equipo = e.id_equipo

            INNER JOIN public.laboratorio l
                ON e.id_laboratorio = l.id_laboratorio

            WHERE bm.id_bitacora = $1
            `,
      [id]
    );

    if (consultaMantenimiento.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de mantenimiento no encontrado',
      });
    }

    const mantenimientoActual = consultaMantenimiento.rows[0];

    // 6. Control de acceso por laboratorio
    if (!esAdmin) {
      const tieneAcceso = await verificarAccesoEquipo(mantenimientoActual.id_equipo, req.usuario);

      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message:
            'Acceso denegado: no tiene permisos para modificar mantenimientos en el laboratorio de este equipo',
        });
      }
    }

    // 7. Validar nuevo estado del equipo
    let nuevoEstadoEquipoId = null;

    if (id_nuevo_estado !== undefined && id_nuevo_estado !== null && id_nuevo_estado !== '') {
      nuevoEstadoEquipoId = parseInt(id_nuevo_estado, 10);

      if (isNaN(nuevoEstadoEquipoId) || nuevoEstadoEquipoId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Seleccione un estado válido.',
        });
      }

      const estadoResult = await pool.query(
        `
                SELECT id_estado, nombre
                FROM public.estado
                WHERE id_estado = $1
                `,
        [nuevoEstadoEquipoId]
      );

      if (estadoResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'El estado seleccionado no está disponible.',
        });
      }
    }

    // 8. Transacción para proteger finalizados (RN11), validar evidencias (RN14/RU09),
    // actualizar mantenimiento y devolver el equipo a Operativo al finalizar (RF22/RN13)
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Bloquear orden y equipo para evitar ediciones concurrentes
      const bloqueoRes = await client.query(
        `
                SELECT
                    bm.id_bitacora,
                    bm.id_equipo,
                    bm.tipo_mantenimiento,
                    bm.estado_mantenimiento,
                    e.id_estado AS id_estado_equipo_actual
                FROM public.bitacora_mantenimiento bm
                INNER JOIN public.equipo e
                    ON bm.id_equipo = e.id_equipo
                WHERE bm.id_bitacora = $1
                FOR UPDATE OF bm, e
                `,
        [id]
      );

      if (bloqueoRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Registro de mantenimiento no encontrado',
        });
      }

      const ordenBloqueada = bloqueoRes.rows[0];

      // RN11 / RNF06: los mantenimientos finalizados son de solo consulta
      if (normalizarTexto(ordenBloqueada.estado_mantenimiento) === 'completado') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Esta orden de mantenimiento ya fue finalizada y es de solo consulta.',
        });
      }

      // RN14 / RU09: exigir evidencia fotográfica antes de marcar como Completado
      if (estadoMantenimientoNormalizado === 'Completado') {
        const validacionEvidencias = await validarEvidenciasParaCierre(
          client,
          ordenBloqueada.id_bitacora,
          ordenBloqueada.tipo_mantenimiento
        );

        if (!validacionEvidencias.valido) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: validacionEvidencias.mensaje,
          });
        }

        // El cierre de una orden no libera un equipo con otro correctivo abierto.
        const pendientes = await client.query(
          `
                    SELECT 1 FROM public.bitacora_mantenimiento
                    WHERE id_equipo = $1 AND id_bitacora <> $2
                      AND LOWER(TRIM(tipo_mantenimiento)) = 'correctivo'
                      AND LOWER(TRIM(estado_mantenimiento)) IN ('en proceso', 'pendiente repuesto')
                    LIMIT 1`,
          [ordenBloqueada.id_equipo, id]
        );
        if (pendientes.rowCount > 0) {
          const estadoPendiente = await resolverEstadoPorNombre(
            client,
            'En mantenimiento',
            'Equipo con mantenimiento correctivo pendiente'
          );
          if (!estadoPendiente) throw new Error('No se pudo resolver el estado de mantenimiento.');
          nuevoEstadoEquipoId = estadoPendiente.id_estado;
        }

        // RF22 / RN13: al finalizar, devolver automáticamente el equipo a 'Operativo'
        // salvo que el técnico indique explícitamente otro estado (ej. recomendación de baja)
        if (!nuevoEstadoEquipoId) {
          const estadoOperativo = await resolverEstadoPorNombre(
            client,
            'Operativo',
            'Equipo en correcto funcionamiento y disponible en laboratorio'
          );

          if (estadoOperativo) {
            nuevoEstadoEquipoId = estadoOperativo.id_estado;
          }
        }
      }

      // Usuario responsable para auditoría
      await client.query("SELECT set_config('app.usuario_id', $1, true)", [String(idUsuario)]);

      const nuevaDescripcion =
        descripcion_trabajo !== undefined && descripcion_trabajo !== null
          ? descripcion_trabajo.trim()
          : null;

      const updateQuery = `
                UPDATE public.bitacora_mantenimiento
                SET
                    estado_mantenimiento = COALESCE(
                        $1,
                        estado_mantenimiento
                    ),
                    horas_invertidas = COALESCE(
                        $2,
                        horas_invertidas
                    ),
                    descripcion_trabajo = COALESCE(
                        $3,
                        descripcion_trabajo
                    )
                WHERE id_bitacora = $4
                RETURNING *;
            `;

      const resultadoUpdate = await client.query(updateQuery, [
        estadoMantenimientoNormalizado,
        horasValidadas,
        nuevaDescripcion,
        id,
      ]);

      const mantenimientoActualizado = resultadoUpdate.rows[0];

      let cambioEstadoInfo = null;

      // Modificar estado del equipo si corresponde
      if (nuevoEstadoEquipoId && nuevoEstadoEquipoId !== ordenBloqueada.id_estado_equipo_actual) {
        await client.query(
          `
                    UPDATE public.equipo
                    SET id_estado = $1
                    WHERE id_equipo = $2
                    `,
          [nuevoEstadoEquipoId, ordenBloqueada.id_equipo]
        );

        // Preparar motivo del cambio de estado
        const motivoTexto =
          motivo_cambio_estado && motivo_cambio_estado.trim()
            ? motivo_cambio_estado.trim().slice(0, 255)
            : `Cambio automático por cierre/actualización de mantenimiento #${id} (${mantenimientoActualizado.estado_mantenimiento})`.slice(
                0,
                255
              );

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
          [motivoTexto, ordenBloqueada.id_equipo]
        );

        cambioEstadoInfo = {
          id_estado_anterior: ordenBloqueada.id_estado_equipo_actual,
          id_estado_nuevo: nuevoEstadoEquipoId,
          historial: histResult.rows[0],
        };
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Estado del mantenimiento actualizado exitosamente',
        data: {
          ...mantenimientoActualizado,
          cambio_estado: cambioEstadoInfo,
        },
      });
    } catch (transaccionError) {
      await client.query('ROLLBACK');
      throw transaccionError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al actualizar estado del mantenimiento:', error);

    return res.status(500).json({
      success: false,
      message: 'Error interno al actualizar el mantenimiento',
    });
  }
};

module.exports = {
  crearMantenimiento,
  obtenerMantenimientos,
  obtenerMantenimientoPorId,
  obtenerHistorialPorEquipo,
  actualizarEstadoMantenimiento,
};
