// Resolver etiquetas sin modificar los identificadores ni los valores de auditoría.
const RELACIONES = {
  id_categoria: ['categoria', 'id_categoria', 'nombre', 'Categoría no disponible'],
  id_estado: ['estado', 'id_estado', 'nombre', 'Estado no disponible'],
  id_laboratorio: ['laboratorio', 'id_laboratorio', 'nombre', 'Laboratorio no disponible'],
  id_sede: ['sede', 'id_sede', 'nombre', 'Sede no disponible'],
  id_usuario: ['usuario', 'id_usuario', 'nombre_completo', 'Responsable no disponible'],
  id_rol: ['rol', 'id_rol', 'nombre', 'Rol no disponible'],
};
const campoDe = registro => registro.campo_modificado || (registro.accion?.startsWith('Modificación: ') ? registro.accion.slice(14) : '');
async function presentarHistorial(cliente, registros) {
  const mapas = new Map();
  for (const [campo, [tabla, columna, nombre]] of Object.entries(RELACIONES)) {
    const ids = [...new Set(registros.filter(r => campoDe(r) === campo)
      .flatMap(r => [r.valor_anterior, r.valor_nuevo])
      .filter(v => /^\d+$/.test(String(v ?? ''))).map(String))];
    if (!ids.length) continue;
    // Los nombres de tablas y columnas provienen únicamente de la lista fija anterior.
    const resultado = await cliente.query(`SELECT ${columna}::text AS clave, ${nombre} AS nombre FROM public.${tabla} WHERE ${columna}::text = ANY($1::text[])`, [ids]);
    mapas.set(campo, new Map(resultado.rows.map(r => [r.clave, r.nombre])));
  }
  return registros.map(registro => {
    const campo = campoDe(registro), relacion = RELACIONES[campo];
    if (!relacion) return registro;
    const visible = valor => {
      if (valor === null || valor === undefined || valor === '') return 'Sin registrar';
      if (!/^\d+$/.test(String(valor))) return String(valor);
      return mapas.get(campo)?.get(String(valor)) || relacion[3];
    };
    return { ...registro, valor_anterior_visible: visible(registro.valor_anterior), valor_nuevo_visible: visible(registro.valor_nuevo) };
  });
}
module.exports = { presentarHistorial };
