const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const { test } = require('node:test');
const express = require('express');

// Ejecutar el middleware real de app.js sin abrir Neon ni iniciar tareas.
// Las rutas se sustituyen: estas pruebas verifican parsing, no autorización.
function cargarApp() {
  const archivo = path.join(__dirname, '../src/app.js');
  const modulo = { exports: {} };
  const expressSinInicio = () => {
    const app = express();
    app.listen = () => {};
    return app;
  };
  Object.assign(expressSinInicio, express);
  const requirePrueba = (nombre) => {
    if (nombre === 'express') return expressSinInicio;
    if (nombre === 'dotenv') return { config() {} };
    if (nombre === './config/database') return {};
    if (nombre === '../jobs/limpiezaTokens') {
      return { iniciarLimpiezaTokens() {} };
    }
    if (nombre.startsWith('./routes/')) {
      const router = express.Router();
      router.post('/confirmar', (req, res) => {
        res.json({ success: true, longitud: req.body.texto.length });
      });
      return router;
    }
    return require(nombre);
  };
  vm.runInNewContext(
    `${readFileSync(archivo, 'utf8')}\nmodule.exports = app;`,
    {
      require: requirePrueba,
      module: modulo,
      process,
      console,
      __dirname: path.dirname(archivo),
      __filename: archivo
    },
    { filename: archivo }
  );
  return modulo.exports;
}

test('límites JSON de importación y respuestas de error', async (t) => {
  const servidor = http.createServer(cargarApp());
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const enviar = (ruta, body) => fetch(`${base}${ruta}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const cuerpo = JSON.stringify({ texto: 'a'.repeat(150 * 1024) });

  await t.test('acepta más de 100 kB en confirmación', async () => {
    const respuesta = await enviar('/api/importacion-equipos/confirmar', cuerpo);
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json()).longitud, 150 * 1024);
  });
  await t.test('mantiene el límite general en otras rutas', async () => {
    const respuesta = await enviar('/api/equipos/confirmar', cuerpo);
    assert.equal(respuesta.status, 413);
    assert.equal((await respuesta.json()).success, false);
  });
  await t.test('rechaza más de 2 MB con JSON', async () => {
    const respuesta = await enviar('/api/importacion-equipos/confirmar',
      JSON.stringify({ texto: 'a'.repeat(2 * 1024 * 1024) }));
    assert.equal(respuesta.status, 413);
    assert.equal((await respuesta.json()).success, false);
  });
  await t.test('rechaza JSON mal formado con JSON', async () => {
    const respuesta = await enviar('/api/importacion-equipos/confirmar', '{');
    assert.equal(respuesta.status, 400);
    assert.equal((await respuesta.json()).success, false);
  });
});

test('historial usa /api y conserva autenticación y cancelación', async (t) => {
  const archivo = path.join(__dirname,
    '../../frontend/src/services/historialCambiosService.js');
  const { obtenerHistorialCambios } = await import(pathToFileURL(archivo).href);
  const signal = new AbortController().signal;
  const fetchOriginal = global.fetch;
  t.after(() => { global.fetch = fetchOriginal; });
  let solicitud;
  global.fetch = async (url, opciones) => {
    solicitud = { url, opciones };
    return new Response(JSON.stringify({ success: true, data: [{ id: 1 }] }));
  };
  assert.deepEqual(await obtenerHistorialCambios(12, 'token-prueba', signal), [{ id: 1 }]);
  assert.equal(solicitud.url, '/api/equipos/12/historial-cambios');
  assert.equal(solicitud.opciones.headers.Authorization, 'Bearer token-prueba');
  assert.equal(solicitud.opciones.signal, signal);
});
