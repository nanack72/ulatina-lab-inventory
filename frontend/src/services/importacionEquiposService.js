import { solicitarInventario } from './solicitarInventario.js';

const API_URL = '/api/importacion-equipos';

async function solicitar(ruta, token, opciones) {
  const { respuesta, resultado } = await solicitarInventario(
    `${API_URL}/${ruta}`,
    {
      ...opciones,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(opciones.headers || {}),
      },
    },
    'No fue posible conectar con el servidor.'
  );

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