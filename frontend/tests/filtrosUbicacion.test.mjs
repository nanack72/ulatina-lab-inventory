import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opcionesUbicacion, filtrarDistribucion } from '../src/utils/ubicaciones.js';
import { consultarIncidencias } from '../src/services/incidenciasService.js';
import { consultarMantenimientos } from '../src/services/mantenimientosService.js';
import { consultarEquiposRevision } from '../src/services/equiposRevisionService.js';
import { obtenerResumenMantenimientos } from '../src/services/dashboardService.js';
const ubicaciones = [
  { id_sede: 1, nombre_sede: 'Heredia', id_laboratorio: 1, codigo: 'A', nombre: 'Informática' },
  { id_sede: 2, nombre_sede: 'Otra', id_laboratorio: 2, codigo: 'B', nombre: 'Informática' },
];
test('sede limita laboratorios por identificador y búsqueda ignora tildes', () => {
  assert.equal(opcionesUbicacion(ubicaciones).sedes.length, 2);
  assert.deepEqual(
    opcionesUbicacion(ubicaciones, '2').laboratorios.map((l) => l.id_laboratorio),
    [2],
  );
  assert.equal(filtrarDistribucion(ubicaciones, '1', '', 'informatica').length, 1);
  assert.equal(filtrarDistribucion(ubicaciones, '1', '2', '').length, 0);
  assert.equal(filtrarDistribucion(ubicaciones, '', '', 'otra')[0].id_laboratorio, 2);
});
test('servicios envían sede y laboratorio sin perder sesión ni cancelación', async (t) => {
  const original = global.fetch;
  t.after(() => {
    global.fetch = original;
  });
  let solicitud;
  global.fetch = async (url, opciones) => {
    solicitud = { url, opciones };
    return new Response(JSON.stringify({ success: true, data: [], total: 0 }));
  };
  const signal = new AbortController().signal;
  for (const fn of [consultarIncidencias, consultarMantenimientos]) {
    await fn({ id_sede: '2', id_laboratorio: '3' }, 'token', signal);
    const url = new URL(solicitud.url, 'http://test');
    assert.equal(url.searchParams.get('id_sede'), '2');
    assert.equal(url.searchParams.get('id_laboratorio'), '3');
    assert.equal(solicitud.opciones.signal, signal);
    assert.equal(solicitud.opciones.headers.Authorization, 'Bearer token');
  }
  await consultarEquiposRevision({ pagina: 2, motivo: 'antiguedad' }, 'token', signal);
  assert.match(solicitud.url, /motivo=antiguedad/);
  assert.equal(solicitud.opciones.signal, signal);
  global.fetch = async () =>
    new Response(JSON.stringify({ message: 'Sesión expirada' }), { status: 401 });
  await assert.rejects(consultarEquiposRevision({}, 'token'), (e) => e.status === 401);
});
test('Inicio conserva los agregados completos junto a la página reciente', async (t) => {
  const original = global.fetch;
  t.after(() => {
    global.fetch = original;
  });
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: [{ id_bitacora: 1 }],
        resumen: { abiertos: 25, esperandoRepuesto: 12 },
      }),
    );
  const resultado = await obtenerResumenMantenimientos('token');
  assert.equal(resultado.data.length, 1);
  assert.equal(resultado.resumen.esperandoRepuesto, 12);
});
