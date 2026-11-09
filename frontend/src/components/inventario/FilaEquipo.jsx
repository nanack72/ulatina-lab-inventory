import { ChevronRight } from 'lucide-react';

import {
  claseEstado,
  formatearSede,
} from '../../utils/inventario';

// ==========================================
// FILA DE EQUIPO - INVENTARIO PES
// ==========================================

export default function FilaEquipo({
  equipo,
  onVer,
}) {
  const puedeVerDetalle = typeof onVer === 'function';

  const ubicacion = [
    formatearSede(equipo.sede),
    equipo.ubicacion,
  ]
    .filter(Boolean)
    .join(' · ');

  function abrirDetalle() {
    if (puedeVerDetalle) {
      onVer(equipo);
    }
  }

  const nombreEquipo = equipo.nombre || 'Sin nombre';

  return (
    <tr>
      {/* PLACA INSTITUCIONAL */}
      <td>
          <span className="inv-placa">
            {equipo.placa || '—'}
          </span>
      </td>

      {/* NOMBRE Y SERIE */}
      <td>
        <div className="inv-celda-doble">
          {puedeVerDetalle ? (
            <button
              type="button"
              className="inv-equipo-enlace"
              onClick={abrirDetalle}
              title={`Ver detalle de ${nombreEquipo}`}
            >
              {nombreEquipo}
            </button>
          ) : (
            <strong>{nombreEquipo}</strong>
          )}

          <small>
            Serie {equipo.serie || 'no registrada'}
          </small>
        </div>
      </td>

      {/* CATEGORÍA */}
      <td>
        {equipo.categoria || '—'}
      </td>

      {/* MARCA Y MODELO */}
      <td>
        <div className="inv-celda-doble">
          <strong>
            {equipo.marca || '—'}
          </strong>

          <small>
            {equipo.modelo || 'Sin modelo'}
          </small>
        </div>
      </td>

      {/* UBICACIÓN */}
      <td>
        <div className="inv-celda-doble">
          <strong>
            {equipo.laboratorio || 'Sin laboratorio'}
          </strong>

          <small>
            {ubicacion || 'Ubicación no detallada'}
          </small>
        </div>
      </td>

      {/* ESTADO */}
      <td>
        <span
          className={`inv-estado ${claseEstado(
            equipo.estado
          )}`}
        >
          {equipo.estado || 'Sin estado'}
        </span>
      </td>

      {/* FLECHA PARA VER DETALLE */}
      <td className="inv-columna-detalle">
        {puedeVerDetalle && (
          <button
            type="button"
            className="inv-boton-detalle"
            onClick={abrirDetalle}
            aria-label={`Ver detalle de ${nombreEquipo}`}
            title={`Ver detalle de ${nombreEquipo}`}
          >
            <ChevronRight
              size={19}
              aria-hidden="true"
            />
          </button>
        )}
      </td>
    </tr>
  );
}
