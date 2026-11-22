const JSZip = require('jszip');
const { SaxesParser } = require('saxes');
const path = require('node:path').posix;

// Solo se leen recursos incrustados del archivo; nunca enlaces externos.
async function leerImagenesEnCelda(buffer, nombreHoja, filasValidas) {
  const zip = await JSZip.loadAsync(buffer);
  async function leerLimitado(archivo, maximo) {
    const partes = [];
    let bytes = 0;
    await new Promise((resolve, reject) => {
      const flujo = archivo.nodeStream();
      flujo.on('data', parte => {
        bytes += parte.length;
        if (bytes > maximo) {
          flujo.destroy();
          reject(new Error('El recurso incrustado supera el tamaño permitido.'));
        } else partes.push(parte);
      });
      flujo.on('error', reject);
      flujo.on('end', resolve);
    });
    return Buffer.concat(partes);
  }
  async function xml(nombre) {
    const archivo = zip.file(nombre);
    if (!archivo) return null;
    const texto = (await leerLimitado(archivo, 8 * 1024 * 1024)).toString('utf8');
    const raiz = { hijos: [] }, pila = [raiz];
    const parser = new SaxesParser({ xmlns: true });
    parser.on('doctype', () => { throw new Error('XML de imágenes no permitido.'); });
    parser.on('opentag', nodo => {
      const elemento = { nombre: nodo.local, atributos: {}, hijos: [], texto: '' };
      for (const valor of Object.values(nodo.attributes)) elemento.atributos[valor.local] = valor.value;
      pila.at(-1).hijos.push(elemento); pila.push(elemento);
    });
    parser.on('text', textoNodo => { pila.at(-1).texto += textoNodo; });
    parser.on('closetag', () => pila.pop());
    parser.write(texto).close();
    return raiz.hijos[0];
  }
  const hijos = (nodo, nombre) => nodo?.hijos.filter(h => h.nombre === nombre) || [];
  const hijo = (nodo, nombre) => hijos(nodo, nombre)[0];
  function buscar(nodo, nombre) {
    if (!nodo) return [];
    return [...(nodo.nombre === nombre ? [nodo] : []), ...nodo.hijos.flatMap(n => buscar(n, nombre))];
  }
  const indice = valor => /^\d+$/.test(String(valor ?? '')) ? Number(valor) : -1;
  const rutaInterna = (base, rel) => {
    if (!rel || rel.atributos.TargetMode === 'External') return null;
    const destino = rel.atributos.Target;
    if (!destino || /[\\:#?]/.test(destino)) return null;
    const ruta = destino.startsWith('/') ? destino.slice(1) : path.join(base, destino);
    return ruta.startsWith('xl/') && !ruta.includes('../') ? ruta : null;
  };
  const metadata = await xml('xl/metadata.xml');
  if (!metadata) return [];
  const tipos = hijos(hijo(metadata, 'metadataTypes'), 'metadataType');
  const futuro = hijos(metadata, 'futureMetadata').find(n => n.atributos.name === 'XLRICHVALUE');
  const valores = hijos(await xml('xl/richData/rdrichvalue.xml'), 'rv');
  const estructuras = hijos(await xml('xl/richData/rdrichvaluestructure.xml'), 's');
  const enlaces = hijos(await xml('xl/richData/richValueRel.xml'), 'rel');
  const relaciones = hijos(await xml('xl/richData/_rels/richValueRel.xml.rels'), 'Relationship');
  const libro = await xml('xl/workbook.xml');
  const hoja = hijos(hijo(libro, 'sheets'), 'sheet').find(n => n.atributos.name === nombreHoja);
  const relHoja = hijos(await xml('xl/_rels/workbook.xml.rels'), 'Relationship').find(n => n.atributos.Id === hoja?.atributos.id);
  const rutaHoja = rutaInterna('xl', relHoja);
  if (!rutaHoja) return [];
  const celdas = buscar(await xml(rutaHoja), 'c');
  const resultado = [];
  let bytesFotos = 0;
  for (const celda of celdas) {
    const fila = Number(celda.atributos.r?.match(/\d+$/)?.[0]);
    if (!filasValidas.has(fila) || !celda.atributos.vm) continue;
    const bloque = hijos(hijo(metadata, 'valueMetadata'), 'bk')[indice(celda.atributos.vm) - 1];
    const registro = hijos(bloque, 'rc').find(n => tipos[indice(n.atributos.t) - 1]?.atributos.name === 'XLRICHVALUE');
    const referencia = buscar(hijos(futuro, 'bk')[indice(registro?.atributos.v)], 'rvb')[0];
    const valor = valores[indice(referencia?.atributos.i)];
    const estructura = estructuras[indice(valor?.atributos.s)];
    if (estructura?.atributos.t !== '_localImage') continue;
    const posicion = hijos(estructura, 'k').findIndex(n => n.atributos.n === '_rvRel:LocalImageIdentifier');
    const enlace = enlaces[indice(hijos(valor, 'v')[posicion]?.texto)];
    const relacion = relaciones.find(n => n.atributos.Id === enlace?.atributos.id);
    const ruta = rutaInterna('xl/richData', relacion);
    if (!ruta || !ruta.startsWith('xl/media/')) throw new Error('La foto en celda no contiene una imagen incrustada válida.');
    const archivo = zip.file(ruta);
    if (!archivo) throw new Error('No se encontró la foto incrustada en la celda.');
    const foto = await leerLimitado(archivo, 5 * 1024 * 1024);
    bytesFotos += foto.length;
    if (bytesFotos > 15 * 1024 * 1024) throw new Error('Las fotos en celdas superan 15 MB por importación.');
    resultado.push({ fila, buffer: foto });
  }
  return resultado;
}

module.exports = { leerImagenesEnCelda };
