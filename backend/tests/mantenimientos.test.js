const test = require('node:test');
const assert = require('node:assert');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';

async function obtenerTokenAdmin() {
  const resp = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correo: 'oscar.monoga@ulatina.net',
      contrasena: 'AdminOscar2026!'
    })
  });
  const json = await resp.json();
  return json.token;
}

test('Mantenimientos e Incidencias - Control de acceso y trazabilidad', async (t) => {
  let token;

  t.before(async () => {
    token = await obtenerTokenAdmin();
  });

  await t.test('Debe listar mantenimientos con estructura paginada y badges de estado', async () => {
    const respuesta = await fetch(`${BASE_URL}/mantenimientos?pagina=1&limite=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const json = await respuesta.json();

    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  await t.test('Debe consultar incidencias técnicas y responder estructura válida', async () => {
    const respuesta = await fetch(`${BASE_URL}/incidencias`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const json = await respuesta.json();

    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
  });
});
