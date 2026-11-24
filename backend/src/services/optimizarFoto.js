const sharp = require('sharp');

const LADO_MAXIMO = 1920;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELES = 40_000_000;
const MIMES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// No recorta, no agranda y conserva transparencias. Se ejecuta antes de guardar.
async function optimizarFoto(buffer, mimeEsperado) {
  const invalida = () => Object.assign(new Error('La foto no se pudo procesar. Use una imagen JPG, PNG o WEBP válida, de hasta 5 MB y 40 megapíxeles.'), { status: 400 });
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_BYTES) throw invalida();
  try {
    const imagen = sharp(buffer, { limitInputPixels: MAX_PIXELES, failOn: 'warning' });
    const original = await imagen.metadata();
    const mime = MIMES[original.format];
    if (!mime || (mimeEsperado && mimeEsperado !== mime) || (original.pages || 1) > 1) throw invalida();
    let proceso = imagen.autoOrient().resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true });
    if (original.format === 'jpeg') proceso = proceso.jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: '4:4:4' });
    if (original.format === 'png') proceso = proceso.png({ compressionLevel: 9 });
    if (original.format === 'webp') proceso = proceso.webp({ quality: 85, alphaQuality: 100, effort: 4 });
    const salida = await proceso.toBuffer({ resolveWithObject: true });
    const necesitaCambio = original.width > LADO_MAXIMO || original.height > LADO_MAXIMO || (original.orientation || 1) !== 1;
    // Si ya era pequeña y más liviana, conservarla evita aumentar su peso o recomprimirla.
    const conservar = !necesitaCambio && salida.data.length >= buffer.length;
    const datos = conservar ? buffer : salida.data;
    return {
      buffer: datos, mime,
      optimizacion: {
        bytes_originales: buffer.length, bytes_guardados: datos.length,
        ancho_original: original.width, alto_original: original.height,
        ancho_guardado: conservar ? original.width : salida.info.width,
        alto_guardado: conservar ? original.height : salida.info.height,
      },
    };
  } catch { throw invalida(); }
}

module.exports = { optimizarFoto, LADO_MAXIMO, MAX_PIXELES };
