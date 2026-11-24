const NOMBRES = {
  categoria: 'categoría',
  pagina: 'página', limite: 'cantidad de registros', busqueda: 'búsqueda', desde: 'inicial', hasta: 'final',
  id_equipo: 'equipo', id_categoria: 'categoría', id_estado: 'estado', id_nuevo_estado: 'nuevo estado',
  id_laboratorio: 'laboratorio', id_sede: 'sede', id_rol: 'rol', id_usuario: 'usuario', id_bitacora: 'mantenimiento',
  numero_serie: 'número de serie', placa_institucional: 'placa institucional', ubicacion_detalle: 'ubicación detallada',
  descripcion_trabajo: 'descripción del trabajo', motivo_falla: 'descripción de la falla',
  tipo_mantenimiento: 'tipo de mantenimiento', estado_mantenimiento: 'estado del mantenimiento',
  motivo_cambio_estado: 'motivo del cambio de estado', descripcion_falla: 'descripción de la falla',
  nombre_completo: 'nombre completo', correo_institucional: 'correo institucional',
  permiso_inventario: 'permisos de inventario', anio: 'año', nombre: 'nombre',
};
function nombreCampo(campo) { return NOMBRES[campo] || String(campo || 'dato').replaceAll('_', ' '); }
module.exports = { nombreCampo };
