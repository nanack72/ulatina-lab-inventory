import { RotateCcw } from 'lucide-react';

function fechaEliminacion(valor) {
  if (!valor) return 'Sin registrar';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? 'Sin registrar'
    : new Intl.DateTimeFormat('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(fecha);
}

export default function FilaEquipoEliminado({ equipo, onRestaurar }) {
  const original = equipo.original;
  return (
    <tr>
      <td>
        <span className="inv-placa">{equipo.placa || '—'}</span>
      </td>
      <td>
        <strong>{equipo.nombre || 'Sin nombre'}</strong>
      </td>
      <td>
        <div className="inv-celda-doble">
          <strong>{equipo.laboratorio}</strong>
          <small>{equipo.sede}</small>
        </div>
      </td>
      <td>{fechaEliminacion(original.eliminado_en)}</td>
      <td>{original.eliminado_por_nombre || 'Sin registrar'}</td>
      <td className="inv-motivo-eliminacion">{original.motivo_eliminacion || 'Sin registrar'}</td>
      <td>
        <button
          type="button"
          className="btn btn-contorno"
          onClick={() => onRestaurar(equipo)}
          aria-label={`Restaurar ${equipo.nombre}`}
        >
          <RotateCcw size={16} aria-hidden="true" /> Restaurar
        </button>
      </td>
    </tr>
  );
}
