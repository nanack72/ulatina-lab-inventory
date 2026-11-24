function normalizarBusqueda(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

export function filtrarLaboratorios(laboratorios, busqueda) {
  const termino = normalizarBusqueda(busqueda);
  return laboratorios.filter((laboratorio) =>
    [laboratorio.nombre, laboratorio.codigo, laboratorio.nombre_sede].some((valor) =>
      normalizarBusqueda(valor).includes(termino)
    )
  );
}

export function asignarSedes(formulario, sedes, laboratorios) {
  const seleccionadas = [...new Set(sedes)];
  const permitidos = new Set(
    laboratorios
      .filter((laboratorio) => seleccionadas.includes(laboratorio.id_sede))
      .map((laboratorio) => laboratorio.id_laboratorio)
  );
  return {
    ...formulario,
    sedes: seleccionadas,
    laboratorios: formulario.laboratorios.filter((id) => permitidos.has(id)),
  };
}

export function asignarLaboratorios(formulario, ids, laboratorios, seleccionar) {
  const permitidos = new Set(
    laboratorios
      .filter((laboratorio) => formulario.sedes.includes(laboratorio.id_sede))
      .map((laboratorio) => laboratorio.id_laboratorio)
  );
  const objetivos = new Set(ids.filter((id) => permitidos.has(id)));
  const actuales = formulario.laboratorios.filter((id) => permitidos.has(id));
  return {
    ...formulario,
    laboratorios: seleccionar
      ? [...new Set([...actuales, ...objetivos])]
      : actuales.filter((id) => !objetivos.has(id)),
  };
}
