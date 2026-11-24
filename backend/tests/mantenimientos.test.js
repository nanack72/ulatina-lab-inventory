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
  throw new Error('Configure TEST_API_URL, TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en el entorno de pruebas.');
}

// PNG mínimo válido (1x1 píxel transparente) para probar subida real con Multer
const PNG_MINIMO = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

async function obtenerTokenAdmin() {
  const resp = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correo: process.env.TEST_ADMIN_EMAIL,
      contrasena: process.env.TEST_ADMIN_PASSWORD
    })
  });
  const json = await resp.json();
  return json.token;
}

async function subirFotoPrueba(baseUrl, token, idBitacora, tipoEvidencia) {
  const form = new FormData();
  form.append('id_bitacora', String(idBitacora));
  form.append('tipo_evidencia', tipoEvidencia);
  form.append('descripcion', `Foto de prueba ${tipoEvidencia}`);
  form.append('foto', new Blob([PNG_MINIMO], { type: 'image/png' }), `prueba_${tipoEvidencia.toLowerCase()}.png`);

  return fetch(`${baseUrl}/evidencias`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
}

test('Reglas de negocio de mantenimientos: RF21/RN12, RN16, RN14/RU09, RF22/RN13 y RN11 (PGlite)', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE TABLE sede(id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio(id_laboratorio int PRIMARY KEY, id_sede int, codigo text, nombre text);
    CREATE TABLE estado(id_estado serial PRIMARY KEY, nombre text UNIQUE, descripcion text);
    CREATE TABLE usuario(id_usuario int PRIMARY KEY, nombre_completo text, correo_institucional text);
    CREATE TABLE usuario_sede(id_usuario_sede int, id_usuario int, id_sede int);
    CREATE TABLE usuario_laboratorio(id_usuario_sede int, id_sede int, id_laboratorio int);
    CREATE TABLE equipo(id_equipo int PRIMARY KEY, id_laboratorio int, id_estado int, nombre text, placa_institucional text, numero_serie text, marca text, modelo text, anio int, caracteristicas text, comentarios text, ubicacion_detalle text, eliminado_en timestamptz);
    CREATE TABLE bitacora_mantenimiento(
      id_bitacora serial PRIMARY KEY,
      id_equipo int,
      id_usuario_tecnico int,
      tipo_mantenimiento text,
      motivo_falla text,
      descripcion_trabajo text,
      horas_invertidas numeric,
      fecha_mantenimiento timestamptz,
      estado_mantenimiento text
    );
    CREATE TABLE evidencia_fotografica(
      id_evidencia serial PRIMARY KEY,
      id_bitacora int,
      tipo_evidencia text,
      url_foto text,
      descripcion text,
      fecha_subida timestamptz DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE historial_estado(
      id_historial_estado serial PRIMARY KEY,
      id_equipo int,
      id_estado_anterior int,
      id_estado_nuevo int,
      motivo text
    );
    INSERT INTO sede VALUES (1, 'Heredia');
    INSERT INTO laboratorio VALUES (1, 1, 'LAB-01', 'Laboratorio 1');
    INSERT INTO estado (id_estado, nombre, descripcion) VALUES
      (1, 'Operativo', 'Equipo operativo'),
      (2, 'En mantenimiento', 'Equipo en mantenimiento'),
      (3, 'Dado de baja', 'Equipo dado de baja');
    INSERT INTO usuario VALUES (1, 'Admin', 'admin@ulatina.cr');
    INSERT INTO equipo (id_equipo, id_laboratorio, id_estado, nombre, placa_institucional, numero_serie, marca, modelo, eliminado_en)
      VALUES (10, 1, 1, 'Osciloscopio Digital', 'PLA-010', 'SER-010', 'Tektronix', 'TBS1052B', NULL);
  `);

  const poolFalso = {
    query: (sql, args) => db.query(sql, args),
    connect: async () => ({
      query: (sql, args) => {
        if (/set_config/i.test(sql)) return Promise.resolve({ rows: [], rowCount: 0 });
        return db.query(sql.replace(/FOR UPDATE OF [a-z, ]+/gi, ''), args);
      },
      release() {}
    })
  };

  const archivoCtrl = path.join(__dirname, '../src/controllers/mantenimientosController.js');
  const localReq = createRequire(archivoCtrl);
  const moduloCtrl = { exports: {} };
  vm.runInNewContext(fs.readFileSync(archivoCtrl, 'utf8'), {
    module: moduloCtrl,
    console,
    require: (n) => {
      if (n === '../config/database') return poolFalso;
      if (n === '../utils/accesoEquipos') return { verificarAccesoEquipo: async () => true };
      return localReq(n);
    }
  });

  const invocar = async (fn, req) => {
    const res = {
      codigo: 200,
      status(c) {
        this.codigo = c;
        return this;
      },
      json(d) {
        this.body = d;
        return this;
      }
    };
    await fn({ ...req, usuario: { idUsuario: 1, rol: 'Superadministrador' } }, res);
    return res;
  };

  // 1. RN14: no permite registrar directamente como Completado
  const directo = await invocar(moduloCtrl.exports.crearMantenimiento, {
    body: {
      id_equipo: 10,
      tipo_mantenimiento: 'Preventivo',
      descripcion_trabajo: 'Intento directo completado',
      horas_invertidas: 1,
      estado_mantenimiento: 'Completado'
    }
  });
  assert.strictEqual(directo.codigo, 400);

  // 2. RF21 / RN12: abrir un Correctivo cambia el equipo a 'En mantenimiento'
  const creado = await invocar(moduloCtrl.exports.crearMantenimiento, {
    body: {
      id_equipo: 10,
      tipo_mantenimiento: 'Correctivo',
      motivo_falla: 'Falla de calibración',
      descripcion_trabajo: 'Ajuste de etapa de entrada',
      horas_invertidas: 2
    }
  });
  assert.strictEqual(creado.codigo, 201);
  const idBitacora = creado.body.data.id_bitacora;

  const estadoEquipoAbierto = await db.query(
    'SELECT es.nombre FROM equipo e JOIN estado es ON e.id_estado = es.id_estado WHERE e.id_equipo = 10'
  );
  assert.strictEqual(estadoEquipoAbierto.rows[0].nombre, 'En mantenimiento');

  // 3. RN16: bloquea un segundo Correctivo activo en el mismo equipo
  const duplicado = await invocar(moduloCtrl.exports.crearMantenimiento, {
    body: {
      id_equipo: 10,
      tipo_mantenimiento: 'Correctivo',
      descripcion_trabajo: 'Segundo correctivo simultáneo',
      horas_invertidas: 1
    }
  });
  assert.strictEqual(duplicado.codigo, 409);

  // 4. RN14 / RU09: bloquea cierre de Correctivo sin fotos Antes y Después
  const cierreSinFotos = await invocar(moduloCtrl.exports.actualizarEstadoMantenimiento, {
    params: { id: String(idBitacora) },
    body: { estado_mantenimiento: 'Completado' }
  });
  assert.strictEqual(cierreSinFotos.codigo, 400);

  await db.query(
    `INSERT INTO evidencia_fotografica (id_bitacora, tipo_evidencia, url_foto) VALUES ($1, 'Antes', '/uploads/evidencias/a.png')`,
    [idBitacora]
  );
  const cierreSoloAntes = await invocar(moduloCtrl.exports.actualizarEstadoMantenimiento, {
    params: { id: String(idBitacora) },
    body: { estado_mantenimiento: 'Completado' }
  });
  assert.strictEqual(cierreSoloAntes.codigo, 400);

  // 5. RF22 / RN13: al adjuntar foto Después y cerrar, el equipo regresa a 'Operativo'
  await db.query(
    `INSERT INTO evidencia_fotografica (id_bitacora, tipo_evidencia, url_foto) VALUES ($1, 'Después', '/uploads/evidencias/d.png')`,
    [idBitacora]
  );
  const cierreExitoso = await invocar(moduloCtrl.exports.actualizarEstadoMantenimiento, {
    params: { id: String(idBitacora) },
    body: { estado_mantenimiento: 'Completado' }
  });
  assert.strictEqual(cierreExitoso.codigo, 200);
  assert.strictEqual(cierreExitoso.body.data.estado_mantenimiento, 'Completado');

  const estadoEquipoCerrado = await db.query(
    'SELECT es.nombre FROM equipo e JOIN estado es ON e.id_estado = es.id_estado WHERE e.id_equipo = 10'
  );
  assert.strictEqual(estadoEquipoCerrado.rows[0].nombre, 'Operativo');

  // 6. RN11: una orden finalizada es de solo consulta
  const reabrir = await invocar(moduloCtrl.exports.actualizarEstadoMantenimiento, {
    params: { id: String(idBitacora) },
    body: { estado_mantenimiento: 'En Proceso' }
  });
  assert.strictEqual(reabrir.codigo, 409);

  // 7. Listado paginado incluye total_evidencias
  const listado = await invocar(moduloCtrl.exports.obtenerMantenimientos, {
    query: { pagina: '1', limite: '10' }
  });
  assert.strictEqual(listado.codigo, 200);
  assert.strictEqual(listado.body.data[0].total_evidencias, 2);
});

test('Punto #13: bloqueo sobre equipos eliminados (eliminado_en), conservación histórica y visibilidad global de Coordinador/Director (PGlite)', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    CREATE TABLE sede(id_sede int PRIMARY KEY, nombre text);
    CREATE TABLE laboratorio(id_laboratorio int PRIMARY KEY, id_sede int, codigo text, nombre text);
    CREATE TABLE estado(id_estado serial PRIMARY KEY, nombre text UNIQUE, descripcion text);
    CREATE TABLE usuario(id_usuario int PRIMARY KEY, nombre_completo text, correo_institucional text);
    CREATE TABLE usuario_sede(id_usuario_sede int, id_usuario int, id_sede int);
    CREATE TABLE usuario_laboratorio(id_usuario_sede int, id_sede int, id_laboratorio int);
    CREATE TABLE equipo(
      id_equipo int PRIMARY KEY,
      id_laboratorio int,
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
      fecha_mantenimiento timestamptz,
      estado_mantenimiento text
    );
    CREATE TABLE evidencia_fotografica(
      id_evidencia serial PRIMARY KEY,
      id_bitacora int,
      tipo_evidencia text,
      url_foto text,
      descripcion text
    );
    CREATE TABLE incidencia_reporte(
      id_incidencia serial PRIMARY KEY,
      id_equipo int,
      id_usuario_reporta int,
      titulo text,
      descripcion_falla text,
      prioridad text,
      estado_incidencia text,
      fecha_reporte timestamptz
    );
    INSERT INTO sede VALUES (1, 'Heredia');
    INSERT INTO laboratorio VALUES (1, 1, 'LAB-01', 'Lab 1'), (2, 1, 'LAB-02', 'Lab 2');
    INSERT INTO estado (id_estado, nombre, descripcion) VALUES (1, 'Operativo', 'Operativo');
    INSERT INTO usuario VALUES
      (1, 'Admin', 'admin@ulatina.cr'),
      (2, 'Técnico Lab 1', 'tec@ulatina.cr'),
      (3, 'Coordinadora', 'coord@ulatina.cr'),
      (4, 'Director', 'dir@ulatina.cr');
    INSERT INTO usuario_sede VALUES (1, 2, 1);
    INSERT INTO usuario_laboratorio VALUES (1, 1, 1);
    INSERT INTO equipo (id_equipo, id_laboratorio, id_estado, nombre, placa_institucional, numero_serie, marca, modelo, eliminado_en) VALUES
      (10, 1, 1, 'Equipo Eliminado', 'PLA-DEL', 'SER-DEL', 'Dell', 'OptiPlex', '2026-11-20 10:00:00+00'),
      (20, 2, 1, 'Equipo Activo Lab 2', 'PLA-ACT', 'SER-ACT', 'HP', 'ProDesk', NULL);
    INSERT INTO bitacora_mantenimiento (id_equipo, id_usuario_tecnico, tipo_mantenimiento, descripcion_trabajo, horas_invertidas, fecha_mantenimiento, estado_mantenimiento) VALUES
      (10, 2, 'Preventivo', 'Mantenimiento histórico previo a eliminación', 1, '2026-11-10 10:00:00+00', 'Completado'),
      (20, 1, 'Preventivo', 'Mantenimiento en Lab 2', 1, '2026-11-15 10:00:00+00', 'Completado');
    INSERT INTO incidencia_reporte (id_equipo, id_usuario_reporta, titulo, descripcion_falla, prioridad, estado_incidencia, fecha_reporte) VALUES
      (10, 2, 'Incidencia histórica', 'Falla registrada antes de eliminar', 'Media', 'Resuelta', '2026-11-05 10:00:00+00');
  `);

  const poolFalso = {
    query: (sql, args) => db.query(sql, args),
    connect: async () => ({
      query: (sql, args) => {
        if (/set_config/i.test(sql)) return Promise.resolve({ rows: [], rowCount: 0 });
        return db.query(sql.replace(/FOR UPDATE OF [a-z, ]+/gi, ''), args);
      },
      release() {}
    })
  };

  const cargarControlador = (rutaRelativa) => {
    const archivo = path.join(__dirname, rutaRelativa);
    const localReq = createRequire(archivo);
    const mod = { exports: {} };
    vm.runInNewContext(fs.readFileSync(archivo, 'utf8'), {
      module: mod,
      console,
      require: (n) => {
        if (n === '../config/database') return poolFalso;
        if (n === '../utils/accesoEquipos') return { verificarAccesoEquipo: async () => true };
        return localReq(n);
      }
    });
    return mod.exports;
  };

  const mantCtrl = cargarControlador('../src/controllers/mantenimientosController.js');
  const incCtrl = cargarControlador('../src/controllers/incidenciasController.js');
  const { listarMantenimientos } = require('../src/services/mantenimientosListado');

  const invocar = async (fn, req, usuario = { idUsuario: 1, rol: 'Superadministrador' }) => {
    const res = {
      codigo: 200,
      status(c) { this.codigo = c; return this; },
      json(d) { this.body = d; return this; }
    };
    await fn({ ...req, usuario }, res);
    return res;
  };

  // 1. Bloquear nuevo mantenimiento sobre equipo eliminado lógicamente (409)
  const mantEliminado = await invocar(mantCtrl.crearMantenimiento, {
    body: {
      id_equipo: 10,
      tipo_mantenimiento: 'Preventivo',
      descripcion_trabajo: 'Intento sobre equipo eliminado',
      horas_invertidas: 1
    }
  });
  assert.strictEqual(mantEliminado.codigo, 409);

  // 2. Bloquear nueva incidencia sobre equipo eliminado lógicamente (409)
  const incEliminada = await invocar(incCtrl.crearIncidencia, {
    body: {
      id_equipo: 10,
      titulo: 'Falla en equipo eliminado',
      descripcion_falla: 'No debe permitirse registrar',
      prioridad: 'Alta'
    }
  });
  assert.strictEqual(incEliminada.codigo, 409);

  // 3. Conservar antecedentes históricos del equipo eliminado en consultas GET
  const histMant = await invocar(mantCtrl.obtenerHistorialPorEquipo, {
    params: { idEquipo: '10' }
  });
  assert.strictEqual(histMant.codigo, 200);
  assert.strictEqual(histMant.body.total, 1);

  const histInc = await invocar(incCtrl.obtenerIncidencias, { query: {} });
  assert.strictEqual(histInc.codigo, 200);
  assert.strictEqual(histInc.body.total, 1);
  assert.strictEqual(histInc.body.data[0].id_equipo, 10);

  // 4. Visibilidad global en listarMantenimientos para Coordinador y Director vs Técnico restringido
  const vistaCoord = await listarMantenimientos(poolFalso, {}, { idUsuario: 3, rol: 'Coordinador' });
  const vistaDir = await listarMantenimientos(poolFalso, {}, { idUsuario: 4, rol: 'Director' });
  const vistaTec = await listarMantenimientos(poolFalso, {}, { idUsuario: 2, rol: 'Tecnico' });
  assert.strictEqual(vistaCoord.total, 2);
  assert.strictEqual(vistaDir.total, 2);
  assert.strictEqual(vistaTec.total, 1);
  assert.strictEqual(vistaTec.data[0].id_equipo, 10);
});

test('Mantenimientos e Incidencias - Control de acceso y trazabilidad', { skip: !integrar }, async (t) => {
  const pool = require('../src/config/database');
  let token;

  t.before(async () => {
    token = await obtenerTokenAdmin();
  });

  t.after(async () => {
    await pool.end();
  });

  await t.test('Debe listar mantenimientos con estructura paginada y conteo de evidencias', async () => {
    const respuesta = await fetch(`${BASE_URL}/mantenimientos?pagina=1&limite=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const json = await respuesta.json();

    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    if (json.data.length > 0) {
      assert.strictEqual(typeof json.data[0].total_evidencias, 'number');
    }
  });

  await t.test('Debe consultar incidencias técnicas y responder estructura válida', async () => {
    const respuesta = await fetch(`${BASE_URL}/incidencias`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(respuesta.status, 200);
    const json = await respuesta.json();

    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  await t.test('Ciclo completo de reglas: RF21/RN12, RN16, RN14/RU09, RF22/RN13 y RN11', async () => {
    // Buscar un equipo Operativo que no tenga correctivos activos
    const equipoRes = await pool.query(`
      SELECT e.id_equipo, e.id_estado
      FROM public.equipo e
      INNER JOIN public.estado es ON e.id_estado = es.id_estado
      WHERE LOWER(TRIM(es.nombre)) = 'operativo'
        AND NOT EXISTS (
          SELECT 1
          FROM public.bitacora_mantenimiento bm
          WHERE bm.id_equipo = e.id_equipo
            AND LOWER(bm.tipo_mantenimiento) = 'correctivo'
            AND LOWER(bm.estado_mantenimiento) IN ('en proceso', 'pendiente repuesto')
        )
      ORDER BY e.id_equipo ASC
      LIMIT 1
    `);

    assert.ok(equipoRes.rowCount > 0, 'Debe existir al menos un equipo Operativo disponible para la prueba');
    const idEquipo = equipoRes.rows[0].id_equipo;
    const estadoOriginal = equipoRes.rows[0].id_estado;

    let idBitacoraCreada = null;
    const archivosSubidos = [];

    try {
      // 1. RN14: no permite crear una orden directamente como Completado sin evidencias
      const respDirectoCompletado = await fetch(`${BASE_URL}/mantenimientos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id_equipo: idEquipo,
          tipo_mantenimiento: 'Preventivo',
          descripcion_trabajo: 'Intento de cierre sin evidencia',
          horas_invertidas: 1,
          estado_mantenimiento: 'Completado'
        })
      });
      assert.strictEqual(respDirectoCompletado.status, 400);

      // 2. RF21 / RN12: abrir un Correctivo sin id_nuevo_estado cambia el equipo a 'En mantenimiento'
      const respCrear = await fetch(`${BASE_URL}/mantenimientos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id_equipo: idEquipo,
          tipo_mantenimiento: 'Correctivo',
          motivo_falla: 'Prueba automatizada de flujo correctivo',
          descripcion_trabajo: 'Revisión técnica de prueba automatizada',
          horas_invertidas: 1.5,
          estado_mantenimiento: 'En Proceso'
        })
      });
      assert.strictEqual(respCrear.status, 201);
      const jsonCrear = await respCrear.json();
      idBitacoraCreada = jsonCrear.data.id_bitacora;
      assert.ok(jsonCrear.data.cambio_estado, 'El correctivo debe cambiar el estado del equipo automáticamente');

      const estadoTrasAbrir = await pool.query(
        `SELECT es.nombre FROM public.equipo e JOIN public.estado es ON e.id_estado = es.id_estado WHERE e.id_equipo = $1`,
        [idEquipo]
      );
      assert.strictEqual(estadoTrasAbrir.rows[0].nombre.toLowerCase(), 'en mantenimiento');

      // 3. RN16: no permite un segundo Correctivo simultáneo sobre el mismo equipo
      const respDuplicado = await fetch(`${BASE_URL}/mantenimientos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id_equipo: idEquipo,
          tipo_mantenimiento: 'Correctivo',
          descripcion_trabajo: 'Segundo correctivo simultáneo no permitido',
          horas_invertidas: 1
        })
      });
      assert.strictEqual(respDuplicado.status, 409);

      // 4. RN14 / RU09: no permite finalizar el Correctivo sin fotos
      const respSinFotos = await fetch(`${BASE_URL}/mantenimientos/${idBitacoraCreada}/estado`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado_mantenimiento: 'Completado' })
      });
      assert.strictEqual(respSinFotos.status, 400);

      // 5. RU09: subir solo foto 'Antes' todavía bloquea cierre hasta tener 'Después'
      const respFotoAntes = await subirFotoPrueba(BASE_URL, token, idBitacoraCreada, 'Antes');
      assert.strictEqual(respFotoAntes.status, 201);
      const jsonFotoAntes = await respFotoAntes.json();
      archivosSubidos.push(jsonFotoAntes.data.url_foto);

      const respSoloAntes = await fetch(`${BASE_URL}/mantenimientos/${idBitacoraCreada}/estado`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado_mantenimiento: 'Completado' })
      });
      assert.strictEqual(respSoloAntes.status, 400);

      // 6. Subir foto 'Después' y finalizar -> RF22 / RN13 devuelve el equipo a 'Operativo'
      const respFotoDespues = await subirFotoPrueba(BASE_URL, token, idBitacoraCreada, 'Después');
      assert.strictEqual(respFotoDespues.status, 201);
      const jsonFotoDespues = await respFotoDespues.json();
      archivosSubidos.push(jsonFotoDespues.data.url_foto);

      const respCerrar = await fetch(`${BASE_URL}/mantenimientos/${idBitacoraCreada}/estado`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado_mantenimiento: 'Completado' })
      });
      assert.strictEqual(respCerrar.status, 200);
      const jsonCerrar = await respCerrar.json();
      assert.strictEqual(jsonCerrar.data.estado_mantenimiento, 'Completado');
      assert.ok(jsonCerrar.data.cambio_estado, 'Al finalizar debe devolver el equipo a Operativo');

      const estadoTrasCerrar = await pool.query(
        `SELECT es.nombre FROM public.equipo e JOIN public.estado es ON e.id_estado = es.id_estado WHERE e.id_equipo = $1`,
        [idEquipo]
      );
      assert.strictEqual(estadoTrasCerrar.rows[0].nombre.toLowerCase(), 'operativo');

      // 7. RN11: una orden finalizada no puede modificarse ni recibir nuevas evidencias
      const respReabrir = await fetch(`${BASE_URL}/mantenimientos/${idBitacoraCreada}/estado`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado_mantenimiento: 'En Proceso' })
      });
      assert.strictEqual(respReabrir.status, 409);

      const respFotoPostCierre = await subirFotoPrueba(BASE_URL, token, idBitacoraCreada, 'Durante');
      assert.strictEqual(respFotoPostCierre.status, 409);
    } finally {
      // Limpieza de datos temporales de la prueba
      for (const urlFoto of archivosSubidos) {
        const nombreArchivo = path.basename(urlFoto);
        const rutaFisica = path.join(__dirname, '../uploads/evidencias', nombreArchivo);
        if (fs.existsSync(rutaFisica)) {
          fs.unlinkSync(rutaFisica);
        }
      }
      if (idBitacoraCreada) {
        await pool.query('DELETE FROM public.evidencia_fotografica WHERE id_bitacora = $1', [idBitacoraCreada]);
        await pool.query('DELETE FROM public.bitacora_mantenimiento WHERE id_bitacora = $1', [idBitacoraCreada]);
      }
      await pool.query('UPDATE public.equipo SET id_estado = $1 WHERE id_equipo = $2', [estadoOriginal, idEquipo]);
    }
  });
});
