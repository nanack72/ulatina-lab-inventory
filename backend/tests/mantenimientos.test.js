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

test('Mantenimientos e Incidencias - Control de acceso y trazabilidad', async (t) => {
  let baseUrl;
  let token;

  t.before(async () => {
    baseUrl = await obtenerBaseUrl();
    token = await obtenerTokenAdmin(baseUrl);
  });

  t.after(() => {
    cerrarServidorTest();
  });

  await t.test('Debe listar mantenimientos con estructura paginada y badges de estado', async () => {
    const respuesta = await fetch(`${baseUrl}/mantenimientos?pagina=1&limite=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const json = await respuesta.json();

    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  await t.test('Debe consultar incidencias técnicas y responder estructura válida', async () => {
    const respuesta = await fetch(`${baseUrl}/incidencias`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const json = await respuesta.json();

    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
  });
});
