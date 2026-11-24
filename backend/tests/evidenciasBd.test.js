const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const sharp = require('sharp');
const { PGlite } = require('@electric-sql/pglite');
const {
  detectarMimePorFirma,
  comprimirImagen
} = require('../src/utils/compresionImagen');

async function crearJpegGrande(ancho = 2400, alto = 1800) {
  // Genera una imagen con gradiente y textura para que tenga peso real antes de comprimir
  const canales = 3;
  const raw = Buffer.alloc(ancho * alto * canales);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const idx = (y * ancho + x) * canales;
      raw[idx] = (x * 7 + y * 3) & 255;
      raw[idx + 1] = (x * 5 + y * 11) & 255;
      raw[idx + 2] = ((x ^ y) * 13) & 255;
    }
  }
  return sharp(raw, { raw: { width: ancho, height: alto, channels: canales } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

test('Helper comprimirImagen (RNF03): redimensiona, reduce peso y rechaza archivos falsos', async () => {
  const original = await crearJpegGrande(2400, 1800);
  assert.equal(detectarMimePorFirma(original), 'image/jpeg');

  const resultado = await comprimirImagen(original);
  assert.equal(resultado.mime, 'image/webp');
  assert.equal(detectarMimePorFirma(resultado.buffer), 'image/webp');
  assert.equal(resultado.ancho, 1280);
  assert.equal(resultado.alto, 960);
  assert.ok(
    resultado.bytesFinales < resultado.bytesOriginales,
    `Esperaba reducción de peso: ${resultado.bytesFinales} vs ${resultado.bytesOriginales}`
  );

  await assert.rejects(
    () => comprimirImagen(Buffer.from('no soy una imagen real')),
    (err) => err.status === 400
  );
});

test('Migración 010 con pes_runtime: guarda y sirve evidencias comprimidas en PostgreSQL y mantiene respaldo histórico', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'pes-ev-hist-'));
  const archivoHistorico = path.join(dirTemporal, '1700000000000-hist01.png');
  const pngMinimo = await sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } }
  })
    .png()
    .toBuffer();
  fs.writeFileSync(archivoHistorico, pngMinimo);
  t.after(() => {
    fs.rmSync(dirTemporal, { recursive: true, force: true });
  });

  await db.exec(`
    CREATE ROLE pes_owner;
    CREATE ROLE pes_runtime;
    CREATE TABLE public.bitacora_mantenimiento (
      id_bitacora serial PRIMARY KEY,
      id_equipo int NOT NULL,
      estado_mantenimiento text NOT NULL
    );
    CREATE TABLE public.evidencia_fotografica (
      id_evidencia serial PRIMARY KEY,
      id_bitacora int NOT NULL REFERENCES public.bitacora_mantenimiento(id_bitacora),
      tipo_evidencia varchar(30) NOT NULL,
      url_foto varchar(255) NOT NULL,
      descripcion text,
      fecha_subida timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO public.bitacora_mantenimiento (id_bitacora, id_equipo, estado_mantenimiento) VALUES
      (1, 10, 'En Proceso'),
      (2, 10, 'Completado');
    -- Registro histórico previo a la migración 010 (sin columnas datos ni mime)
    INSERT INTO public.evidencia_fotografica (id_bitacora, tipo_evidencia, url_foto, descripcion) VALUES
      (1, 'Antes', '/uploads/evidencias/1700000000000-hist01.png', 'Evidencia previa en disco');

    ALTER TABLE public.bitacora_mantenimiento OWNER TO pes_owner;
    ALTER TABLE public.evidencia_fotografica OWNER TO pes_owner;
    ALTER SEQUENCE public.evidencia_fotografica_id_evidencia_seq OWNER TO pes_owner;
    GRANT SELECT ON public.bitacora_mantenimiento TO pes_runtime;
  `);

  const mig010 = fs.readFileSync(
    path.join(__dirname, '../../database/migrations/010_evidencias_en_bd.sql'),
    'utf8'
  );
  await db.exec(mig010);
  await db.exec('SET ROLE pes_runtime');

  const poolFalso = {
    query: (sql, args) => db.query(sql, args)
  };

  const archivoCtrl = path.join(__dirname, '../src/controllers/evidenciasController.js');
  const localReq = createRequire(archivoCtrl);
  const uploadReal = localReq('../middlewares/uploadMiddleware');
  const modCtrl = { exports: {} };

  vm.runInNewContext(fs.readFileSync(archivoCtrl, 'utf8'), {
    module: modCtrl,
    console,
    Buffer,
    require: (n) => {
      if (n === '../config/database') return poolFalso;
      if (n === '../utils/accesoEquipos') return { verificarAccesoEquipo: async () => true };
      if (n === '../middlewares/uploadMiddleware') {
        return {
          ...uploadReal,
          DIRECTORIO_EVIDENCIAS: dirTemporal
        };
      }
      return localReq(n);
    }
  });

  const invocar = async (fn, req) => {
    const res = {
      codigo: 200,
      headers: {},
      status(c) {
        this.codigo = c;
        return this;
      },
      set(h) {
        Object.assign(this.headers, h);
        return this;
      },
      json(d) {
        this.body = d;
        return this;
      },
      send(payload) {
        this.payload = payload;
        return this;
      },
      sendFile(ruta) {
        this.archivo = ruta;
        return this;
      }
    };
    await fn({ ...req, usuario: { idUsuario: 2, rol: 'Tecnico' } }, res);
    return res;
  };

  // 1. Subir evidencia grande: se comprime y se guarda en PostgreSQL bajo pes_runtime
  const fotoGrande = await crearJpegGrande(1920, 1080);
  const subida = await invocar(modCtrl.exports.subirEvidencia, {
    file: { buffer: fotoGrande, mimetype: 'image/jpeg', originalname: 'celular.jpg' },
    body: { id_bitacora: '1', tipo_evidencia: 'Después', descripcion: 'Foto comprimida en Neon' }
  });
  assert.equal(subida.codigo, 201);
  assert.equal(subida.body.data.mime, 'image/webp');
  assert.ok(subida.body.data.url_foto.startsWith('db://evidencias/'));
  assert.ok(subida.body.data.tamano_bytes < fotoGrande.length);
  assert.equal(subida.body.data.datos, undefined, 'La respuesta JSON nunca debe incluir el binario crudo');

  const idNueva = subida.body.data.id_evidencia;

  // 2. Servir la nueva evidencia directamente desde PostgreSQL (bytea)
  const descargaBd = await invocar(modCtrl.exports.obtenerArchivoEvidencia, {
    params: { id: String(idNueva) }
  });
  assert.equal(descargaBd.codigo, 200);
  assert.equal(descargaBd.headers['Content-Type'], 'image/webp');
  assert.equal(descargaBd.headers['Cache-Control'], 'private, no-store');
  assert.equal(descargaBd.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(detectarMimePorFirma(descargaBd.payload), 'image/webp');

  // 3. Respaldo en disco funciona únicamente para el registro histórico viejo sin datos en BD
  const descargaHist = await invocar(modCtrl.exports.obtenerArchivoEvidencia, {
    params: { id: '1' }
  });
  assert.equal(descargaHist.codigo, 200);
  assert.equal(descargaHist.archivo, archivoHistorico);

  // 4. RN11: bloquea subir evidencia en orden completada
  const bloqueada = await invocar(modCtrl.exports.subirEvidencia, {
    file: { buffer: pngMinimo, mimetype: 'image/png' },
    body: { id_bitacora: '2', tipo_evidencia: 'Durante' }
  });
  assert.equal(bloqueada.codigo, 409);

  // 5. RN11 / RNF06: pes_runtime NO tiene permisos de UPDATE ni DELETE sobre evidencia_fotografica
  await assert.rejects(
    () => db.query('DELETE FROM public.evidencia_fotografica WHERE id_evidencia = $1', [idNueva]),
    (err) => err.code === '42501'
  );
  await assert.rejects(
    () => db.query("UPDATE public.evidencia_fotografica SET descripcion = 'alterada' WHERE id_evidencia = $1", [idNueva]),
    (err) => err.code === '42501'
  );

  // 6. CHECK de BD impide guardar mime inválido o datos sin mime
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.evidencia_fotografica (id_bitacora, tipo_evidencia, url_foto, mime, datos)
         VALUES (1, 'Antes', 'db://evidencias/invalida', 'image/gif', $1)`,
        [pngMinimo]
      ),
    (err) => err.code === '23514'
  );
});
