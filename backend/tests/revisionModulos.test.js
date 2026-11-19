const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { listarMantenimientos } = require('../src/services/mantenimientosListado');
const { validarEntradaMantenimiento } = require('../src/utils/validacionMantenimiento');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { createRequire } = require('node:module');
test('incidencias rechaza cuerpos y filtros mal tipados antes de consultar', async () => {
  const archivo = path.join(__dirname, '../src/controllers/incidenciasController.js'),
    local = createRequire(archivo),
    modulo = { exports: {} };
  vm.runInNewContext(fs.readFileSync(archivo, 'utf8'), {
    module: modulo,
    console,
    require: (n) =>
      n === '../config/database'
        ? {
            query() {
              assert.fail('No debe consultar');
            },
          }
        : n === '../utils/accesoEquipos'
          ? { verificarAccesoEquipo: async () => true }
          : local(n),
  });
  async function ejecutar(nombre, body, query = {}) {
    const res = {
      status(n) {
        this.codigo = n;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    await modulo.exports[nombre](
      { body, query, params: { id: '1' }, usuario: { idUsuario: 1, rol: 'Superadministrador' } },
      res
    );
    return res.codigo;
  }
  for (const body of [
    undefined,
    [],
    { id_equipo: [1], titulo: 'Prueba', descripcion_falla: 'Prueba' },
    { id_equipo: 1, titulo: 42, descripcion_falla: 'Prueba' },
  ])
    assert.equal(await ejecutar('crearIncidencia', body), 400);
  assert.equal(await ejecutar('actualizarEstadoIncidencia', { nuevo_estado: ['Abierta'] }), 400);
  assert.equal(await ejecutar('obtenerIncidencias', undefined, { busqueda: ['x'] }), 400);
});
test('validación estricta de ID, tipos y horas antes de consultar PostgreSQL', async () => {
  for (const body of [
    null,
    [],
    { id_equipo: '12abc' },
    { id_equipo: 1, descripcion_trabajo: 42 },
    { id_equipo: 1, horas_invertidas: '2horas' },
    { id_equipo: 1, horas_invertidas: true },
  ])
    assert.ok(validarEntradaMantenimiento(body));
  assert.equal(
    validarEntradaMantenimiento({
      id_equipo: 1,
      descripcion_trabajo: 'Revisión',
      horas_invertidas: 0,
    }),
    ''
  );
  for (const query of [
    { pagina: '2abc' },
    { limite: 101 },
    { busqueda: ['x'] },
    { id_laboratorio: '1x' },
    { fecha_desde: '2026-02-30' },
  ])
    await assert.rejects(
      listarMantenimientos(
        {
          query() {
            assert.fail('No debe consultar');
          },
        },
        query,
        { idUsuario: 2, rol: 'Tecnico' }
      ),
      (e) => e.status === 400
    );
});
test('paginación real de mantenimientos y permisos con PostgreSQL temporal', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE sede(id_sede int PRIMARY KEY,nombre text);CREATE TABLE laboratorio(id_laboratorio int PRIMARY KEY,id_sede int,codigo text,nombre text);CREATE TABLE estado(id_estado int PRIMARY KEY,nombre text);
    CREATE TABLE usuario(id_usuario int PRIMARY KEY,nombre_completo text,correo_institucional text);CREATE TABLE usuario_sede(id_usuario_sede int,id_usuario int,id_sede int);CREATE TABLE usuario_laboratorio(id_usuario_sede int,id_sede int,id_laboratorio int);
    CREATE TABLE equipo(id_equipo int PRIMARY KEY,id_laboratorio int,id_estado int,nombre text,placa_institucional text,numero_serie text,marca text,modelo text);
    CREATE TABLE bitacora_mantenimiento(id_bitacora int PRIMARY KEY,id_equipo int,id_usuario_tecnico int,tipo_mantenimiento text,motivo_falla text,descripcion_trabajo text,horas_invertidas numeric,fecha_mantenimiento timestamptz,estado_mantenimiento text);
    INSERT INTO sede VALUES(1,'Heredia');INSERT INTO laboratorio VALUES(1,1,'L1','Uno'),(2,1,'L2','Dos');INSERT INTO estado VALUES(1,'Operativo');INSERT INTO usuario VALUES(2,'Técnico','tecnico@example.com');
    INSERT INTO usuario_sede VALUES(1,2,1);INSERT INTO usuario_laboratorio VALUES(1,1,1);
    INSERT INTO equipo VALUES(1,1,1,'Equipo 100%_literal','P1','S1','Marca','Modelo'),(2,2,1,'Equipo ajeno','P2','S2','Marca','Modelo');
    INSERT INTO bitacora_mantenimiento SELECT n,CASE WHEN n<=25 THEN 1 ELSE 2 END,2,'Preventivo',null,'Revisión',1,'2026-11-18 12:00:00+00','Completado' FROM generate_series(1,27)n;`);
  const pool = { query: (sql, args) => db.query(sql, args) },
    tecnico = { idUsuario: 2, rol: 'Tecnico' };
  const primera = await listarMantenimientos(pool, { pagina: 1, limite: 10 }, tecnico);
  assert.equal(primera.total, 25);
  assert.equal(primera.data.length, 10);
  assert.equal(primera.totalPaginas, 3);
  assert.equal(primera.data[0].id_bitacora, 25);
  const ultima = await listarMantenimientos(pool, { pagina: 99, limite: 10 }, tecnico);
  assert.equal(ultima.pagina, 3);
  assert.equal(ultima.data.length, 5);
  const global = await listarMantenimientos(
    pool,
    { pagina: 1, limite: 10 },
    { idUsuario: 1, rol: 'Superadministrador' }
  );
  assert.equal(global.total, 27);
  assert.equal((await listarMantenimientos(pool, { busqueda: '%_' }, tecnico)).total, 25);
  assert.equal((await listarMantenimientos(pool, { estado: 'En Proceso' }, tecnico)).total, 0);
  assert.equal((await listarMantenimientos(pool, {}, { idUsuario: 3, rol: 'Tecnico' })).total, 0);
  await db.exec('INSERT INTO usuario_laboratorio VALUES(1,1,1)');
  assert.equal((await listarMantenimientos(pool, {}, tecnico)).total, 25);
});
