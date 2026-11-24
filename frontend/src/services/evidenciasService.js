const API_URL = '/api/evidencias';

/**
 * Consulta todas las evidencias fotográficas asociadas a una orden de mantenimiento.
 */
export async function consultarEvidenciasPorBitacora(idBitacora, token, signal) {
  const respuesta = await fetch(`${API_URL}/bitacora/${idBitacora}`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(resultado?.message || 'Error al consultar las evidencias fotográficas');
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
      // Omitimos Content-Type explícito para que el navegador establezca
      // multipart/form-data junto con el delimitador (boundary) requerido por Multer
    },
    body: formData,
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(resultado?.message || 'Error al subir la fotografía de evidencia');
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}

export async function obtenerArchivoEvidencia(id, token, signal) {
  const respuesta = await fetch(API_URL + '/' + encodeURIComponent(id) + '/archivo', {
    signal,
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw Object.assign(new Error(datos?.message || 'No se pudo cargar la evidencia.'), {
      status: respuesta.status,
    });
  }
  return respuesta.blob();
}
