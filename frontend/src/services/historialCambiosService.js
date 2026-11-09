const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function obtenerHistorialCambios(
  idEquipo,
  token,
  signal
) {
  let respuesta;

  try {
    respuesta = await fetch(
      `${API_URL.replace(/\/$/, '')}/api/equipos/${encodeURIComponent(idEquipo)}/historial-cambios`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      }
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new Error(
      'No se pudo conectar con el servidor.',
      { cause: error }
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = new Error(
      resultado?.message ||
      'No se pudo consultar el historial de modificaciones.'
    );

    error.status = respuesta.status;
    throw error;
  }

  if (
    resultado?.success !== true ||
    !Array.isArray(resultado.data)
  ) {
    throw new Error(
      'El historial recibido no tiene el formato esperado.'
    );
  }

  return resultado.data;
}
