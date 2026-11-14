const API_URL = '/api/importacion-equipos';

async function solicitar(ruta, token, opciones) {
  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}/${ruta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(opciones.headers || {}),
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;

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

export async function leerArchivoEquipos(archivo, token) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);

  const resultado = await solicitar('leer', token, {
    method: 'POST',
    body: formulario,
  });

  return resultado.data;
}

export async function confirmarImportacionEquipos(filas, token) {
  const resultado = await solicitar('confirmar', token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filas }),
  });

  return resultado;
}