const express = require('express');
const multer = require('multer');
const pool = require('../config/database');
const servicio = require('../services/fotosEquipoService');
const { puedeRegistrarInventario } = require('../utils/permisosInventario');
const router = express.Router({ mergeParams: true });
router.use((req,res,next) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id)>2147483647) return res.status(400).json({success:false,message:'Equipo no válido.'});
  next();
});
const upload = multer({ storage:multer.memoryStorage(), limits:{fileSize:5*1024*1024,files:1,fields:0,parts:1} }).single('foto');
function responder(res,error) {
  if (error.status) return res.status(error.status).json({success:false,message:error.message});
  console.error('Error en fotos del equipo:',error);
  return res.status(500).json({success:false,message:'No fue posible completar la operación de fotos.'});
}
router.get('/', async(req,res) => {
  try { res.json({success:true,data:await servicio.listarFotos(pool,req.params.id,req.usuario.idUsuario)}); }
  catch(error) { responder(res,error); }
});
router.post('/', (req,res,next) => {
  if (!puedeRegistrarInventario(req.usuario)) return res.status(403).json({success:false,message:'No tiene permisos para agregar fotos.'});
  upload(req,res,error => error ? res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({success:false,message:'Adjunte una sola foto de hasta 5 MB en el campo foto.'}) : next());
}, async(req,res) => {
  try { res.status(201).json({success:true,data:await servicio.subirFotoEquipo(pool,req.params.id,req.usuario.idUsuario,req.file)}); }
  catch(error) { responder(res,error); }
});
router.param('foto', (req,res,next,id) => /^[1-9]\d*$/.test(id) && Number(id)<=2147483647 ? next() : res.status(400).json({success:false,message:'Foto no válida.'}));
router.get('/:foto/archivo',async(req,res) => {
  try {
    const foto = await servicio.obtenerFoto(pool,req.params.id,req.usuario.idUsuario,req.params.foto);
    res.set({'Content-Type':foto.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(Buffer.from(foto.datos));
  } catch(error) { responder(res,error); }
});
router.delete('/:foto',async(req,res) => {
  try { await servicio.eliminarFoto(pool,req.params.id,req.usuario.idUsuario,req.params.foto); res.json({success:true,message:'Foto eliminada.'}); }
  catch(error) { responder(res,error); }
});
module.exports=router;
