async function solicitar(idEquipo, token, ruta = '', opciones = {}) {
  let respuesta;
  try { respuesta = await fetch(`/api/equipos/${encodeURIComponent(idEquipo)}/fotos${ruta}`, {
    ...opciones, headers: { Authorization: `Bearer ${token}` },
  }); } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar para cargar las fotos.', { cause: error });
  }
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw Object.assign(new Error(datos?.message || 'No se pudo completar la operación de fotos.'), { status:respuesta.status });
  }
  return respuesta;
}
export async function listarFotos(id,token,signal) { return (await (await solicitar(id,token,'',{signal})).json()).data; }
export async function cargarImagen(id,foto,token,signal) { return (await solicitar(id,token,`/${foto}/archivo`,{signal})).blob(); }
export async function agregarFoto(id,archivo,token) {
  const body = new FormData(); body.append('foto',archivo);
  return (await solicitar(id,token,'',{method:'POST',body})).json();
}
export async function borrarFoto(id,foto,token) { return (await solicitar(id,token,`/${foto}`,{method:'DELETE'})).json(); }
