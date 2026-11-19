import { Insignia } from '../comunes/Modulo';
import { formatearFechaIncidencia, ESTADOS_INCIDENCIA } from '../../utils/incidencias';
export default function TablaIncidencias({
  incidencias = [],
  cargando,
  alCambiarEstado,
  actualizandoId,
}) {
  if (cargando)
    return (
      <div className="mod-vacio" role="status">
        Cargando incidencias…
      </div>
    );
  if (!incidencias.length)
    return <div className="mod-vacio">No se encontraron incidencias con estos filtros.</div>;
  return (
    <div className="mod-tabla-wrap" role="region" aria-label="Incidencias encontradas" tabIndex={0}>
      <table className="inv-tabla mod-tabla">
        <caption className="mod-sr">Incidencias técnicas</caption>
        <thead>
          <tr>
            {[
              'Prioridad',
              'Incidencia',
              'Equipo',
              'Laboratorio',
              'Estado',
              'Reportado por',
              'Fecha',
            ].map((t) => (
              <th scope="col" key={t}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidencias.map((i) => (
            <tr key={i.id_incidencia}>
              <td>
                <Insignia
                  tono={
                    ['Crítica', 'Critica', 'Alta'].includes(i.prioridad)
                      ? 'rojo'
                      : i.prioridad === 'Media'
                        ? 'ambar'
                        : 'neutral'
                  }
                >
                  {i.prioridad}
                </Insignia>
              </td>
              <td>
                <strong>{i.titulo}</strong>
                <p>{i.descripcion_falla}</p>
              </td>
              <td>
                {i.nombre_equipo}
                <small>{i.placa_institucional || 'Sin placa'}</small>
              </td>
              <td>
                {i.codigo_laboratorio}
                <small>{i.nombre_laboratorio}</small>
              </td>
              <td>
                <select
                  name={'estado-' + i.id_incidencia}
                  aria-label={'Estado de ' + i.titulo}
                  value={i.estado_incidencia}
                  disabled={actualizandoId !== null && actualizandoId !== undefined}
                  onChange={(e) => alCambiarEstado(i.id_incidencia, e.target.value)}
                >
                  {ESTADOS_INCIDENCIA.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </td>
              <td>{i.reportado_por}</td>
              <td>{formatearFechaIncidencia(i.fecha_reporte)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
