function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
}

// Filtra el listado completo antes de calcular sus páginas.
export function filtrarUsuarios(
  usuarios,
  { busqueda = '', rol = '', sede = '', estado = '' } = {}
) {
  const termino = normalizar(busqueda);
  return usuarios.filter((usuario) => {
    if (rol && String(usuario.id_rol) !== String(rol)) return false;
    const global = normalizar(usuario.rol) === 'superadministrador';
    if (sede && !global && !(usuario.sedes ?? []).some((id) => String(id) === String(sede)))
      return false;
    if (estado === 'activa' && usuario.activo !== true) return false;
    if (estado === 'inactiva' && usuario.activo !== false) return false;
    return [
      usuario.nombre_completo,
      usuario.correo_institucional,
      usuario.rol,
      usuario.activo ? 'Activa' : 'Inactiva',
    ].some((valor) => normalizar(valor).includes(termino));
  });
}
