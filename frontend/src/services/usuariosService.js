const API_URL = '/api/admin/usuarios';

export function darBajaUsuario(id, token, idTecnicoSustituto = null) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new Error('Identificador de usuario no válido.');
  }
  const opciones = { method: 'DELETE' };
  if (
    idTecnicoSustituto !== undefined &&
    idTecnicoSustituto !== null &&
    String(idTecnicoSustituto).trim() !== ''
  ) {
    opciones.body = JSON.stringify({
      id_tecnico_sustituto: Number(idTecnicoSustituto),
    });
  }
  return solicitar(`/${encodeURIComponent(id)}`, token, opciones);
}

async function solicitar(ruta, token, opciones = {}) {
  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
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
    if (error.name === 'AbortError') throw error;

    throw new Error(
      'No fue posible conectar con el servidor.',
      { cause: error }
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'No fue posible completar la operación.'
    );

    error.status = respuesta.status;
    if (resultado?.codigo) error.codigo = resultado.codigo;
    if (Number.isInteger(resultado?.ordenes_abiertas)) {
      error.ordenesAbiertas = resultado.ordenes_abiertas;
    }
    throw error;
  }

  return resultado;
}

export async function obtenerUsuarios(token, signal) {
  const resultado = await solicitar('', token, { signal });
  return resultado.data;
}

export async function obtenerOpcionesUsuarios(token, signal) {
  const resultado = await solicitar('/opciones', token, { signal });
  return resultado.data;
}

export function guardarUsuario(id, datos, token) {
  return solicitar(
    id == null ? '' : `/${id}`,
    token,
    {
      method: id == null ? 'POST' : 'PUT',
      body: JSON.stringify(datos),
    }
  );
}
