const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const pool = require('../config/database');
const { verificarAccesoEquipo } = require('../utils/accesoEquipos');
const { tieneAccesoGlobal } = require('../utils/alcanceUsuario');
const {
  DIRECTORIO_EVIDENCIAS,
  eliminarArchivo,
  tieneFirmaDeImagen,
} = require('../middlewares/uploadMiddleware');
const { detectarMimePorFirma, comprimirImagen } = require('../utils/compresionImagen');

const TIPOS_VALIDOS = ['Antes', 'Durante', 'Después'];

// Normaliza el tipo sin importar mayúsculas ni tilde ("despues" -> "Después")
const normalizar = (texto) =>
  String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const resolverTipo = (valor) => TIPOS_VALIDOS.find((t) => normalizar(t) === normalizar(valor));

const esIdValido = (valor) =>
  /^[1-9]\d*$/.test(String(valor ?? '')) && Number.isSafeInteger(Number(valor));

// Únicamente el Superadministrador posee acceso global; los demás roles dependen de sus laboratorios asignados

// Busca la bitácora y su estado actual (null si no existe)
const buscarBitacora = async (idBitacora) => {
  const resultado = await pool.query(
    `SELECT id_bitacora, id_equipo, estado_mantenimiento
     FROM public.bitacora_mantenimiento
     WHERE id_bitacora = $1`,
    [idBitacora]
  );

  return resultado.rows[0] || null;
};

// 1. SUBIR EVIDENCIA
// POST /api/evidencias   (multipart/form-data)
// Campos: foto (archivo), id_bitacora, tipo_evidencia, descripcion

const subirEvidencia = async (req, res) => {
  const rutaArchivo = req.file?.path;

  // Si algún flujo escribió un archivo temporal en disco, se limpia ante rechazos
  const rechazar = (codigo, mensaje) => {
    eliminarArchivo(rutaArchivo);
    return res.status(codigo).json({ success: false, message: mensaje });
  };

  try {
    if (!req.file) {
      return rechazar(400, 'Seleccione una fotografía para adjuntar');
    }

    const { id_bitacora, tipo_evidencia, descripcion } = req.body;

    if (!esIdValido(id_bitacora)) {
      return rechazar(400, 'Seleccione un mantenimiento válido.');
    }

    const tipo = resolverTipo(tipo_evidencia);

    if (!tipo) {
      return rechazar(400, "El tipo_evidencia debe ser 'Antes', 'Durante' o 'Después'");
    }

    const bufferOriginal = Buffer.isBuffer(req.file.buffer)
      ? req.file.buffer
      : rutaArchivo
        ? await fs.readFile(rutaArchivo)
        : null;

    if (!bufferOriginal || !tieneFirmaDeImagen(bufferOriginal)) {
      return rechazar(400, 'El archivo no es una imagen JPG, PNG o WEBP válida');
    }

    const bitacora = await buscarBitacora(Number(id_bitacora));

    if (!bitacora) {
      return rechazar(404, 'Registro de mantenimiento no encontrado');
    }

    if (normalizar(bitacora.estado_mantenimiento) === 'completado') {
      return rechazar(409, 'No se pueden agregar evidencias a un mantenimiento ya finalizado.');
    }

    if (!tieneAccesoGlobal(req.usuario.rol)) {
      const acceso = await verificarAccesoEquipo(bitacora.id_equipo, req.usuario);

      if (!acceso) {
        return rechazar(403, 'Acceso denegado: no está asignado al laboratorio de este equipo');
      }
    }

    // Comprimir y redimensionar la imagen antes de guardarla en PostgreSQL (RNF03)
    const optimizada = await comprimirImagen(bufferOriginal);
    const sufijo = crypto.randomBytes(6).toString('hex');
    const urlFoto = `db://evidencias/${Date.now()}-${sufijo}${optimizada.extension}`;
    const descripcionLimpia =
      typeof descripcion === 'string' && descripcion.trim() ? descripcion.trim() : null;

    const resultado = await pool.query(
      `INSERT INTO public.evidencia_fotografica
         (id_bitacora, tipo_evidencia, url_foto, descripcion, mime, datos)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_evidencia, id_bitacora, tipo_evidencia,
                 url_foto, descripcion, mime, fecha_subida`,
      [
        bitacora.id_bitacora,
        tipo,
        urlFoto,
        descripcionLimpia,
        optimizada.mime,
        optimizada.buffer,
      ]
    );

    eliminarArchivo(rutaArchivo);

    return res.status(201).json({
      success: true,
      message: 'Evidencia registrada correctamente',
      data: {
        ...resultado.rows[0],
        tamano_bytes: optimizada.bytesFinales,
        optimizacion: {
          bytes_originales: optimizada.bytesOriginales,
          bytes_guardados: optimizada.bytesFinales,
          ancho_guardado: optimizada.ancho,
          alto_guardado: optimizada.alto,
        },
      },
    });
  } catch (error) {
    eliminarArchivo(rutaArchivo);
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    if (error.code === '42703') {
      return res.status(503).json({
        success: false,
        message:
          'Falta aplicar la migración 010_evidencias_en_bd.sql para almacenar evidencias en la base de datos.',
      });
    }
    if (error.code === '42501') {
      return res.status(503).json({
        success: false,
        message:
          'Faltan permisos de base de datos para guardar evidencias. Verifique la migración 010.',
      });
    }
    console.error('Error al subir evidencia:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Error interno al registrar la evidencia',
    });
  }
};

// 2. OBTENER EVIDENCIAS POR BITÁCORA
// GET /api/evidencias/bitacora/:id_bitacora

const obtenerEvidenciasPorBitacora = async (req, res) => {
  try {
    const { id_bitacora } = req.params;

    if (!esIdValido(id_bitacora)) {
      return res.status(400).json({
        success: false,
        message: 'Seleccione un mantenimiento válido.',
      });
    }

    const bitacora = await buscarBitacora(Number(id_bitacora));

    if (!bitacora) {
      return res.status(404).json({
        success: false,
        message: 'Registro de mantenimiento no encontrado',
      });
    }

    if (!tieneAccesoGlobal(req.usuario.rol)) {
      const acceso = await verificarAccesoEquipo(bitacora.id_equipo, req.usuario);

      if (!acceso) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado: no tiene permisos sobre el laboratorio de este equipo',
        });
      }
    }

    const resultado = await pool.query(
      `SELECT id_evidencia, id_bitacora, tipo_evidencia,
              url_foto, descripcion, fecha_subida
       FROM public.evidencia_fotografica
       WHERE id_bitacora = $1
       ORDER BY fecha_subida ASC, id_evidencia ASC`,
      [bitacora.id_bitacora]
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows,
    });
  } catch (error) {
    console.error('Error al consultar evidencias:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Error al consultar las evidencias',
    });
  }
};

// 3. OBTENER ARCHIVO BINARIO DE EVIDENCIA (PRIVADO CON JWT)
// GET /api/evidencias/:id/archivo
// Sirve desde PostgreSQL (datos bytea) y mantiene respaldo en disco
// únicamente para registros históricos anteriores a la migración 010.

const obtenerArchivoEvidencia = async (req, res) => {
  try {
    if (!esIdValido(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Identificador de evidencia inválido.',
      });
    }

    const resultado = await pool.query(
      `SELECT ev.url_foto, ev.mime, ev.datos, bm.id_equipo
       FROM public.evidencia_fotografica ev
       JOIN public.bitacora_mantenimiento bm
         ON bm.id_bitacora = ev.id_bitacora
       WHERE ev.id_evidencia = $1`,
      [Number(req.params.id)]
    );

    const evidencia = resultado.rows[0];
    if (!evidencia) {
      return res.status(404).json({
        success: false,
        message: 'Evidencia no encontrada.',
      });
    }

    if (
      !tieneAccesoGlobal(req.usuario.rol) &&
      !(await verificarAccesoEquipo(evidencia.id_equipo, req.usuario))
    ) {
      return res.status(403).json({
        success: false,
        message: 'Sin acceso a esta evidencia.',
      });
    }

    // 1. Evidencia almacenada en PostgreSQL (migración 010)
    if (evidencia.datos && evidencia.datos.length > 0) {
      const contenido = Buffer.isBuffer(evidencia.datos)
        ? evidencia.datos
        : Buffer.from(evidencia.datos);
      const tipoMime =
        evidencia.mime || detectarMimePorFirma(contenido) || 'application/octet-stream';

      res.set({
        'Content-Type': tipoMime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.send(contenido);
    }

    // 2. Respaldo para registros históricos previos sin datos en BD
    const nombre = String(evidencia.url_foto || '').match(
      /^\/uploads\/evidencias\/([a-zA-Z0-9_-]+\.(?:jpe?g|png|webp))$/i
    )?.[1];

    if (!nombre) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no disponible.',
      });
    }

    const ruta = path.join(DIRECTORIO_EVIDENCIAS, nombre);
    await fs.access(ruta);
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.sendFile(ruta);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message: 'Archivo no disponible.',
      });
    }
    if (error.code === '42703') {
      return res.status(503).json({
        success: false,
        message:
          'Falta aplicar la migración 010_evidencias_en_bd.sql para consultar evidencias en la base de datos.',
      });
    }
    console.error('Error al abrir evidencia:', error.message);
    return res.status(500).json({
      success: false,
      message: 'No se pudo abrir la evidencia.',
    });
  }
};

module.exports = {
  obtenerArchivoEvidencia,
  subirEvidencia,
  obtenerEvidenciasPorBitacora,
};
