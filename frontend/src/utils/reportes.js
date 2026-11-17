// Constantes y formateadores auxiliares para el módulo de reportes

export const COLORES_ESTADOS = {
  operativo: '#10b981',
  en_mantenimiento: '#f59e0b',
  danado: '#ef4444',
  otro: '#6b7280'
};

export const ETIQUETAS_ESTADOS = {
  operativo: 'Operativo',
  en_mantenimiento: 'En Mantenimiento',
  danado: 'Dañado',
  otro: 'Otros estados'
};

export function formatearNumero(valor) {
  const numero = Number(valor) || 0;
  return new Intl.NumberFormat('es-CR').format(numero);
}

export function formatearFechaReporte(fechaIso) {
  if (!fechaIso) return 'N/D';
  const fecha = new Date(fechaIso);
  if (isNaN(fecha.getTime())) return 'N/D';

  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(fecha);
}

/**
 * Calcula porcentaje de forma segura evitando división entre cero o valores NaN.
 */
export function calcularPorcentajeSeguro(cantidad, total) {
  const num = Number(cantidad) || 0;
  const den = Number(total) || 0;
  if (den <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((num / den) * 100)));
}
