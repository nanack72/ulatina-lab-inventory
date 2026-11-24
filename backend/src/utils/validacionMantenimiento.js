const { nombreCampo } = require('./nombresCampos');
function validarEntradaMantenimiento(body, actualizacion = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return 'Complete los datos del mantenimiento.';
  for (const campo of ['id_equipo', 'id_nuevo_estado']) {
    const v = body[campo];
    if (v === undefined || v === null || v === '') continue;
    if (
      !['string', 'number'].includes(typeof v) ||
      !/^[1-9]\d*$/.test(String(v)) ||
      Number(v) > 2147483647
    )
      return 'Seleccione un valor válido para ' + nombreCampo(campo) + '.';
  }
  for (const campo of [
    'tipo_mantenimiento',
    'descripcion_trabajo',
    'motivo_falla',
    'estado_mantenimiento',
    'motivo_cambio_estado',
  ]) {
    const v = body[campo];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string' || v.length > 10000)
      return nombreCampo(campo) + ' debe ser texto de hasta 10000 caracteres.';
  }
  if (
    body.descripcion_trabajo !== undefined &&
    (typeof body.descripcion_trabajo !== 'string' || !body.descripcion_trabajo.trim())
  )
    return 'La descripción del trabajo no puede quedar vacía.';
  if (!actualizacion && !body.id_equipo) return 'Seleccione un equipo.';
  const h = body.horas_invertidas;
  if (h !== undefined && h !== null && h !== '') {
    if (
      !['string', 'number'].includes(typeof h) ||
      !/^\d+(?:\.\d+)?$/.test(String(h)) ||
      !Number.isFinite(Number(h)) ||
      Number(h) > 9999.99
    )
      return 'Las horas deben estar entre 0 y 9999.99 y contener solo un número.';
  }
  return '';
}
module.exports = { validarEntradaMantenimiento };
