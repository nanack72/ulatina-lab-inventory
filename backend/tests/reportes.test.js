const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { PGlite } = require('@electric-sql/pglite');

const BASE_URL = process.env.TEST_API_URL;
const integrar = process.env.RUN_INTEGRATION_TESTS === '1';
if (integrar && (!BASE_URL || !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD)) {
  throw new Error(
    'Configure TEST_API_URL, TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en el entorno de pruebas.'
  );
}

test('Resumen general clasifica estados correctamente sin contar "No operativo" como operativo (PGlite)', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE TABLE sede(id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio(id_laboratorio int PRIMARY KEY, id_sede int, codigo text, nombre text);
    CREATE TABLE estado(id_estado int PRIMARY KEY, nombre text);
    CREATE TABLE equipo(id_equipo int PRIMARY KEY, id_laboratorio int, id_estado int, eliminado_en timestamptz);
    CREATE TABLE bitacora_mantenimiento(id_bitacora int PRIMARY KEY, id_equipo int, tipo_mantenimiento text);
    CREATE TABLE usuario_sede(id_usuario_sede int, id_usuario int, id_sede int);
    CREATE TABLE usuario_laboratorio(id_usuario_sede int, id_sede int, id_laboratorio int);

    INSERT INTO sede VALUES (1, 'Heredia');
    INSERT INTO laboratorio VALUES (1, 1, 'LAB-01', 'Laboratorio 1');
    INSERT INTO estado VALUES
      (1, 'Operativo'),
      (2, 'Activo'),
      (3, 'No operativo'),
      (4, 'Inoperativo'),
      (5, 'En mantenimiento'),
      (6, 'Sin mantenimiento'),
      (7, 'Dañado'),
      (8, 'No dañado'),
      (9, 'Dado de baja');

    INSERT INTO equipo VALUES
      (1, 1, 1, NULL),
      (2, 1, 2, NULL),
      (3, 1, 3, NULL),
      (4, 1, 4, NULL),
      (5, 1, 5, NULL),
      (6, 1, 6, NULL),
      (7, 1, 7, NULL),
      (8, 1, 8, NULL),
      (9, 1, 9, NULL),
      (10, 1, 1, '2026-11-20 10:00:00+00');

    INSERT INTO bitacora_mantenimiento VALUES
      (1, 1, 'Preventivo'),
      (2, 5, 'Correctivo');
  `);

  const archivoCtrl = path.join(__dirname, '../src/controllers/reportesController.js');
  const localReq = createRequire(archivoCtrl);
  const moduloCtrl = { exports: {} };
  vm.runInNewContext(fs.readFileSync(archivoCtrl, 'utf8'), {
    module: moduloCtrl,
    console,
    require: (n) => {
      if (n === '../config/database') return { query: (sql, args) => db.query(sql, args) };
      return localReq(n);
    },
  });

  const res = {
    codigo: 200,
    status(c) {
      this.codigo = c;
      return this;
    },
    json(d) {
      this.body = d;
      return this;
    },
  };

  await moduloCtrl.exports.obtenerResumenGeneral(
    { usuario: { idUsuario: 1, rol: 'Superadministrador' } },
    res
  );

  assert.strictEqual(res.codigo, 200);
  assert.strictEqual(res.body.success, true);
  // 9 activos (el equipo 10 está eliminado lógicamente)
  assert.strictEqual(res.body.data.total_equipos, 9);
  // Solo Operativo (1) + Activo (1) = 2; No operativo e Inoperativo NO se suman
  assert.strictEqual(res.body.data.equipos_por_estado.operativo, 2);
  // Solo En mantenimiento (1); Sin mantenimiento NO se suma
  assert.strictEqual(res.body.data.equipos_por_estado.en_mantenimiento, 1);
  // Solo Dañado (1); No dañado NO se suma
  assert.strictEqual(res.body.data.equipos_por_estado.danado, 1);
  assert.strictEqual(res.body.data.mantenimientos.preventivos, 1);
  assert.strictEqual(res.body.data.mantenimientos.correctivos, 1);
  assert.strictEqual(res.body.data.mantenimientos.total, 2);
});

async function obtenerTokenAdmin() {
  const resp = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correo: process.env.TEST_ADMIN_EMAIL,
      contrasena: process.env.TEST_ADMIN_PASSWORD,
    }),
  });
  const json = await resp.json();
  return json.token;
}

test(
  'Reportes y Exportación - Integridad de datos y generación Excel',
  { skip: !integrar },
  async (t) => {
    let token;

    t.before(async () => {
      token = await obtenerTokenAdmin();
    });

    await t.test(
      'Debe devolver el resumen general con conteo numérico de equipos y estados',
      async () => {
        const respuesta = await fetch(`${BASE_URL}/reportes/resumen-general`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        assert.strictEqual(respuesta.status, 200);
        const json = await respuesta.json();

        assert.strictEqual(json.success, true);
        assert.ok(typeof json.data.total_equipos === 'number');
        assert.ok(json.data.total_equipos >= 0, 'El conteo no puede ser negativo');
        assert.ok(Array.isArray(json.data.equipos_por_laboratorio));
        assert.ok(json.data.equipos_por_estado.operativo >= 0);
      }
    );

    await t.test(
      'Debe generar y descargar el libro binario de Excel (.xlsx) con cabeceras MIME correctas',
      async () => {
        const respuesta = await fetch(`${BASE_URL}/reportes/exportar-excel`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        assert.strictEqual(respuesta.status, 200);
        const contentType = respuesta.headers.get('content-type');
        assert.ok(
          contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          'La cabecera Content-Type debe corresponder a un documento Excel moderno'
        );

        const buffer = await respuesta.arrayBuffer();
        assert.ok(buffer.byteLength > 0, 'El archivo generado no puede estar vacío');
      }
    );
  }
);
