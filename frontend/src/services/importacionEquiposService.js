import { solicitarInventario } from './solicitarInventario.js';

const API_URL = '/api/importacion-equipos';

// Un 5xx sin JSON no viene de la aplicación sino de la conexión (proxy o
// servidor reiniciando). Las operaciones que no escriben datos se repiten.
const ESPERA_REINTENTO_MS = 600;

async function solicitar(ruta, token, opciones, { reintentar = false } = {}) {
  let intentos = reintentar ? 3 : 1;
  let respuesta;
  let resultado;

  while (intentos > 0) {
    intentos -= 1;

    ({ respuesta, resultado } = await solicitarInventario(
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
    ));

    const fallaDeConexion = respuesta.status >= 500 && resultado === null;
    if (!fallaDeConexion || intentos === 0) break;

    await new Promise((listo) => setTimeout(listo, ESPERA_REINTENTO_MS));
  }

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message ||
      (respuesta.status >= 500
        ? 'El servidor no respondió correctamente. Intente de nuevo en unos segundos.'
        : 'No fue posible completar la operación.')
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
  }, { reintentar: true });

  return resultado.data;
}

export async function confirmarImportacionEquipos(filas, token, validarSolo = false) {
  const resultado = await solicitar('confirmar', token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filas, ...(validarSolo ? { validar_solo: true } : {}) }),
  }, { reintentar: validarSolo });

  return resultado;
}
