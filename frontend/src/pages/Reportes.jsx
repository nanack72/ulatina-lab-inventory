import FiltrosUbicacion from '../components/comunes/FiltrosUbicacion';
import { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { EncabezadoModulo, Aviso, Indicador, PaginacionModulo } from '../components/comunes/Modulo';
import { useListadoModulo } from '../hooks/useListadoModulo';
import { consultarResumenGeneral, descargarReporteExcel } from '../services/reportesService';
import { formatearNumero, calcularPorcentajeSeguro } from '../utils/reportes';

export default function Reportes({ token }) {
  const cargar = useCallback((signal) => consultarResumenGeneral(token, signal), [token]);
  const { datos, cargando, error, recargar } = useListadoModulo(cargar);
  const [descargando, setDescargando] = useState(false),
    [errorDescarga, setErrorDescarga] = useState(''),
    [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [ubicacion, setUbicacion] = useState({ sede: '', laboratorio: '' });
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const ocupado = useRef(false);
  const hayFiltrosActivos = Boolean(
    ubicacion.sede || ubicacion.laboratorio || fechaDesde || fechaHasta
  );

  function limpiarFiltros() {
    setUbicacion({ sede: '', laboratorio: '' });
    setFechaDesde('');
    setFechaHasta('');
    setErrorDescarga('');
    setPagina(1);
  }

  async function descargar() {
    if (ocupado.current) return;
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setErrorDescarga('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    ocupado.current = true;
    setDescargando(true);
    setErrorDescarga('');
    try {
      await descargarReporteExcel(token, {
        id_sede: ubicacion.sede,
        id_laboratorio: ubicacion.laboratorio,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      });
    } catch (err) {
      setErrorDescarga(err.message);
    } finally {
      ocupado.current = false;
      setDescargando(false);
    }
  }
  const total = datos?.total_equipos || 0,
    estados = datos?.equipos_por_estado || {},
    mantenimiento = datos?.mantenimientos || {},
    laboratorios = datos?.equipos_por_laboratorio || [];
  const filtrados = laboratorios.filter(
      (l) =>
        (!ubicacion.sede || String(l.id_sede) === ubicacion.sede) &&
        (!ubicacion.laboratorio || String(l.id_laboratorio) === ubicacion.laboratorio)
    ),
    actual = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / limite)));
  return (
    <div className="inv-pagina mod-pagina">
      <EncabezadoModulo
        titulo="Reportes"
        descripcion="Consulte la distribución del inventario y el resumen de mantenimientos."
        alActualizar={recargar}
        cargando={cargando}
      >
        <button
          type="button"
          className="btn btn-lg btn-primario"
          onClick={descargar}
          disabled={descargando || cargando || !!error}
        >
          <FileSpreadsheet size={17} aria-hidden="true" />
          {descargando ? 'Generando Excel…' : 'Exportar a Excel'}
        </button>
      </EncabezadoModulo>
      <Aviso error>{error || errorDescarga}</Aviso>
      {cargando ? (
        <div className="mod-vacio" role="status">
          Cargando reportes…
        </div>
      ) : (
        datos && (
          <>
            <section className="mod-indicadores" aria-label="Resumen del inventario">
              <Indicador
                titulo="Total de equipos"
                valor={formatearNumero(total)}
                detalle="Equipos dentro de su alcance"
              />
              <Indicador
                titulo="Operativos"
                valor={formatearNumero(estados.operativo)}
                detalle="Listos para uso"
              />
              <Indicador
                titulo="En mantenimiento"
                valor={formatearNumero(estados.en_mantenimiento)}
                detalle="En revisión o reparación"
                tono="ambar"
              />
              <Indicador
                titulo="Dañados"
                valor={formatearNumero(estados.danado)}
                detalle="Requieren intervención"
                tono="rojo"
              />
            </section>
            <section
              className="inv-contenedor mod-subpanel"
              aria-labelledby="resumen-intervenciones"
            >
              <h2 id="resumen-intervenciones">Resumen de mantenimientos</h2>
              <div className="mod-indicadores">
                <Indicador
                  titulo="Preventivos"
                  valor={formatearNumero(mantenimiento.preventivos)}
                  detalle="Intervenciones preventivas"
                />
                <Indicador
                  titulo="Correctivos"
                  valor={formatearNumero(mantenimiento.correctivos)}
                  detalle="Reparaciones registradas"
                  tono="ambar"
                />
                <Indicador
                  titulo="Total"
                  valor={formatearNumero(mantenimiento.total)}
                  detalle="Intervenciones registradas"
                />
              </div>
            </section>
            <section className="inv-contenedor" aria-label="Distribución por laboratorio">
              <div className="inv-barra-filtros">
                <h2 className="mod-titulo-tabla">Equipos por laboratorio y filtros de exportación</h2>
                <div className="inv-selectores mod-filtros-reporte">
                  <FiltrosUbicacion
                    compacto
                    token={token}
                    valor={ubicacion}
                    onChange={(valor) => {
                      setUbicacion(valor);
                      setPagina(1);
                    }}
                  />
                  <label className="mod-filtro-fecha" htmlFor="rep-fecha-desde">
                    <span>Desde</span>
                    <input
                      id="rep-fecha-desde"
                      type="date"
                      value={fechaDesde}
                      max={fechaHasta || undefined}
                      onChange={(e) => {
                        setFechaDesde(e.target.value);
                        setErrorDescarga('');
                      }}
                    />
                  </label>
                  <label className="mod-filtro-fecha" htmlFor="rep-fecha-hasta">
                    <span>Hasta</span>
                    <input
                      id="rep-fecha-hasta"
                      type="date"
                      value={fechaHasta}
                      min={fechaDesde || undefined}
                      onChange={(e) => {
                        setFechaHasta(e.target.value);
                        setErrorDescarga('');
                      }}
                    />
                  </label>
                  {hayFiltrosActivos && (
                    <button
                      type="button"
                      className="btn btn-secundario"
                      onClick={limpiarFiltros}
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
              <p className="mod-nota-exportacion">
                La exportación a Excel incluye las hojas <strong>Inventario</strong>,{' '}
                <strong>Mantenimientos</strong> e <strong>Incidencias</strong> respetando la sede,
                el laboratorio y el rango de fechas seleccionados.
              </p>
              <div
                className="mod-tabla-wrap"
                role="region"
                aria-label="Distribución de equipos por laboratorio"
                tabIndex={0}
              >
                <table className="inv-tabla mod-tabla">
                  <caption className="mod-sr">Equipos por laboratorio</caption>
                  <thead>
                    <tr>
                      {['Código', 'Laboratorio', 'Equipos', 'Porcentaje del total'].map((t) => (
                        <th scope="col" key={t}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.slice((actual - 1) * limite, actual * limite).map((l) => {
                      const porcentaje = calcularPorcentajeSeguro(l.cantidad_equipos, total);
                      return (
                        <tr key={l.id_laboratorio}>
                          <td>{l.codigo}</td>
                          <td>{l.nombre}</td>
                          <td>{formatearNumero(l.cantidad_equipos)}</td>
                          <td>
                            <span>{porcentaje}%</span>
                            <div
                              className="mod-barra"
                              style={{ '--porcentaje': porcentaje + '%' }}
                              aria-hidden="true"
                            >
                              <span />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filtrados.length && (
                  <p className="mod-vacio">No hay laboratorios para mostrar.</p>
                )}
              </div>
              <PaginacionModulo
                limite={limite}
                singular="laboratorio"
                plural="laboratorios"
                alCambiarLimite={(valor) => {
                  setLimite(valor);
                  setPagina(1);
                }}
                pagina={actual}
                total={filtrados.length}
                alCambiar={setPagina}
              />
            </section>
          </>
        )
      )}
    </div>
  );
}
