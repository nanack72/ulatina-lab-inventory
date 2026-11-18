// Constantes y funciones de formato para el módulo de mantenimientos

export const TIPOS_MANTENIMIENTO = ['Preventivo', 'Correctivo'];

export const ESTADOS_MANTENIMIENTO = [
  'En Proceso',
  'Completado',
  'Pendiente Repuesto'
];

export const COLORES_ESTADO_MANTENIMIENTO = {
  'En Proceso': {
    fondo: '#fef3c7',
    texto: '#b45309',
    borde: '#fde68a'
  },
  'Completado': {
    fondo: '#d1fae5',
    texto: '#047857',
    borde: '#a7f3d0'
  },
  'Pendiente Repuesto': {
    fondo: '#fee2e2',
    texto: '#b91c1c',
    borde: '#fecaca'
  }
};

export const COLORES_TIPO_MANTENIMIENTO = {
  'Preventivo': {
    fondo: '#e0f2fe',
    texto: '#0369a1',
    borde: '#bae6fd'
  },
  'Correctivo': {
    fondo: '#ffedd5',
    texto: '#c2410c',
    borde: '#fed7aa'
  }
};

/**
 * Formatea la fecha y hora de la intervención ajustada a la zona horaria de Costa Rica.
 * Corrige el desfase de día provocado por la conversión de cadenas UTC sin zona explícita.
 */
export function formatearFechaMantenimiento(fechaIso) {
  if (!fechaIso) return 'N/D';
  const fecha = new Date(fechaIso);
  if (isNaN(fecha.getTime())) return 'N/D';

  return new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(fecha);
}

export function formatearHoras(horas) {
  const num = Number(horas);
  if (isNaN(num) || num <= 0) return '0 h';
  return `${num.toFixed(1)} h`;
}
