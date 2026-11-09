export const EQUIPOS_POR_PAGINA = 5;

export const FILTROS_INICIALES = {
  busqueda: '',
  sede: '',
  laboratorio: '',
  categoria: '',
  estado: '',
};

export const FILTROS_SELECT = [
  {
    clave: 'sede',
    etiqueta: 'Sede',
    chip: formatearSede,
  },
  {
    clave: 'laboratorio',
    etiqueta: 'Laboratorio',
    chip: (valor) => `Laboratorio: ${valor}`,
  },
  {
    clave: 'categoria',
    etiqueta: 'Categoría',
    chip: (valor) => `Categoría: ${valor}`,
  },
  {
    clave: 'estado',
    etiqueta: 'Estado',
    chip: (valor) => `Estado: ${valor}`,
  },
];

const CAMPOS_BUSCABLES = [
  'placa',
  'nombre',
  'serie',
  'marca',
  'modelo',
  'categoria',
  'laboratorio',
  'sede',
  'ubicacion',
];

export function texto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    typeof valor === 'object'
  ) {
    return '';
  }

  return String(valor).trim();
}

export function normalizar(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function formatearSede(sede) {
  const nombre = texto(sede);

  if (!nombre) return '';

  return /^sede\s/i.test(nombre)
    ? nombre
    : `Sede ${nombre}`;
}

function nombreRelacion(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }

  if (typeof valor !== 'object') {
    return texto(valor);
  }

  return texto(
    valor.nombre ??
    valor.descripcion ??
    valor.nombre_categoria ??
    valor.nombre_estado ??
    valor.nombre_laboratorio ??
    valor.nombre_sede
  );
}

export function adaptarEquipo(equipo, indice) {
  const placa = texto(
    equipo.placa_institucional ?? equipo.placa
  );

  const serie = texto(
    equipo.numero_serie ?? equipo.serie
  );

  return {
    clave:
      equipo.id_equipo ??
      equipo.id ??
      `${placa}-${serie}-${indice}`,

    nombre: texto(
      equipo.nombre ?? equipo.nombre_equipo
    ),

    placa,
    serie,

    marca: texto(equipo.marca),
    modelo: texto(equipo.modelo),

    categoria: nombreRelacion(
      equipo.categoria ??
      equipo.nombre_categoria ??
      equipo.categoria_nombre
    ),

    estado: nombreRelacion(
      equipo.estado ??
      equipo.nombre_estado ??
      equipo.estado_nombre
    ),

    laboratorio: nombreRelacion(
      equipo.laboratorio ??
      equipo.nombre_laboratorio ??
      equipo.laboratorio_nombre
    ),

    sede: nombreRelacion(
      equipo.sede ??
      equipo.nombre_sede ??
      equipo.sede_nombre
    ),

    ubicacion: texto(
      equipo.ubicacion_detalle ??
      equipo.ubicacionDetalle
    ),

    original: equipo,
  };
}

export function opcionesUnicas(equipos, propiedad) {
  const mapa = new Map();

  for (const equipo of equipos) {
    const valor = equipo[propiedad];
    const clave = normalizar(valor);

    if (valor && !mapa.has(clave)) {
      mapa.set(clave, valor);
    }
  }

  return [...mapa.values()].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}

export function filtrarEquipos(equipos, filtros) {
  const termino = normalizar(filtros.busqueda);

  return equipos.filter((equipo) => {
    const coincideFiltros = FILTROS_SELECT.every(
      ({ clave }) =>
        !filtros[clave] ||
        normalizar(equipo[clave]) ===
          normalizar(filtros[clave])
    );

    const coincideBusqueda =
      !termino ||
      CAMPOS_BUSCABLES.some((campo) =>
        normalizar(equipo[campo]).includes(termino)
      );

    return coincideFiltros && coincideBusqueda;
  });
}

export function tipoEstado(estado) {
  const valor = normalizar(estado);

  if (valor === 'operativo' || valor === 'activo') {
    return 'operativo';
  }

  if (valor.includes('mantenimiento')) {
    return 'mantenimiento';
  }

  if (
    valor.includes('baja') ||
    valor.includes('fuera de servicio') ||
    valor.includes('inactivo')
  ) {
    return 'baja';
  }

  return 'otro';
}

export function claseEstado(estado) {
  return `inv-estado--${tipoEstado(estado)}`;
}

export function generarPaginas(actual, total) {
  if (total <= 7) {
    return Array.from(
      { length: total },
      (_, indice) => indice + 1
    );
  }

  const validas = [
    ...new Set([
      1,
      total,
      actual - 1,
      actual,
      actual + 1,
    ]),
  ]
    .filter(
      (pagina) => pagina >= 1 && pagina <= total
    )
    .sort((a, b) => a - b);

  const resultado = [];

  validas.forEach((pagina, indice) => {
    const anterior = validas[indice - 1];

    if (
      indice > 0 &&
      pagina - anterior > 1
    ) {
      resultado.push(
        pagina - anterior === 2
          ? anterior + 1
          : '...'
      );
    }

    resultado.push(pagina);
  });

  return resultado;
}
