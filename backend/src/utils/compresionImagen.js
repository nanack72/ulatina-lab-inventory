const sharp = require('sharp');

const MAX_DIMENSION_DEFECTO = 1280;
const CALIDAD_WEBP_DEFECTO = 78;
const LIMITE_BYTES_COMPRIMIDOS = 2 * 1024 * 1024; // 2 MB máximo tras comprimir
const LIMITE_PIXELES_ENTRADA = 40_000_000; // Protección contra bombas de descompresión

/**
 * Revisa los primeros bytes (magic numbers) de un Buffer para validar
 * que realmente corresponda a una imagen JPG, PNG o WEBP.
 */
function detectarMimePorFirma(bytes) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    return null;
  }

  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }

  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Comprime y redimensiona una imagen (RNF03) para reducir consumo en PostgreSQL
 * conservando legibilidad para uso desde celular y escritorio.
 *
 * - Corrige orientación EXIF automáticamente (.rotate()) y remueve metadatos.
 * - Limita dimensiones máximas a 1280x1280 sin agrandar imágenes más pequeñas.
 * - Convierte a WebP (calidad 78 por defecto); si supera 2 MB reintenta con
 *   parámetros más compactos.
 *
 * Helper reutilizable para módulos que almacenen imágenes en BD.
 */
async function comprimirImagen(bufferOriginal, opciones = {}) {
  if (!Buffer.isBuffer(bufferOriginal) || bufferOriginal.length === 0) {
    const error = new Error('Debe adjuntar una imagen válida.');
    error.status = 400;
    throw error;
  }

  const mimeOriginal = detectarMimePorFirma(bufferOriginal);
  if (!mimeOriginal) {
    const error = new Error('El archivo no es una imagen JPG, PNG o WEBP válida');
    error.status = 400;
    throw error;
  }

  const maxAncho = opciones.maxAncho ?? MAX_DIMENSION_DEFECTO;
  const maxAlto = opciones.maxAlto ?? MAX_DIMENSION_DEFECTO;
  const calidad = opciones.calidad ?? CALIDAD_WEBP_DEFECTO;

  const convertir = async (ancho, alto, q) => {
    const { data, info } = await sharp(bufferOriginal, {
      limitInputPixels: LIMITE_PIXELES_ENTRADA
    })
      .rotate()
      .resize({
        width: ancho,
        height: alto,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: q, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return { data, info };
  };

  let resultado;
  try {
    resultado = await convertir(maxAncho, maxAlto, calidad);
    if (resultado.data.length > LIMITE_BYTES_COMPRIMIDOS) {
      resultado = await convertir(
        Math.min(maxAncho, 1024),
        Math.min(maxAlto, 1024),
        Math.min(calidad, 60)
      );
    }
  } catch (err) {
    const error = new Error('No fue posible procesar la imagen enviada. Verifique que no esté dañada.');
    error.status = 400;
    error.cause = err;
    throw error;
  }

  if (resultado.data.length === 0 || resultado.data.length > LIMITE_BYTES_COMPRIMIDOS) {
    const error = new Error('La imagen comprimida supera el límite permitido de 2 MB.');
    error.status = 413;
    throw error;
  }

  return {
    buffer: resultado.data,
    mime: 'image/webp',
    extension: '.webp',
    ancho: resultado.info.width,
    alto: resultado.info.height,
    bytesOriginales: bufferOriginal.length,
    bytesFinales: resultado.data.length
  };
}

module.exports = {
  MAX_DIMENSION_DEFECTO,
  CALIDAD_WEBP_DEFECTO,
  LIMITE_BYTES_COMPRIMIDOS,
  detectarMimePorFirma,
  comprimirImagen
};
