import { useEffect, useId, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';

export default function NavegacionMovil(props) {
  const dialogo = useRef(null);
  const boton = useRef(null);
  const cierre = useRef(null);
  const id = useId();
  const [abierto, setAbierto] = useState(false);

  function cerrar() {
    dialogo.current?.close();
  }

  useEffect(() => {
    const pantalla = window.matchMedia('(min-width: 801px)');
    const alCambiar = () => {
      if (pantalla.matches) dialogo.current?.close();
    };
    pantalla.addEventListener('change', alCambiar);
    return () => pantalla.removeEventListener('change', alCambiar);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  function abrir() {
    dialogo.current.showModal();
    setAbierto(true);
    cierre.current.focus({ preventScroll: true });
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        className="movil-menu-boton"
        aria-controls={id}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        onClick={abrir}
      >
        <Menu size={21} aria-hidden="true" />
        <span>Menú</span>
      </button>
      <dialog
        ref={dialogo}
        id={id}
        className="movil-menu-dialogo"
        aria-label="Navegación del sistema"
        onClose={() => {
          setAbierto(false);
          if (window.matchMedia('(max-width: 800px)').matches) boton.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) cerrar();
        }}
      >
        <div className="movil-menu-panel">
          <button
            ref={cierre}
            type="button"
            className="movil-menu-cerrar"
            onClick={cerrar}
            aria-label="Cerrar menú"
          >
            <X size={22} aria-hidden="true" />
          </button>
          <Sidebar
            {...props}
            cambiarPagina={(pagina) => {
              cerrar();
              props.cambiarPagina(pagina);
            }}
            cerrarSesion={() => {
              cerrar();
              props.cerrarSesion();
            }}
          />
        </div>
      </dialog>
    </>
  );
}
