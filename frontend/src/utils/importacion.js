// Utilidades de la pantalla de importación de equipos.

const quitarAcentos = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Palabra clave del mensaje del servidor -> campo del formulario
const REGLAS_CAMPOS = [
  ['id_categoria', /categoria/],
  ['id_estado', /\bestado\b/],
  ['id_laboratorio', /laboratorio|\bsede\b/],
  ['placa_institucional', /placa/],
  ['numero_serie', /\bserie\b/],
  ['nombre', /\bnombre\b/],
  ['anio', /\banio\b|\bano\b/],
  ['marca', /\bmarca\b/],
  ['modelo', /\bmodelo\b/],
  ['ubicacion_detalle', /ubicacion/],
];

// Devuelve los campos a los que se refieren los errores de una fila.
export function camposConError(errores = []) {
  const campos = new Set();

  for (const mensaje of errores) {
    const texto = quitarAcentos(mensaje);

    for (const [campo, regla] of REGLAS_CAMPOS) {
      if (regla.test(texto)) campos.add(campo);
    }
  }

  return campos;
}

// 'listo' | 'error' | 'modificado'
export function estadoFila(fila) {
  if (fila.modificado) return 'modificado';
  return fila.errores?.length > 0 ? 'error' : 'listo';
}

export function tieneObservaciones(fila) {
  return fila.errores?.length > 0;
}

export const FILTROS_REVISION = {
  todos: () => true,
  listos: (fila) => !tieneObservaciones(fila),
  observaciones: (fila) => tieneObservaciones(fila),
};

export function nombreCatalogo(lista, campoId, id) {
  return lista.find((elemento) => elemento[campoId] === id)?.nombre;
}

// Texto "del Excel" que sirve de pista para cada selector
export function pistaOriginal(originales = {}, campo) {
  if (campo === 'id_categoria') return originales.categoria || '';
  if (campo === 'id_estado') return originales.estado || '';
  if (campo === 'id_laboratorio') {
    return [originales.sede, originales.laboratorio].filter(Boolean).join(' · ');
  }
  return '';
}
