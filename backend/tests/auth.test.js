const test = require('node:test');
const assert = require('node:assert');
const { obtenerBaseUrl, cerrarServidorTest, obtenerCredencialesTest } = require('./testHelper');

test('Autenticación - Flujo de inicio de sesión e integridad JWT', async (t) => {
  let baseUrl;

  t.before(async () => {
    baseUrl = await obtenerBaseUrl();
  });

  t.after(() => {
    cerrarServidorTest();
  });

  await t.test('Debe autenticar exitosamente con credenciales válidas de Superadministrador', async () => {
    const credenciales = obtenerCredencialesTest();
    const respuesta = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credenciales)
    });

    assert.strictEqual(respuesta.status, 200, 'El status HTTP debe ser 200 OK');
    const datos = await respuesta.json();

    assert.strictEqual(datos.success, true, 'La propiedad success debe ser true');
    assert.ok(typeof datos.token === 'string', 'El token JWT debe ser un string válido');
    assert.ok(datos.token.length > 30, 'El token debe poseer longitud criptográfica adecuada');
    assert.strictEqual(datos.usuario.correo, credenciales.correo);
    assert.strictEqual(datos.usuario.rol, 'Superadministrador');
  });

  await t.test('Debe rechazar credenciales inválidas con código HTTP 401', async () => {
    const respuesta = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: 'oscar.monoga@ulatina.net',
        contrasena: 'PasswordIncorrecto123!'
      })
    });

    assert.strictEqual(respuesta.status, 401, 'El status HTTP debe ser 401 Unauthorized');
    const datos = await respuesta.json();
    assert.strictEqual(datos.success, false);
  });

  await t.test('Debe rechazar peticiones protegidas sin cabecera Authorization', async () => {
    const respuesta = await fetch(`${baseUrl}/reportes/resumen-general`);
    assert.strictEqual(respuesta.status, 401, 'Debe denegar acceso sin token');
    const datos = await respuesta.json();
    assert.strictEqual(datos.success, false);
  });
});
