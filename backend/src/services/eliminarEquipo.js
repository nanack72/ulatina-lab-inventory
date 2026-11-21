const fallo = (message, status) => Object.assign(new Error(message), { status });

async function eliminarEquipo(pool, id, usuario, motivo) {
  if (!/^[1-9]\d*$/.test(String(id)) || Number(id) > 2147483647) {
    throw fallo('Equipo no válido.', 400);
  }
  if (typeof motivo !== 'string' || motivo.trim().length < 5 || Array.from(motivo.trim()).length > 500) {
    throw fallo('Indique un motivo de entre 5 y 500 caracteres.', 400);
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // Se consulta el permiso actual, aunque el navegador conserve una sesión anterior.
    const cuenta = await cliente.query(`SELECT u.activo, u.puede_eliminar_equipos, r.nombre AS rol
      FROM public.usuario u JOIN public.rol r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = $1 FOR SHARE OF u, r`, [usuario.idUsuario]);
    const actual = cuenta.rows[0];
    const global = String(actual?.rol || '').trim().toLowerCase() === 'superadministrador';
    if (!actual?.activo || (!global && actual.puede_eliminar_equipos !== true)) {
      throw fallo('No tiene permiso para eliminar equipos.', 403);
    }
    const equipo = await cliente.query(`SELECT e.id_equipo, e.eliminado_en
      FROM public.equipo e JOIN public.laboratorio l ON l.id_laboratorio = e.id_laboratorio
      WHERE e.id_equipo = $1 AND ($3::boolean OR EXISTS (
        SELECT 1 FROM public.usuario_sede us
        JOIN public.usuario_laboratorio ul ON ul.id_usuario_sede = us.id_usuario_sede
        WHERE us.id_usuario = $2 AND us.id_sede = l.id_sede
          AND ul.id_sede = l.id_sede AND ul.id_laboratorio = l.id_laboratorio
      )) FOR UPDATE OF e`, [Number(id), usuario.idUsuario, global]);
    if (!equipo.rowCount) throw fallo('Equipo no encontrado o sin acceso.', 404);
    if (equipo.rows[0].eliminado_en) throw fallo('El equipo ya fue eliminado.', 409);
    await cliente.query("SELECT set_config('app.usuario_id', $1, true)", [String(usuario.idUsuario)]);
    await cliente.query(`UPDATE public.equipo
      SET eliminado_en = CURRENT_TIMESTAMP, eliminado_por = $2, motivo_eliminacion = $3
      WHERE id_equipo = $1`, [Number(id), usuario.idUsuario, motivo.trim()]);
    await cliente.query(`INSERT INTO public.historial_eliminacion_equipo
      (id_equipo, id_usuario, accion, motivo)
      VALUES ($1, $2, 'eliminar', $3)`, [Number(id), usuario.idUsuario, motivo.trim()]);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}
module.exports = { eliminarEquipo };
