import { notificar } from '../../utils/notificaciones';
import Notificacion from '../comunes/Notificacion';
import { useEffect, useRef, useState } from 'react';

export default function EliminarEquipo({ equipo, token, onCerrar, onEliminado, onSesionExpirada }) {
  const dialogo = useRef(null);
  const enviando = useRef(false);
  const cancelar = useRef(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const original = equipo.original ?? equipo;
  useEffect(() => {
    const elemento = dialogo.current;
    elemento.showModal();
    cancelar.current?.focus();
    return () => elemento.close();
  }, []);

  async function confirmar(evento) {
    evento.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setError('');
    try {
      const id = original.id_equipo ?? original.id ?? equipo.clave;
      const respuesta = await fetch(`/api/equipos/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const datos = await respuesta.json().catch(() => null);
      if (respuesta.status === 401) onSesionExpirada?.();
      if (!respuesta.ok || !datos?.success) throw new Error(datos?.message || 'No fue posible eliminar el equipo.');
      notificar({ tipo: 'exito', mensaje: datos.message });
      onEliminado();
    } catch (error) {
      setError(error.message);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  return (
    <dialog ref={dialogo} className="inv-dialogo-eliminar" aria-labelledby="eliminar-equipo-titulo"
      onCancel={(evento) => { evento.preventDefault(); if (!enviando.current) onCerrar(); }}>
      <form onSubmit={confirmar}>
        <h2 id="eliminar-equipo-titulo">Eliminar equipo</h2>
        <p><strong>{equipo.nombre || original.nombre}</strong></p>
        <p>Placa: {original.placa_institucional || equipo.placa || 'Sin placa'}</p>
        <p>Se quitará del inventario. Sus datos, fotos e historial se conservarán.</p>
        <label htmlFor="motivo-eliminar-equipo">Motivo de eliminación *</label>
        <textarea id="motivo-eliminar-equipo" required minLength={5} maxLength={500}
          rows={3} value={motivo} disabled={ocupado}
          placeholder="Por ejemplo: registrado por error o registro duplicado"
          onChange={(evento) => setMotivo(evento.target.value)} />
        {error && <Notificacion tipo="error" alCerrar={() => setError('')}>{error}</Notificacion>}
        <div className="inv-eliminar-acciones">
          <button ref={cancelar} type="button" className="btn btn-secundario" disabled={ocupado} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn inv-confirmar-eliminar" disabled={ocupado || motivo.trim().length < 5}>
            {ocupado ? 'Eliminando…' : 'Eliminar equipo'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
