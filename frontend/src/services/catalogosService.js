const API_URL = '/api';

async function consultarCatalogo(ruta, token, signal) {
  if (!token) {
    throw new Error(
      'Debés iniciar sesión para consultar los catálogos.'
    );
  }

  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}/${ruta}`, {
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

    throw new Error(
      'No se pudo conectar con el servidor.',
      { cause: error }
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = new Error(
      resultado?.message ||
      `No se pudo consultar el catálogo de ${ruta}.`
    );

    error.status = respuesta.status;
    throw error;
  }

  if (resultado?.success !== true || !Array.isArray(resultado.data)) {
    throw new Error(
      `El servidor devolvió datos inválidos para ${ruta}.`
    );
  }

  return resultado.data;
}

export function obtenerCategorias(token, signal) {
  return consultarCatalogo('categorias', token, signal);
}

export function obtenerEstados(token, signal) {
  return consultarCatalogo('estados', token, signal);
}

export function obtenerSedes(token, signal) {
  return consultarCatalogo('sedes', token, signal);
}

export function obtenerLaboratorios(token, signal) {
  return consultarCatalogo('laboratorios', token, signal);
}
