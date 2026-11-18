const CAMPOS_TEXTO = ['nombre', 'placa_institucional', 'numero_serie', 'marca',
  'modelo', 'caracteristicas', 'comentarios'];

function normalizarTexto(valor, obligatorio = false) {
  const texto = String(valor ?? '').trim();
  return obligatorio ? texto : texto || null;
}

export function prepararCambiosEquipo(formulario, original) {
  const valoresOriginales = {
    ...original,
    nombre: original.nombre ?? original.nombre_equipo,
    placa_institucional: original.placa_institucional ?? original.placa,
    numero_serie: original.numero_serie ?? original.serie,
    anio: original.anio ?? original.año,
  };
  const cambios = {};
  for (const campo of CAMPOS_TEXTO) {
    const nuevo = normalizarTexto(formulario[campo], campo === 'nombre');
    if (nuevo !== normalizarTexto(valoresOriginales[campo], campo === 'nombre')) {
      cambios[campo] = nuevo;
    }
  }
  const nuevoAnio = formulario.anio === '' ? null : Number(formulario.anio);
  const anterior = valoresOriginales.anio;
  const anioAnterior = anterior === undefined || anterior === null || anterior === ''
    ? null : Number(anterior);
  if (nuevoAnio !== anioAnterior) cambios.anio = nuevoAnio;
  // Estado, categoría y ubicación se gestionan fuera de la edición general.
  return cambios;
}
