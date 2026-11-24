const esSuper = (rol) =>
  String(rol || '')
    .trim()
    .toLowerCase() === 'superadministrador';
const fallo = (message, status = 409) => Object.assign(new Error(message), { status });
const identificador = (nombre) => '"' + nombre.replace(/"/g, '""') + '"';
const TECNICAS = new Set([
  'public.usuario_sede',
  'public.usuario_laboratorio',
  'public.token_revocado',
]);

async function tieneActividad(cliente, id) {
  // Incluye referencias con CASCADE o SET NULL: nunca permitir que borren autoría.
  // También detecta columnas convencionales sin FK; en ese caso solo se desactiva.
  const referencias = await cliente.query(`
    WITH fk AS (
      SELECT DISTINCT ns.nspname AS esquema, t.relname AS tabla, a.attname AS columna
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = t.relnamespace
      CROSS JOIN LATERAL unnest(c.conkey, c.confkey) AS claves(local, remoto)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = claves.local
      JOIN pg_attribute destino ON destino.attrelid = c.confrelid AND destino.attnum = claves.remoto
      WHERE c.contype = 'f' AND c.confrelid = 'public.usuario'::regclass
        AND destino.attname = 'id_usuario'
    ), indirectas AS (
      SELECT ns.nspname AS esquema, t.relname AS tabla, a.attname AS columna
      FROM pg_constraint c
      JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace ns ON ns.oid=t.relnamespace
      CROSS JOIN LATERAL unnest(c.conkey) AS clave(numero)
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=clave.numero
      WHERE c.contype='f' AND c.confrelid IN ('public.usuario_sede'::regclass,
        'public.usuario_laboratorio'::regclass, 'public.token_revocado'::regclass)
    ), convencionales AS (
      SELECT ns.nspname AS esquema, t.relname AS tabla, a.attname AS columna
      FROM pg_attribute a
      JOIN pg_class t ON t.oid = a.attrelid
      JOIN pg_namespace ns ON ns.oid = t.relnamespace
      WHERE ns.nspname = 'public' AND t.relkind IN ('r','p')
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attname ~ '^id_usuario($|_)' AND t.relname <> 'usuario'
    )
    SELECT esquema, tabla, columna, true AS protegida FROM fk
    UNION
    SELECT esquema, tabla, columna, false AS protegida FROM indirectas
    UNION
    SELECT esquema, tabla, columna, false AS protegida FROM convencionales c
      WHERE NOT EXISTS (SELECT 1 FROM fk WHERE fk.esquema=c.esquema
        AND fk.tabla=c.tabla AND fk.columna=c.columna)
  `);
  for (const referencia of referencias.rows) {
    if (TECNICAS.has(`${referencia.esquema}.${referencia.tabla}`)) continue;
    // Una relación sin integridad referencial no permite garantizar una eliminación segura.
    if (!referencia.protegida) return true;
    const tabla = `${identificador(referencia.esquema)}.${identificador(referencia.tabla)}`;
    const resultado = await cliente.query(
      `SELECT 1 FROM ${tabla} WHERE ${identificador(referencia.columna)} = $1 LIMIT 1`,
      [id]
    );
    if (resultado.rows.length) return true;
  }
  return false;
}

async function darBajaUsuario(pool, id, actor) {
  if (
    !/^[1-9]\d*$/.test(String(id)) ||
    Number(id) > 2147483647 ||
    !Number.isSafeInteger(Number(actor)) ||
    Number(actor) <= 0
  ) {
    throw fallo('Seleccione un usuario válido.', 400);
  }
  id = Number(id);
  actor = Number(actor);
  if (id === actor) throw fallo('No puede eliminar ni desactivar su propia cuenta.');
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(2026, 1101)');
    const cuentas = await cliente.query(
      `
      SELECT u.id_usuario, u.activo, r.nombre AS rol FROM public.usuario u
      JOIN public.rol r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = ANY($1::integer[]) ORDER BY u.id_usuario FOR UPDATE OF u
    `,
      [[actor, id]]
    );
    const administrador = cuentas.rows.find((u) => u.id_usuario === actor);
    if (!administrador?.activo || !esSuper(administrador.rol)) {
      throw fallo('Su cuenta ya no tiene permisos para administrar usuarios.', 403);
    }
    const usuario = cuentas.rows.find((u) => u.id_usuario === id);
    if (!usuario) throw fallo('El usuario no existe.', 404);
    if (usuario.activo && esSuper(usuario.rol)) {
      const otros = await cliente.query(
        `SELECT 1 FROM public.usuario u
        JOIN public.rol r ON r.id_rol=u.id_rol WHERE u.activo = true
        AND lower(trim(r.nombre))='superadministrador' AND u.id_usuario <> $1 LIMIT 1`,
        [id]
      );
      if (!otros.rows.length) throw fallo('Debe conservar al menos un Superadministrador activo.');
    }
    let conservar = await tieneActividad(cliente, id);
    if (!conservar) {
      await cliente.query('SAVEPOINT eliminar_cuenta');
      try {
        await cliente.query(
          `DELETE FROM public.usuario_laboratorio ul USING public.usuario_sede us
          WHERE ul.id_usuario_sede=us.id_usuario_sede AND us.id_usuario=$1`,
          [id]
        );
        await cliente.query('DELETE FROM public.usuario_sede WHERE id_usuario=$1', [id]);
        await cliente.query('DELETE FROM public.token_revocado WHERE id_usuario=$1', [id]);
        await cliente.query('DELETE FROM public.usuario WHERE id_usuario=$1', [id]);
      } catch (error) {
        if (error.code !== '23503') throw error;
        await cliente.query('ROLLBACK TO SAVEPOINT eliminar_cuenta');
        conservar = true;
      }
    }
    if (conservar) {
      await cliente.query('UPDATE public.usuario SET activo=false WHERE id_usuario=$1', [id]);
    }
    await cliente.query('COMMIT');
    return {
      success: true,
      accion: conservar ? 'desactivado' : 'eliminado',
      message: conservar
        ? 'Cuenta desactivada. Se conservan sus registros y la autoría de sus actividades.'
        : 'Usuario sin actividad eliminado correctamente.',
    };
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    if (error.code === '42501') {
      console.error(
        'Permisos insuficientes al dar de baja usuarios; revisar migración 003:',
        error
      );
      throw fallo(
        'No fue posible dar de baja la cuenta. Contacte al responsable del sistema.',
        503
      );
    }
    throw error;
  } finally {
    cliente.release();
  }
}

module.exports = { darBajaUsuario };
