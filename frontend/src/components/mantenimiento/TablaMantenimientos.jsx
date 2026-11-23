import { Camera, Lock } from 'lucide-react';
import { Insignia } from '../comunes/Modulo';
import {
  formatearFechaMantenimiento,
  formatearHoras,
  ESTADOS_MANTENIMIENTO,
} from '../../utils/mantenimiento';
// Color del selector según el estado del mantenimiento
const TONO_ESTADO = {
  'Completado': 'verde',
  'En Proceso': 'ambar',
  'Pendiente Repuesto': 'rojo',
};

export default function TablaMantenimientos({
  mantenimientos = [],
  cargando,
  alSeleccionarEvidencias,
  alCambiarEstado,
  actualizandoId,
}) {
  if (cargando)
    return (
      <div className="mod-vacio" role="status">
        Cargando mantenimientos…
      </div>
    );
  if (!mantenimientos.length)
    return <div className="mod-vacio">No se encontraron mantenimientos con estos filtros.</div>;
  return (
    <div
      className="mod-tabla-wrap"
      role="region"
      aria-label="Mantenimientos encontrados"
      tabIndex={0}
    >
      <table className="inv-tabla mod-tabla">
        <caption className="mod-sr">Mantenimientos registrados</caption>
        <thead>
          <tr>
            {[
              'Fecha',
              'Equipo',
              'Laboratorio',
              'Tipo',
              'Estado',
              'Técnico',
              'Horas',
              'Acciones',
            ].map((t) => (
              <th scope="col" key={t}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mantenimientos.map((m) => (
            <tr key={m.id_bitacora}>
              <td>{formatearFechaMantenimiento(m.fecha_mantenimiento)}</td>
              <td>
                <strong>{m.nombre_equipo}</strong>
                <small>{m.placa_institucional || m.numero_serie || 'Sin placa'}</small>
              </td>
              <td>
                {m.codigo_laboratorio}
                <small>{m.nombre_laboratorio || m.laboratorio}</small>
              </td>
              <td>
                <Insignia tono={m.tipo_mantenimiento === 'Correctivo' ? 'ambar' : 'verde'}>
                  {m.tipo_mantenimiento}
                </Insignia>
              </td>
              <td>
                {m.estado_mantenimiento === 'Completado' ? (
                  <span
                    className="mod-insignia mod-insignia-verde mant-badge-estado--cerrado"
                    title="Orden finalizada (solo consulta)"
                  >
                    <Lock size={12} aria-hidden="true" />
                    <span>Completado</span>
                  </span>
                ) : (
                  <select
                    className={`mod-select-estado mod-insignia-${TONO_ESTADO[m.estado_mantenimiento] || 'neutro'}`}
                    name={'estado-' + m.id_bitacora}
                    aria-label={'Estado del mantenimiento ' + m.id_bitacora}
                    value={m.estado_mantenimiento}
                    disabled={actualizandoId !== null && actualizandoId !== undefined}
                    onChange={(e) => alCambiarEstado(m.id_bitacora, e.target.value)}
                  >
                    {ESTADOS_MANTENIMIENTO.map((e) => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>
                )}
              </td>
              <td>{m.nombre_tecnico || m.tecnico}</td>
              <td>{formatearHoras(m.horas_invertidas)}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-contorno"
                  onClick={() => alSeleccionarEvidencias(m)}
                >
                  <Camera size={15} aria-hidden="true" />
                  <span>
                    Evidencias
                    {Number(m.total_evidencias) > 0 ? ` (${m.total_evidencias})` : ''}
                  </span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
