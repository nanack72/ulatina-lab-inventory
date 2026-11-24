// Alerta orientativa: no cambia el estado ni da de baja equipos.
// Cada categoría define su umbral; cada estado indica si requiere revisión.
export function resumirRevisionEquipos(equipos, anioActual = new Date().getFullYear()) {
  const resumen = { total: 0, porAntiguedad: 0, porCondicion: 0, ambas: 0, sinAnio: 0 };
  for (const adaptado of equipos) {
    const equipo = adaptado.original ?? adaptado;
    if (equipo.eliminado_en) continue;
    const umbral = equipo.anios_revision;
    const tieneUmbral = Number.isInteger(umbral) && umbral >= 1 && umbral <= 100;
    const valorAnio = equipo.anio;
    const anio =
      (typeof valorAnio === 'number' || typeof valorAnio === 'string') &&
      /^\d{4}$/.test(String(valorAnio))
        ? Number(valorAnio)
        : null;
    const anioValido = anio !== null && anio >= 1900 && anio <= anioActual;
    if (tieneUmbral && !anioValido) resumen.sinAnio++;
    const antiguo = tieneUmbral && anioValido && anioActual - anio >= umbral;
    const deteriorado = equipo.requiere_revision === true;
    if (antiguo) resumen.porAntiguedad++;
    if (deteriorado) resumen.porCondicion++;
    if (antiguo && deteriorado) resumen.ambas++;
    if (antiguo || deteriorado) resumen.total++;
  }
  return resumen;
}
