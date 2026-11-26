const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');

const PNG_MINIMO = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

function cargarEnVm(rutaAbsoluta, overrides = {}) {
  const localReq = createRequire(rutaAbsoluta);
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(rutaAbsoluta, 'utf8'), {
    module: mod,
    exports: mod.exports,
    console,
    Buffer,
    process,
    setTimeout,
    clearTimeout,
    require: (nombre) => {
      if (Object.hasOwn(overrides, nombre)) {
        return overrides[nombre];
      }
      return localReq(nombre);
    },
  });
  return mod.exports;
}

test('Permisos consistentes: solo Superadministrador es global; Director, Coordinador y Administrador respetan sus laboratorios en todos los módulos (PGlite)', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE TABLE sede(id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio(id_laboratorio int PRIMARY KEY, id_sede int, codigo text, nombre text);
    CREATE TABLE categoria(id_categoria int PRIMARY KEY, nombre text);
    CREATE TABLE estado(id_estado serial PRIMARY KEY, nombre text UNIQUE, descripcion text);
    CREATE TABLE usuario(id_usuario int PRIMARY KEY, nombre_completo text, correo_institucional text);
    CREATE TABLE usuario_sede(id_usuario_sede int PRIMARY KEY, id_usuario int, id_sede int);
    CREATE TABLE usuario_laboratorio(id_usuario_sede int, id_sede int, id_laboratorio int);
    CREATE TABLE equipo(
      id_equipo int PRIMARY KEY,
      id_laboratorio int,
      id_categoria int,
      id_estado int,
      nombre text,
      placa_institucional text,
      numero_serie text,
      marca text,
      modelo text,
      anio int,
      caracteristicas text,
      comentarios text,
      ubicacion_detalle text,
      eliminado_en timestamptz
    );
    CREATE TABLE bitacora_mantenimiento(
      id_bitacora serial PRIMARY KEY,
      id_equipo int,
      id_usuario_tecnico int,
      tipo_mantenimiento text,
      motivo_falla text,
      descripcion_trabajo text,
      horas_invertidas numeric,
      fecha_mantenimiento timestamptz DEFAULT CURRENT_TIMESTAMP,
      estado_mantenimiento text
    );
    CREATE TABLE evidencia_fotografica(
      id_evidencia serial PRIMARY KEY,
      id_bitacora int,
      tipo_evidencia text,
      url_foto text,
      descripcion text,
      mime text,
      datos bytea,
      fecha_subida timestamptz DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE incidencia_reporte(
      id_incidencia serial PRIMARY KEY,
      id_equipo int,
      id_usuario_reporta int,
      titulo text,
      descripcion_falla text,
      prioridad text,
      estado_incidencia text,
      fecha_reporte timestamptz DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE historial_estado(
      id_historial_estado serial PRIMARY KEY,
      id_equipo int,
      motivo text
    );

    INSERT INTO sede VALUES (1, 'Heredia');
    INSERT INTO laboratorio VALUES (1, 1, 'LAB-01', 'Laboratorio 1'), (2, 1, 'LAB-02', 'Laboratorio 2');
    INSERT INTO categoria VALUES (1, 'Instrumentación');
    INSERT INTO estado (id_estado, nombre, descripcion) VALUES
      (1, 'Operativo', 'Equipo operativo'),
      (2, 'En mantenimiento', 'Equipo en mantenimiento');
    INSERT INTO usuario VALUES
      (1, 'Super Admin', 'super@ulatina.cr'),
      (2, 'Director Sin Labs', 'director@ulatina.cr'),
      (3, 'Coordinador Lab 1', 'coord@ulatina.cr'),
      (4, 'Admin Sin Labs', 'admin@ulatina.cr');
    INSERT INTO usuario_sede VALUES (10, 3, 1);
    INSERT INTO usuario_laboratorio VALUES (10, 1, 1);

    INSERT INTO equipo (id_equipo, id_laboratorio, id_categoria, id_estado, nombre, placa_institucional, numero_serie, marca, modelo, eliminado_en) VALUES
      (10, 1, 1, 1, 'Osciloscopio Lab 1', 'PLA-010', 'SER-010', 'Tektronix', 'TBS', NULL),
      (20, 2, 1, 1, 'Multímetro Lab 2', 'PLA-020', 'SER-020', 'Fluke', '87V', NULL);

    INSERT INTO bitacora_mantenimiento (id_bitacora, id_equipo, id_usuario_tecnico, tipo_mantenimiento, descripcion_trabajo, horas_invertidas, estado_mantenimiento) VALUES
      (100, 10, 1, 'Preventivo', 'Limpieza Lab 1', 1, 'En Proceso'),
      (200, 20, 1, 'Preventivo', 'Limpieza Lab 2', 1, 'En Proceso');
    SELECT setval(pg_get_serial_sequence('bitacora_mantenimiento', 'id_bitacora'), 300);

    INSERT INTO incidencia_reporte (id_incidencia, id_equipo, id_usuario_reporta, titulo, descripcion_falla, prioridad, estado_incidencia) VALUES
      (500, 10, 1, 'Falla Lab 1', 'No enciende', 'Alta', 'Abierta'),
      (600, 20, 1, 'Falla Lab 2', 'Pantalla borrosa', 'Media', 'Abierta');
    SELECT setval(pg_get_serial_sequence('incidencia_reporte', 'id_incidencia'), 700);
  `);

  await db.query(
    `INSERT INTO evidencia_fotografica (id_evidencia, id_bitacora, tipo_evidencia, url_foto, descripcion, mime, datos)
     VALUES (1000, 100, 'Antes', 'db://evidencias/1000.png', 'Foto Lab 1', 'image/png', $1),
            (2000, 200, 'Antes', 'db://evidencias/2000.png', 'Foto Lab 2', 'image/png', $1)`,
    [PNG_MINIMO]
  );
  await db.exec(
    `SELECT setval(pg_get_serial_sequence('evidencia_fotografica', 'id_evidencia'), 3000)`
  );

  const pool = {
    query: (sql, args) => db.query(sql, args),
    connect: async () => ({
      query: (sql, args) => {
        if (/set_config/i.test(sql)) return Promise.resolve({ rows: [], rowCount: 0 });
        return db.query(sql.replace(/FOR (?:UPDATE|SHARE) OF [a-z, ]+/gi, ''), args);
      },
      release() {},
    }),
  };

  const accesoEquipos = cargarEnVm(path.join(__dirname, '../src/utils/accesoEquipos.js'), {
    '../config/database': pool,
  });
  const permisosMiddleware = cargarEnVm(
    path.join(__dirname, '../src/middlewares/permisosMiddleware.js'),
    { '../config/database': pool }
  );
  const mantCtrl = cargarEnVm(
    path.join(__dirname, '../src/controllers/mantenimientosController.js'),
    {
      '../config/database': pool,
      '../utils/accesoEquipos': accesoEquipos,
    }
  );
  const incCtrl = cargarEnVm(path.join(__dirname, '../src/controllers/incidenciasController.js'), {
    '../config/database': pool,
    '../utils/accesoEquipos': accesoEquipos,
  });
  const evCtrl = cargarEnVm(path.join(__dirname, '../src/controllers/evidenciasController.js'), {
    '../config/database': pool,
    '../utils/accesoEquipos': accesoEquipos,
  });
  const repCtrl = cargarEnVm(path.join(__dirname, '../src/controllers/reportesController.js'), {
    '../config/database': pool,
  });

  // Montar reportesRoutes reales con un verificador de token configurable por cabecera de prueba
  const reportesRouter = cargarEnVm(path.join(__dirname, '../src/routes/reportesRoutes.js'), {
    '../controllers/reportesController': repCtrl,
    '../middlewares/permisosMiddleware': permisosMiddleware,
    '../middlewares/authMiddleware': {
      verificarToken: (req, _res, next) => {
        req.usuario = {
          idUsuario: Number(req.headers['x-test-user']),
          rol: String(req.headers['x-test-rol']),
        };
        next();
      },
    },
  });

  const app = express();
  app.use('/api/reportes', reportesRouter);
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const baseReportes = `http://127.0.0.1:${servidor.address().port}/api/reportes`;

  const invocar = async (fn, req, usuario) => {
    const res = {
      codigo: 200,
      headers: {},
      status(c) {
        this.codigo = c;
        return this;
      },
      json(d) {
        this.body = d;
        return this;
      },
      set(h) {
        Object.assign(this.headers, h);
        return this;
      },
      send(d) {
        this.raw = d;
        return this;
      },
    };
    await fn({ query: {}, params: {}, body: {}, ...req, usuario }, res);
    return res;
  };

  const superAdmin = { idUsuario: 1, rol: 'Superadministrador' };
  const directorSinLabs = { idUsuario: 2, rol: 'Director' };
  const coordLab1 = { idUsuario: 3, rol: 'Coordinador' };
  const adminSinLabs = { idUsuario: 4, rol: 'Administrador' };

  // 1. Director y Administrador SIN laboratorios asignados deben ser bloqueados en TODOS los módulos
  for (const usuarioSinLabs of [directorSinLabs, adminSinLabs]) {
    const crearMant = await invocar(
      mantCtrl.crearMantenimiento,
      {
        body: {
          id_equipo: 10,
          tipo_mantenimiento: 'Preventivo',
          descripcion_trabajo: 'No autorizado',
          horas_invertidas: 1,
        },
      },
      usuarioSinLabs
    );
    assert.equal(crearMant.codigo, 403);

    assert.equal(
      (await invocar(mantCtrl.obtenerMantenimientoPorId, { params: { id: '100' } }, usuarioSinLabs))
        .codigo,
      403
    );
    assert.equal(
      (
        await invocar(
          mantCtrl.obtenerHistorialPorEquipo,
          { params: { idEquipo: '10' } },
          usuarioSinLabs
        )
      ).codigo,
      403
    );
    assert.equal(
      (
        await invocar(
          mantCtrl.actualizarEstadoMantenimiento,
          { params: { id: '100' }, body: { horas_invertidas: 2 } },
          usuarioSinLabs
        )
      ).codigo,
      403
    );

    const listaMant = await invocar(mantCtrl.obtenerMantenimientos, { query: {} }, usuarioSinLabs);
    assert.equal(listaMant.codigo, 200);
    assert.equal(listaMant.body.total, 0);

    const crearInc = await invocar(
      incCtrl.crearIncidencia,
      {
        body: {
          id_equipo: 10,
          titulo: 'Falla sin permiso',
          descripcion_falla: 'Detalle',
          prioridad: 'Media',
        },
      },
      usuarioSinLabs
    );
    assert.equal(crearInc.codigo, 403);
    assert.equal(
      (await invocar(incCtrl.obtenerIncidencias, { query: {} }, usuarioSinLabs)).body.total,
      0
    );
    assert.equal(
      (
        await invocar(
          incCtrl.actualizarEstadoIncidencia,
          { params: { id: '500' }, body: { nuevo_estado: 'En Revisión' } },
          usuarioSinLabs
        )
      ).codigo,
      403
    );

    assert.equal(
      (
        await invocar(
          evCtrl.subirEvidencia,
          {
            file: { buffer: PNG_MINIMO, originalname: 'a.png' },
            body: { id_bitacora: '100', tipo_evidencia: 'Antes' },
          },
          usuarioSinLabs
        )
      ).codigo,
      403
    );
    assert.equal(
      (
        await invocar(
          evCtrl.obtenerEvidenciasPorBitacora,
          { params: { id_bitacora: '100' } },
          usuarioSinLabs
        )
      ).codigo,
      403
    );
    assert.equal(
      (await invocar(evCtrl.obtenerArchivoEvidencia, { params: { id: '1000' } }, usuarioSinLabs))
        .codigo,
      403
    );

    const resumen = await invocar(repCtrl.obtenerResumenGeneral, {}, usuarioSinLabs);
    assert.equal(resumen.codigo, 200);
    assert.equal(resumen.body.data.total_equipos, 0);
    assert.equal(resumen.body.data.mantenimientos.total, 0);
    assert.equal(resumen.body.data.equipos_por_laboratorio.length, 0);

    const respRutaLab = await fetch(`${baseReportes}/mantenimientos-laboratorio/1`, {
      headers: {
        'x-test-user': String(usuarioSinLabs.idUsuario),
        'x-test-rol': usuarioSinLabs.rol,
      },
    });
    assert.equal(respRutaLab.status, 403);
  }

  // 2. Coordinador asignado SOLO a Lab 1 opera en Lab 1 y queda bloqueado en Lab 2
  const listaCoord = await invocar(mantCtrl.obtenerMantenimientos, { query: {} }, coordLab1);
  assert.equal(listaCoord.body.total, 1);
  assert.equal(listaCoord.body.data[0].id_laboratorio, 1);

  assert.equal(
    (await invocar(mantCtrl.obtenerMantenimientoPorId, { params: { id: '100' } }, coordLab1))
      .codigo,
    200
  );
  assert.equal(
    (await invocar(mantCtrl.obtenerMantenimientoPorId, { params: { id: '200' } }, coordLab1))
      .codigo,
    403
  );

  const incCoord = await invocar(incCtrl.obtenerIncidencias, { query: {} }, coordLab1);
  assert.equal(incCoord.body.total, 1);
  assert.equal(incCoord.body.data[0].id_equipo, 10);

  assert.equal(
    (await invocar(evCtrl.obtenerArchivoEvidencia, { params: { id: '1000' } }, coordLab1)).codigo,
    200
  );
  assert.equal(
    (await invocar(evCtrl.obtenerArchivoEvidencia, { params: { id: '2000' } }, coordLab1)).codigo,
    403
  );

  const resumenCoord = await invocar(repCtrl.obtenerResumenGeneral, {}, coordLab1);
  assert.equal(resumenCoord.body.data.total_equipos, 1);
  assert.equal(resumenCoord.body.data.equipos_por_laboratorio.length, 1);
  assert.equal(resumenCoord.body.data.equipos_por_laboratorio[0].id_laboratorio, 1);

  const respCoordLab1 = await fetch(`${baseReportes}/mantenimientos-laboratorio/1`, {
    headers: { 'x-test-user': '3', 'x-test-rol': 'Coordinador' },
  });
  assert.equal(respCoordLab1.status, 200);
  const respCoordLab2 = await fetch(`${baseReportes}/mantenimientos-laboratorio/2`, {
    headers: { 'x-test-user': '3', 'x-test-rol': 'Coordinador' },
  });
  assert.equal(respCoordLab2.status, 403);

  // 3. Superadministrador conserva acceso global sin asignaciones manuales
  assert.equal(
    (await invocar(mantCtrl.obtenerMantenimientos, { query: {} }, superAdmin)).body.total,
    2
  );
  assert.equal(
    (await invocar(incCtrl.obtenerIncidencias, { query: {} }, superAdmin)).body.total,
    2
  );
  assert.equal(
    (await invocar(evCtrl.obtenerArchivoEvidencia, { params: { id: '2000' } }, superAdmin)).codigo,
    200
  );
  assert.equal(
    (await invocar(repCtrl.obtenerResumenGeneral, {}, superAdmin)).body.data.total_equipos,
    2
  );
  const respSuperLab2 = await fetch(`${baseReportes}/mantenimientos-laboratorio/2`, {
    headers: { 'x-test-user': '1', 'x-test-rol': 'Superadministrador' },
  });
  assert.equal(respSuperLab2.status, 200);
});
