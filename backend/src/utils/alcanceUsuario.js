const normalizarRol = (rol) =>
  String(rol ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Únicamente el Superadministrador tiene acceso global automático.
// Los demás roles (Administrador, Coordinador, Director, Técnico, etc.)
// operan únicamente sobre las sedes y laboratorios asignados en Usuarios.
const tieneAccesoGlobal = (rolOUsuario) => {
  const rol = rolOUsuario && typeof rolOUsuario === 'object' ? rolOUsuario.rol : rolOUsuario;
  return normalizarRol(rol) === 'superadministrador';
};

module.exports = {
  normalizarRol,
  tieneAccesoGlobal,
};
