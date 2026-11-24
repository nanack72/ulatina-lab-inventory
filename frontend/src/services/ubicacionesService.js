export async function obtenerUbicaciones(token, signal) {
  const respuesta = await fetch('/api/filtros-ubicacion', {
    signal, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  const resultado = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !resultado?.success || !Array.isArray(resultado.data?.laboratorios) || !Array.isArray(resultado.data?.sedes)) {
    throw new Error(resultado?.message || 'No fue posible cargar las sedes y los laboratorios.');
  }
  return resultado.data;
}
