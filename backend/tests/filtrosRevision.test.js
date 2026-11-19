const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { listarEquiposRevision } = require('../src/services/equiposRevision');
const { listarMantenimientos } = require('../src/services/mantenimientosListado');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { createRequire } = require('node:module');
const tecnico = { idUsuario: 2, rol: 'Tecnico' },
  admin = { idUsuario: 1, rol: 'Superadministrador' };
function controlador(nombre, db) {
  const f = path.join(__dirname, '../src/controllers/' + nombre + '.js'),
    local = createRequire(f),
    module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), {
    module,
    console,
    require: (n) =>
      n === '../config/database'
        ? db
        : n === '../utils/accesoEquipos'
          ? { verificarAccesoEquipo: async () => true }
          : local(n),
  });
  return module.exports;
}
async function respuesta(fn, query, usuario = tecnico) {
  const res = {
    status(n) {
      this.codigo = n;
      return this;
    },
    json(d) {
      this.datos = d;
      return this;
    },
  };
  await fn({ query, usuario }, res);
  return res;
}
test('filtros de ubicación y avisos de revisión contra PostgreSQL temporal', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE sede(id_sede int PRIMARY KEY,nombre text);
 CREATE TABLE laboratorio(id_laboratorio int PRIMARY KEY,id_sede int,codigo text,nombre text);
 CREATE TABLE usuario_sede(id_usuario_sede int,id_usuario int,id_sede int);
 CREATE TABLE usuario_laboratorio(id_usuario_sede int,id_sede int,id_laboratorio int);
 CREATE TABLE estado(id_estado int PRIMARY KEY,nombre text);
 CREATE TABLE usuario(id_usuario int PRIMARY KEY,nombre_completo text,correo_institucional text);
 CREATE TABLE equipo(id_equipo int PRIMARY KEY,id_laboratorio int,id_estado int,nombre text,anio int,placa_institucional text,numero_serie text,marca text,modelo text);
 CREATE TABLE bitacora_mantenimiento(id_bitacora int PRIMARY KEY,id_equipo int,id_usuario_tecnico int,tipo_mantenimiento text,motivo_falla text,descripcion_trabajo text,horas_invertidas numeric,fecha_mantenimiento timestamptz,estado_mantenimiento text);
 CREATE TABLE incidencia_reporte(id_incidencia int PRIMARY KEY,id_equipo int,id_usuario_reporta int,titulo text,descripcion_falla text,prioridad text,estado_incidencia text,fecha_reporte timestamptz);
 INSERT INTO sede VALUES(1,'Heredia'),(2,'Otra sede');INSERT INTO laboratorio VALUES(1,1,'A','Informática'),(2,2,'B','Informática'),(3,1,'C','Vacío');
 INSERT INTO usuario VALUES(1,'Admin','a@example.com'),(2,'Técnico','t@example.com');
 INSERT INTO usuario_sede VALUES(1,2,1),(2,2,1);INSERT INTO usuario_laboratorio VALUES(1,1,1),(2,1,1),(1,1,3);
 INSERT INTO estado VALUES(1,'Operativo'),(2,'Dañado'),(3,'Inactivo'),(4,'Obsoleto'),(5,'Estado personalizado');
 INSERT INTO equipo VALUES(1,1,1,'Ocho años',2018,'P1',null,null,null),(2,1,1,'Siete años',2019,'P2',null,null,null),(3,1,2,'Sin año con falla',null,'P3',null,null,null),(4,1,3,'Inactivo futuro',2027,'P4',null,null,null),(5,1,1,'Repuesto pendiente',2025,'P5',null,null,null),(6,2,4,'Ajeno',2000,'P6',null,null,null),(7,1,5,'Estado no inferido',2024,'P7',null,null,null);
 INSERT INTO bitacora_mantenimiento SELECT n,CASE WHEN n=1 THEN 5 ELSE 2 END,2,'Preventivo','','Trabajo',1,'2026-01-01'::timestamptz+n*interval '1 day',CASE WHEN n=1 THEN 'Pendiente Repuesto' ELSE 'Completado' END FROM generate_series(1,25)n;
 INSERT INTO bitacora_mantenimiento VALUES(30,6,1,'Correctivo','','Ajeno',2,'2026-02-01','En Proceso');
 INSERT INTO incidencia_reporte VALUES(1,1,2,'Falla uno','Detalle','Alta','Abierta','2026-01-01'),(2,6,1,'Falla ajena','Detalle','Baja','Resuelta','2026-01-02');`);
  await t.test(
    '8 años exactos avisa, siete no; motivos múltiples y año inválido sin inferir obsolescencia',
    async () => {
      const r = await listarEquiposRevision(db, {}, tecnico, 2026);
      assert.equal(r.total, 4);
      assert.equal(r.sin_anio_valido, 2);
      assert.equal(new Set(r.data.map((e) => e.id_equipo)).size, 4);
      assert.deepEqual(r.data.find((e) => e.id_equipo === 1).motivos, ['antiguedad']);
      assert.equal(r.data.find((e) => e.id_equipo === 1).estado, 'Operativo');
      assert.deepEqual(r.data.find((e) => e.id_equipo === 3).motivos, ['falla']);
      assert.equal(r.data.find((e) => e.id_equipo === 4).antiguedad, null);
      assert.deepEqual(r.data.find((e) => e.id_equipo === 5).motivos, ['repuesto']);
      assert.equal(
        (await db.query('SELECT nombre FROM estado WHERE id_estado=1')).rows[0].nombre,
        'Operativo',
      );
      await db.exec('UPDATE equipo SET anio=2010 WHERE id_equipo=3');
      const varios = await listarEquiposRevision(db, {}, tecnico, 2026);
      assert.deepEqual(varios.data.find((e) => e.id_equipo === 3).motivos, ['antiguedad', 'falla']);
      assert.equal(varios.total, 4);
      await db.exec('UPDATE equipo SET anio=NULL WHERE id_equipo=3');
    },
  );
  await t.test('avisos filtran antes de paginar y no exponen equipos ajenos', async () => {
    const r = await listarEquiposRevision(db, { pagina: '99', limite: '2' }, tecnico, 2026);
    assert.equal(r.pagina, 2);
    assert.equal(r.data.length, 2);
    const edad = await listarEquiposRevision(db, { motivo: 'antiguedad' }, tecnico, 2026);
    assert.equal(edad.total, 1);
    assert.equal((await listarEquiposRevision(db, {}, admin, 2026)).total, 5);
    assert.equal(
      (await listarEquiposRevision(db, {}, { idUsuario: 99, rol: 'Tecnico' }, 2026)).total,
      0,
    );
  });
  await t.test(
    'mantenimientos conserva opciones fuera de la página y cambia sede/laboratorio correctamente',
    async () => {
      const r = await listarMantenimientos(db, { id_sede: '2' }, admin);
      assert.equal(r.total, 1);
      assert.equal(r.data[0].id_equipo, 6);
      assert.equal(r.ubicaciones.length, 3);
      const restringido = await listarMantenimientos(db, { id_sede: '2' }, tecnico);
      assert.equal(restringido.total, 0);
      assert.deepEqual(restringido.ubicaciones.map((u) => u.id_laboratorio).sort(), [1, 3]);
      const sinResultados = await listarMantenimientos(db, { busqueda: 'Inexistente' }, tecnico);
      assert.equal(sinResultados.ubicaciones.length, 2);
      const todos = await listarMantenimientos(db, {}, tecnico);
      assert.equal(todos.data.length, 10);
      assert.equal(todos.resumen.esperandoRepuesto, 1);
      assert.equal(todos.resumen.abiertos, 1);
    },
  );
  await t.test(
    'incidencias filtra por sede y mantiene opciones autorizadas incluso sin resultados',
    async () => {
      const fn = controlador('incidenciasController', db).obtenerIncidencias;
      const r = await respuesta(fn, { id_sede: '2' });
      assert.equal(r.codigo, 200);
      assert.equal(r.datos.total, 0);
      assert.equal(r.datos.ubicaciones.length, 2);
      const global = await respuesta(fn, { id_sede: '2', id_laboratorio: '2' }, admin);
      assert.equal(global.datos.total, 1);
      assert.equal(global.datos.data[0].id_sede, 2);
      const mal = await respuesta(fn, { id_sede: ['1'] });
      assert.equal(mal.codigo, 400);
    },
  );
  await t.test(
    'reportes devuelve sede para laboratorios de igual nombre y respeta asignaciones',
    async () => {
      const fn = controlador('reportesController', db).obtenerResumenGeneral;
      const r = await respuesta(fn, {});
      assert.equal(r.codigo, 200);
      assert.equal(r.datos.data.equipos_por_laboratorio.length, 2);
      assert.ok(
        r.datos.data.equipos_por_laboratorio.every(
          (l) => l.id_sede === 1 && l.nombre_sede === 'Heredia',
        ),
      );
    },
  );
});
test('revisión rechaza filtros inválidos antes de consultar', async () => {
  const db = {
    query() {
      assert.fail('No debe consultar');
    },
  };
  for (const q of [
    { pagina: '1abc' },
    { limite: 51 },
    { motivo: ['falla'] },
    { motivo: 'arbitrario' },
    { pagina: 2147483648 },
  ])
    await assert.rejects(listarEquiposRevision(db, q, tecnico), (e) => e.status === 400);
});
