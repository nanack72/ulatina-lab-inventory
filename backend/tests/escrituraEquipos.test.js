const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

function cargar(pool) {
  const archivo = path.join(__dirname, '../src/controllers/equiposController.js');
  const requireLocal = createRequire(archivo);
  const modulo = { exports: {} };
  vm.runInNewContext(readFileSync(archivo, 'utf8'), {
    module: modulo, console,
    require: nombre => nombre === '../config/database' ? pool : requireLocal(nombre),
  }, { filename: archivo });
  return modulo.exports;
}
async function ejecutar(controlador, metodo, body, id = '1', usuario = 10) {
  const res = { codigo: 200, status(codigo) { this.codigo = codigo; return this; },
    json(datos) { this.datos = datos; return this; } };
  await controlador[metodo]({ body, params: { id }, usuario: { idUsuario: usuario } }, res);
  return res;
}
const equipoValido = { nombre: 'Nuevo', id_categoria: 1, id_estado: 1, id_laboratorio: 1 };

test('rechaza tipos de ID, años y cuerpos incorrectos antes de abrir transacciones', async () => {
  const controlador = cargar({ connect() { assert.fail('No debe consultar la base'); } });
  for (const id of [[1], true, {}, '12abc', 1.5, 0, 2147483648]) {
    assert.equal((await ejecutar(controlador, 'crearEquipo', { ...equipoValido, id_laboratorio: id })).codigo, 400);
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { id_estado: id })).codigo, 400);
  }
  for (const anio of [[2024], {}, true, 2024.5]) {
    assert.equal((await ejecutar(controlador, 'crearEquipo', { ...equipoValido, anio })).codigo, 400);
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { anio })).codigo, 400);
  }
  for (const body of [undefined, null, [], 'texto']) {
    assert.equal((await ejecutar(controlador, 'crearEquipo', body)).codigo, 400);
  }
});

test('escrituras y permisos de equipos contra PostgreSQL temporal', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  let liberaciones = 0;
  const controlador = cargar({ connect: async () => ({
    query: (sql, valores) => db.query(sql, valores), release() { liberaciones++; },
  }) });
  await db.exec(`
    CREATE TABLE rol (id_rol int PRIMARY KEY, nombre text);
    CREATE TABLE usuario (id_usuario int PRIMARY KEY, id_rol int, activo boolean, permiso_inventario text);
    CREATE TABLE laboratorio (id_laboratorio int PRIMARY KEY, id_sede int);
    CREATE TABLE usuario_sede (id_usuario_sede int, id_usuario int, id_sede int);
    CREATE TABLE usuario_laboratorio (id_usuario_sede int, id_sede int, id_laboratorio int);
    CREATE TABLE categoria (id_categoria int PRIMARY KEY);
    CREATE TABLE estado (id_estado int PRIMARY KEY);
    CREATE TABLE equipo (id_equipo serial PRIMARY KEY, nombre text NOT NULL,
      numero_serie text UNIQUE, placa_institucional text UNIQUE, marca text, modelo text,
      anio int, caracteristicas text, comentarios text, ubicacion_detalle text,
      id_categoria int REFERENCES categoria, id_estado int REFERENCES estado,
      id_laboratorio int REFERENCES laboratorio);
    CREATE TABLE prueba_auditoria (operacion text, usuario text);
    CREATE FUNCTION prueba_contexto() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO prueba_auditoria VALUES (TG_OP, current_setting('app.usuario_id', true));
      RETURN NEW; END $$;
    CREATE TRIGGER prueba_contexto AFTER INSERT OR UPDATE ON equipo
      FOR EACH ROW EXECUTE FUNCTION prueba_contexto();
    INSERT INTO rol VALUES (1,'Tecnico'), (2,'Superadministrador');
    INSERT INTO usuario VALUES (10,1,true,'edicion'), (20,1,true,'consulta'),
      (30,2,true,'edicion'), (40,1,false,'edicion');
    INSERT INTO laboratorio VALUES (1,1),(2,1),(3,2);
    INSERT INTO usuario_sede VALUES (1,10,1),(2,20,1);
    INSERT INTO usuario_laboratorio VALUES (1,1,1),(1,1,2),(2,1,1);
    INSERT INTO categoria VALUES (1);
    INSERT INTO estado VALUES (1),(2);
    INSERT INTO equipo (nombre, placa_institucional, id_categoria, id_estado, id_laboratorio)
      VALUES ('Original','P-1',1,1,1);
    TRUNCATE prueba_auditoria;
  `);
  const consultar = async () => (await db.query('SELECT * FROM equipo WHERE id_equipo=1')).rows[0];
  await t.test('registra con contexto del usuario disponible para los triggers', async () => {
    const r = await ejecutar(controlador, 'crearEquipo', { ...equipoValido, anio: '2024' });
    assert.equal(r.codigo, 201);
    assert.equal(r.datos.data.anio, 2024);
    assert.equal((await db.query('SELECT usuario FROM prueba_auditoria ORDER BY operacion')).rows[0].usuario, '10');
  });
  await t.test('edición parcial conserva estado y ubicación actuales', async () => {
    await db.query("UPDATE equipo SET id_estado=2, id_laboratorio=2, ubicacion_detalle='Mesa nueva' WHERE id_equipo=1");
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { comentarios: 'Editado' })).codigo, 200);
    const guardado = await consultar();
    assert.equal(guardado.id_estado, 2);
    assert.equal(guardado.id_laboratorio, 2);
    assert.equal(guardado.ubicacion_detalle, 'Mesa nueva');
    assert.equal(guardado.comentarios, 'Editado');
  });
  await t.test('traslado y cambio de estado autorizados se guardan', async () => {
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { id_laboratorio: 1, ubicacion_detalle: 'Mesa 1' })).codigo, 200);
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { id_estado: 1 })).codigo, 200);
    assert.equal((await consultar()).id_laboratorio, 1);
    assert.equal((await consultar()).id_estado, 1);
  });
  await t.test('rechaza destinos no autorizados sin modificar el equipo', async () => {
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { id_laboratorio: 3 })).codigo, 403);
    assert.equal((await consultar()).id_laboratorio, 1);
  });
  await t.test('solo consulta y cuentas inactivas no pueden escribir', async () => {
    for (const usuario of [20,40]) {
      assert.equal((await ejecutar(controlador, 'actualizarEquipo', { nombre: 'No permitido' }, '1', usuario)).codigo, 403);
      assert.equal((await ejecutar(controlador, 'crearEquipo', equipoValido, '1', usuario)).codigo, 403);
    }
    assert.equal((await consultar()).nombre, 'Original');
  });
  await t.test('duplicados y relaciones inexistentes se revierten', async () => {
    assert.equal((await ejecutar(controlador, 'crearEquipo', { ...equipoValido, placa_institucional: 'P-1' })).codigo, 409);
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { id_estado: 999 })).codigo, 400);
    assert.equal((await consultar()).id_estado, 1);
  });
  await t.test('superadministrador puede trasladar fuera de asignaciones; el técnico no puede editar allí', async () => {
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { id_laboratorio: 3 }, '1', 30)).codigo, 200);
    assert.equal((await ejecutar(controlador, 'actualizarEquipo', { comentarios: 'No permitido' })).codigo, 403);
    assert.equal((await consultar()).comentarios, 'Editado');
  });
  assert.ok(liberaciones > 0);
});
