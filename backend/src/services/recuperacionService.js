const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { enviarCorreoRecuperacion } = require('./emailService');

const MENSAJE_GENERICO_SOLICITUD =
  'Si el correo está registrado y la cuenta se encuentra activa, recibirá un enlace de recuperación en unos minutos.';
const MENSAJE_TOKEN_INVALIDO =
  'El enlace de recuperación no es válido o ha expirado. Solicite uno nuevo.';
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TOKEN_HEX = /^[0-9a-f]{64}$/;

const fallo = (message, status = 400) => Object.assign(new Error(message), { status });

const calcularHashToken = (token) =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const obtenerMinutosExpiracion = () => {
  const valor = Number(process.env.RESET_TOKEN_EXPIRES_MIN);
  if (Number.isInteger(valor) && valor >= 5 && valor <= 1440) {
    return valor;
  }
  return 30;
};

const construirEnlaceRecuperacion = (token) => {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/+$/, '');
  return `${base}/?recuperar=${encodeURIComponent(token)}`;
};

const normalizarTokenEntrada = (token) => {
  if (typeof token !== 'string') return '';
  return token.trim().toLowerCase();
};

const validarPoliticaContrasena = (contrasenaNueva) => {
  if (typeof contrasenaNueva !== 'string' || !contrasenaNueva) {
    throw fallo('Debe ingresar la nueva contraseña.', 400);
  }
  if (contrasenaNueva.length < 12 || Buffer.byteLength(contrasenaNueva, 'utf8') > 72) {
    throw fallo(
      'La nueva contraseña debe tener al menos 12 caracteres y no superar 72 bytes.',
      400
    );
  }
};

/**
 * Genera un token temporal de recuperación (SHA-256 en BD) y lo envía por correo.
 * Siempre responde con el mismo mensaje genérico para evitar enumeración de cuentas.
 */
async function solicitarRecuperacion(pool, correo, opciones = {}) {
  if (typeof correo !== 'string') {
    throw fallo('Ingrese un correo electrónico válido.', 400);
  }

  const correoLimpio = correo.trim().toLowerCase();
  if (!correoLimpio || correoLimpio.length > 150 || !REGEX_CORREO.test(correoLimpio)) {
    throw fallo('Ingrese un correo electrónico válido.', 400);
  }

  const resultadoUsuario = await pool.query(
    `
      SELECT id_usuario, nombre_completo, correo_institucional, activo
      FROM public.usuario
      WHERE LOWER(correo_institucional) = LOWER($1)
      LIMIT 1
    `,
    [correoLimpio]
  );

  const usuario = resultadoUsuario.rows[0];
  if (!usuario || !usuario.activo) {
    return {
      success: true,
      message: MENSAJE_GENERICO_SOLICITUD,
    };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = calcularHashToken(token);
  const minutosExpiracion = obtenerMinutosExpiracion();

  const cliente = await pool.connect();
  let idRecuperacion = null;
  let enTransaccion = false;

  try {
    await cliente.query('BEGIN');
    enTransaccion = true;

    // Bloquear fila del usuario para serializar solicitudes concurrentes de recuperación
    const cuentaActiva = await cliente.query(
      `
        SELECT id_usuario, activo
        FROM public.usuario
        WHERE id_usuario = $1
        FOR UPDATE
      `,
      [usuario.id_usuario]
    );

    if (!cuentaActiva.rows[0]?.activo) {
      await cliente.query('ROLLBACK');
      enTransaccion = false;
      return {
        success: true,
        message: MENSAJE_GENERICO_SOLICITUD,
      };
    }

    // Invalidar enlaces previos sin usar del mismo usuario
    await cliente.query(
      `
        UPDATE public.recuperacion_contrasena
        SET usado_en = NOW()
        WHERE id_usuario = $1
          AND usado_en IS NULL
      `,
      [usuario.id_usuario]
    );

    const insercion = await cliente.query(
      `
        INSERT INTO public.recuperacion_contrasena (id_usuario, token_hash, expira_en)
        VALUES ($1, $2, NOW() + make_interval(mins => $3))
        RETURNING id_recuperacion
      `,
      [usuario.id_usuario, tokenHash, minutosExpiracion]
    );

    idRecuperacion = insercion.rows[0].id_recuperacion;
    await cliente.query('COMMIT');
    enTransaccion = false;
  } catch (error) {
    if (enTransaccion) {
      await cliente.query('ROLLBACK').catch(() => {});
    }
    throw error;
  } finally {
    cliente.release();
  }

  const enlace = construirEnlaceRecuperacion(token);
  const transportador = opciones.transportador || null;
  const enviarCorreo =
    opciones.enviarCorreo ||
    ((datos) => enviarCorreoRecuperacion(datos, transportador));

  try {
    await enviarCorreo({
      para: usuario.correo_institucional,
      nombre: usuario.nombre_completo,
      enlace,
      minutosExpiracion,
    });
  } catch (errorCorreo) {
    console.error(
      '[Recuperación de contraseña] No se pudo enviar el correo:',
      errorCorreo.message
    );
    // Invalidar el token recién creado si el correo no salió
    if (idRecuperacion) {
      await pool
        .query(
          'UPDATE public.recuperacion_contrasena SET usado_en = NOW() WHERE id_recuperacion = $1',
          [idRecuperacion]
        )
        .catch(() => {});
    }
  }

  return {
    success: true,
    message: MENSAJE_GENERICO_SOLICITUD,
  };
}

/**
 * Comprueba si un token recibido desde el enlace sigue vigente y sin usar.
 */
async function validarTokenRecuperacion(pool, token) {
  const tokenLimpio = normalizarTokenEntrada(token);
  if (!REGEX_TOKEN_HEX.test(tokenLimpio)) {
    throw fallo(MENSAJE_TOKEN_INVALIDO, 400);
  }

  const tokenHash = calcularHashToken(tokenLimpio);
  const consulta = await pool.query(
    `
      SELECT rc.id_recuperacion
      FROM public.recuperacion_contrasena rc
      INNER JOIN public.usuario u ON u.id_usuario = rc.id_usuario
      WHERE rc.token_hash = $1
        AND rc.usado_en IS NULL
        AND rc.expira_en > NOW()
        AND u.activo = true
      LIMIT 1
    `,
    [tokenHash]
  );

  if (consulta.rowCount === 0) {
    throw fallo(MENSAJE_TOKEN_INVALIDO, 400);
  }

  return {
    success: true,
    valido: true,
    message: 'El enlace de recuperación es válido.',
  };
}

/**
 * Restablece la contraseña en una transacción atómica consumiendo el token (un solo uso).
 */
async function restablecerContrasenaConToken(pool, { token, contrasenaNueva }) {
  const tokenLimpio = normalizarTokenEntrada(token);
  if (!REGEX_TOKEN_HEX.test(tokenLimpio)) {
    throw fallo(MENSAJE_TOKEN_INVALIDO, 400);
  }

  validarPoliticaContrasena(contrasenaNueva);

  const tokenHash = calcularHashToken(tokenLimpio);
  const cliente = await pool.connect();
  let enTransaccion = false;

  try {
    await cliente.query('BEGIN');
    enTransaccion = true;

    const consulta = await cliente.query(
      `
        SELECT
          rc.id_recuperacion,
          rc.id_usuario,
          rc.usado_en,
          (rc.expira_en <= NOW()) AS expirado,
          u.activo
        FROM public.recuperacion_contrasena rc
        INNER JOIN public.usuario u ON u.id_usuario = rc.id_usuario
        WHERE rc.token_hash = $1
        FOR UPDATE OF rc, u
      `,
      [tokenHash]
    );

    const registro = consulta.rows[0];
    if (!registro || registro.usado_en !== null || registro.expirado || !registro.activo) {
      await cliente.query('ROLLBACK');
      enTransaccion = false;
      throw fallo(MENSAJE_TOKEN_INVALIDO, 400);
    }

    const hashNuevo = await bcrypt.hash(contrasenaNueva, 12);

    await cliente.query(
      `
        UPDATE public.recuperacion_contrasena
        SET usado_en = NOW()
        WHERE id_usuario = $1
          AND usado_en IS NULL
      `,
      [registro.id_usuario]
    );

    const actualizacion = await cliente.query(
      `
        UPDATE public.usuario
        SET contrasena_hash = $1,
            version_sesion = version_sesion + 1
        WHERE id_usuario = $2
          AND activo = true
        RETURNING id_usuario, version_sesion
      `,
      [hashNuevo, registro.id_usuario]
    );

    if (actualizacion.rowCount === 0) {
      await cliente.query('ROLLBACK');
      enTransaccion = false;
      throw fallo(MENSAJE_TOKEN_INVALIDO, 400);
    }

    await cliente.query('COMMIT');
    enTransaccion = false;

    return {
      success: true,
      message: 'Contraseña restablecida correctamente. Ya puede iniciar sesión.',
    };
  } catch (error) {
    if (enTransaccion) {
      await cliente.query('ROLLBACK').catch(() => {});
    }
    throw error;
  } finally {
    cliente.release();
  }
}

module.exports = {
  MENSAJE_GENERICO_SOLICITUD,
  MENSAJE_TOKEN_INVALIDO,
  calcularHashToken,
  obtenerMinutosExpiracion,
  construirEnlaceRecuperacion,
  solicitarRecuperacion,
  validarTokenRecuperacion,
  restablecerContrasenaConToken,
};
