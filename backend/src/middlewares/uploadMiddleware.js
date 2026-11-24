const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { detectarMimePorFirma } = require('../utils/compresionImagen');

// Carpeta física conservada únicamente como respaldo para evidencias históricas previas a la migración 010
const DIRECTORIO_EVIDENCIAS = path.resolve(
  __dirname,
  '../../uploads/evidencias'
);

const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB de entrada (se comprime antes de guardar en BD)

// Extensiones permitidas para las fotos de evidencias
const EXTENSION_POR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

// Se recibe la imagen en memoria para validarla y comprimirla antes de persistirla en PostgreSQL
const storage = multer.memoryStorage();

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

// Revisa los primeros bytes (Buffer o ruta en disco) para confirmar que sea una imagen real
const tieneFirmaDeImagen = (origen) => {
  if (Buffer.isBuffer(origen) || origen instanceof Uint8Array) {
    return Boolean(detectarMimePorFirma(origen));
  }

  if (typeof origen !== 'string' || !origen) {
    return false;
  }

  const descriptor = fs.openSync(origen, 'r');

  try {
    const cabecera = Buffer.alloc(12);
    fs.readSync(descriptor, cabecera, 0, 12, 0);
    return Boolean(detectarMimePorFirma(cabecera));
  } finally {
    fs.closeSync(descriptor);
  }
};

// Elimina un archivo temporal en disco si existiera (conservado por compatibilidad)
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
