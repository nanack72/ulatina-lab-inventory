import { solicitarInventario } from './solicitarInventario.js';

export async function obtenerPaginaInventario(token, filtros, pagina, signal) {
  if (!token) throw new Error('Debés iniciar sesión para consultar el inventario.');
  const parametros = new URLSearchParams({ pagina: String(pagina), limite: '5' });
  for (const campo of ['busqueda', 'sede', 'laboratorio', 'categoria', 'estado']) {
    if (filtros[campo]) parametros.set(campo, filtros[campo]);
  }
  const { respuesta, resultado } = await solicitarInventario(
    `/api/equipos/pagina?${parametros}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal,
    }, 'No se pudo conectar con el servidor de inventario.'
  );
  if (!respuesta.ok) {
    throw Object.assign(new Error(resultado?.message || 'No se pudo cargar el inventario.'),
      { status: respuesta.status });
  }
  const opcionesValidas = ['sede', 'laboratorio', 'categoria', 'estado'].every(campo =>
    Array.isArray(resultado?.opciones?.[campo]) && resultado.opciones[campo].every(valor => typeof valor === 'string'));
  if (resultado?.success !== true || !Array.isArray(resultado.data) ||
    !Number.isSafeInteger(resultado.total) || resultado.total < 0 ||
    !Number.isSafeInteger(resultado.total_autorizados) || resultado.total_autorizados < resultado.total ||
    !Number.isSafeInteger(resultado.pagina) || resultado.pagina < 1 ||
    resultado.limite !== 5 || !opcionesValidas) {
    throw new Error('El servidor devolvió una página de inventario inválida.');
  }
  return resultado;
}
