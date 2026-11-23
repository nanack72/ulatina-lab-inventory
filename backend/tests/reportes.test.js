const test = require('node:test');
const assert = require('node:assert');

const BASE_URL = process.env.TEST_API_URL;
const integrar = process.env.RUN_INTEGRATION_TESTS === '1';
if (integrar && (!BASE_URL || !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD)) {
  throw new Error('Configure TEST_API_URL, TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en el entorno de pruebas.');
}

async function obtenerTokenAdmin() {
  const resp = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correo: process.env.TEST_ADMIN_EMAIL,
      contrasena: process.env.TEST_ADMIN_PASSWORD
    })
  });
  const json = await resp.json();
  return json.token;
}

test('Reportes y Exportación - Integridad de datos y generación Excel', { skip: !integrar }, async (t) => {
  let token;

  t.before(async () => {
    token = await obtenerTokenAdmin();
  });

  await t.test('Debe devolver el resumen general con conteo numérico de equipos y estados', async () => {
    const respuesta = await fetch(`${BASE_URL}/reportes/resumen-general`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const json = await respuesta.json();

    assert.strictEqual(json.success, true);
    assert.ok(typeof json.data.total_equipos === 'number');
    assert.ok(json.data.total_equipos >= 0, 'El conteo no puede ser negativo');
    assert.ok(Array.isArray(json.data.equipos_por_laboratorio));
    assert.ok(json.data.equipos_por_estado.operativo >= 0);
  });

  await t.test('Debe generar y descargar el libro binario de Excel (.xlsx) con cabeceras MIME correctas', async () => {
    const respuesta = await fetch(`${BASE_URL}/reportes/exportar-excel`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const contentType = respuesta.headers.get('content-type');
    assert.ok(
      contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      'La cabecera Content-Type debe corresponder a un documento Excel moderno'
    );

    const buffer = await respuesta.arrayBuffer();
    assert.ok(buffer.byteLength > 0, 'El archivo generado no puede estar vacío');
  });
});
