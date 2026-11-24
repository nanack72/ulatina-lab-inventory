const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { presentarHistorial } = require('../src/services/nombresHistorial');
const { nombreCampo } = require('../src/utils/nombresCampos');

test('resuelve nombres de categorías y estados conservando valores de auditoría', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE categoria(id_categoria int, nombre text);
    CREATE TABLE estado(id_estado int, nombre text);
    INSERT INTO categoria VALUES(1,'Computadoras portátiles'),(2,'Instrumentos de medición');
    INSERT INTO estado VALUES(1,'Operativo');`);
  const originales = [
    { campo_modificado: 'id_categoria', valor_anterior: '1', valor_nuevo: '2' },
    { accion: 'Modificación: id_estado', valor_anterior: null, valor_nuevo: '1' },
    { campo_modificado: 'id_categoria', valor_anterior: '999', valor_nuevo: 'Categoría histórica' },
    { campo_modificado: 'anio', valor_anterior: '2020', valor_nuevo: '2024' },
  ];
  const resultado = await presentarHistorial(db, originales);
  assert.equal(resultado[0].valor_anterior_visible, 'Computadoras portátiles');
  assert.equal(resultado[0].valor_nuevo_visible, 'Instrumentos de medición');
  assert.equal(resultado[0].valor_anterior, '1');
  assert.equal(resultado[0].valor_nuevo, '2');
  assert.equal(resultado[1].valor_anterior_visible, 'Sin registrar');
  assert.equal(resultado[1].valor_nuevo_visible, 'Operativo');
  assert.equal(resultado[2].valor_anterior_visible, 'Categoría no disponible');
  assert.equal(resultado[2].valor_nuevo_visible, 'Categoría histórica');
  assert.equal(resultado[3].valor_nuevo, '2024');
  assert.equal(originales[0].valor_anterior_visible, undefined);
});

test('etiquetas de validación comprensibles sin cambiar los campos internos', () => {
  assert.equal(nombreCampo('numero_serie'), 'número de serie');
  assert.equal(nombreCampo('placa_institucional'), 'placa institucional');
  assert.equal(nombreCampo('id_laboratorio'), 'laboratorio');
  assert.equal(nombreCampo('ubicacion_detalle'), 'ubicación detallada');
  const { validarEntradaMantenimiento } = require('../src/utils/validacionMantenimiento');
  assert.equal(
    validarEntradaMantenimiento({ id_equipo: 'abc' }),
    'Seleccione un valor válido para equipo.'
  );
});

test('incidencias rechaza un equipo eliminado y libera la transacción', async (t) => {
  const fs = require('node:fs'),
    path = require('node:path'),
    vm = require('node:vm');
  const { createRequire } = require('node:module');
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE estado(id_estado int, nombre text); INSERT INTO estado VALUES(1,'Operativo');
    CREATE TABLE equipo(id_equipo int, id_laboratorio int, nombre text, id_estado int, eliminado_en timestamptz);
    INSERT INTO equipo VALUES(1,1,'Equipo eliminado',1,NOW());`);
  const consultas = [];
  let liberado = false;
  let permitido = true;
  const pool = {
    connect: async () => ({
      async query(sql, valores) {
        consultas.push(sql);
        return db.query(sql.replace(/FOR SHARE OF e/g, ''), valores);
      },
      release() {
        liberado = true;
      },
    }),
  };
  const archivo = path.resolve(__dirname, '../src/controllers/incidenciasController.js');
  const local = createRequire(archivo),
    modulo = { exports: {} };
  vm.runInNewContext(fs.readFileSync(archivo, 'utf8'), {
    module: modulo,
    console,
    require: (n) =>
      n === '../config/database'
        ? pool
        : n === '../utils/accesoEquipos'
          ? { verificarAccesoEquipo: async () => permitido }
          : local(n),
  });
  const res = {
    codigo: 200,
    status(c) {
      this.codigo = c;
      return this;
    },
    json(d) {
      this.datos = d;
      return this;
    },
  };
  await modulo.exports.crearIncidencia(
    {
      body: { id_equipo: 1, titulo: 'Revisar equipo', descripcion_falla: 'Falla de prueba' },
      usuario: { idUsuario: 1, rol: 'Superadministrador' },
    },
    res
  );
  assert.equal(res.codigo, 404);
  assert.equal(liberado, true);
  assert.ok(consultas.some((sql) => sql.includes('FOR SHARE OF e')));
  assert.ok(consultas.includes('ROLLBACK'));
  assert.ok(!consultas.some((sql) => sql.includes('INSERT INTO')));
  await db.exec(`UPDATE equipo SET eliminado_en=NULL;
    CREATE TABLE incidencia_reporte(id_incidencia serial PRIMARY KEY,id_equipo int,id_usuario_reporta int,
      titulo text,descripcion_falla text,prioridad text,estado_incidencia text,fecha_reporte timestamptz);`);
  await modulo.exports.crearIncidencia(
    {
      body: { id_equipo: 1, titulo: 'Equipo activo', descripcion_falla: 'Falla de prueba' },
      usuario: { idUsuario: 1, rol: 'Superadministrador' },
    },
    res
  );
  assert.equal(res.codigo, 201);
  assert.ok(consultas.includes('COMMIT'));
  assert.equal(
    (await db.query('SELECT count(*)::int AS total FROM incidencia_reporte')).rows[0].total,
    1
  );
  permitido = false;
  await modulo.exports.crearIncidencia(
    {
      body: { id_equipo: 1, titulo: 'Sin acceso', descripcion_falla: 'Falla de prueba' },
      usuario: { idUsuario: 2, rol: 'Tecnico' },
    },
    res
  );
  assert.equal(res.codigo, 403);
  assert.equal(
    (await db.query('SELECT count(*)::int AS total FROM incidencia_reporte')).rows[0].total,
    1
  );
});
