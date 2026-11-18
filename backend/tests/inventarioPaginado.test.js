const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { consultarPaginaInventario } = require('../src/services/inventarioPaginado');

test('paginación y filtros contra PostgreSQL temporal', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE sede (id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio (id_laboratorio int PRIMARY KEY, id_sede int, codigo text, nombre text);
    CREATE TABLE categoria (id_categoria int PRIMARY KEY, nombre text);
    CREATE TABLE estado (id_estado int PRIMARY KEY, nombre text);
    CREATE TABLE equipo (id_equipo int PRIMARY KEY, nombre text, numero_serie text,
      placa_institucional text, marca text, modelo text, ubicacion_detalle text,
      id_categoria int, id_estado int, id_laboratorio int);
    CREATE TABLE usuario_sede (id_usuario_sede int, id_usuario int, id_sede int);
    CREATE TABLE usuario_laboratorio (id_usuario_sede int, id_sede int, id_laboratorio int);
    INSERT INTO sede VALUES (1, 'Heredia'), (2, 'San José');
    INSERT INTO laboratorio VALUES (1,1,'H1','Laboratorio A'), (2,1,'H2','Laboratorio B'),
      (3,2,'S1','Laboratorio reservado');
    INSERT INTO categoria VALUES (1,'Cómputo'), (2,'Proyección');
    INSERT INTO estado VALUES (1,'Operativo'), (2,'En mantenimiento');
    INSERT INTO usuario_sede VALUES (1,10,1), (2,20,2), (3,30,1);
    INSERT INTO usuario_laboratorio VALUES (1,1,1), (1,1,2), (2,2,3), (3,1,1);
    INSERT INTO equipo
      SELECT i, CASE WHEN i = 1 THEN 'Cámara 100%' ELSE 'Equipo ' || i END,
        'SER-' || i, 'PL_' || i, 'Marca', 'Modelo', 'Estación ' || i,
        CASE WHEN i > 10 THEN 2 ELSE 1 END, CASE WHEN i % 2 = 0 THEN 2 ELSE 1 END,
        CASE WHEN i > 12 THEN 3 WHEN i > 6 THEN 2 ELSE 1 END
      FROM generate_series(1,18) i;
  `);
  const usuario = { idUsuario: 10, rol: 'Tecnico' };
  const admin = { idUsuario: 99, rol: 'Superadministrador' };

  await t.test('limita la página y cuenta todos los equipos autorizados', async () => {
    const r = await consultarPaginaInventario(db, {}, usuario);
    assert.equal(r.total, 12);
    assert.equal(r.total_autorizados, 12);
    assert.equal(r.data.length, 5);
    assert.deepEqual(r.data.map(e => e.id_equipo), [12, 11, 10, 9, 8]);
    assert.equal(r.paginas, 3);
    assert.deepEqual(r.opciones.sede, ['Heredia']);
    assert.ok(!r.opciones.laboratorio.includes('Laboratorio reservado'));
  });
  await t.test('segunda y última página, incluso si la solicitada ya no existe', async () => {
    const segunda = await consultarPaginaInventario(db, { pagina: '2' }, usuario);
    assert.deepEqual(segunda.data.map(e => e.id_equipo), [7, 6, 5, 4, 3]);
    const ultima = await consultarPaginaInventario(db, { pagina: '999' }, usuario);
    assert.equal(ultima.pagina, 3);
    assert.deepEqual(ultima.data.map(e => e.id_equipo), [2, 1]);
  });
  await t.test('combina filtros y conserva opciones fuera de la página visible', async () => {
    const r = await consultarPaginaInventario(db, { categoria: 'COMPUTO', estado: 'operativo' }, usuario);
    assert.equal(r.total, 5);
    assert.ok(r.data.every(e => e.id_categoria === 1 && e.id_estado === 1));
    assert.ok(r.opciones.categoria.includes('Proyección'));
    assert.equal(r.opciones.laboratorio.length, 2);
  });
  await t.test('busca sin tildes y trata porcentajes y guiones bajos literalmente', async () => {
    assert.equal((await consultarPaginaInventario(db, { busqueda: 'camara' }, usuario)).total, 1);
    assert.equal((await consultarPaginaInventario(db, { busqueda: '100%' }, usuario)).total, 1);
    assert.equal((await consultarPaginaInventario(db, { busqueda: 'PL_1' }, usuario)).total, 4);
    assert.equal((await consultarPaginaInventario(db, { busqueda: "' OR 1=1 --" }, usuario)).total, 0);
    assert.equal((await consultarPaginaInventario(db, { busqueda: 'estacion 12' }, usuario)).total, 1);
  });
  await t.test('no filtra solo la página actual ni muestra equipos ajenos', async () => {
    const r = await consultarPaginaInventario(db, { busqueda: 'SER-1' }, usuario);
    assert.equal(r.total, 4);
    assert.ok(r.data.every(e => e.id_laboratorio !== 3));
    const restringido = await consultarPaginaInventario(db, { laboratorio: 'Laboratorio B' },
      { idUsuario: 30, rol: 'Administrador' });
    assert.equal(restringido.total, 0);
    assert.deepEqual(restringido.opciones.laboratorio, ['Laboratorio A']);
  });
  await t.test('superadministrador ve todas las sedes; laboratorios dependen de sede', async () => {
    const completo = await consultarPaginaInventario(db, {}, admin);
    assert.equal(completo.total, 18);
    const r = await consultarPaginaInventario(db, { sede: 'san jose' }, admin);
    assert.equal(r.total, 6);
    assert.deepEqual(r.opciones.laboratorio, ['Laboratorio reservado']);
  });
  await t.test('sin coincidencias o asignaciones devuelve una página vacía válida', async () => {
    const r = await consultarPaginaInventario(db, { busqueda: 'no existe', pagina: '3' }, usuario);
    assert.equal(r.total, 0);
    assert.equal(r.pagina, 1);
    assert.deepEqual(r.data, []);
    const sinAcceso = await consultarPaginaInventario(db, {}, { idUsuario: 80, rol: 'Tecnico' });
    assert.equal(sinAcceso.total_autorizados, 0);
    assert.deepEqual(sinAcceso.opciones.sede, []);
  });
});

test('rechaza parámetros inválidos antes de consultar la base', async () => {
  const db = { query() { assert.fail('No debe consultar'); } };
  const usuario = { idUsuario: 10, rol: 'Tecnico' };
  for (const query of [{ pagina: '0' }, { pagina: '1x' }, { pagina: ['1','2'] },
    { limite: '101' }, { limite: '-1' }, { sede: {} }, { busqueda: 'a'.repeat(201) }]) {
    await assert.rejects(() => consultarPaginaInventario(db, query, usuario), error => error.status === 400);
  }
  await assert.rejects(() => consultarPaginaInventario(db, {}, {}), error => error.status === 403);
});
