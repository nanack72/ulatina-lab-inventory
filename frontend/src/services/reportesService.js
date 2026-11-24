const API_URL = '/api/reportes';

/**
 * Consulta el resumen general consolidado del inventario y mantenimientos.
 */
export async function consultarResumenGeneral(token, signal) {
  const respuesta = await fetch(`${API_URL}/resumen-general`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'Error al obtener el resumen general de reportes'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado.data;
}

/**
 * Consulta los mantenimientos específicos de un laboratorio.
 */
export async function consultarMantenimientosPorLaboratorio(idLaboratorio, token, signal) {
  const respuesta = await fetch(`${API_URL}/mantenimientos-laboratorio/${idLaboratorio}`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'Error al consultar mantenimientos del laboratorio'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}

/**
 * Descarga el archivo de reporte consolidado en formato Excel (.xlsx).
 * Procesa la respuesta binaria como Blob y genera la descarga nativa.
 */
export async function descargarReporteExcel(token) {
  const respuesta = await fetch(`${API_URL}/exportar-excel`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!respuesta.ok) {
    const errorJson = await respuesta.json().catch(() => null);
    throw new Error(errorJson?.message || 'No fue posible generar el reporte consolidado en Excel');
  }

  // Se obtiene el stream binario como Blob para evitar corrupción de codificación
  const blob = await respuesta.blob();

  // Resolver nombre de archivo sugerido por la cabecera o asignar predeterminado
  const disposicion = respuesta.headers.get('content-disposition');
  let nombreArchivo = 'reporte_inventario_ulatina.xlsx';
  if (disposicion && disposicion.includes('filename=')) {
    const coincidencia = disposicion.match(/filename="?([^";]+)"?/);
    if (coincidencia && coincidencia[1]) {
      nombreArchivo = coincidencia[1].trim();
    }
  }

  const urlDescarga = window.URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = urlDescarga;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();

  // Limpieza del objeto temporal en memoria
  setTimeout(() => {
    document.body.removeChild(enlace);
    window.URL.revokeObjectURL(urlDescarga);
  }, 100);
}
