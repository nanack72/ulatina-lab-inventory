import { useState, useEffect } from 'react';
import { X, Camera, RefreshCw, ZoomIn, Calendar, FileText, ImageOff } from 'lucide-react';
import { consultarEvidenciasPorBitacora } from '../../services/evidenciasService';
import { formatearFechaMantenimiento } from '../../utils/mantenimiento';

export default function ModalVerEvidencias({
  mantenimiento,
  abierto,
  alCerrar,
  token
}) {
  const [evidencias, setEvidencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  useEffect(() => {
    if (!abierto || !mantenimiento?.id_bitacora) return;

    let cancelado = false;
    const controlador = new AbortController();

    async function cargar() {
      try {
        setCargando(true);
        setError(null);
        const data = await consultarEvidenciasPorBitacora(
          mantenimiento.id_bitacora,
          token,
          controlador.signal
        );
        if (!cancelado) {
          setEvidencias(data);
        }
      } catch (err) {
        if (!cancelado && err.name !== 'AbortError') {
          setError(err.message || 'Error al cargar evidencias');
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
  }, [abierto, mantenimiento?.id_bitacora, token]);

  if (!abierto || !mantenimiento) return null;

  return (
    <div className="mant-modal-backdrop" onClick={alCerrar}>
      <div
        className="mant-modal-contenido mant-modal-contenido--ancho"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="mant-evidencias-titulo"
      >
        <header className="mant-modal-cabecera">
          <div>
            <h2 id="mant-evidencias-titulo" className="mant-modal-titulo">
              Evidencias Fotográficas de la Orden #{mantenimiento.id_bitacora}
            </h2>
            <p className="mant-modal-subtitulo">
              {mantenimiento.nombre_equipo} ({mantenimiento.placa_institucional || 'Sin placa'}) — {mantenimiento.codigo_laboratorio}
            </p>
          </div>
          <button
            type="button"
            className="mant-modal-cerrar"
            onClick={alCerrar}
            aria-label="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </header>

        <div className="mant-evidencias-cuerpo">
          {cargando && (
            <div className="mant-evidencias-cargando">
              <RefreshCw className="mant-spinner" size={24} />
              <p>Cargando galería de evidencias fotográficas...</p>
            </div>
          )}

          {error && (
            <div className="mant-alerta-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          {!cargando && !error && evidencias.length === 0 && (
            <div className="mant-evidencias-vacio">
              <ImageOff size={40} className="mant-icono-vacio" />
              <p>No se adjuntaron fotografías para esta orden de mantenimiento.</p>
            </div>
          )}

          {!cargando && evidencias.length > 0 && (
            <div className="mant-galeria-grid">
              {evidencias.map((ev) => (
                <article key={ev.id_evidencia} className="mant-tarjeta-evidencia">
                  <div
                    className="mant-evidencia-img-wrap"
                    onClick={() => setFotoAmpliada(ev.url_foto)}
                  >
                    <img
                      src={ev.url_foto}
                      alt={ev.descripcion || 'Evidencia fotográfica'}
                      className="mant-evidencia-img"
                      loading="lazy"
                    />
                    <div className="mant-evidencia-overlay">
                      <ZoomIn size={20} />
                      <span>Ampliar foto</span>
                    </div>
                    <span className={`mant-evidencia-badge mant-evidencia-badge--${ev.tipo_evidencia?.toLowerCase()}`}>
                      {ev.tipo_evidencia}
                    </span>
                  </div>

                  <div className="mant-evidencia-pie">
                    <p className="mant-evidencia-desc">
                      {ev.descripcion || 'Sin descripción adicional'}
                    </p>
                    <span className="mant-evidencia-fecha">
                      <Calendar size={13} />
                      {formatearFechaMantenimiento(ev.fecha_subida)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Lightbox / Zoom modal */}
        {fotoAmpliada && (
          <div
            className="mant-lightbox-backdrop"
            onClick={() => setFotoAmpliada(null)}
          >
            <div className="mant-lightbox-wrap" onClick={(e) => e.stopPropagation()}>
              <img
                src={fotoAmpliada}
                alt="Evidencia ampliada"
                className="mant-lightbox-img"
              />
              <button
                type="button"
                className="mant-lightbox-cerrar"
                onClick={() => setFotoAmpliada(null)}
                aria-label="Cerrar vista ampliada"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
