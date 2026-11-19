import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerArchivoEvidencia } from '../src/services/evidenciasService.js';
test('las imágenes de evidencia se descargan por la API con sesión y cancelación', async (t) => {
  const anterior = globalThis.fetch;
  t.after(() => (globalThis.fetch = anterior));
  const signal = new AbortController().signal;
  globalThis.fetch = async (url, opciones) => {
    assert.equal(url, '/api/evidencias/5/archivo');
    assert.equal(opciones.headers.Authorization, 'Bearer prueba');
    assert.equal(opciones.signal, signal);
    return new Response(new Blob(['imagen'], { type: 'image/png' }));
  };
  assert.equal((await obtenerArchivoEvidencia(5, 'prueba', signal)).type, 'image/png');
});
test('un acceso denegado a la evidencia se muestra como error sin reintentos', async (t) => {
  const anterior = globalThis.fetch;
  t.after(() => (globalThis.fetch = anterior));
  let llamadas = 0;
  globalThis.fetch = async () => {
    llamadas++;
    return new Response(JSON.stringify({ message: 'Sin acceso' }), { status: 403 });
  };
  await assert.rejects(
    obtenerArchivoEvidencia(5, 'prueba'),
    (e) => e.status === 403 && e.message === 'Sin acceso'
  );
  assert.equal(llamadas, 1);
});
