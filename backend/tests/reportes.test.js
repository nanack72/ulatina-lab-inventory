const test = require('node:test');
const assert = require('node:assert');
const { obtenerBaseUrl, cerrarServidorTest, obtenerCredencialesTest } = require('./testHelper');

async function obtenerTokenAdmin(baseUrl) {
  const credenciales = obtenerCredencialesTest();
  const resp = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciales)
  });
  const json = await resp.json();
  return json.token;
}

test('Reportes y Exportación - Integridad de datos y generación Excel', async (t) => {
  let baseUrl;
  let token;

  t.before(async () => {
    baseUrl = await obtenerBaseUrl();
    token = await obtenerTokenAdmin(baseUrl);
  });

  t.after(() => {
    cerrarServidorTest();
  });

  await t.test('Debe devolver el resumen general con conteo numérico de equipos y estados', async () => {
    const respuesta = await fetch(`${baseUrl}/reportes/resumen-general`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const json = await respuesta.json();

    assert.strictEqual(json.success, true);
    assert.ok(typeof json.data.total_equipos === 'number');
    assert.ok(json.data.total_equipos >= 66, 'Deben existir al menos los 66 equipos reales de Heredia');
    assert.ok(Array.isArray(json.data.equipos_por_laboratorio));
    assert.ok(json.data.equipos_por_estado.operativo >= 0);
  });

  await t.test('Debe generar y descargar el libro binario de Excel (.xlsx) con cabeceras MIME correctas', async () => {
    const respuesta = await fetch(`${baseUrl}/reportes/exportar-excel`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const contentType = respuesta.headers.get('content-type');
    assert.ok(
      contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      'La cabecera Content-Type debe corresponder a un documento Excel moderno'
    );

    const buffer = await respuesta.arrayBuffer();
    assert.ok(buffer.byteLength > 5000, 'El archivo generado debe tener tamaño binario representativo');
  });
});
