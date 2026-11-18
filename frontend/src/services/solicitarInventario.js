// Comparte el transporte y la lectura JSON. Cada operación conserva
// sus validaciones y sus mensajes según el estado HTTP recibido.
export async function solicitarInventario(
  url,
  opciones,
  mensajeConexion,
  { propagarCancelacion = true } = {}
) {
  let respuesta;

  try {
    respuesta = await fetch(url, opciones);
  } catch (error) {
    if (propagarCancelacion && error.name === 'AbortError') throw error;
    throw new Error(mensajeConexion, { cause: error });
  }

  const resultado = await respuesta.json().catch(() => null);
  return { respuesta, resultado };
}
