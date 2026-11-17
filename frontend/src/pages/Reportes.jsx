import { useState, useEffect } from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  FileSpreadsheet,
  RefreshCw,
  Building2,
  CalendarCheck,
  ClipboardList
} from 'lucide-react';

import {
  consultarResumenGeneral,
  descargarReporteExcel
} from '../services/reportesService';

import {
  COLORES_ESTADOS,
  ETIQUETAS_ESTADOS,
  formatearNumero,
  calcularPorcentajeSeguro
} from '../utils/reportes';

export default function Reportes({ token, usuario }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const controlador = new AbortController();

    async function cargar() {
      try {
        setCargando(true);
        setError(null);
        const resumen = await consultarResumenGeneral(token, controlador.signal);
        if (!cancelado) {
          setDatos(resumen);
        }
      } catch (err) {
        if (!cancelado && err.name !== 'AbortError') {
          setError(err.message || 'No se pudieron cargar los datos de reportería.');
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [token]);

  const manejarDescarga = async () => {
    try {
      setDescargando(true);
      await descargarReporteExcel(token);
    } catch (err) {
      alert('Error al descargar el archivo: ' + err.message);
    } finally {
      setDescargando(false);
    }
  };

  const total = datos?.total_equipos || 0;
  const estados = datos?.equipos_por_estado || {};
  const mantenimientos = datos?.mantenimientos || {};
  const laboratorios = datos?.equipos_por_laboratorio || [];

  return (
    <div className="reportes-contenedor">
      <header className="reportes-encabezado">
        <div>
          <h1 className="reportes-titulo">Reportería y Estadísticas</h1>
          <p className="reportes-subtitulo">
            Métricas analíticas del inventario tecnológico y seguimiento de mantenimientos en laboratorios.
          </p>
        </div>
      </header>

      {error && (
        <div className="reportes-alerta-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {cargando ? (
        <div className="reportes-cargando">
          <RefreshCw className="reportes-spinner" size={28} />
          <p>Cargando métricas consolidadas...</p>
        </div>
      ) : (
        <>
          <section className="reportes-kpis-grid">
            <article className="reportes-kpi-card">
              <div className="reportes-kpi-icono reportes-kpi-icono--azul">
                <Package size={22} />
              </div>
              <div className="reportes-kpi-info">
                <span className="reportes-kpi-etiqueta">Total Activos</span>
                <span className="reportes-kpi-valor">{formatearNumero(total)}</span>
                <span className="reportes-kpi-detalle">Equipos registrados en el sistema</span>
              </div>
            </article>

            <article className="reportes-kpi-card">
              <div className="reportes-kpi-icono reportes-kpi-icono--verde">
                <CheckCircle2 size={22} />
              </div>
              <div className="reportes-kpi-info">
                <span className="reportes-kpi-etiqueta">Operativos</span>
                <span className="reportes-kpi-valor">{formatearNumero(estados.operativo)}</span>
                <span className="reportes-kpi-detalle">Listos para uso docente</span>
              </div>
            </article>

            <article className="reportes-kpi-card">
              <div className="reportes-kpi-icono reportes-kpi-icono--amarillo">
                <Wrench size={22} />
              </div>
              <div className="reportes-kpi-info">
                <span className="reportes-kpi-etiqueta">En Mantenimiento</span>
                <span className="reportes-kpi-valor">{formatearNumero(estados.en_mantenimiento)}</span>
                <span className="reportes-kpi-detalle">En revisión o reparación</span>
              </div>
            </article>

            <article className="reportes-kpi-card">
              <div className="reportes-kpi-icono reportes-kpi-icono--rojo">
                <XCircle size={22} />
              </div>
              <div className="reportes-kpi-info">
                <span className="reportes-kpi-etiqueta">Dañados / Falla</span>
                <span className="reportes-kpi-valor">{formatearNumero(estados.danado)}</span>
                <span className="reportes-kpi-detalle">Requieren intervención técnica</span>
              </div>
            </article>
          </section>

          {/* Resumen de Mantenimientos */}
          <section className="reportes-seccion-secundaria">
            <h2 className="reportes-subtitulo-seccion">Balance de Intervenciones Técnicas</h2>
            <div className="reportes-mantenimientos-grid">
              <div className="reportes-mini-kpi">
                <CalendarCheck className="reportes-mini-icono reportes-mini-icono--verde" size={20} />
                <div>
                  <span className="reportes-mini-valor">{formatearNumero(mantenimientos.preventivos)}</span>
                  <span className="reportes-mini-etiqueta">Mantenimientos Preventivos</span>
                </div>
              </div>

              <div className="reportes-mini-kpi">
                <AlertTriangle className="reportes-mini-icono reportes-mini-icono--ambar" size={20} />
                <div>
                  <span className="reportes-mini-valor">{formatearNumero(mantenimientos.correctivos)}</span>
                  <span className="reportes-mini-etiqueta">Mantenimientos Correctivos</span>
                </div>
              </div>

              <div className="reportes-mini-kpi">
                <ClipboardList className="reportes-mini-icono reportes-mini-icono--azul" size={20} />
                <div>
                  <span className="reportes-mini-valor">{formatearNumero(mantenimientos.total)}</span>
                  <span className="reportes-mini-etiqueta">Total de Intervenciones</span>
                </div>
              </div>
            </div>
          </section>

          {/* Tabla de Distribución por Laboratorio */}
          <section className="reportes-seccion-tabla">
            <h2 className="reportes-subtitulo-seccion">Distribución de Equipos por Laboratorio</h2>
            <div className="reportes-tabla-contenedor">
              <table className="reportes-tabla">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Laboratorio</th>
                    <th>Equipos</th>
                    <th>% Total</th>
                  </tr>
                </thead>
                <tbody>
                  {laboratorios.map((lab) => {
                    const porcentaje = calcularPorcentajeSeguro(lab.cantidad_equipos, total);
                    return (
                      <tr key={lab.id_laboratorio}>
                        <td className="reportes-codigo-lab">{lab.codigo}</td>
                        <td className="reportes-nombre-lab">{lab.nombre}</td>
                        <td className="reportes-conteo-lab">{lab.cantidad_equipos}</td>
                        <td className="reportes-barra-celda">
                          <div className="reportes-barra-fondo">
                            <div
                              className="reportes-barra-progreso"
                              style={{ width: `${porcentaje}%` }}
                            />
                          </div>
                          <span className="reportes-barra-texto">{porcentaje}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Botón de descarga al pie */}
          <div className="reportes-acciones-pie">
            <button
              type="button"
              className="reportes-boton-descarga"
              onClick={manejarDescarga}
              disabled={descargando}
            >
              <FileSpreadsheet size={18} />
              <span>{descargando ? 'Generando libro Excel...' : 'Descargar Consolidado Oficial (.xlsx)'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
