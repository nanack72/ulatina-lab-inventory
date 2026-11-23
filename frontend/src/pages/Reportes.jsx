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
    [laboratorio, setLaboratorio] = useState(''),
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
  const filtrados = laboratorios.filter(
      (l) => !laboratorio || String(l.id_laboratorio) === laboratorio
    ),
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
                <div className="mod-selectores">
                  <label>
                    Laboratorio
                    <select
                      name="laboratorio"
                      value={laboratorio}
                      onChange={(e) => {
                        setLaboratorio(e.target.value);
                        setPagina(1);
                      }}
                    >
                      <option value="">Todos los laboratorios</option>
                      {laboratorios.map((l) => (
                        <option key={l.id_laboratorio} value={l.id_laboratorio}>
                          {l.codigo} · {l.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
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
                      {['Código', 'Laboratorio', 'Equipos', 'Porcentaje del total'].map((t) => (
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
