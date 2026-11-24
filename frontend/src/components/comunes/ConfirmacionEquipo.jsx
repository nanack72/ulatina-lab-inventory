import { useEffect, useRef } from 'react';
import '../../styles/confirmacionEquipo.css';

// Se monta solo al solicitar la confirmación; el navegador controla foco y fondo.
export default function ConfirmacionEquipo({ tituloId, ocupado, onCerrar, children }) {
  const dialogo = useRef(null);
  useEffect(() => {
    const ventana = dialogo.current;
    ventana.showModal();
    return () => {
      if (ventana.open) ventana.close();
    };
  }, []);
  return (
    <dialog
      ref={dialogo}
      className="equipo-confirmacion-dialogo"
      aria-labelledby={tituloId}
      aria-busy={ocupado}
      onCancel={(evento) => {
        if (ocupado) evento.preventDefault();
        else onCerrar();
      }}
    >
      {children}
    </dialog>
  );
}
