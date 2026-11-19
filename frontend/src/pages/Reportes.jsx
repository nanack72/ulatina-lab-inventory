import { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { EncabezadoModulo, Aviso, Indicador, PaginacionModulo } from '../components/comunes/Modulo';
import { useListadoModulo } from '../hooks/useListadoModulo';
import { consultarResumenGeneral, descargarReporteExcel } from '../services/reportesService';
import { formatearNumero, calcularPorcentajeSeguro } from '../utils/reportes';
import FiltrosUbicacion from '../components/comunes/FiltrosUbicacion';
import { filtrarDistribucion } from '../utils/ubicaciones';
import '../styles/filtrosRevision.css';

export default function Reportes({ token }) {
  const cargar = useCallback((signal) => consultarResumenGeneral(token, signal), [token]);
  const { datos, cargando, error, recargar } = useListadoModulo(cargar);
  const [descargando, setDescargando] = useState(false),
    [errorDescarga, setErrorDescarga] = useState(''),
    [laboratorio, setLaboratorio] = useState(''),
    [sede, setSede] = useState(''),
    [busqueda, setBusqueda] = useState(''),
    [pagina, setPagina] = useState(1);
  const ocupado = useRef(false);
  async function descargar() {
    if (ocupado.current) return;
    ocupado.current = true;
    setDescargando(true);
    setErrorDescarga('');
    try {
      await descargarReporteExcel(token);
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
  const filtrados = filtrarDistribucion(laboratorios, sede, laboratorio, busqueda),
    actual = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / 10)));
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
                <h2 className="mod-titulo-tabla">Equipos por laboratorio</h2>
                <div className="mod-selectores revision-filtros-reportes">
                  <label>
                    Buscar
                    <input
                      type="search"
                      className="revision-busqueda"
                      value={busqueda}
                      placeholder="Código, laboratorio o sede…"
                      onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
                    />
                  </label>
                  <FiltrosUbicacion
                    ubicaciones={laboratorios}
                    sede={sede}
                    laboratorio={laboratorio}
                    alCambiar={(s, l) => { setSede(s); setLaboratorio(l); setPagina(1); }}
                  />
                </div>
              </div>
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
                      {['Código', 'Laboratorio', 'Sede', 'Equipos', 'Porcentaje del total'].map((t) => (
                        <th scope="col" key={t}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.slice((actual - 1) * 10, actual * 10).map((l) => {
                      const porcentaje = calcularPorcentajeSeguro(l.cantidad_equipos, total);
                      return (
                        <tr key={l.id_laboratorio}>
                          <td>{l.codigo}</td>
                          <td>{l.nombre}</td>
                          <td>{l.nombre_sede}</td>
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
              <PaginacionModulo pagina={actual} total={filtrados.length} alCambiar={setPagina} />
            </section>
          </>
        )
      )}
    </div>
  );
}
