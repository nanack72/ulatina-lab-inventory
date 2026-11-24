// Constantes semánticas y utilidades para el módulo de incidencias técnicas

export const PRIORIDADES_INCIDENCIA = ['Crítica', 'Alta', 'Media', 'Baja'];

export const ESTADOS_INCIDENCIA = [
  'Abierta',
  'En Revisión',
  'Resuelta',
  'Descartada'
];

export const COLORES_PRIORIDAD = {
  'Crítica': {
    fondo: '#fee2e2',
    texto: '#991b1b',
    borde: '#fecaca',
    punto: '#dc2626'
  },
  'Alta': {
    fondo: '#ffedd5',
    texto: '#c2410c',
    borde: '#fed7aa',
    punto: '#ea580c'
  },
  'Media': {
    fondo: '#fef3c7',
    texto: '#b45309',
    borde: '#fde68a',
    punto: '#d97706'
  },
  'Baja': {
    fondo: '#f1f5f9',
    texto: '#475569',
    borde: '#e2e8f0',
    punto: '#64748b'
  }
};

export const COLORES_ESTADO_INCIDENCIA = {
  'Abierta': {
    fondo: '#fef2f2',
    texto: '#b91c1c',
    borde: '#fca5a5'
  },
  'En Revisión': {
    fondo: '#eff6ff',
    texto: '#1d4ed8',
    borde: '#bfdbfe'
  },
  'Resuelta': {
    fondo: '#ecfdf5',
    texto: '#047857',
    borde: '#a7f3d0'
  },
  'Descartada': {
    fondo: '#f8fafc',
    texto: '#64748b',
    borde: '#cbd5e1'
  }
};

export function formatearFechaIncidencia(fechaIso) {
  if (!fechaIso) return "No disponible";
  const fecha = new Date(fechaIso);
  if (isNaN(fecha.getTime())) return "No disponible";

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
