import { solicitarInventario } from './solicitarInventario.js';

export async function obtenerPaginaInventario(token, filtros, pagina, limite, signal) {
  if (!token) throw new Error('Debe iniciar sesión para consultar el inventario.');
  if (![10, 20, 50].includes(limite)) throw new Error('Cantidad de equipos por página inválida.');
  const parametros = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  for (const campo of ['busqueda', 'sede', 'laboratorio', 'categoria', 'estado', 'vista']) {
    if (filtros[campo]) parametros.set(campo, filtros[campo]);
  }
  const { respuesta, resultado } = await solicitarInventario(
    `/api/equipos/pagina?${parametros}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    },
    'No se pudo conectar con el servidor de inventario.'
  );
  if (!respuesta.ok) {
    throw Object.assign(new Error(resultado?.message || 'No se pudo cargar el inventario.'), {
      status: respuesta.status,
    });
  }
  const opcionesValidas = ['sede', 'laboratorio', 'categoria', 'estado'].every(
    (campo) =>
      Array.isArray(resultado?.opciones?.[campo]) &&
      resultado.opciones[campo].every((valor) => typeof valor === 'string')
  );
  if (
    resultado?.success !== true ||
    !Array.isArray(resultado.data) ||
    !Number.isSafeInteger(resultado.total) ||
    resultado.total < 0 ||
    !Number.isSafeInteger(resultado.total_autorizados) ||
    resultado.total_autorizados < resultado.total ||
    !Number.isSafeInteger(resultado.pagina) ||
    resultado.pagina < 1 ||
    resultado.limite !== limite ||
    !opcionesValidas
  ) {
    throw new Error('El servidor devolvió una página de inventario inválida.');
  }
  return resultado;
}
