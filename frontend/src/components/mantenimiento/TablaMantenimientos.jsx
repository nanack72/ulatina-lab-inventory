import { Camera, Lock, Wrench } from 'lucide-react';
import {
  formatearFechaMantenimiento,
  formatearHoras,
  COLORES_ESTADO_MANTENIMIENTO,
  COLORES_TIPO_MANTENIMIENTO,
  ESTADOS_MANTENIMIENTO
} from '../../utils/mantenimiento';

export default function TablaMantenimientos({
  mantenimientos = [],
  cargando,
  alSeleccionarEvidencias,
  alCambiarEstado,
  actualizandoId
}) {
  if (cargando) {
    return (
      <div className="mant-tabla-cargando">
        <div className="mant-spinner" />
        <p>Cargando órdenes de mantenimiento...</p>
      </div>
    );
  }

  if (!mantenimientos || mantenimientos.length === 0) {
    return (
      <div className="mant-tabla-vacia">
        <Wrench size={40} className="mant-icono-vacio" />
        <h3>Sin intervenciones registradas</h3>
        <p>No se encontraron órdenes de mantenimiento según los filtros aplicados.</p>
      </div>
    );
  }

  return (
    <div className="mant-tabla-contenedor">
      <table className="mant-tabla">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Placa / Serie</th>
            <th scope="col">Equipo</th>
            <th scope="col">Laboratorio</th>
            <th scope="col">Tipo</th>
            <th scope="col">Estado</th>
            <th scope="col">Técnico</th>
            <th scope="col">Horas</th>
            <th scope="col" className="mant-col-acciones">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {mantenimientos.map((item) => {
            const estiloEstado =
              COLORES_ESTADO_MANTENIMIENTO[item.estado_mantenimiento] || {
                fondo: '#f1f5f9',
                texto: '#475569',
                borde: '#e2e8f0'
              };

            const estiloTipo =
              COLORES_TIPO_MANTENIMIENTO[item.tipo_mantenimiento] || {
                fondo: '#f1f5f9',
                texto: '#475569',
                borde: '#e2e8f0'
              };

            return (
              <tr key={item.id_bitacora}>
                <td className="mant-celda-fecha">
                  {formatearFechaMantenimiento(item.fecha_mantenimiento)}
                </td>
                <td className="mant-celda-placa">
                  <span className="mant-badge-placa">
                    {item.placa_institucional || item.numero_serie || 'S/N'}
                  </span>
                </td>
                <td className="mant-celda-equipo">
                  <span className="mant-nombre-equipo">{item.nombre_equipo}</span>
                </td>
                <td className="mant-celda-lab">
                  <span className="mant-codigo-lab">{item.codigo_laboratorio}</span>
                  <span className="mant-nombre-lab-sub">
                    {item.nombre_laboratorio || item.laboratorio}
                  </span>
                </td>
                <td>
                  <span
                    className="mant-badge-tipo"
                    style={{
                      backgroundColor: estiloTipo.fondo,
                      color: estiloTipo.texto,
                      borderColor: estiloTipo.borde
                    }}
                  >
                    {item.tipo_mantenimiento}
                  </span>
                </td>
                <td>
                  {item.estado_mantenimiento === 'Completado' ? (
                    <span
                      className="mant-badge-estado mant-badge-estado--cerrado"
                      style={{
                        backgroundColor: estiloEstado.fondo,
                        color: estiloEstado.texto,
                        borderColor: estiloEstado.borde
                      }}
                      title="Orden finalizada (solo consulta)"
                    >
                      <Lock size={12} aria-hidden="true" />
                      <span>Completado</span>
                    </span>
                  ) : (
                    <select
                      className="mant-select-estado"
                      style={{
                        backgroundColor: estiloEstado.fondo,
                        color: estiloEstado.texto,
                        borderColor: estiloEstado.borde
                      }}
                      value={item.estado_mantenimiento}
                      disabled={actualizandoId === item.id_bitacora}
                      onChange={(e) =>
                        alCambiarEstado &&
                        alCambiarEstado(item.id_bitacora, e.target.value)
                      }
                      aria-label={`Estado del mantenimiento #${item.id_bitacora}`}
                      title="Actualizar estado del mantenimiento"
                    >
                      {ESTADOS_MANTENIMIENTO.map((est) => (
                        <option key={est} value={est}>
                          {est}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="mant-celda-tecnico">
                  {item.nombre_tecnico || item.tecnico}
                </td>
                <td className="mant-celda-horas">
                  {formatearHoras(item.horas_invertidas)}
                </td>
                <td className="mant-col-acciones">
                  <button
                    type="button"
                    className="mant-btn-accion mant-btn-accion--evidencias"
                    title="Ver o adjuntar evidencias fotográficas"
                    onClick={() => alSeleccionarEvidencias(item)}
                  >
                    <Camera size={16} />
                    <span>
                      Evidencias
                      {Number(item.total_evidencias) > 0
                        ? ` (${item.total_evidencias})`
                        : ''}
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
