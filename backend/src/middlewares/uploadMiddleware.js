const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Carpeta física: backend/uploads/evidencias
const DIRECTORIO_EVIDENCIAS = path.resolve(
  __dirname,
  '../../uploads/evidencias'
);

fs.mkdirSync(DIRECTORIO_EVIDENCIAS, { recursive: true });

const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

// Extensiones permitidas para las fotos de evidencias
const EXTENSION_POR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIRECTORIO_EVIDENCIAS),
  filename: (req, file, cb) => {
    const extension = EXTENSION_POR_MIME[file.mimetype];
    // timestamp y sufijo aleatorio para evitar colisiones
    const sufijo = crypto.randomBytes(6).toString('hex');
    cb(null, `${Date.now()}-${sufijo}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!EXTENSION_POR_MIME[file.mimetype]) {
    const error = new Error(
      'Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP'
    );
    error.code = 'FORMATO_NO_PERMITIDO';
    return cb(error);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: TAMANO_MAXIMO, files: 1 }
});

// Revisa los primeros bytes del archivo para confirmar que sea una imagen real
const tieneFirmaDeImagen = (rutaArchivo) => {
  const descriptor = fs.openSync(rutaArchivo, 'r');

  try {
    const cabecera = Buffer.alloc(12);
    fs.readSync(descriptor, cabecera, 0, 12, 0);

    const esJpg =
      cabecera[0] === 0xff && cabecera[1] === 0xd8 && cabecera[2] === 0xff;
    const esPng = cabecera
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const esWebp =
      cabecera.subarray(0, 4).toString('ascii') === 'RIFF' &&
      cabecera.subarray(8, 12).toString('ascii') === 'WEBP';

    return esJpg || esPng || esWebp;
  } finally {
    fs.closeSync(descriptor);
  }
};

// Elimina un archivo subido (ignora el error si ya no existe)
const eliminarArchivo = (rutaArchivo) => {
  if (!rutaArchivo) return;
  fs.unlink(rutaArchivo, () => {});
};

// Middleware para el campo "foto" que traduce los errores de multer
// a respuestas JSON consistentes con el resto de la API.
const subirFoto = (req, res, next) => {
  upload.single('foto')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const mensaje =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'La imagen supera el tamaño máximo de 5 MB'
          : 'No se pudo procesar la imagen enviada (use el campo "foto")';

      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        success: false,
        message: mensaje
      });
    }

    if (error.code === 'FORMATO_NO_PERMITIDO') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Error al subir imagen:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al guardar la imagen'
    });
  });
};

module.exports = {
  subirFoto,
  eliminarArchivo,
  tieneFirmaDeImagen,
  DIRECTORIO_EVIDENCIAS
};

