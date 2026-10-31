const pool = require('../config/database');

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

// Verificar identificadores positivos
const esIdValido = (valor) => {
  return (
    /^[1-9]\d*$/.test(String(valor ?? '')) &&
    Number.isSafeInteger(Number(valor))
  );
};

// Comprobar acceso global
const tieneAccesoGlobal = (usuario) => {
  return usuario?.rol?.toLowerCase().trim() ===
    'superadministrador';
};

// Obtener ID del usuario autenticado
const obtenerIdUsuario = (usuario) => {
  const idUsuario = Number(usuario?.idUsuario);

  if (
    !Number.isSafeInteger(idUsuario) ||
    idUsuario <= 0
  ) {
    return null;
  }

  return idUsuario;
};

// Agregar restricciones de laboratorio a consultas GET
const agregarRestriccionAcceso = (
  condiciones,
  valores,
  usuario
) => {
  const idUsuario = obtenerIdUsuario(usuario);

  if (!idUsuario) {
    return false;
  }

  if (tieneAccesoGlobal(usuario)) {
    return true;
  }

  valores.push(idUsuario);

  condiciones.push(`
    EXISTS (
      SELECT 1
      FROM public.usuario_sede us
      INNER JOIN public.usuario_laboratorio ul
        ON us.id_usuario_sede = ul.id_usuario_sede
      WHERE us.id_usuario = $${valores.length}
        AND us.id_sede = l.id_sede
        AND ul.id_sede = l.id_sede
        AND ul.id_laboratorio = e.id_laboratorio
    )
  `);

  return true;
};

// Convertir textos opcionales vacíos a NULL
const textoOpcional = (valor) => {
  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  return typeof valor === 'string'
    ? valor.trim() || null
    : null;
};

// Comprobar rol y estado directamente en PostgreSQL
const consultarUsuarioActual = async (
  client,
  idUsuario
) => {
  const resultado = await client.query(
    `SELECT
       u.id_usuario,
       u.activo,
       r.nombre AS rol
     FROM public.usuario u
     INNER JOIN public.rol r
       ON u.id_rol = r.id_rol
     WHERE u.id_usuario = $1
     LIMIT 1`,
    [idUsuario]
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  return {
    activo: resultado.rows[0].activo === true,
    rol: resultado.rows[0].rol?.toLowerCase().trim()
  };
};

// Verificar asignación actual a un laboratorio
const tieneAccesoLaboratorio = async (
  client,
  idUsuario,
  idLaboratorio,
  esSuperadministrador
) => {
  const resultado = await client.query(
    `SELECT l.id_laboratorio
     FROM public.laboratorio l
     WHERE l.id_laboratorio = $1
       AND (
         $3::boolean
         OR EXISTS (
           SELECT 1
           FROM public.usuario_sede us
           INNER JOIN public.usuario_laboratorio ul
             ON us.id_usuario_sede = ul.id_usuario_sede
           WHERE us.id_usuario = $2
             AND us.id_sede = l.id_sede
             AND ul.id_sede = l.id_sede
             AND ul.id_laboratorio = l.id_laboratorio
         )
       )
     LIMIT 1`,
    [
      idLaboratorio,
      idUsuario,
      esSuperadministrador
    ]
  );

  return resultado.rowCount > 0;
};

// Manejar errores comunes de PostgreSQL
const responderErrorEscritura = (
  res,
  error,
  operacion
) => {
  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      message:
        'Ya existe un equipo con ese número de serie o placa institucional'
    });
  }

  if (error.code === '23503') {
    return res.status(400).json({
      success: false,
      message:
        'La categoría, el estado o el laboratorio no existen'
    });
  }

  if (error.code === '23502' || error.code === '23514') {
    return res.status(400).json({
      success: false,
      message:
        'Los datos enviados no cumplen las restricciones del sistema'
    });
  }

  console.error(
    `Error al ${operacion} equipo:`,
    error.message
  );

  return res.status(500).json({
    success: false,
    message: `Error interno al ${operacion} el equipo`
  });
};

// =====================================================
// 1. OBTENER EQUIPOS
// GET /api/equipos
// =====================================================

const obtenerEquipos = async (req, res) => {
  try {
    const condiciones = [];
    const valores = [];

    if (!agregarRestriccionAcceso(
      condiciones,
      valores,
      req.usuario
    )) {
      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    // Filtros de texto
    const filtrosTexto = {
      nombre: 'e.nombre',
      numero_serie: 'e.numero_serie',
      placa_institucional: 'e.placa_institucional',
      marca: 'e.marca',
      modelo: 'e.modelo'
    };

    for (const [campo, columna] of Object.entries(filtrosTexto)) {
      const valor = req.query[campo];

      if (valor !== undefined) {
        if (
          typeof valor !== 'string' ||
          !valor.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: `El filtro ${campo} no es válido`
          });
        }

        valores.push(`%${valor.trim()}%`);

        condiciones.push(
          `${columna} ILIKE $${valores.length}`
        );
      }
    }

    // Filtros por identificador
    const filtrosId = {
      id_categoria: 'e.id_categoria',
      id_estado: 'e.id_estado',
      id_laboratorio: 'e.id_laboratorio',
      id_sede: 's.id_sede'
    };

    for (const [campo, columna] of Object.entries(filtrosId)) {
      const valor = req.query[campo];

      if (valor !== undefined) {
        if (
          typeof valor !== 'string' ||
          !esIdValido(valor)
        ) {
          return res.status(400).json({
            success: false,
            message: `El filtro ${campo} debe ser un ID válido`
          });
        }

        valores.push(Number(valor));

        condiciones.push(
          `${columna} = $${valores.length}`
        );
      }
    }

    let consulta = `
      SELECT
        e.id_equipo,
        e.nombre,
        e.numero_serie,
        e.placa_institucional,
        e.marca,
        e.modelo,
        e.anio,
        e.caracteristicas,
        e.comentarios,
        e.ubicacion_detalle,

        e.id_categoria,
        c.nombre AS categoria,

        e.id_estado,
        es.nombre AS estado,

        e.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS laboratorio,

        s.id_sede,
        s.nombre AS sede

      FROM public.equipo e

      INNER JOIN public.categoria c
        ON e.id_categoria = c.id_categoria

      INNER JOIN public.estado es
        ON e.id_estado = es.id_estado

      INNER JOIN public.laboratorio l
        ON e.id_laboratorio = l.id_laboratorio

      INNER JOIN public.sede s
        ON l.id_sede = s.id_sede
    `;

    if (condiciones.length > 0) {
      consulta += `
        WHERE ${condiciones.join(' AND ')}
      `;
    }

    consulta += `
      ORDER BY e.id_equipo DESC
    `;

    const resultado = await pool.query(
      consulta,
      valores
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al obtener equipos:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar los equipos'
    });
  }
};

// =====================================================
// 2. OBTENER EQUIPO POR ID
// GET /api/equipos/:id
// =====================================================

const obtenerEquipoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!esIdValido(id)) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del equipo no es válido'
      });
    }

    const condiciones = ['e.id_equipo = $1'];
    const valores = [Number(id)];

    if (!agregarRestriccionAcceso(
      condiciones,
      valores,
      req.usuario
    )) {
      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    const consulta = `
      SELECT
        e.id_equipo,
        e.nombre,
        e.numero_serie,
        e.placa_institucional,
        e.marca,
        e.modelo,
        e.anio,
        e.caracteristicas,
        e.comentarios,
        e.ubicacion_detalle,

        e.id_categoria,
        c.nombre AS categoria,

        e.id_estado,
        es.nombre AS estado,

        e.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS laboratorio,

        s.id_sede,
        s.nombre AS sede

      FROM public.equipo e

      INNER JOIN public.categoria c
        ON e.id_categoria = c.id_categoria

      INNER JOIN public.estado es
        ON e.id_estado = es.id_estado

      INNER JOIN public.laboratorio l
        ON e.id_laboratorio = l.id_laboratorio

      INNER JOIN public.sede s
        ON l.id_sede = s.id_sede

      WHERE ${condiciones.join(' AND ')}
      LIMIT 1
    `;

    const resultado = await pool.query(
      consulta,
      valores
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado o sin acceso autorizado'
      });
    }

    return res.status(200).json({
      success: true,
      data: resultado.rows[0]
    });

  } catch (error) {
    console.error(
      'Error al obtener equipo por ID:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el equipo'
    });
  }
};

// =====================================================
// 3. CREAR EQUIPO
// POST /api/equipos
// =====================================================

const crearEquipo = async (req, res) => {
  const idUsuario = obtenerIdUsuario(req.usuario);

  if (!idUsuario) {
    return res.status(401).json({
      success: false,
      message: 'Usuario no autenticado'
    });
  }

  const {
    nombre,
    numero_serie,
    placa_institucional,
    marca,
    modelo,
    anio,
    caracteristicas,
    comentarios,
    ubicacion_detalle,
    id_categoria,
    id_estado,
    id_laboratorio
  } = req.body || {};

  if (
    typeof nombre !== 'string' ||
    !nombre.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'El nombre del equipo es obligatorio'
    });
  }

  if (
    !esIdValido(id_categoria) ||
    !esIdValido(id_estado) ||
    !esIdValido(id_laboratorio)
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Categoría, estado y laboratorio deben ser válidos'
    });
  }

  const textos = {
    numero_serie,
    placa_institucional,
    marca,
    modelo,
    caracteristicas,
    comentarios,
    ubicacion_detalle
  };

  for (const [campo, valor] of Object.entries(textos)) {
    if (
      valor !== undefined &&
      valor !== null &&
      typeof valor !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: `El campo ${campo} debe ser texto`
      });
    }
  }

  if (
    anio !== undefined &&
    anio !== null &&
    anio !== '' &&
    (
      !/^\d{4}$/.test(String(anio)) ||
      Number(anio) < 1900 ||
      Number(anio) > 2100
    )
  ) {
    return res.status(400).json({
      success: false,
      message: 'El año del equipo no es válido'
    });
  }

  let client;
  let transaccionIniciada = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');
    transaccionIniciada = true;

    // Verificar rol y estado actuales
    const usuario = await consultarUsuarioActual(
      client,
      idUsuario
    );

    if (!usuario) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    if (!usuario.activo) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message: 'La cuenta de usuario está inactiva'
      });
    }

    // Roles permitidos provisionalmente
    if (
      !['superadministrador', 'tecnico'].includes(usuario.rol)
    ) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message:
          'Tu rol no tiene permisos para registrar equipos'
      });
    }

    // Verificar acceso al laboratorio
    const tieneAcceso = await tieneAccesoLaboratorio(
      client,
      idUsuario,
      Number(id_laboratorio),
      usuario.rol === 'superadministrador'
    );

    if (!tieneAcceso) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message:
          'Laboratorio inexistente o sin acceso autorizado'
      });
    }

    // Identificar usuario para los triggers
    await client.query(
      "SELECT set_config('app.usuario_id', $1, true)",
      [String(idUsuario)]
    );

    const resultado = await client.query(
      `INSERT INTO public.equipo (
        nombre,
        numero_serie,
        placa_institucional,
        marca,
        modelo,
        anio,
        caracteristicas,
        comentarios,
        ubicacion_detalle,
        id_categoria,
        id_estado,
        id_laboratorio
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
      )
      RETURNING *`,
      [
        nombre.trim(),
        textoOpcional(numero_serie),
        textoOpcional(placa_institucional),
        textoOpcional(marca),
        textoOpcional(modelo),
        anio === undefined || anio === null || anio === ''
          ? null
          : Number(anio),
        textoOpcional(caracteristicas),
        textoOpcional(comentarios),
        textoOpcional(ubicacion_detalle),
        Number(id_categoria),
        Number(id_estado),
        Number(id_laboratorio)
      ]
    );

    await client.query('COMMIT');
    transaccionIniciada = false;

    return res.status(201).json({
      success: true,
      message: 'Equipo registrado correctamente',
      data: resultado.rows[0]
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Error al revertir:',
          rollbackError.message
        );
      }
    }

    return responderErrorEscritura(
      res,
      error,
      'registrar'
    );

  } finally {
    if (client) {
      client.release();
    }
  }
};

// =====================================================
// 4. ACTUALIZAR EQUIPO
// PUT /api/equipos/:id
// =====================================================

const actualizarEquipo = async (req, res) => {
  const idUsuario = obtenerIdUsuario(req.usuario);

  if (!idUsuario) {
    return res.status(401).json({
      success: false,
      message: 'Usuario no autenticado'
    });
  }

  if (!esIdValido(req.params.id)) {
    return res.status(400).json({
      success: false,
      message:
        'El identificador del equipo no es válido'
    });
  }

  const idEquipo = Number(req.params.id);

  // Solamente se pueden modificar estos campos
  const camposPermitidos = [
    'nombre',
    'numero_serie',
    'placa_institucional',
    'marca',
    'modelo',
    'anio',
    'caracteristicas',
    'comentarios',
    'ubicacion_detalle',
    'id_categoria',
    'id_estado',
    'id_laboratorio'
  ];

  const datos = req.body;

  if (
    !datos ||
    typeof datos !== 'object' ||
    Array.isArray(datos)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Debe enviar un objeto JSON válido'
    });
  }

  const camposRecibidos = Object.keys(datos);

  if (camposRecibidos.length === 0) {
    return res.status(400).json({
      success: false,
      message:
        'Debe indicar al menos un campo para actualizar'
    });
  }

  // Evitar que modifiquen columnas no permitidas
  const camposDesconocidos = camposRecibidos.filter(
    campo => !camposPermitidos.includes(campo)
  );

  if (camposDesconocidos.length > 0) {
    return res.status(400).json({
      success: false,
      message:
        `Campos no permitidos: ${camposDesconocidos.join(', ')}`
    });
  }

  const camposId = [
    'id_categoria',
    'id_estado',
    'id_laboratorio'
  ];

  const camposTexto = [
    'nombre',
    'numero_serie',
    'placa_institucional',
    'marca',
    'modelo',
    'caracteristicas',
    'comentarios',
    'ubicacion_detalle'
  ];

  // Validar IDs
  for (const campo of camposId) {
    if (
      Object.prototype.hasOwnProperty.call(datos, campo) &&
      !esIdValido(datos[campo])
    ) {
      return res.status(400).json({
        success: false,
        message: `El campo ${campo} debe ser un ID válido`
      });
    }
  }

  // Validar textos
  for (const campo of camposTexto) {
    if (
      !Object.prototype.hasOwnProperty.call(datos, campo)
    ) {
      continue;
    }

    const valor = datos[campo];

    if (campo === 'nombre') {
      if (
        typeof valor !== 'string' ||
        !valor.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El nombre del equipo no puede estar vacío'
        });
      }
    } else if (
      valor !== null &&
      typeof valor !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message:
          `El campo ${campo} debe ser texto o null`
      });
    }
  }

  // Validar año opcional
  if (
    Object.prototype.hasOwnProperty.call(datos, 'anio')
  ) {
    const anio = datos.anio;

    if (
      anio !== null &&
      anio !== '' &&
      (
        !/^\d{4}$/.test(String(anio)) ||
        Number(anio) < 1900 ||
        Number(anio) > 2100
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'El año del equipo no es válido'
      });
    }
  }

  // Preparar los valores nuevos
  const cambios = {};

  for (const campo of camposRecibidos) {
    const valor = datos[campo];

    if (camposId.includes(campo)) {
      cambios[campo] = Number(valor);
    } else if (campo === 'anio') {
      cambios[campo] =
        valor === null || valor === ''
          ? null
          : Number(valor);
    } else if (campo === 'nombre') {
      cambios[campo] = valor.trim();
    } else {
      cambios[campo] =
        valor === null
          ? null
          : valor.trim() || null;
    }
  }

  let client;
  let transaccionIniciada = false;

  try {
    client = await pool.connect();

    await client.query('BEGIN');
    transaccionIniciada = true;

    // Verificar usuario actual en Neon
    const usuario = await consultarUsuarioActual(
      client,
      idUsuario
    );

    if (!usuario) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    if (!usuario.activo) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message:
          'La cuenta de usuario está inactiva'
      });
    }

    // Roles autorizados provisionalmente
    if (
      !['superadministrador', 'tecnico'].includes(usuario.rol)
    ) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message:
          'Tu rol no tiene permisos para modificar equipos'
      });
    }

    // Bloquear el equipo durante la modificación
    const equipoActual = await client.query(
      `SELECT
         id_equipo,
         id_laboratorio
       FROM public.equipo
       WHERE id_equipo = $1
       FOR UPDATE`,
      [idEquipo]
    );

    if (equipoActual.rowCount === 0) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    const laboratorioAnterior =
      equipoActual.rows[0].id_laboratorio;

    const laboratorioNuevo =
      cambios.id_laboratorio ?? laboratorioAnterior;

    const esSuperadministrador =
      usuario.rol === 'superadministrador';

    // Verificar acceso al laboratorio de origen
    const accesoOrigen = await tieneAccesoLaboratorio(
      client,
      idUsuario,
      laboratorioAnterior,
      esSuperadministrador
    );

    if (!accesoOrigen) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message:
          'Sin acceso autorizado al laboratorio de origen'
      });
    }

    // Verificar acceso al laboratorio de destino
    const accesoDestino = await tieneAccesoLaboratorio(
      client,
      idUsuario,
      laboratorioNuevo,
      esSuperadministrador
    );

    if (!accesoDestino) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;

      return res.status(403).json({
        success: false,
        message:
          'Laboratorio de destino inexistente o sin acceso'
      });
    }

    // Informar al trigger quién modifica el equipo
    await client.query(
      "SELECT set_config('app.usuario_id', $1, true)",
      [String(idUsuario)]
    );

    // Construir actualización con campos permitidos
    const nombresCampos = Object.keys(cambios);
    const valores = Object.values(cambios);

    const asignaciones = nombresCampos.map(
      (campo, indice) => `${campo} = $${indice + 1}`
    );

    valores.push(idEquipo);

    const consulta = `
      UPDATE public.equipo
      SET ${asignaciones.join(', ')}
      WHERE id_equipo = $${valores.length}
      RETURNING *
    `;

    const resultado = await client.query(
      consulta,
      valores
    );

    await client.query('COMMIT');
    transaccionIniciada = false;

    return res.status(200).json({
      success: true,
      message: 'Equipo actualizado correctamente',
      data: resultado.rows[0]
    });

  } catch (error) {
    if (client && transaccionIniciada) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Error al revertir:',
          rollbackError.message
        );
      }
    }

    return responderErrorEscritura(
      res,
      error,
      'actualizar'
    );

  } finally {
    if (client) {
      client.release();
    }
  }
};

// =====================================================
// EXPORTACIONES
// =====================================================

module.exports = {
  obtenerEquipos,
  obtenerEquipoPorId,
  crearEquipo,
  actualizarEquipo
};
