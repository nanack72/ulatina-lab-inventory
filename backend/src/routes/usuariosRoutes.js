const express = require('express');
const bcrypt = require('bcryptjs');

const pool = require('../config/database');
const { verificarToken } = require('../middlewares/authMiddleware');
const { permitirRoles } = require('../middlewares/permisosMiddleware');

const router = express.Router();

router.use(
  verificarToken,
  permitirRoles('Superadministrador')
);

const esId = (valor) =>
  Number.isSafeInteger(valor) &&
  valor > 0 &&
  valor <= 2147483647;

const esSuperadministrador = (rol) =>
  String(rol || '').trim().toLowerCase() === 'superadministrador';

function errorSolicitud(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function responderError(res, error) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'El correo o una de las asignaciones ya existe.',
    });
  }

  if (error.code === '23503') {
    return res.status(409).json({
      success: false,
      message:
        'Uno de los roles, sedes o laboratorios seleccionados ya no está disponible.',
    });
  }

  console.error('Error de administración de usuarios:', error);

  return res.status(500).json({
    success: false,
    message: 'No fue posible completar la operación.',
  });
}

function validarDatos(body, creando) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw errorSolicitud('Debe enviar los datos del usuario.');
  }

  if (
    typeof body.nombre_completo !== 'string' ||
    !body.nombre_completo.trim() ||
    Array.from(body.nombre_completo.trim()).length > 150
  ) {
    throw errorSolicitud(
      'El nombre es obligatorio y admite hasta 150 caracteres.'
    );
  }

  if (typeof body.correo_institucional !== 'string') {
    throw errorSolicitud('Ingrese un correo válido.');
  }

  const correo = body.correo_institucional.trim().toLowerCase();

  if (
    correo.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
  ) {
    throw errorSolicitud('Ingrese un correo válido de hasta 150 caracteres.');
  }

  if (!esId(body.id_rol)) {
    throw errorSolicitud('Seleccione un rol válido.');
  }

  if (typeof body.activo !== 'boolean') {
    throw errorSolicitud('Debe indicar si la cuenta estará activa.');
  }

  if (!Array.isArray(body.sedes) || !Array.isArray(body.laboratorios)) {
    throw errorSolicitud('Debe enviar las sedes y laboratorios seleccionados.');
  }

  if (
    body.sedes.some((id) => !esId(id)) ||
    body.laboratorios.some((id) => !esId(id))
  ) {
    throw errorSolicitud('Hay sedes o laboratorios no válidos.');
  }

  const sedes = [...new Set(body.sedes)];
  const laboratorios = [...new Set(body.laboratorios)];

  if (creando) {
    if (
      typeof body.contrasena !== 'string' ||
      body.contrasena.length < 12 ||
      Buffer.byteLength(body.contrasena, 'utf8') > 72
    ) {
      throw errorSolicitud(
        'La contraseña debe tener al menos 12 caracteres y no superar 72 bytes.'
      );
    }
  }

  return {
    nombre: body.nombre_completo.trim(),
    correo,
    idRol: body.id_rol,
    activo: body.activo,
    sedes,
    laboratorios,
  };
}

// Validar que los catálogos y asignaciones realmente existan.
async function validarReferencias(cliente, datos) {
  const rol = await cliente.query(
    'SELECT id_rol, nombre FROM public.rol WHERE id_rol = $1',
    [datos.idRol]
  );

  if (rol.rowCount === 0) {
    throw errorSolicitud('El rol seleccionado no existe.');
  }

  const sedes = await cliente.query(
    `
      SELECT id_sede
      FROM public.sede
      WHERE id_sede = ANY($1::integer[])
    `,
    [datos.sedes]
  );

  if (sedes.rowCount !== datos.sedes.length) {
    throw errorSolicitud('Una de las sedes seleccionadas no existe.');
  }

  const laboratorios = await cliente.query(
    `
      SELECT id_laboratorio, id_sede
      FROM public.laboratorio
      WHERE id_laboratorio = ANY($1::integer[])
    `,
    [datos.laboratorios]
  );

  if (laboratorios.rowCount !== datos.laboratorios.length) {
    throw errorSolicitud('Uno de los laboratorios seleccionados no existe.');
  }

  for (const laboratorio of laboratorios.rows) {
    if (!datos.sedes.includes(laboratorio.id_sede)) {
      throw errorSolicitud(
        'Cada laboratorio debe pertenecer a una sede asignada al usuario.'
      );
    }
  }

  return {
    rol: rol.rows[0],
    laboratorios: laboratorios.rows,
  };
}

// Mantener las asignaciones existentes y modificar solamente las necesarias.
async function guardarAsignaciones(cliente, idUsuario, datos, laboratorios) {
  // Primero eliminar las asignaciones de laboratorios retiradas.
  await cliente.query(
    `
      DELETE FROM public.usuario_laboratorio ul
      USING public.usuario_sede us
      WHERE ul.id_usuario_sede = us.id_usuario_sede
        AND us.id_usuario = $1
        AND (
          NOT (ul.id_laboratorio = ANY($2::integer[]))
          OR NOT (us.id_sede = ANY($3::integer[]))
        )
    `,
    [idUsuario, datos.laboratorios, datos.sedes]
  );

  // Después eliminar las sedes retiradas.
  await cliente.query(
    `
      DELETE FROM public.usuario_sede
      WHERE id_usuario = $1
        AND NOT (id_sede = ANY($2::integer[]))
    `,
    [idUsuario, datos.sedes]
  );

  for (const idSede of datos.sedes) {
    await cliente.query(
      `
        INSERT INTO public.usuario_sede (id_usuario, id_sede)
        VALUES ($1, $2)
        ON CONFLICT (id_usuario, id_sede) DO NOTHING
      `,
      [idUsuario, idSede]
    );
  }

  const asignaciones = await cliente.query(
    `
      SELECT id_usuario_sede, id_sede
      FROM public.usuario_sede
      WHERE id_usuario = $1
    `,
    [idUsuario]
  );

  const sedePorId = new Map(
    asignaciones.rows.map((registro) => [
      registro.id_sede,
      registro.id_usuario_sede,
    ])
  );

  for (const laboratorio of laboratorios) {
    await cliente.query(
      `
        INSERT INTO public.usuario_laboratorio (
          id_usuario_sede,
          id_laboratorio,
          id_sede
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (id_usuario_sede, id_laboratorio) DO NOTHING
      `,
      [
        sedePorId.get(laboratorio.id_sede),
        laboratorio.id_laboratorio,
        laboratorio.id_sede,
      ]
    );
  }
}

// Opciones para formularios de usuarios.
router.get('/opciones', async (req, res) => {
  try {
    const [roles, sedes, laboratorios] = await Promise.all([
      pool.query(`
        SELECT id_rol, nombre
        FROM public.rol
        ORDER BY nombre
      `),
      pool.query(`
        SELECT id_sede, nombre
        FROM public.sede
        ORDER BY nombre
      `),
      pool.query(`
        SELECT
          l.id_laboratorio,
          l.id_sede,
          l.codigo,
          l.nombre,
          s.nombre AS nombre_sede
        FROM public.laboratorio l
        INNER JOIN public.sede s ON s.id_sede = l.id_sede
        ORDER BY s.nombre, l.nombre
      `),
    ]);

    return res.json({
      success: true,
      data: {
        roles: roles.rows,
        sedes: sedes.rows,
        laboratorios: laboratorios.rows,
      },
    });
  } catch (error) {
    return responderError(res, error);
  }
});

// Listado. Nunca devolver contrasena_hash.
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        u.id_usuario,
        u.id_rol,
        u.nombre_completo,
        u.correo_institucional,
        u.activo,
        u.fecha_creacion,
        r.nombre AS rol,
        ARRAY(
          SELECT us.id_sede
          FROM public.usuario_sede us
          WHERE us.id_usuario = u.id_usuario
          ORDER BY us.id_sede
        ) AS sedes,
        ARRAY(
          SELECT ul.id_laboratorio
          FROM public.usuario_laboratorio ul
          INNER JOIN public.usuario_sede us
            ON us.id_usuario_sede = ul.id_usuario_sede
          WHERE us.id_usuario = u.id_usuario
          ORDER BY ul.id_laboratorio
        ) AS laboratorios
      FROM public.usuario u
      INNER JOIN public.rol r ON r.id_rol = u.id_rol
      ORDER BY u.fecha_creacion DESC, u.id_usuario DESC
    `);

    return res.json({
      success: true,
      data: resultado.rows,
    });
  } catch (error) {
    return responderError(res, error);
  }
});

// Crear usuario con sus asignaciones en una sola transacción.
router.post('/', async (req, res) => {
  let cliente;
  let transaccion = false;

  try {
    const datos = validarDatos(req.body, true);
    const hash = await bcrypt.hash(req.body.contrasena, 12);

    cliente = await pool.connect();
    await cliente.query('BEGIN');
    transaccion = true;

    // Serializar las modificaciones administrativas de usuarios.
    await cliente.query('SELECT pg_advisory_xact_lock(2026, 1101)');

    const referencias = await validarReferencias(cliente, datos);

    const duplicado = await cliente.query(
      `
        SELECT id_usuario
        FROM public.usuario
        WHERE LOWER(correo_institucional) = $1
      `,
      [datos.correo]
    );

    if (duplicado.rowCount > 0) {
      throw errorSolicitud('Ya existe un usuario con ese correo.', 409);
    }

    const resultado = await cliente.query(
      `
        INSERT INTO public.usuario (
          id_rol,
          nombre_completo,
          correo_institucional,
          contrasena_hash,
          activo
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id_usuario
      `,
      [datos.idRol, datos.nombre, datos.correo, hash, datos.activo]
    );

    const idUsuario = resultado.rows[0].id_usuario;

    await guardarAsignaciones(
      cliente,
      idUsuario,
      datos,
      referencias.laboratorios
    );

    await cliente.query('COMMIT');
    transaccion = false;

    return res.status(201).json({
      success: true,
      message: 'Usuario registrado correctamente.',
      data: { id_usuario: idUsuario },
    });
  } catch (error) {
    if (cliente && transaccion) {
      await cliente.query('ROLLBACK');
    }

    return responderError(res, error);
  } finally {
    cliente?.release();
  }
});

// Editar datos, rol, estado y asignaciones.
// La contraseña no se modifica desde este endpoint.
router.put('/:id', async (req, res) => {
  let cliente;
  let transaccion = false;

  try {
    const idUsuario = Number(req.params.id);

    if (!esId(idUsuario)) {
      throw errorSolicitud('Identificador de usuario no válido.');
    }

    const datos = validarDatos(req.body, false);

    cliente = await pool.connect();
    await cliente.query('BEGIN');
    transaccion = true;

    await cliente.query('SELECT pg_advisory_xact_lock(2026, 1101)');

    const actual = await cliente.query(
      `
        SELECT
          u.id_usuario,
          u.activo,
          r.nombre AS rol
        FROM public.usuario u
        INNER JOIN public.rol r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = $1
        FOR UPDATE OF u
      `,
      [idUsuario]
    );

    if (actual.rowCount === 0) {
      throw errorSolicitud('El usuario no existe.', 404);
    }

    const referencias = await validarReferencias(cliente, datos);
    const nuevoEsSuper = esSuperadministrador(referencias.rol.nombre);

    // Evitar que el administrador se quite su propio acceso.
    if (
      idUsuario === req.usuario.idUsuario &&
      (!datos.activo || !nuevoEsSuper)
    ) {
      throw errorSolicitud(
        'No puede desactivar su propia cuenta ni quitarse el rol de Superadministrador.',
        409
      );
    }

    const usuarioActual = actual.rows[0];

    // Nunca dejar el sistema sin un Superadministrador activo.
    if (
      usuarioActual.activo &&
      esSuperadministrador(usuarioActual.rol) &&
      (!datos.activo || !nuevoEsSuper)
    ) {
      const otros = await cliente.query(
        `
          SELECT u.id_usuario
          FROM public.usuario u
          INNER JOIN public.rol r ON r.id_rol = u.id_rol
          WHERE u.activo = true
            AND LOWER(TRIM(r.nombre)) = 'superadministrador'
            AND u.id_usuario <> $1
          LIMIT 1
        `,
        [idUsuario]
      );

      if (otros.rowCount === 0) {
        throw errorSolicitud(
          'Debe conservar al menos un Superadministrador activo.',
          409
        );
      }
    }

    const duplicado = await cliente.query(
      `
        SELECT id_usuario
        FROM public.usuario
        WHERE LOWER(correo_institucional) = $1
          AND id_usuario <> $2
      `,
      [datos.correo, idUsuario]
    );

    if (duplicado.rowCount > 0) {
      throw errorSolicitud('Ya existe un usuario con ese correo.', 409);
    }

    await cliente.query(
      `
        UPDATE public.usuario
        SET
          id_rol = $1,
          nombre_completo = $2,
          correo_institucional = $3,
          activo = $4
        WHERE id_usuario = $5
      `,
      [
        datos.idRol,
        datos.nombre,
        datos.correo,
        datos.activo,
        idUsuario,
      ]
    );

    await guardarAsignaciones(
      cliente,
      idUsuario,
      datos,
      referencias.laboratorios
    );

    await cliente.query('COMMIT');
    transaccion = false;

    return res.json({
      success: true,
      message: 'Usuario actualizado correctamente.',
    });
  } catch (error) {
    if (cliente && transaccion) {
      await cliente.query('ROLLBACK');
    }

    return responderError(res, error);
  } finally {
    cliente?.release();
  }
});

module.exports = router;