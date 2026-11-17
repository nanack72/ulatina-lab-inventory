const API_URL = '/api/reportes';

/**
 * Consulta el resumen general consolidado del inventario y mantenimientos.
 */
export async function consultarResumenGeneral(token, signal) {
  const respuesta = await fetch(`${API_URL}/resumen-general`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'Error al obtener el resumen general de reportes'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}

/**
 * Consulta los mantenimientos específicos de un laboratorio.
 */
export async function consultarMantenimientosPorLaboratorio(
  idLaboratorio,
  token,
  signal
) {
  const respuesta = await fetch(
    `${API_URL}/mantenimientos-laboratorio/${idLaboratorio}`,
    {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    }
  );

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'Error al consultar mantenimientos del laboratorio'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}
