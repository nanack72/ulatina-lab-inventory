import { useEffect, useRef, useState } from 'react';

export default function RestaurarEquipo({ equipo, token, onCerrar, onRestaurado, onSesionExpirada }) {
  const dialogo = useRef(null);
  const cancelar = useRef(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
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
      const id = equipo.original?.id_equipo ?? equipo.clave;
      const respuesta = await fetch(`/api/equipos/${encodeURIComponent(id)}/restaurar`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const datos = await respuesta.json().catch(() => null);
      if (respuesta.status === 401) onSesionExpirada?.();
      if (!respuesta.ok || !datos?.success) throw new Error(datos?.message || 'No fue posible restaurar el equipo.');
      onRestaurado(datos.message);
    } catch (error) {
      setError(error.message);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  return (
    <dialog ref={dialogo} className="inv-dialogo-eliminar" aria-labelledby="restaurar-equipo-titulo"
      onCancel={(evento) => { evento.preventDefault(); if (!enviando.current) onCerrar(); }}>
      <form onSubmit={confirmar}>
        <h2 id="restaurar-equipo-titulo">Restaurar equipo</h2>
        <p><strong>{equipo.nombre}</strong></p>
        <p>Placa: {equipo.placa || 'Sin placa'}</p>
        <p>Volverá al inventario activo con sus datos, fotos e historiales. Su estado y laboratorio se conservarán.</p>
        {error && <p role="alert">{error}</p>}
        <div className="inv-eliminar-acciones">
          <button ref={cancelar} type="button" className="btn btn-secundario" disabled={ocupado} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={ocupado}>
            {ocupado ? 'Restaurando…' : 'Restaurar equipo'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
