import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { almacenNotificaciones } from '../../utils/notificaciones';
import '../../styles/notificaciones.css';

const TIPOS = {
  exito: { titulo: 'Operación completada', icono: CheckCircle2, duracion: 6500 },
  error: { titulo: 'Ocurrió un problema', icono: AlertCircle, duracion: 0 },
  advertencia: { titulo: 'Revise la información', icono: TriangleAlert, duracion: 0 },
  info: { titulo: 'Información', icono: Info, duracion: 8000 },
};

function TarjetaNotificacion({ aviso }) {
  const tipo = TIPOS[aviso.tipo];
  const Icono = tipo.icono;
  const [sobre, setSobre] = useState(false);
  const [conFoco, setConFoco] = useState(false);
  const restante = useRef(tipo.duracion);
  useEffect(() => {
    if (!tipo.duracion || sobre || conFoco) return;
    const inicio = Date.now();
    const temporizador = setTimeout(() => almacenNotificaciones.cerrar(aviso.id), restante.current);
    return () => {
      clearTimeout(temporizador);
      restante.current = Math.max(0, restante.current - (Date.now() - inicio));
    };
  }, [aviso.id, tipo.duracion, sobre, conFoco]);

  return (
    <article
      className={`notificacion notificacion--${aviso.tipo}`}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
      onFocusCapture={() => setConFoco(true)}
      onBlurCapture={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setConFoco(false);
      }}
    >
      <span className="notificacion-icono">
        <Icono size={22} aria-hidden="true" />
      </span>
      <div
        className="notificacion-contenido"
        role={aviso.tipo === 'error' ? 'alert' : 'status'}
        aria-atomic="true"
      >
        <strong>{aviso.titulo || tipo.titulo}</strong>
        <div className="notificacion-cuerpo">{aviso.contenido ?? aviso.mensaje}</div>
      </div>
      <button
        type="button"
        className="notificacion-cerrar"
        onClick={() => {
          aviso.alCerrar?.();
          almacenNotificaciones.cerrar(aviso.id);
        }}
        aria-label="Cerrar notificación"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </article>
  );
}

export default function CentroNotificaciones() {
  const avisos = useSyncExternalStore(
    almacenNotificaciones.suscribir,
    almacenNotificaciones.obtener,
    almacenNotificaciones.obtener
  );
  const [destino, setDestino] = useState(() =>
    typeof document === 'undefined' ? null : document.body
  );
  const capaRef = useRef(null);
  // La pantalla puede desmontar el diálogo antes de que se ejecute el observador.
  const contenedor = destino?.isConnected
    ? destino
    : typeof document === 'undefined'
      ? null
      : document.body;

  useEffect(() => {
    function actualizarDestino() {
      // Dentro del diálogo modal para que la notificación también sea interactiva.
      const ventanas = Array.from(
        document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')
      );
      const activa = ventanas.filter((elemento) => !elemento.closest('[hidden], [inert]')).at(-1);
      setDestino(activa ?? document.body);
    }
    const observador = new MutationObserver(actualizarDestino);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open', 'hidden', 'aria-modal'],
    });
    actualizarDestino();
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const capa = capaRef.current;
    if (!capa?.isConnected) return;
    if (typeof capa.showPopover === 'function') {
      if (!capa.matches(':popover-open')) capa.showPopover();
    } else {
      // Respaldo sin dependencia adicional para navegadores sin Popover API.
      capa.removeAttribute('popover');
    }
    return () => {
      if (
        capa.isConnected &&
        typeof capa.hidePopover === 'function' &&
        capa.matches(':popover-open')
      )
        capa.hidePopover();
    };
  }, [contenedor, avisos.length]);

  if (!contenedor || avisos.length === 0) return null;
  return createPortal(
    <div
      ref={capaRef}
      className="notificaciones-capa"
      popover="manual"
      role="region"
      aria-label="Notificaciones del sistema"
    >
      {avisos.map((aviso) => (
        <TarjetaNotificacion key={`${aviso.id}:${aviso.clave}`} aviso={aviso} />
      ))}
    </div>,
    contenedor
  );
}
