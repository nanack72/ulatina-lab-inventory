const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const ExcelJS = require('exceljs');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { modificarRol } = require('../src/services/rolesService');
const fotos = require('../src/services/fotosEquipoService');
const { extraerImagenes } = require('../src/utils/imagenesExcel');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH1sAAAAASUVORK5CYII=', 'base64');

test('comprobar la revisión valida en el servidor sin insertar equipos', async () => {
  const consultas=[];
  const cliente={release(){},async query(sql){
    consultas.push(sql);
    const rows = sql.includes('FROM public.usuario u') ? [{activo:true,rol:'Superadministrador',permiso_inventario:'edicion'}]
      : sql.includes('FROM public.categoria') ? [{id_categoria:1,nombre:'C'}]
      : sql.includes('FROM public.estado') ? [{id_estado:1,nombre:'E'}]
      : sql.includes('FROM public.laboratorio l') ? [{id_laboratorio:1,nombre:'L'}] : [];
    return {rows};
  }};
  const archivo=path.join(__dirname,'../src/routes/importacionEquiposRoutes.js');
  const local=createRequire(archivo),modulo={exports:{}};
  vm.runInNewContext(readFileSync(archivo,'utf8'),{module:modulo,console,Buffer,require:n=>n==='../config/database'?{connect:async()=>cliente}:n==='../middlewares/authMiddleware'?{verificarToken:(req,res,next)=>next()}:local(n)});
  const ruta=modulo.exports.stack.find(c=>c.route?.path==='/confirmar').route.stack[0].handle;
  const res={json(data){this.data=data;return this;},status(code){this.code=code;return this;}};
  await ruta({usuario:{idUsuario:1},body:{validar_solo:true,filas:[{fila:2,nombre:'Prueba',id_categoria:1,id_estado:1,id_laboratorio:1}]}},res);
  assert.equal(res.data.success,true);
  assert.equal(res.data.data.filas[0].errores.length,0);
  assert.ok(consultas.includes('ROLLBACK'));
  assert.ok(!consultas.some(sql=>sql.includes('INSERT')||sql==='COMMIT'));
});

test('extrae imágenes de un Excel real por fila y avisa de imágenes sin equipo', async () => {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Inventario');
  hoja.addRow(['Nombre del equipo']); hoja.addRow(['Equipo A']); hoja.addRow(['Equipo B']);
  const id = libro.addImage({buffer:png,extension:'png'});
  hoja.addImage(id, {tl:{col:2,row:1},ext:{width:20,height:20}});
  hoja.addImage(id, {tl:{col:2,row:0},ext:{width:20,height:20}});
  const cargado = new ExcelJS.Workbook();
  await cargado.xlsx.load(await libro.xlsx.writeBuffer());
  const resultado = extraerImagenes(cargado,cargado.getWorksheet('Inventario'),[{fila:2},{fila:3}]);
  assert.equal(resultado.porFila.get(2).length,1);
  assert.equal(resultado.porFila.get(3).length,0);
  assert.deepEqual(Buffer.from(resultado.porFila.get(2)[0].base64,'base64'),png);
  assert.equal(resultado.avisos.length,1);
});
test('rechaza fotos vacías, excesivas y formatos activos como SVG', () => {
  for(const buffer of [Buffer.alloc(0),Buffer.alloc(5242881),Buffer.from('<svg onload="x()"/>')]) assert.throws(()=>fotos.validarFoto({buffer}));
  assert.equal(fotos.validarFoto({buffer:png}),'image/png');
});
test('extrae hasta 50 fotos por equipo y avisa sobre la número 51', () => {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Inventario');
  const id = libro.addImage({buffer:png,extension:'png'});
  for (let i=0;i<51;i++) hoja.addImage(id,{tl:{col:2,row:1},ext:{width:20,height:20}});
  const resultado = extraerImagenes(libro,hoja,[{fila:2}]);
  assert.equal(resultado.porFila.get(2).length,50);
  assert.equal(resultado.avisos.length,1);
});
test('roles, fotos y permisos sobre PostgreSQL temporal', async t => {
  const db = new PGlite(); t.after(()=>db.close());
  const pool = {connect:async()=>({query:(sql,args)=>db.query(sql,args),release(){}})};
  await db.exec(`CREATE ROLE pes_owner; CREATE ROLE pes_runtime;
    GRANT pes_owner TO postgres; GRANT ALL ON SCHEMA public TO pes_owner;
    CREATE TABLE rol(id_rol serial PRIMARY KEY,nombre text UNIQUE);
    CREATE TABLE usuario(id_usuario int PRIMARY KEY,id_rol int REFERENCES rol,activo boolean,permiso_inventario text);
    CREATE TABLE laboratorio(id_laboratorio int PRIMARY KEY,id_sede int);
    CREATE TABLE equipo(id_equipo int PRIMARY KEY,id_laboratorio int REFERENCES laboratorio);
    CREATE TABLE usuario_sede(id_usuario_sede int,id_usuario int,id_sede int);
    CREATE TABLE usuario_laboratorio(id_usuario_sede int,id_sede int,id_laboratorio int);
    INSERT INTO rol(nombre) VALUES('Superadministrador'),('Tecnico');
    INSERT INTO usuario VALUES(1,1,true,'edicion'),(2,2,true,'edicion'),(3,2,true,'consulta');
    INSERT INTO laboratorio VALUES(1,1),(2,2); INSERT INTO equipo VALUES(1,1),(2,2);
    INSERT INTO usuario_sede VALUES(1,2,1),(2,3,1);
    INSERT INTO usuario_laboratorio VALUES(1,1,1),(2,1,1);
    GRANT REFERENCES ON equipo,usuario TO pes_owner;
  `);
  await db.exec(readFileSync(path.join(__dirname,'../../database/migrations/005_fotos_equipos.sql'),'utf8'));
  await db.exec(`ALTER TABLE rol OWNER TO pes_owner;`);
  await db.exec(readFileSync(path.join(__dirname,'../../database/migrations/004_roles_personalizados.sql'),'utf8'));
  await t.test('las migraciones permiten fotos y roles con la cuenta de la aplicación', async()=>{
    await db.exec(`SET ROLE pes_runtime; INSERT INTO rol(nombre) VALUES('Temporal');
      UPDATE rol SET nombre='Temporal editado' WHERE nombre='Temporal';
      DELETE FROM rol WHERE nombre='Temporal editado';
      INSERT INTO foto_equipo(id_equipo,id_usuario,nombre_archivo,mime,datos) VALUES(1,1,'foto.png','image/png',decode('89504e470d0a1a0a','hex'));
      DELETE FROM foto_equipo; RESET ROLE;`);
  });
  await t.test('crea, edita y elimina un rol personalizado; protege roles asignados y del sistema', async()=>{
    await modificarRol(pool,'crear',null,'Investigador',1);
    const id=(await db.query("SELECT id_rol FROM rol WHERE nombre='Investigador'")).rows[0].id_rol;
    await modificarRol(pool,'editar',id,'Docente',1);
    await assert.rejects(modificarRol(pool,'crear',null,'Docente',1),e=>e.status===409);
    await db.query('UPDATE usuario SET id_rol=$1 WHERE id_usuario=3',[id]);
    await assert.rejects(modificarRol(pool,'eliminar',id,null,1),e=>e.status===409);
    await db.query('UPDATE usuario SET id_rol=2 WHERE id_usuario=3');
    await modificarRol(pool,'eliminar',id,null,1);
    await assert.rejects(modificarRol(pool,'eliminar',1,null,1),e=>e.status===409);
    await assert.rejects(modificarRol(pool,'crear',null,'Otro',2),e=>e.status===403);
  });
  await t.test('agrega, lee y elimina solo la foto elegida; conserva los bytes',async()=>{
    const a=await fotos.subirFotoEquipo(pool,1,2,{buffer:png,originalname:'uno.png'});
    const b=await fotos.subirFotoEquipo(pool,1,2,{buffer:png,originalname:'dos.png'});
    assert.equal((await fotos.listarFotos(pool,1,2)).length,2);
    assert.deepEqual(Buffer.from((await fotos.obtenerFoto(pool,1,2,a.id_foto)).datos),png);
    await fotos.eliminarFoto(pool,1,2,a.id_foto);
    assert.equal((await fotos.listarFotos(pool,1,2))[0].id_foto,b.id_foto);
    await assert.rejects(fotos.obtenerFoto(pool,2,1,b.id_foto),e=>e.status===404);
  });
  await t.test('impide fotos en equipos ajenos y escrituras de cuentas de consulta',async()=>{
    await assert.rejects(fotos.listarFotos(pool,2,2),e=>e.status===404);
    await assert.rejects(fotos.subirFotoEquipo(pool,1,3,{buffer:png}),e=>e.status===403);
    await assert.rejects(fotos.eliminarFoto(pool,1,3,1),e=>e.status===403);
    for(let i=1;i<50;i++) await fotos.subirFotoEquipo(pool,1,2,{buffer:png});
    await assert.rejects(fotos.subirFotoEquipo(pool,1,2,{buffer:png}),e=>e.status===409);
  });
});

