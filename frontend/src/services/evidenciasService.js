const API_URL = '/api/evidencias';

/**
 * Consulta todas las evidencias fotográficas asociadas a una orden de mantenimiento.
 */
export async function consultarEvidenciasPorBitacora(idBitacora, token, signal) {
  const respuesta = await fetch(`${API_URL}/bitacora/${idBitacora}`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'Error al consultar las evidencias fotográficas'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data || [];
}

/**
 * Sube una nueva evidencia fotográfica adjunta a una orden de mantenimiento.
 * (Envío inicial con Content-Type explícito).
 */
export async function subirEvidenciaFotografica(datos, token) {
  const formData = new FormData();
  formData.append('foto', datos.foto);
  formData.append('id_bitacora', datos.id_bitacora);
  formData.append('tipo_evidencia', datos.tipo_evidencia);
  if (datos.descripcion) {
    formData.append('descripcion', datos.descripcion);
  }

  const respuesta = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Cabecera manual que rompe el boundary de Multer en multipart/form-data
      'Content-Type': 'multipart/form-data'
    },
    body: formData
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'Error al subir la fotografía de evidencia'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}
