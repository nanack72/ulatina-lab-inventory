const { optimizarFoto } = require('./optimizarFoto');
const { puedeRegistrarInventario, puedeEditarInventario } = require('../utils/permisosInventario');
const fallo = (message, status = 400) => Object.assign(new Error(message), { status });
const MAX_FOTOS_EQUIPO = 50;
const MAX_FOTO = 5 * 1024 * 1024;
function tipoImagen(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  return null;
}
function validarFoto(archivo) {
  if (!archivo?.buffer?.length || archivo.buffer.length > MAX_FOTO) throw fallo('Cada foto debe tener contenido y no superar 5 MB.');
  const mime = tipoImagen(archivo.buffer);
  if (!mime) throw fallo('Solo se permiten fotos JPG, PNG o WEBP válidas.');
  return mime;
}
async function conAcceso(pool, equipo, actor, accion, operar) {
  if (!/^[1-9]\d*$/.test(String(equipo)) || Number(equipo) > 2147483647) throw fallo('Equipo no válido.');
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const cuenta = await cliente.query(`SELECT u.activo,u.permiso_inventario,r.nombre AS rol
      FROM public.usuario u JOIN public.rol r ON r.id_rol=u.id_rol WHERE u.id_usuario=$1 FOR SHARE OF u`, [actor]);
    const usuario = cuenta.rows[0];
    if (!usuario?.activo) throw fallo('La cuenta no está disponible.',401);
    if (accion === 'subir' && !puedeRegistrarInventario(usuario)) throw fallo('No tiene permisos para agregar fotos.',403);
    if (accion === 'eliminar' && !puedeEditarInventario(usuario)) throw fallo('No tiene permisos para eliminar fotos.',403);
    const visible = await cliente.query(`SELECT e.id_equipo FROM public.equipo e
      JOIN public.laboratorio l ON l.id_laboratorio=e.id_laboratorio
      WHERE e.id_equipo=$1 AND e.eliminado_en IS NULL AND ($3::boolean OR EXISTS (
        SELECT 1 FROM public.usuario_sede us JOIN public.usuario_laboratorio ul ON ul.id_usuario_sede=us.id_usuario_sede
        WHERE us.id_usuario=$2 AND us.id_sede=l.id_sede AND ul.id_sede=l.id_sede AND ul.id_laboratorio=e.id_laboratorio))
      FOR UPDATE OF e`, [Number(equipo), actor, String(usuario.rol).trim().toLowerCase() === 'superadministrador']);
    if (!visible.rows.length) throw fallo('Equipo no encontrado o sin acceso.',404);
    const resultado = await operar(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) { await cliente.query('ROLLBACK').catch(() => {}); throw error; }
  finally { cliente.release(); }
}
async function listarFotos(pool, equipo, actor) {
  return conAcceso(pool,equipo,actor,'ver', async cliente => (await cliente.query(
    'SELECT id_foto,nombre_archivo,mime,fecha_creacion FROM public.foto_equipo WHERE id_equipo=$1 ORDER BY id_foto', [equipo])).rows);
}
async function subirFotoEquipo(pool, equipo, actor, archivo) {
  validarFoto(archivo);
  return conAcceso(pool,equipo,actor,'subir', async cliente => {
    const cantidad = await cliente.query('SELECT count(*)::int AS total FROM public.foto_equipo WHERE id_equipo=$1',[equipo]);
    if (cantidad.rows[0].total >= MAX_FOTOS_EQUIPO) throw fallo('Puede guardar hasta '+MAX_FOTOS_EQUIPO+' fotos por equipo.',409);
    const foto = await optimizarFoto(archivo.buffer);
    const registro = (await cliente.query(`INSERT INTO public.foto_equipo(id_equipo,id_usuario,nombre_archivo,mime,datos)
      VALUES($1,$2,$3,$4,$5) RETURNING id_foto,nombre_archivo,mime,fecha_creacion`,
      [equipo,actor,String(archivo.originalname || 'foto').slice(0,180),foto.mime,foto.buffer])).rows[0];
    return { ...registro, optimizacion: foto.optimizacion };
  });
}
async function obtenerFoto(pool,equipo,actor,id) {
  return conAcceso(pool,equipo,actor,'ver',async cliente => {
    const foto = await cliente.query('SELECT datos,mime FROM public.foto_equipo WHERE id_equipo=$1 AND id_foto=$2',[equipo,id]);
    if (!foto.rows.length) throw fallo('Foto no encontrada.',404);
    return foto.rows[0];
  });
}
async function eliminarFoto(pool,equipo,actor,id) {
  return conAcceso(pool,equipo,actor,'eliminar',async cliente => {
    const foto = await cliente.query('DELETE FROM public.foto_equipo WHERE id_equipo=$1 AND id_foto=$2 RETURNING id_foto',[equipo,id]);
    if (!foto.rows.length) throw fallo('Foto no encontrada.',404);
  });
}
module.exports = { MAX_FOTOS_EQUIPO, listarFotos, subirFotoEquipo, obtenerFoto, eliminarFoto, tipoImagen, validarFoto };
