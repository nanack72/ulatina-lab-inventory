const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const {
  MENSAJE_GENERICO_SOLICITUD,
  calcularHashToken,
  solicitarRecuperacion,
  validarTokenRecuperacion,
  restablecerContrasenaConToken,
} = require('../src/services/recuperacionService');

function crearPoolPglite(db) {
  return {
    query: (sql, valores) => db.query(sql, valores),
    connect: async () => ({
      query: (sql, valores) => db.query(sql, valores),
      release() {},
    }),
  };
}

function extraerTokenDesdeCorreo(correoEnviado) {
  const coincidencia = String(correoEnviado?.text || '').match(/\?recuperar=([0-9a-f]{64})/);
  return coincidencia ? coincidencia[1] : null;
}

test('Recuperación de contraseña con migración 011 y rol pes_runtime (PGlite)', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  const hashInicial = await bcrypt.hash('ClaveInicialSegura2026!', 12);

  await db.exec(`
    CREATE ROLE pes_owner;
    CREATE ROLE pes_runtime;
    GRANT USAGE, CREATE ON SCHEMA public TO pes_owner;
    GRANT USAGE ON SCHEMA public TO pes_runtime;
    CREATE TABLE public.rol (
      id_rol integer PRIMARY KEY,
      nombre text NOT NULL
    );
    CREATE TABLE public.usuario (
      id_usuario integer PRIMARY KEY,
      id_rol integer NOT NULL REFERENCES public.rol(id_rol),
      nombre_completo text NOT NULL,
      correo_institucional text NOT NULL UNIQUE,
      contrasena_hash text NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      permiso_inventario text NOT NULL DEFAULT 'consulta',
      puede_eliminar_equipos boolean NOT NULL DEFAULT false
    );
    CREATE TABLE public.token_revocado (
      jti uuid PRIMARY KEY,
      id_usuario integer NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
      expira_en timestamptz NOT NULL
    );
    INSERT INTO public.rol VALUES (1, 'Superadministrador'), (2, 'Tecnico');
    INSERT INTO public.usuario
      (id_usuario, id_rol, nombre_completo, correo_institucional, contrasena_hash, activo)
    VALUES
      (1, 2, 'Técnico Activo', 'tecnico@ulatina.cr', '${hashInicial}', true),
      (2, 2, 'Técnico Inactivo', 'inactivo@ulatina.cr', '${hashInicial}', false);

    ALTER TABLE public.rol OWNER TO pes_owner;
    ALTER TABLE public.usuario OWNER TO pes_owner;
    ALTER TABLE public.token_revocado OWNER TO pes_owner;
    GRANT SELECT ON public.rol TO pes_runtime;
    GRANT SELECT, INSERT ON public.token_revocado TO pes_runtime;
    GRANT SELECT (id_usuario, id_rol, nombre_completo, correo_institucional, contrasena_hash, activo, permiso_inventario, puede_eliminar_equipos)
      ON public.usuario TO pes_runtime;
  `);

  const mig011 = fs.readFileSync(
    path.join(__dirname, '../../database/migrations/011_recuperacion_contrasena.sql'),
    'utf8'
  );
  const mig012 = fs.readFileSync(
    path.join(__dirname, '../../database/migrations/012_invalidacion_sesiones.sql'),
    'utf8'
  );
  await db.exec(mig011);
  await db.exec(mig012);
  await db.exec('SET ROLE pes_runtime');

  const pool = crearPoolPglite(db);
  const correosEnviados = [];
  const transportadorMock = {
    async sendMail(mensaje) {
      correosEnviados.push(mensaje);
      return { messageId: `mock-${correosEnviados.length}` };
    },
  };

  // 1. Anti-enumeración: correo inexistente y cuenta inactiva devuelven mismo mensaje sin enviar correo
  const respInexistente = await solicitarRecuperacion(pool, 'noexiste@ulatina.cr', {
    transportador: transportadorMock,
  });
  const respInactiva = await solicitarRecuperacion(pool, 'inactivo@ulatina.cr', {
    transportador: transportadorMock,
  });
  assert.equal(respInexistente.success, true);
  assert.equal(respInexistente.message, MENSAJE_GENERICO_SOLICITUD);
  assert.equal(respInactiva.success, true);
  assert.equal(respInactiva.message, MENSAJE_GENERICO_SOLICITUD);
  assert.equal(correosEnviados.length, 0);
  assert.equal(
    (await db.query('SELECT COUNT(*)::int AS n FROM public.recuperacion_contrasena')).rows[0].n,
    0
  );

  // 2. Generación de token + almacenamiento exclusivo de SHA-256 en BD
  const respActiva = await solicitarRecuperacion(pool, 'tecnico@ulatina.cr', {
    transportador: transportadorMock,
  });
  assert.equal(respActiva.success, true);
  assert.equal(respActiva.message, MENSAJE_GENERICO_SOLICITUD);
  assert.equal(correosEnviados.length, 1);
  assert.equal(correosEnviados[0].to, 'tecnico@ulatina.cr');
  assert.ok(correosEnviados[0].html.includes('cid:logo-ulatina-blanco'));
  assert.ok(correosEnviados[0].html.includes('#075640'));
  assert.ok(correosEnviados[0].html.includes('#b3d334'));
  assert.equal(correosEnviados[0].attachments?.[0]?.cid, 'logo-ulatina-blanco');

  const primerToken = extraerTokenDesdeCorreo(correosEnviados[0]);
  assert.ok(primerToken, 'El correo debe incluir el enlace con ?recuperar=<token>');

  const filaPrimerToken = (
    await db.query(
      'SELECT id_recuperacion, id_usuario, token_hash, usado_en FROM public.recuperacion_contrasena'
    )
  ).rows[0];
  assert.equal(filaPrimerToken.id_usuario, 1);
  assert.notEqual(filaPrimerToken.token_hash, primerToken);
  assert.equal(filaPrimerToken.token_hash, calcularHashToken(primerToken));
  assert.equal(filaPrimerToken.usado_en, null);

  // 3. Solicitar un segundo enlace invalida automáticamente el anterior
  await solicitarRecuperacion(pool, 'tecnico@ulatina.cr', {
    transportador: transportadorMock,
  });
  assert.equal(correosEnviados.length, 2);
  const segundoToken = extraerTokenDesdeCorreo(correosEnviados[1]);
  assert.ok(segundoToken && segundoToken !== primerToken);

  await assert.rejects(
    () => validarTokenRecuperacion(pool, primerToken),
    (err) => err.status === 400
  );
  const validacionSegundo = await validarTokenRecuperacion(pool, segundoToken);
  assert.equal(validacionSegundo.valido, true);

  // 4. Política de contraseña (< 12 caracteres y > 72 bytes UTF-8) rechaza sin consumir el token
  await assert.rejects(
    () =>
      restablecerContrasenaConToken(pool, {
        token: segundoToken,
        contrasenaNueva: 'corta12345',
      }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () =>
      restablecerContrasenaConToken(pool, {
        token: segundoToken,
        contrasenaNueva: 'á'.repeat(40), // 80 bytes UTF-8 > 72 bytes
      }),
    (err) => err.status === 400
  );
  // El token sigue vigente tras rechazos de validación
  assert.equal((await validarTokenRecuperacion(pool, segundoToken)).valido, true);

  // 5. Expiración: simular token expirado directamente como pes_owner y verificar rechazo
  await db.exec('RESET ROLE');
  await db.query(
    `UPDATE public.recuperacion_contrasena
     SET expira_en = NOW() - INTERVAL '2 minutes'
     WHERE token_hash = $1`,
    [calcularHashToken(segundoToken)]
  );
  await db.exec('SET ROLE pes_runtime');

  await assert.rejects(
    () => validarTokenRecuperacion(pool, segundoToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    () =>
      restablecerContrasenaConToken(pool, {
        token: segundoToken,
        contrasenaNueva: 'NuevaClaveSegura2026!',
      }),
    (err) => err.status === 400
  );

  // 6. Cuenta desactivada después de emitir enlace: debe rechazar uso del token
  await solicitarRecuperacion(pool, 'tecnico@ulatina.cr', {
    transportador: transportadorMock,
  });
  const tercerToken = extraerTokenDesdeCorreo(correosEnviados[2]);
  await db.exec('RESET ROLE');
  await db.query('UPDATE public.usuario SET activo = false WHERE id_usuario = 1');
  await db.exec('SET ROLE pes_runtime');

  await assert.rejects(
    () => validarTokenRecuperacion(pool, tercerToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    () =>
      restablecerContrasenaConToken(pool, {
        token: tercerToken,
        contrasenaNueva: 'NuevaClaveSegura2026!',
      }),
    (err) => err.status === 400
  );

  // Reactivar cuenta para probar flujo exitoso completo
  await db.exec('RESET ROLE');
  await db.query('UPDATE public.usuario SET activo = true WHERE id_usuario = 1');
  await db.exec('SET ROLE pes_runtime');

  // Preparar authController y authMiddleware reales apuntando a PGlite (con pes_runtime)
  const rutaAuthCtrl = path.join(__dirname, '../src/controllers/authController.js');
  const rutaAuthMw = path.join(__dirname, '../src/middlewares/authMiddleware.js');
  const modAuth = { exports: {} };
  const modMw = { exports: {} };
  const secretoPrevio = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-pruebas-recuperacion-2026';
  t.after(() => {
    if (secretoPrevio === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretoPrevio;
  });

  vm.runInNewContext(fs.readFileSync(rutaAuthCtrl, 'utf8'), {
    module: modAuth,
    console,
    Buffer,
    process,
    require: (n) => (n === '../config/database' ? pool : createRequire(rutaAuthCtrl)(n)),
  });
  vm.runInNewContext(fs.readFileSync(rutaAuthMw, 'utf8'), {
    module: modMw,
    console,
    Buffer,
    process,
    require: (n) => (n === '../config/database' ? pool : createRequire(rutaAuthMw)(n)),
  });

  const ejecutarLogin = async (contrasena) => {
    const res = {
      codigo: 200,
      status(c) {
        this.codigo = c;
        return this;
      },
      json(d) {
        this.body = d;
        return this;
      },
    };
    await modAuth.exports.login(
      { body: { correo: 'tecnico@ulatina.cr', contrasena } },
      res
    );
    return res;
  };

  const probarMiddleware = async (token) => {
    let paso = false;
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {
      codigo: 200,
      status(c) {
        this.codigo = c;
        return this;
      },
      json(d) {
        this.body = d;
        return this;
      },
    };
    await modMw.exports.verificarToken(req, res, () => {
      paso = true;
    });
    return { paso, codigo: res.codigo, body: res.body, usuario: req.usuario };
  };

  // Emitir una sesión ANTES del restablecimiento de contraseña y verificar que inicialmente es válida
  const loginAntesReset = await ejecutarLogin('ClaveInicialSegura2026!');
  assert.equal(loginAntesReset.codigo, 200);
  const tokenPrevioReset = loginAntesReset.body.token;
  assert.equal((await probarMiddleware(tokenPrevioReset)).paso, true);

  // 7. Restablecimiento exitoso + un solo uso + invalidación inmediata de sesiones previas (OWASP)
  const claveNueva = 'NuevaClaveULatina2026!';
  const resCambio = await restablecerContrasenaConToken(pool, {
    token: tercerToken,
    contrasenaNueva: claveNueva,
  });
  assert.equal(resCambio.success, true);

  // El token emitido ANTES del restablecimiento debe ser rechazado de inmediato (401)
  const accesoConTokenViejo = await probarMiddleware(tokenPrevioReset);
  assert.equal(accesoConTokenViejo.paso, false);
  assert.equal(accesoConTokenViejo.codigo, 401);

  // Un token heredado sin versionSesion también debe ser rechazado (401)
  const tokenSinVersion = jwt.sign(
    { idUsuario: 1, rol: 'Tecnico' },
    process.env.JWT_SECRET,
    { expiresIn: '1h', jwtid: crypto.randomUUID(), algorithm: 'HS256' }
  );
  const accesoSinVersion = await probarMiddleware(tokenSinVersion);
  assert.equal(accesoSinVersion.paso, false);
  assert.equal(accesoSinVersion.codigo, 401);

  // Reutilizar el mismo token una segunda vez debe fallar (un solo uso)
  await assert.rejects(
    () =>
      restablecerContrasenaConToken(pool, {
        token: tercerToken,
        contrasenaNueva: 'OtraClaveDiferente2026!',
      }),
    (err) => err.status === 400
  );

  // Login con clave vieja falla (401); login con clave nueva entra (200) y pasa verificarToken
  const loginViejo = await ejecutarLogin('ClaveInicialSegura2026!');
  assert.equal(loginViejo.codigo, 401);

  const loginNuevo = await ejecutarLogin(claveNueva);
  assert.equal(loginNuevo.codigo, 200);
  assert.equal(loginNuevo.body.success, true);
  assert.ok(loginNuevo.body.token);
  const sesionPrincipal = await probarMiddleware(loginNuevo.body.token);
  assert.equal(sesionPrincipal.paso, true);

  // Segunda sesión abierta en otro dispositivo antes de cambiar contraseña desde Mi perfil
  const loginOtroDispositivo = await ejecutarLogin(claveNueva);
  assert.equal(loginOtroDispositivo.codigo, 200);
  assert.equal((await probarMiddleware(loginOtroDispositivo.body.token)).paso, true);

  // Al cambiar contraseña autenticado (PATCH /mi-contrasena), todas las sesiones previas mueren (401)
  // y el token rotado devuelto en la respuesta sí queda vigente.
  const claveTercera = 'TerceraClaveSegura2026!';
  const resCambiar = {
    codigo: 200,
    status(c) {
      this.codigo = c;
      return this;
    },
    json(d) {
      this.body = d;
      return this;
    },
  };
  await modAuth.exports.cambiarContrasena(
    {
      usuario: sesionPrincipal.usuario,
      body: { contrasenaActual: claveNueva, contrasenaNueva: claveTercera },
    },
    resCambiar
  );
  assert.equal(resCambiar.codigo, 200);
  assert.ok(resCambiar.body.token);

  assert.equal((await probarMiddleware(loginNuevo.body.token)).codigo, 401);
  assert.equal((await probarMiddleware(loginOtroDispositivo.body.token)).codigo, 401);
  assert.equal((await probarMiddleware(resCambiar.body.token)).paso, true);

  // Restricción CHECK de migración 012 impide version_sesion < 1
  await assert.rejects(
    () => db.query('UPDATE public.usuario SET version_sesion = 0 WHERE id_usuario = 1'),
    (err) => err.code === '23514'
  );

  // 8. Permisos mínimos de pes_runtime: no puede hacer DELETE ni alterar token_hash,
  // pero SÍ puede invocar la función SECURITY DEFINER de limpieza de tokens antiguos.
  await assert.rejects(
    () => db.query('DELETE FROM public.recuperacion_contrasena'),
    (err) => err.code === '42501'
  );
  await assert.rejects(
    () =>
      db.query(
        "UPDATE public.recuperacion_contrasena SET token_hash = repeat('a', 64)"
      ),
    (err) => err.code === '42501'
  );

  await db.exec('RESET ROLE');
  await db.query(
    `UPDATE public.recuperacion_contrasena
     SET expira_en = NOW() - INTERVAL '2 days', usado_en = NOW() - INTERVAL '2 days'`
  );
  await db.exec('SET ROLE pes_runtime');

  const limpieza = await db.query('SELECT public.limpiar_tokens_recuperacion() AS eliminados');
  assert.ok(limpieza.rows[0].eliminados >= 3);
  assert.equal(
    (await db.query('SELECT COUNT(*)::int AS n FROM public.recuperacion_contrasena')).rows[0].n,
    0
  );

  // 9. Si SMTP falla o no está configurado, responde genérico 200 e invalida el token huérfano
  const resFalloSmtp = await solicitarRecuperacion(pool, 'tecnico@ulatina.cr', {
    enviarCorreo: async () => {
      throw Object.assign(new Error('SMTP no configurado'), { code: 'SMTP_NO_CONFIGURADO' });
    },
  });
  assert.equal(resFalloSmtp.success, true);
  assert.equal(resFalloSmtp.message, MENSAJE_GENERICO_SOLICITUD);
  const pendientes = await db.query(
    'SELECT COUNT(*)::int AS n FROM public.recuperacion_contrasena WHERE usado_en IS NULL'
  );
  assert.equal(pendientes.rows[0].n, 0);
});
