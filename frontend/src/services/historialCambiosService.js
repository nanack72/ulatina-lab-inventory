import { solicitarInventario } from './solicitarInventario.js';

export async function obtenerHistorialCambios(
  idEquipo,
  token,
  signal
) {
  const { respuesta, resultado } = await solicitarInventario(
    `/api/equipos/${encodeURIComponent(idEquipo)}/historial-cambios`,
    {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      },
    'No se pudo conectar con el servidor.'
  );

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
