import { AlertTriangle, CheckCircle, Clock, XCircle, ShieldAlert } from 'lucide-react';
import {
  formatearFechaIncidencia,
  COLORES_PRIORIDAD,
  COLORES_ESTADO_INCIDENCIA,
  ESTADOS_INCIDENCIA
} from '../../utils/incidencias';

export default function TablaIncidencias({
  incidencias = [],
  cargando,
  alCambiarEstado,
  actualizandoId
}) {
  if (cargando) {
    return (
      <div className="inci-tabla-cargando">
        <div className="inci-spinner" />
        <p>Cargando reportes de incidencias técnicas...</p>
      </div>
    );
  }

  if (!incidencias || incidencias.length === 0) {
    return (
      <div className="inci-tabla-vacia">
        <ShieldAlert size={42} className="inci-icono-vacio" />
        <h3>Sin incidencias registradas</h3>
        <p>No se encontraron reportes de fallas activas bajo los filtros seleccionados.</p>
      </div>
    );
  }

  return (
    <div className="inci-tabla-contenedor">
      <table className="inci-tabla">
        <thead>
          <tr>
            <th>Prioridad</th>
            <th>Incidencia / Falla</th>
            <th>Activo Tecnológico</th>
            <th>Laboratorio</th>
            <th>Estado</th>
            <th>Reportado Por</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {incidencias.map((item) => {
            const estiloPrio =
              COLORES_PRIORIDAD[item.prioridad] || COLORES_PRIORIDAD.Media;
            const estiloEstado =
              COLORES_ESTADO_INCIDENCIA[item.estado_incidencia] ||
              COLORES_ESTADO_INCIDENCIA.Abierta;

            const esActualizando = actualizandoId === item.id_incidencia;

            return (
              <tr key={item.id_incidencia}>
                <td className="inci-celda-prioridad">
                  <span
                    className="inci-badge-prioridad"
                    style={{
                      backgroundColor: estiloPrio.fondo,
                      color: estiloPrio.texto,
                      borderColor: estiloPrio.borde
                    }}
                  >
                    <span
                      className="inci-punto-prioridad"
                      style={{ backgroundColor: estiloPrio.punto }}
                    />
                    {item.prioridad}
                  </span>
                </td>

                <td className="inci-celda-detalle">
                  <span className="inci-titulo-falla">{item.titulo}</span>
                  <p className="inci-desc-falla">{item.descripcion_falla}</p>
                </td>

                <td className="inci-celda-equipo">
                  <span className="inci-nombre-equipo">{item.nombre_equipo}</span>
                  <span className="inci-placa-equipo">
                    {item.placa_institucional || 'Sin placa'}
                  </span>
                </td>

                <td className="inci-celda-lab">
                  <span className="inci-codigo-lab">{item.codigo_laboratorio}</span>
                  <span className="inci-nombre-lab">{item.nombre_laboratorio}</span>
                </td>

                <td className="inci-celda-estado">
                  <select
                    className="inci-select-estado"
                    style={{
                      backgroundColor: estiloEstado.fondo,
                      color: estiloEstado.texto,
                      borderColor: estiloEstado.borde
                    }}
                    value={item.estado_incidencia}
                    disabled={esActualizando}
                    onChange={(e) =>
                      alCambiarEstado(item.id_incidencia, e.target.value)
                    }
                    title="Actualizar estado de atención"
                  >
                    {ESTADOS_INCIDENCIA.map((est) => (
                      <option key={est} value={est}>
                        {est}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="inci-celda-usuario">
                  <span>{item.reportado_por}</span>
                </td>

                <td className="inci-celda-fecha">
                  {formatearFechaIncidencia(item.fecha_reporte)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
