import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerPaginaInventario } from '../src/services/inventarioPaginadoService.js';

const paginaValida = { success: true, total: 12, total_autorizados: 20,
  pagina: 2, paginas: 3, limite: 5, data: [{ id_equipo: 7 }],
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
    assert.equal(url.searchParams.get('limite'), '5');
    assert.equal(url.searchParams.get('busqueda'), 'placa A&B + 100%');
    assert.equal(url.searchParams.get('sede'), 'San José');
    assert.equal(url.searchParams.get('estado'), null);
    assert.equal(opciones.headers.Authorization, 'Bearer token');
    assert.equal(opciones.signal, signal);
    return new Response(JSON.stringify(paginaValida));
  });
  assert.deepEqual(await obtenerPaginaInventario('token',
    { busqueda: 'placa A&B + 100%', sede: 'San José', estado: '' }, 2, signal), paginaValida);
});

test('preserva 401 para que la interfaz gestione la sesión expirada', async (t) => {
  simular(t, async () => new Response(JSON.stringify({ message: 'Sesión expirada' }), { status: 401 }));
  await assert.rejects(() => obtenerPaginaInventario('token', {}, 1),
    error => error.status === 401 && error.message === 'Sesión expirada');
});

test('rechaza una respuesta con metadatos incompletos', async (t) => {
  simular(t, async () => new Response(JSON.stringify({ success: true, data: [] })));
  await assert.rejects(() => obtenerPaginaInventario('token', {}, 1), /página de inventario inválida/);
});

test('propaga la cancelación sin convertirla en error de red', async (t) => {
  const causa = new DOMException('Cancelada', 'AbortError');
  simular(t, async () => { throw causa; });
  await assert.rejects(() => obtenerPaginaInventario('token', {}, 1), error => error === causa);
});

test('no consulta sin sesión', async (t) => {
  simular(t, () => assert.fail('No debe llamar al servidor'));
  await assert.rejects(() => obtenerPaginaInventario('', {}, 1), /iniciar sesión/);
});

test('permite resultado vacío y página corregida por el servidor', async (t) => {
  const vacia = { ...paginaValida, total: 0, total_autorizados: 0, pagina: 1,
    paginas: 1, data: [], opciones: { sede: [], laboratorio: [], categoria: [], estado: [] } };
  simular(t, async () => new Response(JSON.stringify(vacia)));
  assert.deepEqual(await obtenerPaginaInventario('token', {}, 99), vacia);
});
