const API_URL = '/api/mantenimientos';

/**
 * Consulta la lista de mantenimientos con paginación y filtros opcionales.
 */
export async function consultarMantenimientos(params = {}, token, signal) {
  const query = new URLSearchParams();

  if (params.pagina) query.set('pagina', params.pagina);
  if (params.limite) query.set('limite', params.limite);
  if (params.tipo_mantenimiento) query.set('tipo_mantenimiento', params.tipo_mantenimiento);
  if (params.estado_mantenimiento) query.set('estado_mantenimiento', params.estado_mantenimiento);
  if (params.id_sede) query.set('id_sede', params.id_sede);
  if (params.id_laboratorio) query.set('id_laboratorio', params.id_laboratorio);
  if (params.busqueda) query.set('busqueda', params.busqueda);

  const url = `${API_URL}${query.toString() ? `?${query.toString()}` : ''}`;

  const respuesta = await fetch(url, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(resultado?.message || 'Error al obtener la lista de mantenimientos');
    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}

/**
 * Consulta el detalle completo de un mantenimiento por su identificador.
 */
export async function consultarMantenimientoPorId(id, token, signal) {
  const respuesta = await fetch(`${API_URL}/${id}`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(resultado?.message || 'Error al obtener el detalle del mantenimiento');
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}

/**
 * Registra una nueva intervención técnica en la bitácora.
 */
export async function registrarMantenimiento(datos, token) {
  const respuesta = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(datos),
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(resultado?.message || 'No fue posible registrar el mantenimiento');
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}

/**
 * Actualiza el estado o las horas invertidas de un mantenimiento existente.
 */
export async function actualizarEstadoMantenimiento(id, datos, token) {
  const respuesta = await fetch(`${API_URL}/${id}/estado`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(datos),
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'No se pudo actualizar el estado del mantenimiento'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}
