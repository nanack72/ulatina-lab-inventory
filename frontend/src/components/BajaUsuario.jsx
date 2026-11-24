import { useEffect, useRef, useState } from 'react';
import { darBajaUsuario } from '../services/usuariosService';

const ROLES_OPERATIVOS = [
  'superadministrador',
  'administrador',
  'admin',
  'coordinador',
  'director',
  'tecnico',
];

const normalizarRol = (rol) =>
  String(rol ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function BajaUsuario({ usuario, usuarios = [], token, onCerrar, onCompletada }) {
  const dialogoRef = useRef(null);
  const enviandoRef = useRef(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [ordenesAbiertas, setOrdenesAbiertas] = useState(
    Number(usuario?.ordenes_abiertas) || 0
  );
  const [idTecnicoSustituto, setIdTecnicoSustituto] = useState('');

  const requiereReasignacion = ordenesAbiertas > 0;
  const sustitutosDisponibles = usuarios.filter(
    (candidato) =>
      candidato.activo &&
      Number(candidato.id_usuario) !== Number(usuario.id_usuario) &&
      ROLES_OPERATIVOS.includes(normalizarRol(candidato.rol))
  );

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo.open) dialogo.showModal();
    return () => { if (dialogo.open) dialogo.close(); };
  }, []);

  async function confirmar(evento) {
    evento.preventDefault();
    if (enviandoRef.current || !confirmado) return;
    if (requiereReasignacion && !idTecnicoSustituto) {
      setError('Seleccione un usuario activo y autorizado para reasignar las órdenes abiertas (RN15).');
      return;
    }
    enviandoRef.current = true;
    setProcesando(true);
    setError('');
    try {
      const resultado = await darBajaUsuario(
        usuario.id_usuario,
        token,
        requiereReasignacion ? Number(idTecnicoSustituto) : null
      );
      onCompletada(resultado);
    } catch (err) {
      if (err.ordenesAbiertas > 0) {
        setOrdenesAbiertas(err.ordenesAbiertas);
      }
      setError(err.message || 'No se pudo dar de baja la cuenta.');
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
      {error && <p className="cfg-mensaje cfg-error" role="alert">{error}</p>}
      {procesando && <p role="status">Procesando la baja. Espere a que termine.</p>}
      <form onSubmit={confirmar}>
        {requiereReasignacion && (
          <label className="cfg-campo">
            <span>
              Reasignar {ordenesAbiertas === 1 ? '1 orden abierta' : `${ordenesAbiertas} órdenes abiertas`} a *
            </span>
            <select
              required
              disabled={procesando}
              value={idTecnicoSustituto}
              onChange={evento => setIdTecnicoSustituto(evento.target.value)}
            >
              <option value="">Seleccione un usuario activo autorizado</option>
              {sustitutosDisponibles.map(candidato => (
                <option key={candidato.id_usuario} value={candidato.id_usuario}>
                  {candidato.nombre_completo} ({candidato.rol})
                </option>
              ))}
            </select>
            <small>
              Solo se reasignan las órdenes en proceso o pendientes de repuesto (RN15).
              Las órdenes completadas conservan su autoría histórica.
            </small>
          </label>
        )}
        <label className="cfg-confirmar-check">
          <input type="checkbox" checked={confirmado} disabled={procesando}
            onChange={evento => setConfirmado(evento.target.checked)} />
          <span>Entiendo que la cuenta se eliminará si no tiene actividad o se desactivará para conservar sus historiales.</span>
        </label>
        <div className="cfg-modal-acciones">
          <button type="button" className="btn btn-secundario" autoFocus disabled={procesando}
            onClick={() => dialogoRef.current.close()}>Cancelar</button>
          <button
            type="submit"
            className="btn usu-boton-baja"
            disabled={procesando || !confirmado || (requiereReasignacion && !idTecnicoSustituto)}
          >
            {procesando ? 'Procesando...' : 'Eliminar o desactivar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
