const { nombreCampo } = require('../utils/nombresCampos');
const CAMPOS = ['id_equipo', 'nombre', 'numero_serie', 'placa_institucional',
  'marca', 'modelo', 'ubicacion_detalle', 'id_categoria', 'categoria',
  'id_estado', 'estado', 'id_laboratorio', 'codigo_laboratorio', 'laboratorio',
  'id_sede', 'sede', 'eliminado_en', 'eliminado_por_nombre', 'motivo_eliminacion'];
const BUSCABLES = ['nombre', 'numero_serie', 'placa_institucional', 'marca',
  'modelo', 'categoria', 'laboratorio', 'sede', 'ubicacion_detalle'];
const FILTROS = ['sede', 'laboratorio', 'categoria', 'estado'];

// Equivalente a la normalización NFD de los filtros anteriores del navegador.
const normalizarSQL = (columna) =>
  `lower(regexp_replace(normalize(trim(coalesce(${columna}, '')), NFD), U&'[\\0300-\\036f]', '', 'g'))`;

function opcionesSQL(campo) {
  const condicion = campo === 'laboratorio' ? "AND ($4 = '' OR sede_n = $4)" : '';
  return `(SELECT coalesce(json_agg(valor ORDER BY valor), '[]'::json)
    FROM (SELECT DISTINCT ON (${campo}_n) ${campo} AS valor
      FROM visibles WHERE ${campo}_n <> '' ${condicion}
      ORDER BY ${campo}_n, id_equipo DESC) opciones)`;
}

const CONSULTA = `
  WITH visibles AS MATERIALIZED (
    SELECT base.*, ${BUSCABLES.concat('estado').map(campo =>
      `${normalizarSQL(campo)} AS ${campo}_n`).join(', ')}
    FROM (
      SELECT e.id_equipo, e.nombre, e.numero_serie, e.placa_institucional,
        e.marca, e.modelo, e.ubicacion_detalle,
        e.id_categoria, c.nombre AS categoria, e.id_estado, es.nombre AS estado,
        e.id_laboratorio, l.codigo AS codigo_laboratorio, l.nombre AS laboratorio,
        s.id_sede, s.nombre AS sede,
        e.eliminado_en, e.motivo_eliminacion, actor.nombre_completo AS eliminado_por_nombre
      FROM public.equipo e
      JOIN public.categoria c ON c.id_categoria = e.id_categoria
      JOIN public.estado es ON es.id_estado = e.id_estado
      JOIN public.laboratorio l ON l.id_laboratorio = e.id_laboratorio
      JOIN public.sede s ON s.id_sede = l.id_sede
      LEFT JOIN public.usuario actor ON actor.id_usuario = e.eliminado_por
      WHERE (e.eliminado_en IS NOT NULL) = $10::boolean AND ($1::boolean OR EXISTS (
        SELECT 1 FROM public.usuario_sede us
        JOIN public.usuario_laboratorio ul ON ul.id_usuario_sede = us.id_usuario_sede
        WHERE us.id_usuario = $2 AND us.id_sede = l.id_sede
          AND ul.id_sede = l.id_sede AND ul.id_laboratorio = e.id_laboratorio
      ))
    ) base
  ), filtrados AS MATERIALIZED (
    SELECT * FROM visibles
    WHERE ($3 = '' OR ${BUSCABLES.map(campo => `position($3 IN ${campo}_n) > 0`).join(' OR ')})
      ${FILTROS.map((campo, indice) => `AND ($${indice + 4} = '' OR ${campo}_n = $${indice + 4})`).join('\n')}
  ), resumen AS (
    SELECT count(*)::integer AS total,
      greatest(1, ceil(count(*)::numeric / $9::integer))::integer AS paginas
    FROM filtrados
  ), pagina_actual AS (
    SELECT total, paginas, least($8::integer, paginas) AS pagina FROM resumen
  )
  SELECT total, paginas, pagina, $9::integer AS limite,
    (SELECT count(*)::integer FROM visibles) AS total_autorizados,
    (SELECT coalesce(json_agg(fila ORDER BY id_equipo DESC), '[]'::json)
      FROM (SELECT ${CAMPOS.join(', ')} FROM filtrados
        ORDER BY id_equipo DESC LIMIT $9
        OFFSET (SELECT (pagina - 1) * $9 FROM pagina_actual)) fila) AS data,
    json_build_object(${FILTROS.map(campo => `'${campo}', ${opcionesSQL(campo)}`).join(', ')}) AS opciones
  FROM pagina_actual
`;

function solicitudInvalida(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function consultarPaginaInventario(db, query, usuario) {
  const idUsuario = Number(usuario?.idUsuario);
  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
    throw solicitudInvalida('Usuario sin autorización válida', 403);
  }
  const vista = query.vista ?? 'activos';
  if (typeof vista !== 'string' || !['activos', 'eliminados'].includes(vista)) {
    throw solicitudInvalida('La vista del inventario no es válida');
  }
  const global = String(usuario.rol || '').trim().toLowerCase() === 'superadministrador';
  if (vista === 'eliminados' && !global && usuario.puede_eliminar_equipos !== true) {
    throw solicitudInvalida('No tiene permiso para consultar equipos eliminados', 403);
  }
  const textos = ['busqueda', ...FILTROS].map(campo => {
    const valor = query[campo] ?? '';
    if (typeof valor !== 'string' || valor.length > 200) {
      throw solicitudInvalida(`El filtro de ${nombreCampo(campo)} no es válido`);
    }
    return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  });
  function entero(campo, defecto, maximo) {
    const valor = query[campo] ?? String(defecto);
    if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || Number(valor) > maximo) {
      throw solicitudInvalida(`La selección de ${nombreCampo(campo)} no es válido`);
    }
    return Number(valor);
  }
  const pagina = entero('pagina', 1, 100000);
  const limite = entero('limite', 5, 100);
  const resultado = await db.query(CONSULTA, [global, idUsuario, ...textos, pagina, limite, vista === 'eliminados']);
  return { success: true, ...resultado.rows[0] };
}

module.exports = { consultarPaginaInventario };