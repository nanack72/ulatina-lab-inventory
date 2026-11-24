const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');
const { darBajaUsuario } = require('../src/services/bajaUsuario');

function crearPoolPglite(db) {
  return {
    query: (sql, valores) => db.query(sql, valores),
    connect: async () => ({
      query: (sql, valores) => db.query(sql, valores),
      release() {},
    }),
  };
}

test('RN15: bloqueo y reasignación de órdenes abiertas en darBajaUsuario (DELETE)', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const pool = crearPoolPglite(db);

  await db.exec(`
    CREATE TABLE rol (id_rol int PRIMARY KEY, nombre text);
    CREATE TABLE sede (id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio (id_laboratorio int PRIMARY KEY, id_sede int REFERENCES sede, codigo text, nombre text);
    CREATE TABLE usuario (id_usuario int PRIMARY KEY, id_rol int REFERENCES rol, activo boolean);
    CREATE TABLE usuario_sede (id_usuario_sede int PRIMARY KEY, id_usuario int REFERENCES usuario, id_sede int);
    CREATE TABLE usuario_laboratorio (id_usuario_sede int REFERENCES usuario_sede, id_laboratorio int);
    CREATE TABLE token_revocado (id_usuario int REFERENCES usuario, jti text);
    CREATE TABLE equipo (id_equipo int PRIMARY KEY, id_laboratorio int REFERENCES laboratorio, nombre text);
    CREATE TABLE bitacora_mantenimiento (
      id_bitacora int PRIMARY KEY,
      id_equipo int REFERENCES equipo,
      id_usuario_tecnico int REFERENCES usuario,
      estado_mantenimiento text
    );
    INSERT INTO rol VALUES
      (1, 'Superadministrador'),
      (2, 'Tecnico'),
      (3, 'Coordinador'),
      (4, 'Consulta');
    INSERT INTO sede VALUES (1, 'Heredia');
    INSERT INTO laboratorio VALUES (1, 1, 'L1', 'Lab 1'), (2, 1, 'L2', 'Lab 2');
    INSERT INTO equipo VALUES (10, 1, 'Osciloscopio');
  `);

  async function reiniciar() {
    await db.exec(`
      TRUNCATE bitacora_mantenimiento, usuario_laboratorio, usuario_sede, token_revocado, usuario CASCADE;
      INSERT INTO usuario VALUES
        (1, 1, true),
        (2, 2, true),
        (3, 2, true),
        (4, 2, false),
        (5, 4, true),
        (6, 2, true),
        (7, 3, true);
      INSERT INTO usuario_sede VALUES (10, 2, 1), (11, 3, 1), (12, 6, 1);
      INSERT INTO usuario_laboratorio VALUES (10, 1), (11, 1), (12, 2);
      INSERT INTO bitacora_mantenimiento VALUES
        (101, 10, 2, 'En Proceso'),
        (102, 10, 2, 'Pendiente Repuesto'),
        (103, 10, 2, 'Completado');
    `);
  }

  await t.test('rechaza con 409 si hay órdenes abiertas y no se indica sustituto', async () => {
    await reiniciar();
    await assert.rejects(
      () => darBajaUsuario(pool, '2', 1),
      (err) => err.status === 409 && err.datos?.ordenes_abiertas === 2
    );
    assert.equal((await db.query('SELECT activo FROM usuario WHERE id_usuario = 2')).rows[0].activo, true);
  });

  await t.test('rechaza sustituto inactivo, con rol de consulta, del mismo usuario o sin acceso al laboratorio', async () => {
    await reiniciar();
    // Mismo usuario -> 400
    await assert.rejects(
      () => darBajaUsuario(pool, '2', 1, { idTecnicoSustituto: 2 }),
      (err) => err.status === 400
    );
    // Inactivo -> 409
    await assert.rejects(
      () => darBajaUsuario(pool, '2', 1, { idTecnicoSustituto: 4 }),
      (err) => err.status === 409
    );
    // Rol Consulta no autorizado -> 409
    await assert.rejects(
      () => darBajaUsuario(pool, '2', 1, { idTecnicoSustituto: 5 }),
      (err) => err.status === 409
    );
    // Técnico asignado solo a Lab 2 (órdenes están en Lab 1) -> 409
    await assert.rejects(
      () => darBajaUsuario(pool, '2', 1, { idTecnicoSustituto: 6 }),
      (err) => err.status === 409
    );
    // Ninguna orden debió alterarse
    const abiertas = await db.query(
      "SELECT COUNT(*)::int AS n FROM bitacora_mantenimiento WHERE id_usuario_tecnico = 2 AND estado_mantenimiento <> 'Completado'"
    );
    assert.equal(abiertas.rows[0].n, 2);
  });

  await t.test('reasigna solo órdenes abiertas a técnico autorizado y conserva autoría de completadas', async () => {
    await reiniciar();
    const res = await darBajaUsuario(pool, '2', 1, { idTecnicoSustituto: 3 });
    assert.equal(res.accion, 'desactivado');
    assert.equal(res.ordenes_reasignadas, 2);
    assert.equal((await db.query('SELECT activo FROM usuario WHERE id_usuario = 2')).rows[0].activo, false);

    const ordenes = await db.query(
      'SELECT id_bitacora, id_usuario_tecnico, estado_mantenimiento FROM bitacora_mantenimiento ORDER BY id_bitacora'
    );
    assert.deepEqual(ordenes.rows, [
      { id_bitacora: 101, id_usuario_tecnico: 3, estado_mantenimiento: 'En Proceso' },
      { id_bitacora: 102, id_usuario_tecnico: 3, estado_mantenimiento: 'Pendiente Repuesto' },
      { id_bitacora: 103, id_usuario_tecnico: 2, estado_mantenimiento: 'Completado' },
    ]);
  });

  await t.test('permite reasignar a un Coordinador con acceso global sin asignación manual de laboratorio', async () => {
    await reiniciar();
    const res = await darBajaUsuario(pool, '2', 1, { idTecnicoSustituto: 7 });
    assert.equal(res.accion, 'desactivado');
    assert.equal(res.ordenes_reasignadas, 2);
    const reasignadas = await db.query(
      'SELECT COUNT(*)::int AS n FROM bitacora_mantenimiento WHERE id_usuario_tecnico = 7'
    );
    assert.equal(reasignadas.rows[0].n, 2);
  });
});

test('RN15: endpoints HTTP GET/PUT/DELETE en usuariosRoutes.js protegen ambas puertas', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const pool = crearPoolPglite(db);

  await db.exec(`
    CREATE TABLE rol (id_rol int PRIMARY KEY, nombre text);
    CREATE TABLE sede (id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio (id_laboratorio int PRIMARY KEY, id_sede int REFERENCES sede, codigo text, nombre text);
    CREATE TABLE usuario (
      id_usuario int PRIMARY KEY,
      id_rol int REFERENCES rol,
      nombre_completo text,
      correo_institucional text,
      contrasena_hash text,
      activo boolean,
      permiso_inventario text,
      puede_eliminar_equipos boolean,
      fecha_creacion timestamptz DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE usuario_sede (
      id_usuario_sede serial PRIMARY KEY,
      id_usuario int REFERENCES usuario,
      id_sede int REFERENCES sede,
      UNIQUE (id_usuario, id_sede)
    );
    CREATE TABLE usuario_laboratorio (
      id_usuario_sede int REFERENCES usuario_sede,
      id_laboratorio int REFERENCES laboratorio,
      id_sede int REFERENCES sede,
      UNIQUE (id_usuario_sede, id_laboratorio)
    );
    CREATE TABLE token_revocado (id_usuario int REFERENCES usuario, jti text);
    CREATE TABLE equipo (id_equipo int PRIMARY KEY, id_laboratorio int REFERENCES laboratorio, nombre text);
    CREATE TABLE bitacora_mantenimiento (
      id_bitacora int PRIMARY KEY,
      id_equipo int REFERENCES equipo,
      id_usuario_tecnico int REFERENCES usuario,
      estado_mantenimiento text
    );
    INSERT INTO rol VALUES (1, 'Superadministrador'), (2, 'Tecnico');
    INSERT INTO sede VALUES (1, 'Heredia');
    INSERT INTO laboratorio VALUES (1, 1, 'L1', 'Lab 1');
    INSERT INTO equipo VALUES (10, 1, 'Switch');
    INSERT INTO usuario (id_usuario, id_rol, nombre_completo, correo_institucional, contrasena_hash, activo, permiso_inventario, puede_eliminar_equipos) VALUES
      (1, 1, 'Admin Principal', 'admin@ulatina.cr', 'hash', true, 'edicion', true),
      (2, 2, 'Técnico Saliente', 'tec1@ulatina.cr', 'hash', true, 'consulta', false),
      (3, 2, 'Técnico Sustituto', 'tec2@ulatina.cr', 'hash', true, 'consulta', false),
      (4, 2, 'Técnico Baja Query', 'tec3@ulatina.cr', 'hash', true, 'consulta', false);
    INSERT INTO usuario_sede (id_usuario, id_sede) VALUES (2, 1), (3, 1), (4, 1);
    INSERT INTO usuario_laboratorio (id_usuario_sede, id_laboratorio, id_sede)
      SELECT id_usuario_sede, 1, 1 FROM usuario_sede;
    INSERT INTO bitacora_mantenimiento VALUES
      (201, 10, 2, 'En Proceso'),
      (202, 10, 2, 'Completado'),
      (203, 10, 4, 'Pendiente Repuesto');
  `);

  const archivoRuta = path.join(__dirname, '../src/routes/usuariosRoutes.js');
  const localReq = createRequire(archivoRuta);
  const moduloRuta = { exports: {} };
  vm.runInNewContext(fs.readFileSync(archivoRuta, 'utf8'), {
    module: moduloRuta,
    console,
    Buffer,
    require: (n) => {
      if (n === '../config/database') return pool;
      if (n === '../middlewares/authMiddleware') {
        return {
          verificarToken: (req, _res, next) => {
            req.usuario = { idUsuario: 1, rol: 'Superadministrador' };
            next();
          },
        };
      }
      if (n === '../middlewares/permisosMiddleware') {
        return { permitirRoles: () => (_req, _res, next) => next() };
      }
      return localReq(n);
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/admin/usuarios', moduloRuta.exports);

  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const baseUrl = `http://127.0.0.1:${servidor.address().port}/api/admin/usuarios`;

  // 1. GET / incluye ordenes_abiertas por usuario
  const respLista = await fetch(baseUrl);
  assert.equal(respLista.status, 200);
  const lista = await respLista.json();
  const tecSaliente = lista.data.find((u) => u.id_usuario === 2);
  assert.equal(tecSaliente.ordenes_abiertas, 1);

  // 2. PUT /:id con activo: false sin sustituto -> 409 con ordenes_abiertas
  const payloadBase = {
    nombre_completo: 'Técnico Saliente',
    correo_institucional: 'tec1@ulatina.cr',
    id_rol: 2,
    activo: false,
    permiso_inventario: 'consulta',
    puede_eliminar_equipos: false,
    sedes: [1],
    laboratorios: [1],
  };

  const respPutBloqueado = await fetch(`${baseUrl}/2`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadBase),
  });
  assert.equal(respPutBloqueado.status, 409);
  const jsonBloqueado = await respPutBloqueado.json();
  assert.equal(jsonBloqueado.codigo, 'ORDENES_ABIERTAS');
  assert.equal(jsonBloqueado.ordenes_abiertas, 1);

  // 3. PUT /:id con activo: false e id_tecnico_sustituto -> 200 y reasigna solo abiertas
  const respPutOk = await fetch(`${baseUrl}/2`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payloadBase, id_tecnico_sustituto: 3 }),
  });
  assert.equal(respPutOk.status, 200);
  const jsonPutOk = await respPutOk.json();
  assert.equal(jsonPutOk.ordenes_reasignadas, 1);

  const estadoTec2 = await db.query('SELECT activo FROM usuario WHERE id_usuario = 2');
  assert.equal(estadoTec2.rows[0].activo, false);
  const ordenesTec2 = await db.query(
    'SELECT id_bitacora, id_usuario_tecnico FROM bitacora_mantenimiento WHERE id_bitacora IN (201, 202) ORDER BY id_bitacora'
  );
  assert.deepEqual(ordenesTec2.rows, [
    { id_bitacora: 201, id_usuario_tecnico: 3 },
    { id_bitacora: 202, id_usuario_tecnico: 2 },
  ]);

  // 4. DELETE /:id acepta id_tecnico_sustituto desde req.query
  const respDeleteQuery = await fetch(`${baseUrl}/4?id_tecnico_sustituto=3`, {
    method: 'DELETE',
  });
  assert.equal(respDeleteQuery.status, 200);
  const jsonDeleteQuery = await respDeleteQuery.json();
  assert.equal(jsonDeleteQuery.accion, 'desactivado');
  assert.equal(jsonDeleteQuery.ordenes_reasignadas, 1);

  const orden203 = await db.query(
    'SELECT id_usuario_tecnico FROM bitacora_mantenimiento WHERE id_bitacora = 203'
  );
  assert.equal(orden203.rows[0].id_usuario_tecnico, 3);
});

test('Migración 009 habilita UPDATE(id_usuario_tecnico) a pes_runtime sin conceder DELETE', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE ROLE pes_owner;
    CREATE ROLE pes_runtime;
    CREATE TABLE rol (id_rol int PRIMARY KEY, nombre text);
    CREATE TABLE usuario (id_usuario int PRIMARY KEY, id_rol int REFERENCES rol, activo boolean);
    CREATE TABLE usuario_sede (id_usuario_sede int PRIMARY KEY, id_usuario int REFERENCES usuario);
    CREATE TABLE usuario_laboratorio (id_usuario_sede int REFERENCES usuario_sede);
    CREATE TABLE token_revocado (id_usuario int REFERENCES usuario);
    CREATE TABLE bitacora_mantenimiento (
      id_bitacora int PRIMARY KEY,
      id_usuario_tecnico int REFERENCES usuario,
      estado_mantenimiento text,
      horas_invertidas numeric,
      descripcion_trabajo text
    );
    INSERT INTO rol VALUES (1, 'Superadministrador'), (2, 'Tecnico');
    INSERT INTO usuario VALUES (1, 1, true), (2, 2, true), (3, 2, true);
    INSERT INTO bitacora_mantenimiento VALUES (1, 2, 'En Proceso', 1, 'Diagnóstico');
    ALTER TABLE usuario OWNER TO pes_owner;
    ALTER TABLE usuario_sede OWNER TO pes_owner;
    ALTER TABLE usuario_laboratorio OWNER TO pes_owner;
    ALTER TABLE token_revocado OWNER TO pes_owner;
    ALTER TABLE bitacora_mantenimiento OWNER TO pes_owner;
    GRANT SELECT ON rol, usuario, usuario_sede, usuario_laboratorio, token_revocado, bitacora_mantenimiento TO pes_runtime;
    GRANT UPDATE(activo) ON usuario TO pes_runtime;
    GRANT UPDATE(estado_mantenimiento, horas_invertidas, descripcion_trabajo) ON bitacora_mantenimiento TO pes_runtime;
  `);

  const mig003 = fs.readFileSync(
    path.join(__dirname, '../../database/migrations/003_baja_usuarios.sql'),
    'utf8'
  );
  const mig009 = fs.readFileSync(
    path.join(__dirname, '../../database/migrations/009_permisos_reasignacion_mantenimientos.sql'),
    'utf8'
  );
  await db.exec(mig003);

  const pool = crearPoolPglite(db);

  // Antes de aplicar 009, pes_runtime no puede actualizar id_usuario_tecnico -> 503
  await db.exec('SET ROLE pes_runtime');
  await assert.rejects(
    () => darBajaUsuario(pool, '2', 1, { idTecnicoSustituto: 3 }),
    (err) => err.status === 503
  );
  await db.exec('RESET ROLE');

  // Tras aplicar 009, pes_runtime sí puede reasignar y sigue sin permiso DELETE
  await db.exec(mig009);
  await db.exec('SET ROLE pes_runtime');
  const res = await darBajaUsuario(pool, '2', 1, { idTecnicoSustituto: 3 });
  assert.equal(res.accion, 'desactivado');
  assert.equal(res.ordenes_reasignadas, 1);
  await assert.rejects(
    () => db.query('DELETE FROM bitacora_mantenimiento'),
    (err) => err.code === '42501'
  );
});
