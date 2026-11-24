import Notificacion from './comunes/Notificacion';
import { useEffect, useRef, useState } from 'react';
import { darBajaUsuario } from '../services/usuariosService';

export default function BajaUsuario({ usuario, token, onCerrar, onCompletada }) {
  const dialogoRef = useRef(null);
  const enviandoRef = useRef(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo.open) dialogo.showModal();
    return () => { if (dialogo.open) dialogo.close(); };
  }, []);

  async function confirmar(evento) {
    evento.preventDefault();
    if (enviandoRef.current || !confirmado) return;
    enviandoRef.current = true;
    setProcesando(true);
    setError('');
    try {
      const resultado = await darBajaUsuario(usuario.id_usuario, token);
      onCompletada(resultado);
    } catch (error) {
      setError(error.message || 'No se pudo dar de baja la cuenta.');
    } finally {
      enviandoRef.current = false;
      setProcesando(false);
    }
  }

  return (
    <dialog ref={dialogoRef} className="cfg-dialogo usu-baja" aria-labelledby="usu-baja-titulo"
      aria-describedby="usu-baja-descripcion"
      onClose={evento => {
        // close se entrega de forma asíncrona. StrictMode puede haber reabierto
        // el diálogo tras la limpieza del efecto; ese cierre anterior se ignora.
        if (!evento.currentTarget.open) onCerrar();
      }}
      onCancel={evento => { if (enviandoRef.current) evento.preventDefault(); }}>
      <h2 id="usu-baja-titulo">¿Dar de baja a este usuario?</h2>
      <p><strong>{usuario.nombre_completo}</strong><br />{usuario.correo_institucional}</p>
      <p id="usu-baja-descripcion">
        Si no tiene actividad registrada, la cuenta se eliminará permanentemente.
        Si tiene actividad, se desactivará y se conservarán sus historiales.
        Una cuenta desactivada no puede iniciar sesión.
      </p>
      {error && <Notificacion tipo="error" alCerrar={() => setError('')}>{error}</Notificacion>}
      {procesando && <p role="status">Procesando la baja. Espere a que termine.</p>}
      <form onSubmit={confirmar}>
        <label className="cfg-confirmar-check">
          <input type="checkbox" checked={confirmado} disabled={procesando}
            onChange={evento => setConfirmado(evento.target.checked)} />
          <span>Entiendo que la cuenta se eliminará si no tiene actividad o se desactivará para conservar sus historiales.</span>
        </label>
        <div className="cfg-modal-acciones">
          <button type="button" className="btn btn-secundario" autoFocus disabled={procesando}
            onClick={() => dialogoRef.current.close()}>Cancelar</button>
          <button type="submit" className="btn usu-boton-baja" disabled={procesando || !confirmado}>
            {procesando ? 'Procesando...' : 'Eliminar o desactivar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
