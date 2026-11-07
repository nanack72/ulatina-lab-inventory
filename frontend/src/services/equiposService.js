const API_URL = '/api/equipos';

export async function obtenerEquipos(token, signal) {
  if (!token) {
    throw new Error('Debés iniciar sesión para consultar el inventario.');
  }

  let respuesta;

  try {
    respuesta = await fetch(API_URL, {
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
        'No se pudo conectar con el servidor de inventario.',
        { cause: error }
    );
    }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = new Error(
      resultado?.message ||
      'No fue posible consultar el inventario.'
    );
    error.status = respuesta.status;
    throw error;
  }

  if (!resultado?.success || !Array.isArray(resultado.data)) {
    throw new Error('El servidor devolvió datos de inventario inválidos.');
  }

  return resultado.data;
}

export async function obtenerEquipoPorId(idEquipo, token, signal) {
  if (!token) {
    throw new Error('Debés iniciar sesión para consultar el equipo.');
  }

  if (!Number.isInteger(Number(idEquipo)) || Number(idEquipo) <= 0) {
    throw new Error('El identificador del equipo no es válido.');
  }

  let respuesta;

  try {
    respuesta = await fetch(
      `/api/equipos/${encodeURIComponent(idEquipo)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal,
      }
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new Error(
      'No se pudo conectar con el servidor para consultar el equipo.',
      { cause: error }
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    let mensaje = resultado?.message;

    if (respuesta.status === 401) {
      mensaje = 'Tu sesión ya no es válida. Iniciá sesión nuevamente.';
    } else if (respuesta.status === 403 || respuesta.status === 404) {
      mensaje = 'No se encontró el equipo o no tenés acceso a él.';
    }

    const error = new Error(
      mensaje || 'No fue posible consultar el detalle del equipo.'
    );

    error.status = respuesta.status;
    throw error;
  }

  if (resultado?.success !== true) {
    throw new Error('El servidor no confirmó la consulta del equipo.');
  }

  const equipo = resultado.data;

  if (!equipo || Array.isArray(equipo) || typeof equipo !== 'object') {
    throw new Error('El servidor devolvió información inválida del equipo.');
  }

  return equipo;
}

/**
 * Registra un nuevo equipo tecnológico.
 * POST /api/equipos
 */
export async function registrarEquipo(datosEquipo, token) {
  if (!token) {
    throw new Error(
      'Debés iniciar sesión para registrar equipos.'
    );
  }

  let respuesta;

  try {
    respuesta = await fetch('/api/equipos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(datosEquipo),
    });
  } catch (error) {
    throw new Error(
      'No se pudo conectar con el servidor para registrar el equipo.',
      { cause: error }
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    let mensaje =
      resultado?.message || 'No fue posible registrar el equipo.';

    if (respuesta.status === 401) {
      mensaje = 'Tu sesión ya no es válida. Iniciá sesión nuevamente.';
    }

    if (respuesta.status === 403) {
      mensaje =
        'No tenés permisos para registrar equipos en este laboratorio.';
    }

    const error = new Error(mensaje);
    error.status = respuesta.status;
    error.detalles = resultado?.errors || null;

    throw error;
  }

  if (resultado?.success !== true) {
    throw new Error(
      'El servidor no confirmó el registro del equipo.'
    );
  }

  return resultado;
}

/**
 * Actualiza la información de un equipo existente.
 * PUT /api/equipos/:id
 */

export async function actualizarEquipo(idEquipo, datosEquipo, token) {
  if (!token) {
    throw new Error(
      'Debés iniciar sesión para modificar equipos.'
    );
  }

  if (
    !Number.isSafeInteger(Number(idEquipo)) ||
    Number(idEquipo) <= 0
  ) {
    throw new Error('El identificador del equipo no es válido.');
  }

  let respuesta;

  try {
    respuesta = await fetch(
      `/api/equipos/${encodeURIComponent(idEquipo)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datosEquipo),
      }
    );
  } catch (error) {
    throw new Error(
      'No se pudo conectar con el servidor para actualizar el equipo.',
      { cause: error }
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    let mensaje =
      resultado?.message ||
      'No fue posible actualizar el equipo.';

    if (respuesta.status === 401) {
      mensaje =
        'Tu sesión ya no es válida. Iniciá sesión nuevamente.';
    } else if (respuesta.status === 403) {
      mensaje =
        'No tenés permisos para modificar este equipo.';
    } else if (respuesta.status === 404) {
      mensaje =
        'No se encontró el equipo o no tenés acceso a él.';
    }

    const error = new Error(mensaje);
    error.status = respuesta.status;
    error.detalles = resultado?.errors ?? null;

    throw error;
  }

  if (resultado?.success !== true) {
    throw new Error(
      'El servidor no confirmó la actualización del equipo.'
    );
  }

  return resultado;
}


/**
 * Traslada un equipo a una nueva ubicación.
 *
 * Utiliza el endpoint existente:
 * PUT /api/equipos/:id
 *
 * El backend debe verificar los permisos y
 * PostgreSQL debe registrar el historial.
 */
export async function trasladarEquipo(
  idEquipo,
  datosTraslado,
  token
) {
  if (!token) {
    throw new Error(
      'Debés iniciar sesión para trasladar equipos.'
    );
  }

  const id = Number(idEquipo);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(
      'El identificador del equipo no es válido.'
    );
  }

  const idLaboratorio = Number(
    datosTraslado.id_laboratorio
  );

  if (
    !Number.isSafeInteger(idLaboratorio) ||
    idLaboratorio <= 0
  ) {
    throw new Error(
      'Debés seleccionar un laboratorio válido.'
    );
  }

  const ubicacionDetalle = String(
    datosTraslado.ubicacion_detalle ?? ''
  ).trim();

  // El backend recibe únicamente los campos
  // que queremos modificar.
  const datos = {
    id_laboratorio: idLaboratorio,
    ubicacion_detalle: ubicacionDetalle || null,
  };

  let respuesta;

  try {
    respuesta = await fetch(
      `/api/equipos/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datos),
      }
    );
  } catch (error) {
    throw new Error(
      'No se pudo conectar con el servidor.',
      { cause: error }
    );
  }

  const resultado = await respuesta
    .json()
    .catch(() => null);

  if (!respuesta.ok) {
    let mensaje =
      resultado?.message ||
      'No fue posible trasladar el equipo.';

    if (respuesta.status === 401) {
      mensaje =
        'Tu sesión ya no es válida. Iniciá sesión nuevamente.';
    } else if (respuesta.status === 403) {
      mensaje =
        'No tenés permisos para trasladar el equipo a ese laboratorio.';
    } else if (respuesta.status === 404) {
      mensaje =
        'El equipo o laboratorio no está disponible.';
    }

    const error = new Error(mensaje);
    error.status = respuesta.status;

    throw error;
  }

  if (resultado?.success !== true) {
    throw new Error(
      'El servidor no confirmó el traslado.'
    );
  }

  return resultado;
}

/**
 * Consulta el historial de ubicaciones.
 *
 * GET /api/equipos/:id/historial-ubicacion
 */
export async function obtenerHistorialUbicacion(
  idEquipo,
  token,
  signal
) {
  if (!token) {
    throw new Error(
      'Debés iniciar sesión para consultar el historial.'
    );
  }

  const id = Number(idEquipo);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(
      'El identificador del equipo no es válido.'
    );
  }

  let respuesta;

  try {
    respuesta = await fetch(
      `/api/equipos/${encodeURIComponent(id)}/historial-ubicacion`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal,
      }
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new Error(
      'No se pudo conectar con el servidor.',
      { cause: error }
    );
  }

  const resultado = await respuesta
    .json()
    .catch(() => null);

  if (!respuesta.ok) {
    const error = new Error(
      resultado?.message ||
      'No fue posible consultar el historial.'
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
