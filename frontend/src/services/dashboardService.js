// Consulta GET autenticada y devuelve resultado.data (arreglo).
async function consultar(url, token, signal, mensajeError) {
  if (!token) {
    throw new Error('Debés iniciar sesión para consultar esta información.');
  }

  let respuesta;

  try {
    respuesta = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new Error('No se pudo conectar con el servidor.', {
      cause: error,
    });
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = new Error(resultado?.message || mensajeError);
    error.status = respuesta.status;
    throw error;
  }

  if (resultado?.success !== true || !Array.isArray(resultado.data)) {
    throw new Error('El servidor devolvió datos con un formato inesperado.');
  }

  return resultado.data;
}

// GET /api/mantenimientos (más recientes primero)
export function obtenerMantenimientos(token, signal) {
  return consultar(
    '/api/mantenimientos',
    token,
    signal,
    'No fue posible consultar los mantenimientos.'
  );
}

// GET /api/dashboard/actividad
export function obtenerActividadReciente(token, signal, limite = 6) {
  return consultar(
    `/api/dashboard/actividad?limite=${encodeURIComponent(limite)}`,
    token,
    signal,
    'No fue posible consultar la actividad reciente.'
  );
}