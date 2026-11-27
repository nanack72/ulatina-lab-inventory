import { normalizar, tipoEstado } from './inventario.js';

export const MANTENIMIENTOS_RECIENTES = 5;

// Singular o plural según la cantidad.
export function plural(cantidad, singular, pluralTexto) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

// Saludo según la hora del día.
export function saludo(fecha = new Date()) {
  const hora = fecha.getHours();

  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// Primer nombre del usuario (el backend devuelve el nombre completo).
export function primerNombre(nombreCompleto) {
  return (
    String(nombreCompleto ?? '')
      .trim()
      .split(/\s+/)[0] || ''
  );
}

// Día y mes en español: { dia: '9', mes: 'noviembre' }.
export function diaYMes(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('es-CR', {
    day: 'numeric',
    month: 'long',
  }).formatToParts(fecha);

  const buscar = (tipo) => partes.find((parte) => parte.type === tipo)?.value ?? '';

  return { dia: buscar('day'), mes: buscar('month') };
}

// "Hace 20 min", "Hace 3 h", "Hace 2 d" o la fecha corta.
export function tiempoRelativo(fecha, ahora = Date.now()) {
  const momento = new Date(fecha).getTime();

  if (Number.isNaN(momento)) return '';

  const minutos = Math.floor((ahora - momento) / 60000);

  if (minutos < 1) return 'Hace un momento';
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);

  if (horas < 24) return `Hace ${horas} h`;

  const dias = Math.floor(horas / 24);

  if (dias < 7) return `Hace ${dias} d`;

  return new Intl.DateTimeFormat('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(momento));
}

// Tipo de estado de una bitácora: completado, proceso, repuesto u otro.
export function tipoMantenimiento(estado) {
  const valor = normalizar(estado);

  if (valor === 'completado') return 'completado';
  if (valor === 'en proceso') return 'proceso';
  if (valor === 'pendiente repuesto') return 'repuesto';

  return 'otro';
}

// Resumen de números para las tarjetas y las alertas.
// Cuando el backend entrega resumenMantenimientos (calculado en SQL sobre todo el
// alcance del usuario), se utilizan esas cifras reales en lugar de contar solo la página visible.
export function resumirInicio(equipos, mantenimientos, resumenMantenimientos = null) {
  const total = equipos.length;
  const contar = (tipo) => equipos.filter((equipo) => tipoEstado(equipo.estado) === tipo).length;

  const operativos = contar('operativo');

  const tieneResumenServidor =
    resumenMantenimientos &&
    typeof resumenMantenimientos === 'object' &&
    Number.isFinite(Number(resumenMantenimientos.abiertos));

  let abiertosTotal;
  let enProceso;
  let esperandoRepuesto;
  let correctivos;

  if (tieneResumenServidor) {
    abiertosTotal = Number(resumenMantenimientos.abiertos) || 0;
    enProceso = Number(resumenMantenimientos.enProceso) || 0;
    esperandoRepuesto = Number(resumenMantenimientos.esperandoRepuesto) || 0;
    correctivos = Number(resumenMantenimientos.correctivos) || 0;
  } else {
    const abiertos = mantenimientos.filter(
      (m) => tipoMantenimiento(m.estado_mantenimiento) !== 'completado'
    );
    abiertosTotal = abiertos.length;
    enProceso = abiertos.filter(
      (m) => tipoMantenimiento(m.estado_mantenimiento) === 'proceso'
    ).length;
    esperandoRepuesto = abiertos.filter(
      (m) => tipoMantenimiento(m.estado_mantenimiento) === 'repuesto'
    ).length;
    correctivos = abiertos.filter(
      (m) => normalizar(m.tipo_mantenimiento) === 'correctivo'
    ).length;
  }

  return {
    total,
    laboratorios: new Set(equipos.map((equipo) => equipo.laboratorio).filter(Boolean)).size,
    operativos,
    noOperativos: total - operativos,
    porcentajeNoOperativos: total ? Math.round(((total - operativos) / total) * 1000) / 10 : 0,
    porcentajeOperativos: total ? Math.round((operativos / total) * 1000) / 10 : 0,
    enMantenimiento: contar('mantenimiento'),
    fueraDeServicio: contar('baja'),
    abiertos: abiertosTotal,
    enProceso,
    esperandoRepuesto,
    correctivos,
    preventivos: Math.max(0, abiertosTotal - correctivos),
  };
}

// Título y tipo visual de un movimiento de la actividad reciente.
export function describirActividad(movimiento) {
  switch (movimiento.tipo) {
    case 'registro':
      return { titulo: 'Equipo registrado', icono: 'registro' };

    case 'traslado':
      return { titulo: 'Equipo trasladado', icono: 'traslado' };

    case 'cambio_estado':
      return {
        titulo: movimiento.detalle
          ? `Estado cambiado a ${movimiento.detalle}`
          : 'Estado actualizado',
        icono: 'estado',
      };

    case 'mantenimiento': {
      const tipo = tipoMantenimiento(movimiento.detalle);

      if (tipo === 'completado') {
        return { titulo: 'Mantenimiento finalizado', icono: 'completado' };
      }

      return {
        titulo:
          tipo === 'repuesto' ? 'Mantenimiento en espera de repuesto' : 'Mantenimiento en proceso',
        icono: 'mantenimiento',
      };
    }

    default:
      return { titulo: 'Movimiento registrado', icono: 'estado' };
  }
}
