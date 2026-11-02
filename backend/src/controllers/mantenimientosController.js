const pool = require('../config/database');
const { verificarAccesoEquipo } = require('../utils/accesoEquipos');

/**
 * Verifica si el usuario tiene el rol Superadministrador.
 * Este rol posee acceso global a todas las sedes y laboratorios.
 *
 * @param {string} rol - Rol actual del usuario
 * @returns {boolean}
 */
const esUsuarioAdministrador = (rol) => {
    const rolNormalizado = String(rol || '').toLowerCase().trim();

    return rolNormalizado === 'superadministrador';
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
    if (
        !id_equipo ||
        !tipo_mantenimiento ||
        !descripcion_trabajo ||
        !descripcion_trabajo.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: 'Los campos id_equipo, tipo_mantenimiento y descripcion_trabajo son obligatorios'
        });
    }

    // 2. Validar identificador del equipo
    const equipoId = parseInt(id_equipo, 10);

    if (isNaN(equipoId) || equipoId <= 0) {
        return res.status(400).json({
            success: false,
            message: 'El identificador del equipo (id_equipo) debe ser un número entero positivo válido'
        });
    }

    // 3. Validar tipo de mantenimiento
    const tiposValidos = ['Preventivo', 'Correctivo'];

    const tipoEncontrado = tiposValidos.find(
        (tipo) =>
            tipo.toLowerCase() ===
            tipo_mantenimiento.trim().toLowerCase()
    );

    if (!tipoEncontrado) {
        return res.status(400).json({
            success: false,
            message: "El tipo de mantenimiento debe ser 'Preventivo' o 'Correctivo'"
        });
    }

    // 4. Validar estado del mantenimiento
    const estadosMantenimientoValidos = [
        'Completado',
        'En Proceso',
        'Pendiente Repuesto'
    ];

    let estadoMantenimientoFinal = 'Completado';

    if (estado_mantenimiento && estado_mantenimiento.trim()) {
        const estadoEncontrado = estadosMantenimientoValidos.find(
            (estado) =>
                estado.toLowerCase() ===
                estado_mantenimiento.trim().toLowerCase()
        );

        if (!estadoEncontrado) {
            return res.status(400).json({
                success: false,
                message: "El estado del mantenimiento debe ser 'Completado', 'En Proceso' o 'Pendiente Repuesto'"
            });
        }

        estadoMantenimientoFinal = estadoEncontrado;
    }

    // 5. Validar horas invertidas
    let horasFinales = 0.0;

    if (
        horas_invertidas !== undefined &&
        horas_invertidas !== null &&
        horas_invertidas !== ''
    ) {
        const parsedHoras = parseFloat(horas_invertidas);

        if (isNaN(parsedHoras) || parsedHoras < 0) {
            return res.status(400).json({
                success: false,
                message: 'Las horas invertidas deben ser un valor numérico mayor o igual a 0'
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
                message: 'Equipo no encontrado'
            });
        }

        const equipoExistente = equipoConsulta.rows[0];

        // 7. Control de acceso por laboratorio
        // El Superadministrador tiene acceso global.
        // Los demás usuarios deben estar autorizados.
        if (!esAdmin) {
            const tieneAcceso = await verificarAccesoEquipo(
                equipoId,
                req.usuario
            );

            if (!tieneAcceso) {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso denegado: no estás asignado al laboratorio de este equipo'
                });
            }
        }

        // 8. Validar nuevo estado del equipo
        let nuevoEstadoId = null;

        if (
            id_nuevo_estado !== undefined &&
            id_nuevo_estado !== null &&
            id_nuevo_estado !== ''
        ) {
            nuevoEstadoId = parseInt(id_nuevo_estado, 10);

            if (isNaN(nuevoEstadoId) || nuevoEstadoId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El id_nuevo_estado debe ser un número entero positivo válido'
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
                    message: 'El estado de equipo especificado (id_nuevo_estado) no existe'
                });
            }
        }

        // 9. Transacción de mantenimiento y auditoría
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Usuario responsable para los triggers de auditoría
            await client.query(
                "SELECT set_config('app.usuario_id', $1, true)",
                [String(idUsuarioTecnico)]
            );

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
                motivo_falla && motivo_falla.trim()
                    ? motivo_falla.trim()
                    : null,
                descripcion_trabajo.trim(),
                horasFinales,
                estadoMantenimientoFinal
            ];

            const resultadoBitacora = await client.query(
                insertBitacoraQuery,
                valoresBitacora
            );

            const mantenimientoCreado = resultadoBitacora.rows[0];

            let auditoriaEstado = null;

            // Cambiar estado del equipo si corresponde
            if (
                nuevoEstadoId &&
                nuevoEstadoId !== equipoExistente.id_estado
            ) {
                await client.query(
                    `
                    UPDATE public.equipo
                    SET id_estado = $1
                    WHERE id_equipo = $2
                    `,
                    [nuevoEstadoId, equipoId]
                );

                // Descripción del cambio para el historial
                const motivoFinal = (
                    motivo_cambio_estado &&
                    motivo_cambio_estado.trim()
                )
                    ? motivo_cambio_estado.trim().slice(0, 255)
                    : `Cambio de estado por mantenimiento #${mantenimientoCreado.id_bitacora} (${tipoEncontrado} - ${estadoMantenimientoFinal})`.slice(0, 255);

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
        // Los detalles técnicos quedan solo en el servidor
        console.error('Error al registrar mantenimiento:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno al registrar el mantenimiento'
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
        `;

        // Restringir por sede y laboratorio del usuario
        if (!esAdmin) {
            query += `
                INNER JOIN public.usuario_sede us
                    ON s.id_sede = us.id_sede
                    AND us.id_usuario = $${paramIndex++}

                INNER JOIN public.usuario_laboratorio ul
                    ON us.id_usuario_sede = ul.id_usuario_sede
                    AND ul.id_sede = l.id_sede
                    AND ul.id_laboratorio = e.id_laboratorio
            `;

            params.push(idUsuario);
        }

        const condiciones = [];

        // Filtro por equipo
        if (id_equipo) {
            const equipoNum = parseInt(id_equipo, 10);

            if (!isNaN(equipoNum)) {
                condiciones.push(
                    `bm.id_equipo = $${paramIndex++}`
                );

                params.push(equipoNum);
            }
        }

        // Filtro por tipo
        if (tipo && tipo.trim()) {
            condiciones.push(
                `LOWER(bm.tipo_mantenimiento) = LOWER($${paramIndex++})`
            );

            params.push(tipo.trim());
        }

        // Filtro por estado de mantenimiento
        if (estado && estado.trim()) {
            condiciones.push(
                `LOWER(bm.estado_mantenimiento) = LOWER($${paramIndex++})`
            );

            params.push(estado.trim());
        }

        // Filtro por fecha inicial
        if (fecha_desde && fecha_desde.trim()) {
            condiciones.push(
                `bm.fecha_mantenimiento >= $${paramIndex++}`
            );

            params.push(fecha_desde.trim());
        }

        // Filtro por fecha final
        if (fecha_hasta && fecha_hasta.trim()) {
            let hasta = fecha_hasta.trim();

            if (/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
                hasta += ' 23:59:59.999';
            }

            condiciones.push(
                `bm.fecha_mantenimiento <= $${paramIndex++}`
            );

            params.push(hasta);
        }

        // Filtro por sede
        if (id_sede) {
            const sedeNum = parseInt(id_sede, 10);

            if (!isNaN(sedeNum)) {
                condiciones.push(
                    `s.id_sede = $${paramIndex++}`
                );

                params.push(sedeNum);
            }
        }

        if (condiciones.length > 0) {
            query += ` WHERE ${condiciones.join(' AND ')} `;
        }

        query += `
            ORDER BY bm.fecha_mantenimiento DESC
        `;

        const resultado = await pool.query(query, params);

        return res.json({
            success: true,
            total: resultado.rowCount,
            data: resultado.rows
        });

    } catch (error) {
        console.error('Error al obtener mantenimientos:', error);

        return res.status(500).json({
            success: false,
            message: 'Error al consultar la lista de mantenimientos'
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
                message: 'Registro de mantenimiento no encontrado'
            });
        }

        const mantenimiento = resultado.rows[0];

        // Validación por laboratorio
        const esAdmin = esUsuarioAdministrador(req.usuario.rol);

        if (!esAdmin) {
            const tieneAcceso = await verificarAccesoEquipo(
                mantenimiento.id_equipo,
                req.usuario
            );

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
        console.error('Error al obtener mantenimiento por ID:', error);

        return res.status(500).json({
            success: false,
            message: 'Error al consultar el registro de mantenimiento'
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
                message: 'Debe especificar el identificador o placa institucional del equipo'
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

            queryParams = [
                parseInt(identificador, 10),
                identificador
            ];

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

        const resultadoEquipo = await pool.query(
            consultaEquipo,
            queryParams
        );

        if (resultadoEquipo.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Equipo no encontrado'
            });
        }

        const equipo = resultadoEquipo.rows[0];

        // Control de acceso por laboratorio
        const esAdmin = esUsuarioAdministrador(req.usuario.rol);

        if (!esAdmin) {
            const tieneAcceso = await verificarAccesoEquipo(
                equipo.id_equipo,
                req.usuario
            );

            if (!tieneAcceso) {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso denegado: no tienes permisos sobre el laboratorio de este equipo'
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

        const resultadoHistorial = await pool.query(
            consultaHistorial,
            [equipo.id_equipo]
        );

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
        console.error('Error al obtener historial por equipo:', error);

        return res.status(500).json({
            success: false,
            message: 'Error al consultar el historial de mantenimientos del equipo'
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
    const { id } = req.params;

    const {
        estado_mantenimiento,
        descripcion_trabajo,
        horas_invertidas,
        id_nuevo_estado,
        motivo_cambio_estado
    } = req.body;

    // 1. Validar identificador de bitácora
    if (!/^[1-9]\d*$/.test(id)) {
        return res.status(400).json({
            success: false,
            message: 'El identificador del mantenimiento no es válido'
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
            message: 'Debe proporcionar al menos un campo para actualizar (estado_mantenimiento, descripcion_trabajo, horas_invertidas o id_nuevo_estado)'
        });
    }

    // 3. Validar estado del mantenimiento
    let estadoMantenimientoNormalizado = null;

    if (estado_mantenimiento !== undefined) {
        const estadosValidos = [
            'Completado',
            'En Proceso',
            'Pendiente Repuesto'
        ];

        const estadoEncontrado = estadosValidos.find(
            (estado) =>
                estado.toLowerCase() ===
                String(estado_mantenimiento).trim().toLowerCase()
        );

        if (!estadoEncontrado) {
            return res.status(400).json({
                success: false,
                message: "El estado del mantenimiento debe ser 'Completado', 'En Proceso' o 'Pendiente Repuesto'"
            });
        }

        estadoMantenimientoNormalizado = estadoEncontrado;
    }

    // 4. Validar horas invertidas
    let horasValidadas = null;

    if (
        horas_invertidas !== undefined &&
        horas_invertidas !== null &&
        horas_invertidas !== ''
    ) {
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
                message: 'Registro de mantenimiento no encontrado'
            });
        }

        const mantenimientoActual = consultaMantenimiento.rows[0];

        // 6. Control de acceso por laboratorio
        if (!esAdmin) {
            const tieneAcceso = await verificarAccesoEquipo(
                mantenimientoActual.id_equipo,
                req.usuario
            );

            if (!tieneAcceso) {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso denegado: no tienes permisos para modificar mantenimientos en el laboratorio de este equipo'
                });
            }
        }

        // 7. Validar nuevo estado del equipo
        let nuevoEstadoEquipoId = null;

        if (
            id_nuevo_estado !== undefined &&
            id_nuevo_estado !== null &&
            id_nuevo_estado !== ''
        ) {
            nuevoEstadoEquipoId = parseInt(id_nuevo_estado, 10);

            if (
                isNaN(nuevoEstadoEquipoId) ||
                nuevoEstadoEquipoId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'El id_nuevo_estado debe ser un número entero positivo válido'
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
                    message: 'El estado de equipo especificado (id_nuevo_estado) no existe'
                });
            }
        }

        // 8. Transacción para actualizar mantenimiento y equipo
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Usuario responsable para auditoría
            await client.query(
                "SELECT set_config('app.usuario_id', $1, true)",
                [String(idUsuario)]
            );

            const nuevaDescripcion = (
                descripcion_trabajo !== undefined &&
                descripcion_trabajo !== null
            )
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

            const resultadoUpdate = await client.query(
                updateQuery,
                [
                    estadoMantenimientoNormalizado,
                    horasValidadas,
                    nuevaDescripcion,
                    id
                ]
            );

            const mantenimientoActualizado = resultadoUpdate.rows[0];

            let cambioEstadoInfo = null;

            // Modificar estado del equipo si corresponde
            if (
                nuevoEstadoEquipoId &&
                nuevoEstadoEquipoId !==
                    mantenimientoActual.id_estado_equipo_actual
            ) {
                await client.query(
                    `
                    UPDATE public.equipo
                    SET id_estado = $1
                    WHERE id_equipo = $2
                    `,
                    [
                        nuevoEstadoEquipoId,
                        mantenimientoActual.id_equipo
                    ]
                );

                // Preparar motivo del cambio de estado
                const motivoTexto = (
                    motivo_cambio_estado &&
                    motivo_cambio_estado.trim()
                )
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
                    [
                        motivoTexto,
                        mantenimientoActual.id_equipo
                    ]
                );

                cambioEstadoInfo = {
                    id_estado_anterior:
                        mantenimientoActual.id_estado_equipo_actual,
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
        console.error(
            'Error al actualizar estado del mantenimiento:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Error interno al actualizar el mantenimiento'
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
