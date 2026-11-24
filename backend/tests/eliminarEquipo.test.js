const test = require('node:test');
const assert = require('node:assert/strict');
const { eliminarEquipo } = require('../src/services/eliminarEquipo');

function base({
  permiso = false,
  rol = 'Tecnico',
  activo = true,
  encontrado = true,
  eliminado = false,
  fallar = false,
} = {}) {
  const consultas = [];
  let liberado = false;
  const cliente = {
    async query(sql, valores) {
      consultas.push({ sql, valores });
      if (sql.includes('FROM public.usuario u'))
        return { rows: [{ activo, rol, puede_eliminar_equipos: permiso }] };
      if (sql.includes('FROM public.equipo e'))
        return {
          rowCount: encontrado ? 1 : 0,
          rows: encontrado ? [{ eliminado_en: eliminado ? new Date() : null }] : [],
        };
      if (fallar && sql.startsWith('UPDATE')) throw new Error('Fallo de escritura');
      return { rows: [], rowCount: 1 };
    },
    release() {
      liberado = true;
    },
  };
  return { pool: { connect: async () => cliente }, consultas, liberado: () => liberado };
}
const actor = { idUsuario: 9 };
test('rechaza ID y motivo inválidos antes de consultar la base', async () => {
  await assert.rejects(eliminarEquipo(null, '1 OR 1=1', actor, 'Registro duplicado'), {
    status: 400,
  });
  await assert.rejects(eliminarEquipo(null, 1, actor, '  '), { status: 400 });
});
test('no permite eliminar solo por tener permiso de edición', async () => {
  const db = base();
  await assert.rejects(eliminarEquipo(db.pool, 1, actor, 'Registro duplicado'), { status: 403 });
  assert.equal(
    db.consultas.some((q) => q.sql.startsWith('UPDATE')),
    false
  );
  assert.ok(db.liberado());
});
test('rechaza una cuenta inactiva aunque sea superadministradora', async () => {
  const db = base({ activo: false, rol: 'Superadministrador' });
  await assert.rejects(eliminarEquipo(db.pool, 1, actor, 'Registro duplicado'), { status: 403 });
});
test('el usuario autorizado sigue restringido a laboratorios asignados', async () => {
  const db = base({ permiso: true, encontrado: false });
  await assert.rejects(eliminarEquipo(db.pool, 2, actor, 'Registro duplicado'), { status: 404 });
  const acceso = db.consultas.find((q) => q.sql.includes('FROM public.equipo e'));
  assert.deepEqual(acceso.valores, [2, 9, false]);
  assert.match(acceso.sql, /ul.id_sede = l.id_sede/);
  assert.equal(
    db.consultas.some((q) => q.sql.startsWith('UPDATE')),
    false
  );
});
test('el superadministrador conserva acceso global y guarda la auditoría sin borrar datos', async () => {
  const db = base({ rol: 'Superadministrador' });
  await eliminarEquipo(db.pool, 2, actor, '  Registrado por error  ');
  assert.deepEqual(db.consultas.find((q) => q.sql.includes('FROM public.equipo e')).valores, [
    2,
    9,
    true,
  ]);
  const escritura = db.consultas.find((q) => q.sql.startsWith('UPDATE'));
  assert.deepEqual(escritura.valores, [2, 9, 'Registrado por error']);
  assert.match(escritura.sql, /eliminado_en = CURRENT_TIMESTAMP/);
  assert.equal(
    db.consultas.some((q) => /DELETE FROM/.test(q.sql)),
    false
  );
  assert.equal(db.consultas.at(-1).sql, 'COMMIT');
});
test('rechaza una eliminación repetida', async () => {
  const db = base({ permiso: true, eliminado: true });
  await assert.rejects(eliminarEquipo(db.pool, 1, actor, 'Registro duplicado'), { status: 409 });
  assert.equal(db.consultas.at(-1).sql, 'ROLLBACK');
});
test('revierte la transacción y libera la conexión si falla la escritura', async () => {
  const db = base({ permiso: true, fallar: true });
  await assert.rejects(
    eliminarEquipo(db.pool, 1, actor, 'Registro duplicado'),
    /Fallo de escritura/
  );
  assert.equal(db.consultas.at(-1).sql, 'ROLLBACK');
  assert.ok(db.liberado());
});
