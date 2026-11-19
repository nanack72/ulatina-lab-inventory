export async function consultarEquiposRevision({ pagina = 1, motivo = '' }, token, signal) {
  if (!token) throw new Error('Debe iniciar sesión.');
  const query = new URLSearchParams({ pagina: String(pagina), limite: '5' });
  if (motivo) query.set('motivo', motivo);
  const respuesta = await fetch('/api/dashboard/equipos-revision?' + query, {
    signal,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || datos?.success !== true || !Array.isArray(datos.data)) {
    const error = new Error(datos?.message || 'No fue posible consultar los equipos por revisar.');
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}
