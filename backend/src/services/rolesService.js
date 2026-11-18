const normalizar = nombre => String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '').toLowerCase();
const SISTEMA = new Set(['superadministrador', 'administrador', 'admin', 'tecnico', 'coordinador', 'director']);
const esRolSistema = nombre => SISTEMA.has(normalizar(nombre));
const fallo = (message, status = 409) => Object.assign(new Error(message), { status });

async function modificarRol(pool, accion, id, nombre, actor) {
  if (accion !== 'eliminar' && (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 50)) {
    throw fallo('Ingrese un nombre de rol de hasta 50 caracteres.', 400);
  }
  if (accion !== 'eliminar' && esRolSistema(nombre)) throw fallo('Los nombres de los roles del sistema están reservados.');
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(2026, 1101)');
    const permiso = await cliente.query(`SELECT u.activo, r.nombre FROM public.usuario u
      JOIN public.rol r ON r.id_rol=u.id_rol WHERE u.id_usuario=$1 FOR SHARE OF u`, [actor]);
    if (!permiso.rows[0]?.activo || normalizar(permiso.rows[0].nombre) !== 'superadministrador') {
      throw fallo('No tiene permisos para administrar roles.', 403);
    }
    if (accion !== 'crear') {
      const actual = await cliente.query('SELECT nombre FROM public.rol WHERE id_rol=$1 FOR UPDATE', [id]);
      if (!actual.rows.length) throw fallo('El rol ya no existe.', 404);
      if (esRolSistema(actual.rows[0].nombre)) throw fallo('Este rol del sistema está protegido y no puede modificarse ni eliminarse.');
    }
    if (accion === 'eliminar') {
      const asignados = await cliente.query('SELECT 1 FROM public.usuario WHERE id_rol=$1 LIMIT 1', [id]);
      if (asignados.rows.length) throw fallo('El rol está asignado a usuarios. Cambie sus roles antes de eliminarlo.');
      await cliente.query('DELETE FROM public.rol WHERE id_rol=$1', [id]);
    } else {
      const duplicado = await cliente.query(`SELECT 1 FROM public.rol
        WHERE lower(trim(nombre))=lower($1) AND ($2::integer IS NULL OR id_rol<>$2) LIMIT 1`, [nombre.trim(), accion === 'crear' ? null : id]);
      if (duplicado.rows.length) throw fallo('Ya existe un rol con ese nombre.');
      if (accion === 'crear') await cliente.query('INSERT INTO public.rol(nombre) VALUES($1)', [nombre.trim()]);
      else await cliente.query('UPDATE public.rol SET nombre=$1 WHERE id_rol=$2', [nombre.trim(), id]);
    }
    await cliente.query('COMMIT');
    return { success: true, message: accion === 'crear' ? 'Rol creado correctamente.' : accion === 'eliminar' ? 'Rol eliminado correctamente.' : 'Rol actualizado correctamente.' };
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    if (error.code === '23503') throw fallo('El rol está en uso y no puede eliminarse.');
    throw error;
  } finally { cliente.release(); }
}
module.exports = { modificarRol, esRolSistema };
