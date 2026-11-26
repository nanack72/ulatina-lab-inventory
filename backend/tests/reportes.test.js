const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ExcelJS = require('exceljs');
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

test('Exportación Excel: 3 hojas (Inventario, Mantenimientos, Incidencias), filtros, RBAC y rendimiento < 5 s (PGlite)', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE TABLE sede(id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio(id_laboratorio int PRIMARY KEY, id_sede int, codigo text, nombre text);
    CREATE TABLE categoria(id_categoria int PRIMARY KEY, nombre text);
    CREATE TABLE estado(id_estado int PRIMARY KEY, nombre text);
    CREATE TABLE usuario(id_usuario int PRIMARY KEY, nombre_completo text);
    CREATE TABLE usuario_sede(id_usuario_sede int, id_usuario int, id_sede int);
    CREATE TABLE usuario_laboratorio(id_usuario_sede int, id_sede int, id_laboratorio int);
    CREATE TABLE equipo(
      id_equipo int PRIMARY KEY,
      id_laboratorio int,
      id_categoria int,
      id_estado int,
      placa_institucional text,
      numero_serie text,
      nombre text,
      marca text,
      modelo text,
      anio int,
      ubicacion_detalle text,
      eliminado_en timestamptz
    );
    CREATE TABLE bitacora_mantenimiento(
      id_bitacora int PRIMARY KEY,
      id_equipo int,
      id_usuario_tecnico int,
      fecha_mantenimiento timestamptz,
      tipo_mantenimiento text,
      estado_mantenimiento text,
      motivo_falla text,
      descripcion_trabajo text,
      horas_invertidas numeric
    );
    CREATE TABLE incidencia_reporte(
      id_incidencia int PRIMARY KEY,
      id_equipo int,
      id_usuario_reporta int,
      fecha_reporte timestamptz,
      titulo text,
      descripcion_falla text,
      prioridad text,
      estado_incidencia text
    );

    INSERT INTO sede VALUES (1, 'Heredia'), (2, 'San Pedro');
    INSERT INTO laboratorio VALUES
      (1, 1, 'HER-01', 'Lab Heredia 1'),
      (2, 2, 'SP-01', 'Lab San Pedro 1');
    INSERT INTO categoria VALUES (1, 'Cómputo');
    INSERT INTO estado VALUES (1, 'Operativo'), (2, 'En mantenimiento');
    INSERT INTO usuario VALUES (1, 'Super Admin'), (2, 'Técnico Heredia');
    INSERT INTO usuario_sede VALUES (10, 2, 1);
    INSERT INTO usuario_laboratorio VALUES (10, 1, 1);

    INSERT INTO equipo VALUES
      (1, 1, 1, 1, 'PL-H1', 'SN-H1', 'PC Heredia', 'Dell', 'OptiPlex', 2024, 'Mesa 1', NULL),
      (2, 2, 1, 2, 'PL-S1', 'SN-S1', 'PC San Pedro', 'HP', 'ProDesk', 2023, 'Mesa 2', NULL),
      (3, 1, 1, 1, 'PL-DEL', 'SN-DEL', 'PC Eliminada', 'Lenovo', 'Tiny', 2020, 'Bodega', '2026-11-01 10:00:00+00');

    INSERT INTO bitacora_mantenimiento VALUES
      (1, 1, 2, '2026-10-15 10:00:00-06', 'Preventivo', 'Completado', NULL, 'Limpieza octubre', 1.5),
      (2, 1, 2, '2026-11-18 14:00:00-06', 'Correctivo', 'En Proceso', 'No enciende', 'Cambio de fuente', 2.0),
      (3, 2, 1, '2026-11-19 09:00:00-06', 'Preventivo', 'Completado', NULL, 'Limpieza San Pedro', 1.0);

    INSERT INTO incidencia_reporte VALUES
      (1, 1, 2, '2026-10-10 08:00:00-06', 'Falla vieja Heredia', 'Monitor parpadea', 'Media', 'Resuelta'),
      (2, 1, 2, '2026-11-20 11:00:00-06', 'Falla nueva Heredia', 'Sin red', 'Alta', 'Abierta'),
      (3, 2, 1, '2026-11-21 15:00:00-06', 'Falla San Pedro', 'Teclado dañado', 'Baja', 'Abierta');
  `);

  const archivoCtrl = path.join(__dirname, '../src/controllers/reportesController.js');
  const localReq = createRequire(archivoCtrl);
  const moduloCtrl = { exports: {} };
  vm.runInNewContext(fs.readFileSync(archivoCtrl, 'utf8'), {
    module: moduloCtrl,
    console,
    Buffer,
    require: (n) => {
      if (n === '../config/database') return { query: (sql, args) => db.query(sql, args) };
      return localReq(n);
    },
  });

  const ejecutarExcel = async (query, usuario = { idUsuario: 1, rol: 'Superadministrador' }) => {
    const stream = new PassThrough();
    const fragmentos = [];
    stream.on('data', (chunk) => fragmentos.push(chunk));
    const fin = new Promise((resolve) => stream.on('end', resolve));

    const headers = {};
    let codigo = 200;
    let bodyJson = null;
    stream.headersSent = false;
    stream.setHeader = (k, v) => {
      headers[k.toLowerCase()] = v;
    };
    stream.status = (c) => {
      codigo = c;
      return stream;
    };
    stream.json = (d) => {
      bodyJson = d;
      stream.end();
      return stream;
    };

    await moduloCtrl.exports.exportarExcel({ query, usuario }, stream);
    await fin;
    return { codigo, headers, bodyJson, buffer: Buffer.concat(fragmentos) };
  };

  // 1. Validación estricta de filtros inválidos antes de consultar
  for (const queryInvalida of [
    { id_sede: 'abc' },
    { id_laboratorio: '0' },
    { fecha_desde: '2026-02-30' },
    { fecha_desde: '2026-11-25', fecha_hasta: '2026-11-10' },
  ]) {
    const resp = await ejecutarExcel(queryInvalida);
    assert.strictEqual(resp.codigo, 400);
    assert.strictEqual(resp.bodyJson?.success, false);
  }

  // 2. Sin filtros: 3 hojas completas (Inventario excluye equipo eliminado)
  const completo = await ejecutarExcel({});
  assert.strictEqual(completo.codigo, 200);
  assert.ok(
    completo.headers['content-type'].includes(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  );
  const libroCompleto = new ExcelJS.Workbook();
  await libroCompleto.xlsx.load(completo.buffer);
  assert.deepStrictEqual(
    libroCompleto.worksheets.map((h) => h.name),
    ['Inventario', 'Mantenimientos', 'Incidencias']
  );
  assert.strictEqual(libroCompleto.getWorksheet('Inventario').actualRowCount - 1, 2);
  assert.strictEqual(libroCompleto.getWorksheet('Mantenimientos').actualRowCount - 1, 3);
  assert.strictEqual(libroCompleto.getWorksheet('Incidencias').actualRowCount - 1, 3);

  // 3. Con filtros de sede, laboratorio y fechas: respeta filtros en las 3 hojas
  const filtrado = await ejecutarExcel({
    id_sede: '1',
    id_laboratorio: '1',
    fecha_desde: '2026-11-01',
    fecha_hasta: '2026-11-30',
  });
  assert.strictEqual(filtrado.codigo, 200);
  const libroFiltrado = new ExcelJS.Workbook();
  await libroFiltrado.xlsx.load(filtrado.buffer);
  assert.strictEqual(libroFiltrado.getWorksheet('Inventario').actualRowCount - 1, 1);
  assert.strictEqual(libroFiltrado.getWorksheet('Inventario').getRow(2).getCell(1).value, 'PL-H1');
  assert.strictEqual(libroFiltrado.getWorksheet('Mantenimientos').actualRowCount - 1, 1);
  assert.strictEqual(
    libroFiltrado.getWorksheet('Mantenimientos').getRow(2).getCell(4).value,
    'PL-H1'
  );
  assert.strictEqual(libroFiltrado.getWorksheet('Incidencias').actualRowCount - 1, 1);
  assert.strictEqual(
    libroFiltrado.getWorksheet('Incidencias').getRow(2).getCell(6).value,
    'Falla nueva Heredia'
  );

  // 4. Técnico restringido a Lab 1 no puede escapar su alcance pidiendo id_laboratorio=2
  const intentoAjeno = await ejecutarExcel(
    { id_laboratorio: '2' },
    { idUsuario: 2, rol: 'Tecnico' }
  );
  assert.strictEqual(intentoAjeno.codigo, 200);
  const libroAjeno = new ExcelJS.Workbook();
  await libroAjeno.xlsx.load(intentoAjeno.buffer);
  assert.strictEqual(libroAjeno.getWorksheet('Inventario').actualRowCount - 1, 0);
  assert.strictEqual(libroAjeno.getWorksheet('Mantenimientos').actualRowCount - 1, 0);
  assert.strictEqual(libroAjeno.getWorksheet('Incidencias').actualRowCount - 1, 0);

  // 5. Rendimiento RNF05 (< 5 s) con 1000 registros (300 equipos + 400 mantenimientos + 300 incidencias)
  await db.exec(`
    TRUNCATE incidencia_reporte, bitacora_mantenimiento, equipo;
    INSERT INTO equipo
      SELECT n, CASE WHEN n % 2 = 0 THEN 1 ELSE 2 END, 1, 1,
             'PL-' || n, 'SN-' || n, 'Equipo ' || n, 'Marca', 'Modelo', 2024, 'Mesa ' || n, NULL
      FROM generate_series(1, 300) n;
    INSERT INTO bitacora_mantenimiento
      SELECT n, ((n - 1) % 300) + 1, 1, '2026-11-15 10:00:00-06'::timestamptz + (n || ' minutes')::interval,
             CASE WHEN n % 2 = 0 THEN 'Preventivo' ELSE 'Correctivo' END,
             'Completado', 'Motivo ' || n, 'Trabajo realizado ' || n, 1.5
      FROM generate_series(1, 400) n;
    INSERT INTO incidencia_reporte
      SELECT n, ((n - 1) % 300) + 1, 1, '2026-11-15 08:00:00-06'::timestamptz + (n || ' minutes')::interval,
             'Incidencia ' || n, 'Descripción de falla ' || n, 'Alta', 'Abierta'
      FROM generate_series(1, 300) n;
  `);

  const inicio = performance.now();
  const masivo = await ejecutarExcel({});
  const duracionMs = Math.round(performance.now() - inicio);
  assert.strictEqual(masivo.codigo, 200);
  assert.ok(
    duracionMs < 5000,
    `La exportación masiva de 1000 registros tardó ${duracionMs} ms y superó el límite RNF05 de 5000 ms`
  );
  const libroMasivo = new ExcelJS.Workbook();
  await libroMasivo.xlsx.load(masivo.buffer);
  assert.strictEqual(libroMasivo.getWorksheet('Inventario').actualRowCount - 1, 300);
  assert.strictEqual(libroMasivo.getWorksheet('Mantenimientos').actualRowCount - 1, 400);
  assert.strictEqual(libroMasivo.getWorksheet('Incidencias').actualRowCount - 1, 300);
  console.log(`[RNF05] Exportación Excel de 1000 registros (3 hojas): ${duracionMs} ms`);
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
