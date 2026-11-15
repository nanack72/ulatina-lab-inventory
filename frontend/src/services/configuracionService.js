const API_URL = '/api/admin/configuracion';

async function solicitar(ruta, token, opciones = {}) {
  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}/${ruta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(opciones.body
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new Error(
      'No fue posible conectar con el servidor.',
      { cause: error }
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message ||
      'No fue posible completar la operación.'
    );

    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}

export async function consultarConfiguracion(
  catalogo,
  token,
  signal
) {
  const resultado = await solicitar(catalogo, token, {
    signal,
  });

  return resultado.data;
}

export function guardarConfiguracion(
  catalogo,
  id,
  datos,
  token
) {
  return solicitar(
    id == null ? catalogo : `${catalogo}/${id}`,
    token,
    {
      method: id == null ? 'POST' : 'PUT',
      body: JSON.stringify(datos),
    }
  );
}

export function eliminarConfiguracion(
  catalogo,
  id,
  token
) {
  return solicitar(`${catalogo}/${id}`, token, {
    method: 'DELETE',
  });
}