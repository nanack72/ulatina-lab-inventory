import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as equipos from '../src/services/equiposService.js';
import { obtenerHistorialCambios } from '../src/services/historialCambiosService.js';
import { leerArchivoEquipos, confirmarImportacionEquipos } from '../src/services/importacionEquiposService.js';

const token = 'token-prueba';
const signal = new AbortController().signal;
const datosEquipo = { nombre: 'Equipo de prueba' };
const filas = [{ nombre: 'Equipo importado' }];
const archivo = new Blob(['contenido de prueba']);
const casos = [
  { nombre: 'inventario', llamar: () => equipos.obtenerEquipos(token, signal),
    ruta: '/api/equipos', metodo: 'GET', data: [], signal },
  { nombre: 'detalle', llamar: () => equipos.obtenerEquipoPorId(12, token, signal),
    ruta: '/api/equipos/12', metodo: 'GET', data: { id_equipo: 12 }, signal },
  { nombre: 'registro', llamar: () => equipos.registrarEquipo(datosEquipo, token),
    ruta: '/api/equipos', metodo: 'POST', data: {}, body: datosEquipo, mutacion: true },
  { nombre: 'edición', llamar: () => equipos.actualizarEquipo(12, datosEquipo, token),
    ruta: '/api/equipos/12', metodo: 'PUT', data: {}, body: datosEquipo, mutacion: true },
  { nombre: 'traslado', llamar: () => equipos.trasladarEquipo(12,
    { id_laboratorio: '3', ubicacion_detalle: ' Mesa 1 ' }, token),
    ruta: '/api/equipos/12', metodo: 'PUT', data: {},
    body: { id_laboratorio: 3, ubicacion_detalle: 'Mesa 1' }, mutacion: true },
  { nombre: 'ubicaciones', llamar: () => equipos.obtenerHistorialUbicacion(12, token, signal),
    ruta: '/api/equipos/12/historial-ubicacion', metodo: 'GET', data: [], signal },
  { nombre: 'estados', llamar: () => equipos.obtenerHistorialEstados(12, token, signal),
    ruta: '/api/equipos/12/historial-estados', metodo: 'GET', data: [], signal },
  { nombre: 'modificaciones', llamar: () => obtenerHistorialCambios(12, token, signal),
    ruta: '/api/equipos/12/historial-cambios', metodo: 'GET', data: [], signal },
  { nombre: 'lectura Excel', llamar: () => leerArchivoEquipos(archivo, token),
    ruta: '/api/importacion-equipos/leer', metodo: 'POST', data: { filas: [] }, archivo: true },
  { nombre: 'confirmación Excel', llamar: () => confirmarImportacionEquipos(filas, token),
    ruta: '/api/importacion-equipos/confirmar', metodo: 'POST', data: {}, body: { filas } },
];

function simularFetch(t, implementacion) {
  const original = globalThis.fetch;
  globalThis.fetch = implementacion;
  t.after(() => { globalThis.fetch = original; });
}

for (const caso of casos) {
  test(`${caso.nombre}: conserva ruta, credenciales, cuerpo y resultado`, async (t) => {
    const resultado = { success: true, data: caso.data };
    let llamadas = 0;
    simularFetch(t, async (url, opciones) => {
      llamadas++;
      assert.equal(url, caso.ruta);
      assert.equal(opciones.method, caso.metodo);
      assert.equal(opciones.headers.Authorization, `Bearer ${token}`);
      assert.equal(opciones.signal, caso.signal);
      if (caso.body) {
        assert.equal(opciones.headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(opciones.body), caso.body);
      }
      if (caso.archivo) {
        assert.ok(opciones.body instanceof FormData);
        assert.ok(opciones.body.get('archivo') instanceof Blob);
        assert.equal(opciones.headers['Content-Type'], undefined);
      }
      return new Response(JSON.stringify(resultado));
    });
    const recibido = await caso.llamar();
    const devuelveCompleto = caso.mutacion || caso.nombre === 'confirmación Excel';
    assert.deepEqual(recibido, devuelveCompleto ? resultado : caso.data);
    assert.equal(llamadas, 1);
  });

  test(`${caso.nombre}: conserva estado HTTP en errores`, async (t) => {
    simularFetch(t, async () => new Response(JSON.stringify({
      success: false, message: 'Error del servidor', errors: ['Campo inválido'],
    }), { status: 403 }));
    await assert.rejects(caso.llamar, (error) => {
      assert.equal(error.status, 403);
      assert.ok(error.message);
      if (['registro', 'edición'].includes(caso.nombre)) {
        assert.deepEqual(error.detalles, ['Campo inválido']);
      }
      return true;
    });
  });

  test(`${caso.nombre}: controla respuestas no JSON`, async (t) => {
    simularFetch(t, async () => new Response('<html>Error</html>', { status: 502 }));
    await assert.rejects(caso.llamar, error => error.status === 502 && !!error.message);
  });

  test(`${caso.nombre}: conserva causa y no reintenta escrituras`, async (t) => {
    const causa = new TypeError('Fallo de red');
    let llamadas = 0;
    simularFetch(t, async () => { llamadas++; throw causa; });
    await assert.rejects(caso.llamar, error => error.cause === causa);
    assert.equal(llamadas, 1);
  });

  test(`${caso.nombre}: conserva cancelación`, async (t) => {
    const cancelacion = new DOMException('Cancelada', 'AbortError');
    simularFetch(t, async () => { throw cancelacion; });
    await assert.rejects(caso.llamar, error => caso.mutacion
      ? error.cause === cancelacion
      : error === cancelacion);
  });
}

test('no envía registros ni consultas de equipos sin sesión', async (t) => {
  simularFetch(t, () => { assert.fail('No debe llamar al servidor'); });
  await assert.rejects(() => equipos.obtenerEquipos(''), /iniciar sesión/);
  await assert.rejects(() => equipos.registrarEquipo(datosEquipo, ''), /iniciar sesión/);
  await assert.rejects(() => equipos.actualizarEquipo(12, datosEquipo, ''), /iniciar sesión/);
});

test('conserva mensajes específicos de sesión y permisos', async (t) => {
  let status = 401;
  simularFetch(t, async () => new Response(JSON.stringify({ success: false }), { status }));
  await assert.rejects(() => equipos.obtenerEquipoPorId(12, token), /sesión ya no es válida/);
  status = 403;
  await assert.rejects(() => equipos.registrarEquipo(datosEquipo, token), /registrar equipos en este laboratorio/);
  await assert.rejects(() => equipos.actualizarEquipo(12, datosEquipo, token), /modificar este equipo/);
  await assert.rejects(() => equipos.trasladarEquipo(12, { id_laboratorio: 3 }, token), /trasladar el equipo/);
});

test('no acepta una respuesta exitosa con datos de inventario inválidos', async (t) => {
  simularFetch(t, async () => new Response(JSON.stringify({ success: true, data: null })));
  await assert.rejects(() => equipos.obtenerEquipos(token), /datos de inventario inválidos/);
  await assert.rejects(() => equipos.obtenerEquipoPorId(12, token), /información inválida/);
});
