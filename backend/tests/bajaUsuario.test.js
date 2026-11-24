const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { darBajaUsuario } = require('../src/services/bajaUsuario');

test('baja de usuarios con PostgreSQL temporal', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const pool = {
    connect: async () => ({ query: (sql, valores) => db.query(sql, valores), release() {} }),
  };
  await db.exec(`
    CREATE TABLE rol (id_rol int PRIMARY KEY, nombre text);
    CREATE TABLE usuario (id_usuario int PRIMARY KEY, id_rol int REFERENCES rol, activo boolean);
    CREATE TABLE usuario_sede (id_usuario_sede int PRIMARY KEY,
      id_usuario int REFERENCES usuario, id_sede int);
    CREATE TABLE usuario_laboratorio (id_usuario_sede int REFERENCES usuario_sede, id_laboratorio int);
    CREATE TABLE token_revocado (id_usuario int REFERENCES usuario, jti text);
    CREATE TABLE historial_cambio (id_usuario int REFERENCES usuario, detalle text);
    CREATE TABLE actividad_cascade (autor int REFERENCES usuario ON DELETE CASCADE);
    CREATE TABLE actividad_setnull (autor int REFERENCES usuario ON DELETE SET NULL);
    INSERT INTO rol VALUES (1, 'Superadministrador'), (2, 'Tecnico');
  `);
  async function reiniciar() {
    await db.exec(`TRUNCATE usuario CASCADE;
      INSERT INTO usuario VALUES (1,1,true),(2,2,true),(3,1,true);
      INSERT INTO usuario_sede VALUES (20,2,1);
      INSERT INTO usuario_laboratorio VALUES (20,1);
      INSERT INTO token_revocado VALUES (2,'token-revocado');`);
  }
  const cuenta = async () => (await db.query('SELECT * FROM usuario WHERE id_usuario=2')).rows[0];
  await t.test('elimina una cuenta sin actividad y limpia solo datos de acceso', async () => {
    await reiniciar();
    assert.equal((await darBajaUsuario(pool, '2', 1)).accion, 'eliminado');
    assert.equal(await cuenta(), undefined);
    assert.equal((await db.query('SELECT * FROM usuario_sede')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM usuario_laboratorio')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM token_revocado')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM usuario WHERE id_usuario=1')).rows.length, 1);
  });
  await t.test('desactiva y conserva la autoría de los historiales', async () => {
    await reiniciar();
    await db.query("INSERT INTO historial_cambio VALUES (2,'Cambio registrado')");
    assert.equal((await darBajaUsuario(pool, '2', 1)).accion, 'desactivado');
    assert.equal((await cuenta()).activo, false);
    assert.equal((await db.query('SELECT id_usuario FROM historial_cambio')).rows[0].id_usuario, 2);
    assert.equal((await db.query('SELECT * FROM usuario_sede')).rows.length, 1);
  });
  await t.test('no borra ni desvincula actividad con CASCADE o SET NULL', async () => {
    for (const tabla of ['actividad_cascade', 'actividad_setnull']) {
      await reiniciar();
      await db.exec(`INSERT INTO ${tabla} VALUES (2)`);
      assert.equal((await darBajaUsuario(pool, '2', 1)).accion, 'desactivado');
      assert.equal((await db.query(`SELECT autor FROM ${tabla}`)).rows[0].autor, 2);
    }
  });
  await t.test('impide la baja propia, incluida la del único superadministrador', async () => {
    await reiniciar();
    await db.query('UPDATE usuario SET activo=false WHERE id_usuario=3');
    await assert.rejects(
      () => darBajaUsuario(pool, '1', 1),
      (error) => error.status === 409
    );
    assert.equal(
      (await db.query('SELECT activo FROM usuario WHERE id_usuario=1')).rows[0].activo,
      true
    );
  });
  await t.test('vuelve a comprobar el rol y estado del administrador', async () => {
    for (const cambio of ['id_rol=2', 'activo=false']) {
      await reiniciar();
      await db.exec(`UPDATE usuario SET ${cambio} WHERE id_usuario=1`);
      await assert.rejects(
        () => darBajaUsuario(pool, '2', 1),
        (error) => error.status === 403
      );
      assert.equal((await cuenta()).activo, true);
    }
  });
  await t.test('permite retirar otro superadministrador y conserva al actor', async () => {
    await reiniciar();
    assert.equal((await darBajaUsuario(pool, '3', 1)).accion, 'eliminado');
    assert.equal(
      (await db.query('SELECT activo FROM usuario WHERE id_usuario=1')).rows[0].activo,
      true
    );
  });
  await t.test('sin FK de actividad elige desactivar de forma conservadora', async () => {
    await reiniciar();
    await db.exec('CREATE TABLE actividad_sin_fk (id_usuario_tecnico int)');
    assert.equal((await darBajaUsuario(pool, '2', 1)).accion, 'desactivado');
    assert.equal((await cuenta()).activo, false);
    await db.exec('DROP TABLE actividad_sin_fk');
  });
  await t.test('revierte la limpieza si una restricción adicional impide borrar', async () => {
    await reiniciar();
    await db.exec(`CREATE FUNCTION impedir_borrado() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE foreign_key_violation USING MESSAGE='Referencia adicional'; END $$;
      CREATE TRIGGER impedir_borrado BEFORE DELETE ON usuario FOR EACH ROW EXECUTE FUNCTION impedir_borrado();`);
    assert.equal((await darBajaUsuario(pool, '2', 1)).accion, 'desactivado');
    assert.equal((await cuenta()).activo, false);
    assert.equal((await db.query('SELECT * FROM usuario_sede')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM token_revocado')).rows.length, 1);
    await db.exec('DROP TRIGGER impedir_borrado ON usuario; DROP FUNCTION impedir_borrado()');
  });
  await t.test('no permite cascadas indirectas sobre las asignaciones de acceso', async () => {
    await reiniciar();
    await db.exec(
      'CREATE TABLE actividad_por_acceso (id_acceso int REFERENCES usuario_sede ON DELETE CASCADE); INSERT INTO actividad_por_acceso VALUES (20)'
    );
    assert.equal((await darBajaUsuario(pool, '2', 1)).accion, 'desactivado');
    assert.equal(
      (await db.query('SELECT id_acceso FROM actividad_por_acceso')).rows[0].id_acceso,
      20
    );
    await db.exec('DROP TABLE actividad_por_acceso');
  });
  await t.test('responde 404 sin alterar otras cuentas', async () => {
    await reiniciar();
    await assert.rejects(
      () => darBajaUsuario(pool, '999', 1),
      (error) => error.status === 404
    );
    assert.equal((await db.query('SELECT count(*)::int AS n FROM usuario')).rows[0].n, 3);
  });
});

test('rechaza identificadores inválidos antes de conectar', async () => {
  const pool = {
    connect() {
      assert.fail('No debe conectar');
    },
  };
  for (const id of ['0', '-1', '1x', '2147483648']) {
    await assert.rejects(
      () => darBajaUsuario(pool, id, 1),
      (error) => error.status === 400
    );
  }
});

test('la migración habilita la baja con pes_runtime sin permitir borrar historiales', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE pes_owner; CREATE ROLE pes_runtime;
    CREATE TABLE rol (id_rol int PRIMARY KEY, nombre text);
    CREATE TABLE usuario (id_usuario int PRIMARY KEY, id_rol int REFERENCES rol, activo boolean);
    CREATE TABLE usuario_sede (id_usuario_sede int PRIMARY KEY, id_usuario int REFERENCES usuario);
    CREATE TABLE usuario_laboratorio (id_usuario_sede int REFERENCES usuario_sede);
    CREATE TABLE token_revocado (id_usuario int REFERENCES usuario);
    CREATE TABLE historial_cambio (id_usuario int REFERENCES usuario);
    INSERT INTO rol VALUES (1,'Superadministrador'), (2,'Tecnico');
    INSERT INTO usuario VALUES (1,1,true),(2,2,true);
    ALTER TABLE usuario OWNER TO pes_owner;
    ALTER TABLE usuario_sede OWNER TO pes_owner;
    ALTER TABLE usuario_laboratorio OWNER TO pes_owner;
    ALTER TABLE token_revocado OWNER TO pes_owner;
    GRANT SELECT ON rol,usuario,usuario_sede,usuario_laboratorio,token_revocado,historial_cambio TO pes_runtime;
    GRANT UPDATE(activo) ON usuario TO pes_runtime;
  `);
  const migracion = readFileSync(
    path.join(__dirname, '../../database/migrations/003_baja_usuarios.sql'),
    'utf8'
  );
  await db.exec(migracion);
  await db.exec('SET ROLE pes_runtime');
  const pool = {
    connect: async () => ({ query: (sql, valores) => db.query(sql, valores), release() {} }),
  };
  assert.equal((await darBajaUsuario(pool, '2', 1)).accion, 'eliminado');
  await assert.rejects(
    () => db.query('DELETE FROM historial_cambio'),
    (error) => error.code === '42501'
  );
});
