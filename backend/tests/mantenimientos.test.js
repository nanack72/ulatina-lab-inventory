const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');
const { obtenerBaseUrl, cerrarServidorTest, obtenerCredencialesTest } = require('./testHelper');

// PNG mínimo válido (1x1 píxel transparente) para probar subida real con Multer
const PNG_MINIMO = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

async function obtenerTokenAdmin(baseUrl) {
  const credenciales = obtenerCredencialesTest();
  const resp = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciales)
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

test('Mantenimientos e Incidencias - Control de acceso, reglas de negocio y trazabilidad', async (t) => {
  let baseUrl;
  let token;

  t.before(async () => {
    baseUrl = await obtenerBaseUrl();
    token = await obtenerTokenAdmin(baseUrl);
  });

  t.after(async () => {
    cerrarServidorTest();
    await pool.end();
  });

  await t.test('Debe listar mantenimientos con estructura válida y conteo de evidencias', async () => {
    const respuesta = await fetch(`${baseUrl}/mantenimientos?pagina=1&limite=5`, {
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
    const respuesta = await fetch(`${baseUrl}/incidencias`, {
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
      const respDirectoCompletado = await fetch(`${baseUrl}/mantenimientos`, {
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
      const respCrear = await fetch(`${baseUrl}/mantenimientos`, {
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
      const respDuplicado = await fetch(`${baseUrl}/mantenimientos`, {
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
      const respSinFotos = await fetch(`${baseUrl}/mantenimientos/${idBitacoraCreada}/estado`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado_mantenimiento: 'Completado' })
      });
      assert.strictEqual(respSinFotos.status, 400);

      // 5. RU09: subir solo foto 'Antes' todavía bloquea cierre hasta tener 'Después'
      const respFotoAntes = await subirFotoPrueba(baseUrl, token, idBitacoraCreada, 'Antes');
      assert.strictEqual(respFotoAntes.status, 201);
      const jsonFotoAntes = await respFotoAntes.json();
      archivosSubidos.push(jsonFotoAntes.data.url_foto);

      const respSoloAntes = await fetch(`${baseUrl}/mantenimientos/${idBitacoraCreada}/estado`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado_mantenimiento: 'Completado' })
      });
      assert.strictEqual(respSoloAntes.status, 400);

      // 6. Subir foto 'Después' y finalizar -> RF22 / RN13 devuelve el equipo a 'Operativo'
      const respFotoDespues = await subirFotoPrueba(baseUrl, token, idBitacoraCreada, 'Después');
      assert.strictEqual(respFotoDespues.status, 201);
      const jsonFotoDespues = await respFotoDespues.json();
      archivosSubidos.push(jsonFotoDespues.data.url_foto);

      const respCerrar = await fetch(`${baseUrl}/mantenimientos/${idBitacoraCreada}/estado`, {
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
      const respReabrir = await fetch(`${baseUrl}/mantenimientos/${idBitacoraCreada}/estado`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado_mantenimiento: 'En Proceso' })
      });
      assert.strictEqual(respReabrir.status, 409);

      const respFotoPostCierre = await subirFotoPrueba(baseUrl, token, idBitacoraCreada, 'Durante');
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
