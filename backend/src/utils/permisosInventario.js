function puedeRegistrarInventario(usuario) {
  const rol = String(usuario?.rol || '').trim().toLowerCase();

  return (
    rol === 'superadministrador' ||
    ['registro', 'edicion'].includes(usuario?.permiso_inventario)
  );
}

function puedeEditarInventario(usuario) {
  const rol = String(usuario?.rol || '').trim().toLowerCase();

  return (
    rol === 'superadministrador' ||
    usuario?.permiso_inventario === 'edicion'
  );
}

module.exports = {
  puedeRegistrarInventario,
  puedeEditarInventario,
};