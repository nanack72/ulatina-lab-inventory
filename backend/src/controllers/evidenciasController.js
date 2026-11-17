const pool = require('../config/database');
const { verificarAccesoEquipo } = require('../utils/accesoEquipos');
const {
  eliminarArchivo,
  tieneFirmaDeImagen
} = require('../middlewares/uploadMiddleware');

const TIPOS_VALIDOS = ['Antes', 'Durante', 'Después'];

// Normaliza el tipo sin importar mayúsculas ni tilde ("despues" -> "Después")
const normalizar = (texto) =>
  String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const resolverTipo = (valor) =>
  TIPOS_VALIDOS.find((t) => normalizar(t) === normalizar(valor));

const esIdValido = (valor) =>
  /^[1-9]\d*$/.test(String(valor ?? '')) &&
  Number.isSafeInteger(Number(valor));

// Administradores y roles de gestión (Coordinador, Director) ven todo; el técnico solo sus laboratorios
const tieneAccesoGlobal = (rol) =>
  ['superadministrador', 'administrador', 'admin', 'coordinador', 'director'].includes(
    (rol || '').toLowerCase().trim()
  );

// Busca el equipo asociado a una bitácora (null si no existe)
const buscarBitacora = async (idBitacora) => {
  const resultado = await pool.query(
    `SELECT id_bitacora, id_equipo
     FROM public.bitacora_mantenimiento
     WHERE id_bitacora = $1`,
    [idBitacora]
  );

  return resultado.rows[0] || null;
};

// =====================================================
// 1. SUBIR EVIDENCIA
// POST /api/evidencias   (multipart/form-data)
// Campos: foto (archivo), id_bitacora, tipo_evidencia, descripcion
// =====================================================

const subirEvidencia = async (req, res) => {
  const rutaArchivo = req.file?.path;

  // Cualquier rechazo borra la imagen para no dejar archivos huérfanos
  const rechazar = (codigo, mensaje) => {
    eliminarArchivo(rutaArchivo);
    return res.status(codigo).json({ success: false, message: mensaje });
  };

  try {
    if (!req.file) {
      return rechazar(400, 'Debe adjuntar una imagen en el campo "foto"');
    }

    const { id_bitacora, tipo_evidencia, descripcion } = req.body;

    if (!esIdValido(id_bitacora)) {
      return rechazar(400, 'El id_bitacora no es válido');
    }

    const tipo = resolverTipo(tipo_evidencia);

    if (!tipo) {
      return rechazar(
        400,
        "El tipo_evidencia debe ser 'Antes', 'Durante' o 'Después'"
      );
    }

    if (!tieneFirmaDeImagen(rutaArchivo)) {
      return rechazar(
        400,
        'El archivo no es una imagen JPG, PNG o WEBP válida'
      );
    }

    const bitacora = await buscarBitacora(Number(id_bitacora));

    if (!bitacora) {
      return rechazar(404, 'Registro de mantenimiento no encontrado');
    }

    if (!tieneAccesoGlobal(req.usuario.rol)) {
      const acceso = await verificarAccesoEquipo(
        bitacora.id_equipo,
        req.usuario
      );

      if (!acceso) {
        return rechazar(
          403,
          'Acceso denegado: no estás asignado al laboratorio de este equipo'
        );
      }
    }

    // Se guarda la URL relativa; app.js sirve /uploads de forma estática
    const urlFoto = `/uploads/evidencias/${req.file.filename}`;
    const descripcionLimpia =
      typeof descripcion === 'string' && descripcion.trim()
        ? descripcion.trim()
        : null;

    const resultado = await pool.query(
      `INSERT INTO public.evidencia_fotografica
         (id_bitacora, tipo_evidencia, url_foto, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING id_evidencia, id_bitacora, tipo_evidencia,
                 url_foto, descripcion, fecha_subida`,
      [bitacora.id_bitacora, tipo, urlFoto, descripcionLimpia]
    );

    return res.status(201).json({
      success: true,
      message: 'Evidencia registrada correctamente',
      data: resultado.rows[0]
    });
  } catch (error) {
    eliminarArchivo(rutaArchivo);
    console.error('Error al subir evidencia:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Error interno al registrar la evidencia'
    });
  }
};

// =====================================================
// 2. OBTENER EVIDENCIAS POR BITÁCORA
// GET /api/evidencias/bitacora/:id_bitacora
// =====================================================

const obtenerEvidenciasPorBitacora = async (req, res) => {
  try {
    const { id_bitacora } = req.params;

    if (!esIdValido(id_bitacora)) {
      return res.status(400).json({
        success: false,
        message: 'El id_bitacora no es válido'
      });
    }

    const bitacora = await buscarBitacora(Number(id_bitacora));

    if (!bitacora) {
      return res.status(404).json({
        success: false,
        message: 'Registro de mantenimiento no encontrado'
      });
    }

    if (!tieneAccesoGlobal(req.usuario.rol)) {
      const acceso = await verificarAccesoEquipo(
        bitacora.id_equipo,
        req.usuario
      );

      if (!acceso) {
        return res.status(403).json({
          success: false,
          message:
            'Acceso denegado: no tienes permisos sobre el laboratorio de este equipo'
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
      data: resultado.rows
    });
  } catch (error) {
    console.error('Error al consultar evidencias:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Error al consultar las evidencias'
    });
  }
};

module.exports = {
  subirEvidencia,
  obtenerEvidenciasPorBitacora
};

