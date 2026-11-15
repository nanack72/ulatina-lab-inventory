export async function obtenerHistorialGeneral(token, filtros = {}, signal) {
  const parametros = new URLSearchParams({
    tipo: filtros.tipo || 'todos',
    busqueda: filtros.busqueda || '',
    desde: filtros.desde || '',
    hasta: filtros.hasta || '',
    pagina: String(filtros.pagina || 1),
  });

  const respuesta = await fetch(
    `/api/historial-general?${parametros.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal,
    }
  );

  const resultado = await respuesta.json().catch(() => null);

    if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
        resultado?.message || 'No fue posible consultar el historial.'
    );

    error.status = respuesta.status;
    throw error;
    }

  return resultado;
}
