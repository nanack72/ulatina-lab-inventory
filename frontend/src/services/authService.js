const API_URL = '/api/auth';

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
