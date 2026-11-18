const { validarFoto, MAX_FOTOS_EQUIPO } = require('../services/fotosEquipoService');

// ExcelJS usa anclas con filas desde cero. Nunca se descargan imágenes externas.
function extraerImagenes(libro, hoja, filas) {
  const porFila = new Map(filas.map(f => [f.fila, []]));
  const avisos = [];
  let total = 0;
  for (const dibujo of hoja.getImages()) {
    const inicio = dibujo.range?.tl;
    const numero = Math.floor(inicio?.nativeRow ?? inicio?.row ?? -1) + 1;
    const destino = porFila.get(numero);
    try {
      if (!destino) throw new Error(`Imagen fuera de una fila de equipo (fila ${numero}).`);
      const imagen = libro.getImage(dibujo.imageId);
      const buffer = imagen?.buffer ? Buffer.from(imagen.buffer) : null;
      const mime = validarFoto({ buffer });
      if (destino.length >= MAX_FOTOS_EQUIPO || total + buffer.length > 15 * 1024 * 1024) {
        throw new Error(`Se alcanzó el límite de fotos en la fila ${numero} o de 15 MB por importación.`);
      }
      total += buffer.length;
      destino.push({ nombre: `fila-${numero}-foto-${destino.length + 1}.${mime.split('/')[1]}`, mime, base64: buffer.toString('base64') });
    } catch (error) { avisos.push(`No se extrajo una imagen: ${error.message}`); }
  }
  return { porFila, avisos };
}
module.exports = { extraerImagenes };
