const { validarFoto, MAX_FOTOS_EQUIPO } = require('../services/fotosEquipoService');

const { leerImagenesEnCelda } = require('./imagenesEnCelda');

// ExcelJS usa anclas con filas desde cero. Nunca se descargan imágenes externas.
async function extraerImagenes(libro, hoja, filas, archivoOriginal) {
  const porFila = new Map(filas.map(f => [f.fila, []]));
  const avisos = [];
  let total = 0;
  function agregarFoto(numero, buffer) {
    const destino = porFila.get(numero);
    const mime = validarFoto({ buffer });
    if (destino.length >= MAX_FOTOS_EQUIPO || total + buffer.length > 15 * 1024 * 1024) {
      throw new Error(`Se alcanzó el límite de fotos en la fila ${numero} o de 15 MB por importación.`);
    }
    total += buffer.length;
    destino.push({ nombre: `fila-${numero}-foto-${destino.length + 1}.${mime.split('/')[1]}`, mime, base64: buffer.toString('base64') });
  }
  for (const dibujo of hoja.getImages()) {
    const inicio = dibujo.range?.tl;
    const numero = Math.floor(inicio?.nativeRow ?? inicio?.row ?? -1) + 1;
    const destino = porFila.get(numero);
    if (!destino) continue; // Logos y otros dibujos del encabezado.
    try {
      const imagen = libro.getImage(dibujo.imageId);
      const buffer = imagen?.buffer ? Buffer.from(imagen.buffer) : null;
      agregarFoto(numero, buffer);
    } catch (error) { avisos.push(`No se extrajo una imagen: ${error.message}`); }
  }
  if (archivoOriginal) {
    try {
      const imagenes = await leerImagenesEnCelda(archivoOriginal, hoja.name, new Set(porFila.keys()));
      for (const imagen of imagenes) {
        try { agregarFoto(imagen.fila, imagen.buffer); }
        catch (error) { avisos.push(`No se extrajo la foto en la fila ${imagen.fila}: ${error.message}`); }
      }
    } catch (error) { avisos.push(`No se pudieron leer las fotos en celdas: ${error.message}`); }
  }
  return { porFila, avisos };
}
module.exports = { extraerImagenes };
