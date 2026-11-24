// Almacén compartido: los éxitos sobreviven al cambio de pantalla.
export function crearAlmacenNotificaciones() {
  let avisos = [];
  let secuencia = 0;
  const oyentes = new Set();
  const descartados = new Map();
  const publicar = () => oyentes.forEach((oyente) => oyente());
  function notificar(opciones) {
    const tipo = ['exito', 'error', 'advertencia', 'info'].includes(opciones.tipo)
      ? opciones.tipo
      : 'info';
    const id = opciones.id ?? `notificacion-${++secuencia}`;
    const clave = opciones.clave ?? `${tipo}|${opciones.titulo ?? ''}|${opciones.mensaje ?? ''}`;
    if (descartados.get(id) === clave) return id;
    const anterior = avisos.find((aviso) => aviso.id === id);
    if (anterior?.clave === clave) return id;
    descartados.delete(id);
    avisos = [{ ...opciones, id, tipo, clave }, ...avisos.filter((aviso) => aviso.id !== id)];
    publicar();
    return id;
  }
  function cerrar(id) {
    const aviso = avisos.find((item) => item.id === id);
    if (!aviso) return;
    descartados.set(id, aviso.clave);
    avisos = avisos.filter((item) => item.id !== id);
    publicar();
  }
  function retirar(id) {
    descartados.delete(id);
    if (!avisos.some((item) => item.id === id)) return;
    avisos = avisos.filter((item) => item.id !== id);
    publicar();
  }
  function limpiar() {
    descartados.clear();
    if (!avisos.length) return;
    avisos = [];
    publicar();
  }
  return {
    notificar,
    cerrar,
    retirar,
    limpiar,
    obtener: () => avisos,
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
  };
}

export const almacenNotificaciones = crearAlmacenNotificaciones();
export const notificar = almacenNotificaciones.notificar;
export const limpiarNotificaciones = almacenNotificaciones.limpiar;
