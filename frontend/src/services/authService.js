const API_URL = '/api/auth';

// Iniciar sesión con correo institucional y contraseña
export async function iniciarSesion(correo, contrasena) {
  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correo,
        contrasena,
      }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifique que esté encendido.');
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(resultado?.message || 'No fue posible iniciar sesión.');
  }

  if (!resultado?.success || !resultado?.token || !resultado?.usuario) {
    throw new Error('La respuesta del servidor no es válida.');
  }

  return {
    token: resultado.token,
    usuario: resultado.usuario,
  };
}

// Cerrar sesión revocando el JWT en el backend
export async function cerrarSesion(token) {
  if (!token) {
    throw new Error('No se encontró un token de sesión válido.');
  }

  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor para cerrar la sesión.');
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = new Error(resultado?.message || 'No fue posible cerrar la sesión.');

    error.status = respuesta.status;
    throw error;
  }

  if (resultado?.success !== true) {
    throw new Error('El servidor no confirmó el cierre de sesión.');
  }

  return resultado;
}

// Solicitar enlace temporal de recuperación de contraseña por correo
export async function solicitarRecuperacionContrasena(correo) {
  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}/olvide-contrasena`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ correo }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.');
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'No fue posible procesar la solicitud de recuperación.'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}

// Validar si un enlace temporal de recuperación sigue vigente
export async function validarTokenRecuperacion(token, signal) {
  let respuesta;

  try {
    respuesta = await fetch(
      `${API_URL}/restablecer-contrasena/validar?token=${encodeURIComponent(token)}`,
      {
        signal,
        headers: {
          Accept: 'application/json',
        },
      }
    );
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar con el servidor para validar el enlace.', { cause: error });
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'El enlace de recuperación no es válido o ha expirado.'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}

// Restablecer contraseña con token temporal de un solo uso
export async function restablecerContrasena(token, contrasenaNueva) {
  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}/restablecer-contrasena`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token, contrasenaNueva }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor para restablecer la contraseña.');
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok || resultado?.success !== true) {
    const error = new Error(
      resultado?.message || 'No fue posible restablecer la contraseña.'
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}
