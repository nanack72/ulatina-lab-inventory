const API_URL = '/api/incidencias';

/**
 * Consulta la lista de incidencias técnicas con filtros opcionales.
 */
export async function consultarIncidencias(params = {}, token, signal) {
  const query = new URLSearchParams();

  if (params.estado) query.set('estado', params.estado);
  if (params.prioridad) query.set('prioridad', params.prioridad);
  if (params.id_sede) query.set('id_sede', params.id_sede);
  if (params.id_laboratorio) query.set('id_laboratorio', params.id_laboratorio);
  if (params.busqueda) query.set('busqueda', params.busqueda);

  const url = `${API_URL}${query.toString() ? `?${query.toString()}` : ''}`;

  const respuesta = await fetch(url, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'Error al obtener la lista de incidencias'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}

/**
 * Registra un nuevo reporte de falla técnica sobre un activo.
 */
export async function crearIncidencia(datos, token) {
  const respuesta = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'No fue posible registrar la incidencia técnica'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}

/**
 * Actualiza el estado de resolución de una incidencia (PATCH).
 */
export async function actualizarEstadoIncidencia(id, nuevoEstado, token) {
  const respuesta = await fetch(`${API_URL}/${id}/estado`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ nuevo_estado: nuevoEstado })
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'No se pudo actualizar el estado de la incidencia'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}
