const { SQL_UBICACIONES } = require('./ubicacionesListado');
const EDAD_REFERENCIA = 8;
const MOTIVOS = ['antiguedad', 'repuesto', 'inactivo', 'falla', 'obsoleto'];
const error400 = () => Object.assign(new Error('Filtros de revisión inválidos.'), { status: 400 });
function entero(valor, defecto) {
  if (valor === undefined || valor === '') return defecto;
  if (
    !['string', 'number'].includes(typeof valor) ||
    !/^[1-9]\d*$/.test(String(valor)) ||
    Number(valor) > 2147483647
  )
    throw error400();
  return Number(valor);
}
// Solo lectura: los motivos son avisos, no un diagnóstico ni un cambio de estado.
async function listarEquiposRevision(
  pool,
  query,
  usuario,
  anioActual = Number(
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Costa_Rica' }).format(
      new Date(),
    ),
  ),
) {
  const pagina = entero(query.pagina, 1),
    limite = entero(query.limite, 5),
    motivo = query.motivo || '';
  if (limite > 50 || typeof motivo !== 'string' || (motivo && !MOTIVOS.includes(motivo)))
    throw error400();
  const valores = [
    Number(usuario.idUsuario),
    String(usuario.rol).trim().toLowerCase() === 'superadministrador',
    anioActual,
    EDAD_REFERENCIA,
    motivo,
    pagina,
    limite,
  ];
  const sql = `WITH ubicaciones AS (${SQL_UBICACIONES}), datos AS (
    SELECT e.id_equipo,e.nombre,e.placa_institucional,e.anio,es.nombre AS estado,l.nombre AS laboratorio,l.nombre_sede,
      lower(translate(trim(coalesce(es.nombre,'')),'áéíóúñÁÉÍÓÚÑ','aeiounAEIOUN')) AS estado_normalizado,
      EXISTS (SELECT 1 FROM public.bitacora_mantenimiento bm WHERE bm.id_equipo=e.id_equipo AND lower(trim(bm.estado_mantenimiento))='pendiente repuesto') AS repuesto
    FROM public.equipo e JOIN ubicaciones l ON l.id_laboratorio=e.id_laboratorio LEFT JOIN public.estado es ON es.id_estado=e.id_estado
  ), evaluados AS (
    SELECT *,CASE WHEN anio BETWEEN 1900 AND $3::int THEN $3::int-anio END AS antiguedad,
      array_remove(ARRAY[
        CASE WHEN anio BETWEEN 1900 AND $3::int-$4::int THEN 'antiguedad' END,
        CASE WHEN repuesto THEN 'repuesto' END,
        CASE WHEN estado_normalizado IN ('inactivo','inactiva','baja','dado de baja','fuera de servicio') THEN 'inactivo' END,
        CASE WHEN estado_normalizado IN ('danado','danada','averiado','averiada','malo','mala') THEN 'falla' END,
        CASE WHEN estado_normalizado IN ('obsoleto','obsoleta') THEN 'obsoleto' END
      ],NULL) AS motivos
    FROM datos
  ), candidatos AS (SELECT * FROM evaluados WHERE cardinality(motivos)>0), filtrados AS (SELECT * FROM candidatos WHERE $5::text='' OR $5=ANY(motivos)),
  total AS (SELECT count(*)::int AS total FROM filtrados), limites AS (SELECT total,LEAST($6::int,GREATEST(1,ceil(total::numeric/$7)::int)) AS pagina FROM total)
  SELECT total,pagina,
    (SELECT count(*)::int FROM evaluados WHERE anio IS NULL OR anio<1900 OR anio>$3::int) AS sin_anio_valido,
    (SELECT coalesce(json_agg(fila),'[]'::json) FROM (SELECT id_equipo,nombre,placa_institucional,anio,estado,laboratorio,nombre_sede,antiguedad,motivos FROM filtrados ORDER BY cardinality(motivos) DESC,antiguedad DESC NULLS LAST,id_equipo LIMIT $7 OFFSET (SELECT (pagina-1)*$7 FROM limites)) fila) AS data
  FROM limites`;
  return {
    success: true,
    edad_referencia: EDAD_REFERENCIA,
    anio_referencia: anioActual,
    limite,
    ...(await pool.query(sql, valores)).rows[0],
  };
}
module.exports = { listarEquiposRevision, EDAD_REFERENCIA };
