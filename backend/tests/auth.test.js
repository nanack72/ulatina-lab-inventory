const test = require('node:test');
const assert = require('node:assert');

const BASE_URL = process.env.TEST_API_URL;
const integrar = process.env.RUN_INTEGRATION_TESTS === '1';
if (integrar && (!BASE_URL || !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD)) {
  throw new Error('Configure TEST_API_URL, TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en el entorno de pruebas.');
}

test('Autenticación - Flujo de inicio de sesión e integridad JWT', { skip: !integrar }, async (t) => {
  await t.test('Debe autenticar exitosamente con credenciales válidas de Superadministrador', async () => {
    const respuesta = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: process.env.TEST_ADMIN_EMAIL,
        contrasena: process.env.TEST_ADMIN_PASSWORD
      })
    });

    assert.strictEqual(respuesta.status, 200, 'El status HTTP debe ser 200 OK');
    const datos = await respuesta.json();

    assert.strictEqual(datos.success, true, 'La propiedad success debe ser true');
    assert.ok(typeof datos.token === 'string', 'El token JWT debe ser un string válido');
    assert.ok(datos.token.length > 30, 'El token debe poseer longitud criptográfica adecuada');
    assert.strictEqual(datos.usuario.correo, process.env.TEST_ADMIN_EMAIL);
    assert.strictEqual(datos.usuario.rol, 'Superadministrador');
  });

  await t.test('Debe rechazar credenciales inválidas con código HTTP 401', async () => {
    const respuesta = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: process.env.TEST_ADMIN_EMAIL,
        contrasena: 'PasswordIncorrecto123!'
      })
    });

    assert.strictEqual(respuesta.status, 401, 'El status HTTP debe ser 401 Unauthorized');
    const datos = await respuesta.json();
    assert.strictEqual(datos.success, false);
  });

  await t.test('Debe rechazar peticiones protegidas sin cabecera Authorization', async () => {
    const respuesta = await fetch(`${BASE_URL}/reportes/resumen-general`);
    assert.strictEqual(respuesta.status, 401, 'Debe denegar acceso sin token');
    const datos = await respuesta.json();
    assert.strictEqual(datos.success, false);
  });
});
