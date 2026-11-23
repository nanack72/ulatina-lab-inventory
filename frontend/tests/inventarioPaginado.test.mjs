import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerPaginaInventario } from '../src/services/inventarioPaginadoService.js';

const paginaValida = { success: true, total: 12, total_autorizados: 20,
  pagina: 2, paginas: 3, limite: 10, data: [{ id_equipo: 7 }],
  opciones: { sede: ['Heredia'], laboratorio: ['Lab A'], categoria: ['Cómputo'], estado: ['Operativo'] } };
function simular(t, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  t.after(() => { globalThis.fetch = original; });
}

test('solicita solo una página y codifica búsqueda y filtros', async (t) => {
  const signal = new AbortController().signal;
  simular(t, async (ruta, opciones) => {
    const url = new URL(ruta, 'https://inventario.example');
    assert.equal(url.pathname, '/api/equipos/pagina');
    assert.equal(url.searchParams.get('pagina'), '2');
    assert.equal(url.searchParams.get('limite'), '10');
    assert.equal(url.searchParams.get('busqueda'), 'placa A&B + 100%');
    assert.equal(url.searchParams.get('sede'), 'San José');
    assert.equal(url.searchParams.get('estado'), null);
    assert.equal(opciones.headers.Authorization, 'Bearer token');
    assert.equal(opciones.signal, signal);
    return new Response(JSON.stringify(paginaValida));
  });
  assert.deepEqual(await obtenerPaginaInventario('token',
    { busqueda: 'placa A&B + 100%', sede: 'San José', estado: '' }, 2, 10, signal), paginaValida);
});

test('preserva 401 para que la interfaz gestione la sesión expirada', async (t) => {
  simular(t, async () => new Response(JSON.stringify({ message: 'Sesión expirada' }), { status: 401 }));
  await assert.rejects(() => obtenerPaginaInventario('token', {}, 1, 10),
    error => error.status === 401 && error.message === 'Sesión expirada');
});

test('rechaza una respuesta con metadatos incompletos', async (t) => {
  simular(t, async () => new Response(JSON.stringify({ success: true, data: [] })));
  await assert.rejects(() => obtenerPaginaInventario('token', {}, 1, 10), /página de inventario inválida/);
});

test('propaga la cancelación sin convertirla en error de red', async (t) => {
  const causa = new DOMException('Cancelada', 'AbortError');
  simular(t, async () => { throw causa; });
  await assert.rejects(() => obtenerPaginaInventario('token', {}, 1, 10), error => error === causa);
});

test('no consulta sin sesión', async (t) => {
  simular(t, () => assert.fail('No debe llamar al servidor'));
  await assert.rejects(() => obtenerPaginaInventario('', {}, 1, 10), /iniciar sesión/);
});

test('permite resultado vacío y página corregida por el servidor', async (t) => {
  const vacia = { ...paginaValida, total: 0, total_autorizados: 0, pagina: 1,
    paginas: 1, data: [], opciones: { sede: [], laboratorio: [], categoria: [], estado: [] } };
  simular(t, async () => new Response(JSON.stringify(vacia)));
  assert.deepEqual(await obtenerPaginaInventario('token', {}, 99, 10), vacia);
});


test('admite 20 y 50 equipos por página y exige coincidencia del límite', async (t) => {
  let llamadas = 0;
  simular(t, async (ruta) => {
    const url = new URL(ruta, 'https://inventario.example');
    llamadas += 1;
    const limite = Number(url.searchParams.get('limite'));
    assert.ok([20, 50].includes(limite));
    return new Response(JSON.stringify({ ...paginaValida, limite }));
  });
  assert.equal((await obtenerPaginaInventario('token', {}, 1, 20)).limite, 20);
  assert.equal((await obtenerPaginaInventario('token', {}, 1, 50)).limite, 50);
  assert.equal(llamadas, 2);
});

test('rechaza tamaños de página no permitidos antes de llamar al servidor', async (t) => {
  simular(t, () => assert.fail('No debe llamar al servidor'));
  await assert.rejects(() => obtenerPaginaInventario('token', {}, 1, 100), /por página inválida/);
  await assert.rejects(() => obtenerPaginaInventario('token', {}, 1, 5), /por página inválida/);
});
