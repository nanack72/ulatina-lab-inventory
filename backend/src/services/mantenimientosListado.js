const fallo = (mensaje) => Object.assign(new Error(mensaje), { status: 400 });
function entero(valor, nombre, defecto) {
  if (valor === undefined || valor === '') return defecto;
  if (
    !['string', 'number'].includes(typeof valor) ||
    !/^[1-9]\d*$/.test(String(valor)) ||
    Number(valor) > 2147483647
  )
    throw fallo(nombre + ' debe ser un entero positivo.');
  return Number(valor);
}
function texto(valor, nombre, max = 200) {
  if (valor === undefined) return '';
  if (typeof valor !== 'string' || valor.length > max)
    throw fallo('Filtro ' + nombre + ' inválido.');
  return valor.trim();
}
function fecha(valor, nombre) {
  const v = texto(valor, nombre, 10);
  if (!v) return '';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw fallo('Fecha ' + nombre + ' inválida. Use AAAA-MM-DD.');
  return v;
}
async function listarMantenimientos(pool, query, usuario) {
  const pagina = entero(query.pagina, 'pagina', 1),
    limite = entero(query.limite, 'limite', 10);
  if (limite > 100) throw fallo('El límite máximo es 100.');
  const valores = [
    Number(usuario.idUsuario),
    String(usuario.rol).trim().toLowerCase() === 'superadministrador',
  ];
  const condiciones = [
    `($2::boolean OR EXISTS (SELECT 1 FROM public.usuario_sede us JOIN public.usuario_laboratorio ul ON ul.id_usuario_sede=us.id_usuario_sede WHERE us.id_usuario=$1 AND us.id_sede=l.id_sede AND ul.id_sede=l.id_sede AND ul.id_laboratorio=l.id_laboratorio))`,
  ];
  for (const [nombre, columna] of [
    ['id_equipo', 'bm.id_equipo'],
    ['id_sede', 'l.id_sede'],
    ['id_laboratorio', 'l.id_laboratorio'],
  ]) {
    const id = entero(query[nombre], nombre, null);
    if (id) {
      valores.push(id);
      condiciones.push(columna + '=$' + valores.length);
    }
  }
  for (const [nombre, alias, columna] of [
    ['tipo', 'tipo_mantenimiento', 'bm.tipo_mantenimiento'],
    ['estado', 'estado_mantenimiento', 'bm.estado_mantenimiento'],
  ]) {
    const valor = texto(query[nombre] ?? query[alias], nombre, 40);
    if (valor) {
      valores.push(valor);
      condiciones.push('lower(' + columna + ')=lower($' + valores.length + ')');
    }
  }
  const buscar = texto(query.busqueda, 'busqueda');
  if (buscar) {
    valores.push('%' + buscar.replace(/[\\%_]/g, '\\$&') + '%');
    const p = '$' + valores.length;
    condiciones.push(
      '(' +
        [
          'e.nombre',
          'e.placa_institucional',
          'e.numero_serie',
          'bm.motivo_falla',
          'bm.descripcion_trabajo',
        ]
          .map((c) => c + ' ILIKE ' + p + " ESCAPE '\\'")
          .join(' OR ') +
        ')'
    );
  }
  const desde = fecha(query.fecha_desde, 'desde'),
    hasta = fecha(query.fecha_hasta, 'hasta');
  if (desde && hasta && desde > hasta)
    throw fallo('La fecha inicial no puede ser posterior a la final.');
  if (desde) {
    valores.push(desde + 'T00:00:00-06:00');
    condiciones.push('bm.fecha_mantenimiento >= $' + valores.length + '::timestamptz');
  }
  if (hasta) {
    valores.push(hasta + 'T23:59:59.999999-06:00');
    condiciones.push('bm.fecha_mantenimiento <= $' + valores.length + '::timestamptz');
  }
  valores.push(pagina, limite);
  const p = '$' + (valores.length - 1),
    n = '$' + valores.length;
  const sql = `WITH base AS (
    SELECT bm.id_bitacora,bm.id_equipo,bm.id_usuario_tecnico,bm.tipo_mantenimiento,bm.motivo_falla,bm.descripcion_trabajo,bm.horas_invertidas,bm.fecha_mantenimiento,bm.estado_mantenimiento,
      e.nombre AS nombre_equipo,e.placa_institucional,e.numero_serie,e.marca,e.modelo,e.id_estado AS id_estado_equipo,es.nombre AS estado_equipo,
      u.nombre_completo AS nombre_tecnico,u.correo_institucional AS correo_tecnico,l.id_laboratorio,l.codigo AS codigo_laboratorio,l.nombre AS nombre_laboratorio,s.id_sede,s.nombre AS nombre_sede
    FROM public.bitacora_mantenimiento bm JOIN public.equipo e ON e.id_equipo=bm.id_equipo JOIN public.usuario u ON u.id_usuario=bm.id_usuario_tecnico JOIN public.laboratorio l ON l.id_laboratorio=e.id_laboratorio JOIN public.sede s ON s.id_sede=l.id_sede LEFT JOIN public.estado es ON es.id_estado=e.id_estado
    WHERE ${condiciones.join(' AND ')}
  ), total AS (SELECT count(*)::int AS total FROM base), limites AS (SELECT total,LEAST(${p}::int,GREATEST(1,ceil(total::numeric/${n})::int)) AS pagina,GREATEST(1,ceil(total::numeric/${n})::int) AS "totalPaginas" FROM total)
  SELECT total,pagina,"totalPaginas",(SELECT coalesce(json_agg(fila),'[]'::json) FROM (SELECT * FROM base ORDER BY fecha_mantenimiento DESC,id_bitacora DESC LIMIT ${n} OFFSET (SELECT (pagina-1)*${n} FROM limites)) fila) AS data FROM limites`;
  return { success: true, limite, ...(await pool.query(sql, valores)).rows[0] };
}
module.exports = { listarMantenimientos };
