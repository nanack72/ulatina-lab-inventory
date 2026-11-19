export const normalizarBusqueda = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
export function opcionesUbicacion(ubicaciones, sede = '') {
  const sedes = [
    ...new Map(
      ubicaciones.map((l) => [String(l.id_sede), { id: String(l.id_sede), nombre: l.nombre_sede }]),
    ).values(),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const laboratorios = ubicaciones
    .filter((l) => !sede || String(l.id_sede) === sede)
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { sedes, laboratorios };
}
export function filtrarDistribucion(lista, sede, laboratorio, busqueda) {
  const buscar = normalizarBusqueda(busqueda);
  return lista.filter(
    (l) =>
      (!sede || String(l.id_sede) === sede) &&
      (!laboratorio || String(l.id_laboratorio) === laboratorio) &&
      normalizarBusqueda([l.codigo, l.nombre, l.nombre_sede].join(' ')).includes(buscar),
  );
}
