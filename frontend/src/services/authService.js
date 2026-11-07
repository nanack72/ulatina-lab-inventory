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
    throw new Error(
      'No se pudo conectar con el servidor. Verificá que esté encendido.'
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.message || 'No fue posible iniciar sesión.'
    );
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
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor para cerrar la sesión.'
    );
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = new Error(
      resultado?.message || 'No fue posible cerrar la sesión.'
    );

    error.status = respuesta.status;
    throw error;
  }

  if (resultado?.success !== true) {
    throw new Error(
      'El servidor no confirmó el cierre de sesión.'
    );
  }

  return resultado;
}
