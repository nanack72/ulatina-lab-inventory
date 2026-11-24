const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { optimizarFoto } = require('../src/services/optimizarFoto');

test('reduce una foto grande sin recortar y devuelve medidas verificables', async () => {
  const original = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: '#205c49' },
  })
    .jpeg({ quality: 100 })
    .toBuffer();
  const foto = await optimizarFoto(original);
  const medidas = await sharp(foto.buffer).metadata();
  assert.equal(medidas.width, 1920);
  assert.equal(medidas.height, 1280);
  assert.ok(foto.buffer.length < original.length);
  assert.equal(foto.optimizacion.bytes_guardados, foto.buffer.length);
});

test('no agranda fotos pequeñas ni aumenta su peso cuando no requieren rotación', async () => {
  const original = await sharp({
    create: { width: 240, height: 160, channels: 3, background: '#ffffff' },
  })
    .webp({ quality: 40 })
    .toBuffer();
  const foto = await optimizarFoto(original);
  assert.ok(foto.buffer.length <= original.length);
  const medidas = await sharp(foto.buffer).metadata();
  assert.equal(medidas.width, 240);
  assert.equal(medidas.height, 160);
});

test('conserva transparencia de PNG y corrige orientación EXIF', async () => {
  const png = await sharp({
    create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 100, b: 50, alpha: 0 } },
  })
    .png()
    .toBuffer();
  const transparente = await optimizarFoto(png);
  assert.equal((await sharp(transparente.buffer).metadata()).hasAlpha, true);
  const jpg = await sharp({
    create: { width: 600, height: 400, channels: 3, background: '#205c49' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const rotada = await optimizarFoto(jpg);
  const medidas = await sharp(rotada.buffer).metadata();
  assert.equal(medidas.width, 400);
  assert.equal(medidas.height, 600);
  assert.equal(medidas.orientation, undefined);
});

test('rechaza archivos falsos, formatos no admitidos, MIME incorrecto y exceso de píxeles', async () => {
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } })
    .png()
    .toBuffer();
  const enorme = await sharp({
    create: { width: 6400, height: 6400, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  for (const buffer of [
    Buffer.alloc(0),
    Buffer.alloc(5 * 1024 * 1024 + 1),
    Buffer.from('<svg/>'),
    Buffer.from([255, 216, 255]),
    enorme,
  ]) {
    await assert.rejects(optimizarFoto(buffer), (error) => error.status === 400);
  }
  await assert.rejects(optimizarFoto(png, 'image/jpeg'), (error) => error.status === 400);
});

test('la subida de equipo persiste el resultado optimizado, no la foto original', async () => {
  const { subirFotoEquipo } = require('../src/services/fotosEquipoService');
  const original = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#205c49' },
  })
    .jpeg()
    .toBuffer();
  let guardado;
  const cliente = {
    release() {},
    async query(sql, parametros) {
      if (sql.includes('FROM public.usuario'))
        return { rows: [{ activo: true, rol: 'Superadministrador' }] };
      if (sql.includes('SELECT e.id_equipo')) return { rows: [{ id_equipo: 1 }] };
      if (sql.includes('count(*)')) return { rows: [{ total: 0 }] };
      if (sql.includes('INSERT INTO')) {
        guardado = parametros;
        return { rows: [{ id_foto: 1 }] };
      }
      return { rows: [] };
    },
  };
  const resultado = await subirFotoEquipo({ connect: async () => cliente }, 1, 1, {
    originalname: 'foto.jpg',
    buffer: original,
  });
  assert.equal(guardado[3], 'image/jpeg');
  assert.equal((await sharp(guardado[4]).metadata()).width, 1920);
  assert.equal(resultado.optimizacion.bytes_guardados, guardado[4].length);
});

test('la evidencia guarda el archivo optimizado y conserva su extensión y asociación', async (t) => {
  const fs = require('node:fs/promises'),
    os = require('node:os'),
    path = require('node:path');
  const vm = require('node:vm'),
    { createRequire } = require('node:module');
  const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), 'pes-foto-'));
  t.after(() => fs.rm(carpeta, { recursive: true, force: true }));
  const archivo = path.join(carpeta, 'prueba.jpg');
  const original = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#205c49' },
  })
    .jpeg()
    .toBuffer();
  await fs.writeFile(archivo, original);
  const ruta = path.resolve(__dirname, '../src/controllers/evidenciasController.js');
  const local = createRequire(ruta),
    modulo = { exports: {} };
  let insertado;
  const pool = {
    async query(sql, datos) {
      if (sql.includes('INSERT INTO')) {
        insertado = datos;
        return { rows: [{ id_evidencia: 1 }] };
      }
      return { rows: [{ id_bitacora: 4, id_equipo: 1 }] };
    },
  };
  vm.runInNewContext(await fs.readFile(ruta, 'utf8'), {
    module: modulo,
    console,
    Buffer,
    require: (nombre) =>
      nombre === '../config/database'
        ? pool
        : nombre === '../middlewares/uploadMiddleware'
          ? {
              DIRECTORIO_EVIDENCIAS: carpeta,
              eliminarArchivo() {},
              tieneFirmaDeImagen: () => true,
            }
          : nombre === '../utils/accesoEquipos'
            ? { verificarAccesoEquipo: async () => true }
            : local(nombre),
  });
  const res = {
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(datos) {
      this.datos = datos;
      return this;
    },
  };
  await modulo.exports.subirEvidencia(
    {
      file: { path: archivo, filename: 'prueba.jpg', mimetype: 'image/jpeg' },
      body: { id_bitacora: '4', tipo_evidencia: 'Antes' },
      usuario: { rol: 'Superadministrador' },
    },
    res
  );
  assert.equal(res.codigo, 201);
  assert.equal((await sharp(await fs.readFile(archivo)).metadata()).width, 1920);
  assert.equal(insertado[0], 4);
  assert.equal(insertado[2], '/uploads/evidencias/prueba.jpg');
});
