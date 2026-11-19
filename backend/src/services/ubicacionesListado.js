// Las opciones conservan el alcance del módulo, sin depender de la página o los filtros.
const SQL_UBICACIONES = `SELECT l.id_laboratorio,l.id_sede,l.codigo,l.nombre,s.nombre AS nombre_sede
FROM public.laboratorio l JOIN public.sede s ON s.id_sede=l.id_sede
WHERE ($2::boolean OR EXISTS (SELECT 1 FROM public.usuario_sede us JOIN public.usuario_laboratorio ul ON ul.id_usuario_sede=us.id_usuario_sede WHERE us.id_usuario=$1 AND us.id_sede=l.id_sede AND ul.id_sede=l.id_sede AND ul.id_laboratorio=l.id_laboratorio))`;
async function listarUbicaciones(pool, usuario, global) {
  return (
    await pool.query(SQL_UBICACIONES + ' ORDER BY s.nombre,l.nombre,l.id_laboratorio', [
      Number(usuario.idUsuario),
      global,
    ])
  ).rows;
}
module.exports = { SQL_UBICACIONES, listarUbicaciones };
