const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { consultarPaginaInventario } = require('../src/services/inventarioPaginado');
const { restaurarEquipo } = require('../src/services/restaurarEquipo');
const { eliminarEquipo } = require('../src/services/eliminarEquipo');

test('eliminados y restauración contra PostgreSQL temporal', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE rol (id_rol int PRIMARY KEY, nombre text);
    CREATE TABLE usuario (id_usuario int PRIMARY KEY, id_rol int, nombre_completo text, activo boolean);
    CREATE TABLE sede (id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio (id_laboratorio int PRIMARY KEY, id_sede int, codigo text, nombre text);
    CREATE TABLE categoria (id_categoria int PRIMARY KEY, nombre text);
    CREATE TABLE estado (id_estado int PRIMARY KEY, nombre text);
    CREATE TABLE equipo (id_equipo int PRIMARY KEY, nombre text, numero_serie text,
      placa_institucional text, marca text, modelo text, ubicacion_detalle text,
      id_categoria int, id_estado int, id_laboratorio int);
    CREATE TABLE usuario_sede (id_usuario_sede int, id_usuario int, id_sede int);
    CREATE TABLE usuario_laboratorio (id_usuario_sede int, id_sede int, id_laboratorio int);
    CREATE TABLE foto_equipo (id_foto int, id_equipo int);
    INSERT INTO rol VALUES (1,'Superadministrador'),(2,'Tecnico');
    INSERT INTO usuario VALUES (99,1,'Administradora',true),(10,2,'Autorizada A',true),
      (11,2,'Sin permiso',true),(20,2,'Autorizada B',true),(30,2,'Inactiva',false);
    INSERT INTO sede VALUES (1,'Heredia');
    INSERT INTO laboratorio VALUES (1,1,'A','Laboratorio A'),(2,1,'B','Laboratorio B');
    INSERT INTO categoria VALUES (1,'Cómputo'); INSERT INTO estado VALUES (1,'Operativo');
    INSERT INTO equipo VALUES (1,'Equipo A','S1','P1','Marca','Modelo','Mesa',1,1,1),
      (2,'Equipo B','S2','P2','Marca','Modelo','Mesa',1,1,2),
      (3,'Equipo anterior','S3','P3','Marca','Modelo','Mesa',1,1,1);
    INSERT INTO foto_equipo VALUES (1,3);
    INSERT INTO usuario_sede VALUES (1,10,1),(2,11,1),(3,20,1),(4,30,1);
    INSERT INTO usuario_laboratorio VALUES (1,1,1),(2,1,1),(3,1,2),(4,1,1);
  `);
  // Los permisos SQL dependen de los roles de despliegue, no del comportamiento que se prueba.
  function migracion(nombre) {
    return fs.readFileSync(path.join(__dirname, '../..', 'database/migrations', nombre), 'utf8')
      .replace(/SET LOCAL ROLE pes_owner;/g, '')
      .replace(/GRANT[^;]+;/g, '');
  }
  await db.exec(migracion('006_eliminacion_logica_equipos.sql'));
  await db.exec(`UPDATE usuario SET puede_eliminar_equipos = true WHERE id_usuario IN (10,20,30);
    UPDATE equipo SET eliminado_en = CURRENT_TIMESTAMP, eliminado_por = 99, motivo_eliminacion = 'Registro anterior' WHERE id_equipo = 3;`);
  await db.exec(migracion('007_historial_eliminacion_equipos.sql'));
  const pool = { connect: async () => ({ query: (sql, valores) => db.query(sql, valores), release() {} }) };
  const admin = { idUsuario: 99, rol: 'Superadministrador' };
  const a = { idUsuario: 10, rol: 'Tecnico', puede_eliminar_equipos: true };
  const b = { idUsuario: 20, rol: 'Tecnico', puede_eliminar_equipos: true };
  const sin = { idUsuario: 11, rol: 'Tecnico' };
  const eventos = async (id) => (await db.query('SELECT accion, motivo FROM historial_eliminacion_equipo WHERE id_equipo=$1 ORDER BY id_evento', [id])).rows;

  await t.test('conserva las eliminaciones anteriores a la migración', async () => {
    assert.deepEqual(await eventos(3), [{ accion: 'eliminar', motivo: 'Registro anterior' }]);
  });
  await t.test('la vista predeterminada excluye eliminados', async () => {
    const r = await consultarPaginaInventario(db, {}, a);
    assert.deepEqual(r.data.map(e => e.id_equipo), [1]);
    assert.equal(r.total, 1);
  });
  await t.test('rechaza vistas inválidas y acceso a eliminados sin permiso', async () => {
    await assert.rejects(consultarPaginaInventario(db, { vista: 'todos' }, admin), { status: 400 });
    await assert.rejects(consultarPaginaInventario(db, { vista: ['eliminados'] }, admin), { status: 400 });
    await assert.rejects(consultarPaginaInventario(db, { vista: 'eliminados' }, sin), { status: 403 });
  });
  await t.test('filtra eliminados por laboratorio y devuelve su auditoría', async () => {
    assert.equal((await consultarPaginaInventario(db, { vista: 'eliminados' }, b)).total, 0);
    const r = await consultarPaginaInventario(db, { vista: 'eliminados' }, a);
    assert.equal(r.total, 1);
    assert.equal(r.data[0].eliminado_por_nombre, 'Administradora');
    assert.equal(r.data[0].motivo_eliminacion, 'Registro anterior');
    assert.equal((await consultarPaginaInventario(db, { vista: 'eliminados', busqueda: 'P3' }, admin)).total, 1);
  });
  await t.test('restaurar valida permiso actual y laboratorio en el servidor', async () => {
    await assert.rejects(restaurarEquipo(pool, 3, sin), { status: 403 });
    await assert.rejects(restaurarEquipo(pool, 3, b), { status: 404 });
    await assert.rejects(restaurarEquipo(pool, 3, { idUsuario: 30 }), { status: 403 });
    await assert.rejects(restaurarEquipo(pool, '0', admin), { status: 400 });
  });
  await t.test('restaura con datos y fotos intactos y conserva ambos eventos', async () => {
    await restaurarEquipo(pool, 3, admin);
    const e = (await db.query('SELECT * FROM equipo WHERE id_equipo=3')).rows[0];
    assert.equal(e.eliminado_en, null); assert.equal(e.eliminado_por, null); assert.equal(e.motivo_eliminacion, null);
    assert.equal(e.numero_serie, 'S3'); assert.equal(e.id_laboratorio, 1); assert.equal(e.id_estado, 1);
    assert.equal((await db.query('SELECT * FROM foto_equipo WHERE id_equipo=3')).rows.length, 1);
    assert.deepEqual((await eventos(3)).map(e => e.accion), ['eliminar', 'restaurar']);
    assert.equal((await consultarPaginaInventario(db, { vista: 'eliminados' }, a)).total, 0);
    assert.equal((await consultarPaginaInventario(db, {}, a)).total, 2);
    await assert.rejects(restaurarEquipo(pool, 3, admin), { status: 409 });
  });
  await t.test('registra cada nuevo ciclo de eliminación y restauración', async () => {
    await eliminarEquipo(pool, 1, a, 'Registro duplicado');
    await restaurarEquipo(pool, 1, a);
    assert.deepEqual((await eventos(1)).map(e => e.accion), ['eliminar', 'restaurar']);
  });
  await t.test('revoca restauración cuando se retira el permiso aunque el navegador lo conserve', async () => {
    await eliminarEquipo(pool, 1, a, 'Registro duplicado');
    await db.query('UPDATE usuario SET puede_eliminar_equipos=false WHERE id_usuario=10');
    await assert.rejects(restaurarEquipo(pool, 1, a), { status: 403 });
    await db.query('UPDATE usuario SET puede_eliminar_equipos=true WHERE id_usuario=10');
  });
  await t.test('revierte también el evento si falla la actualización', async () => {
    const antes = await eventos(1);
    const falla = { connect: async () => ({
      async query(sql, valores) {
        if (sql.startsWith('UPDATE public.equipo')) throw new Error('Fallo simulado');
        return db.query(sql, valores);
      }, release() {},
    }) };
    await assert.rejects(restaurarEquipo(falla, 1, a), /Fallo simulado/);
    assert.deepEqual(await eventos(1), antes);
    assert.notEqual((await db.query('SELECT eliminado_en FROM equipo WHERE id_equipo=1')).rows[0].eliminado_en, null);
  });
});
