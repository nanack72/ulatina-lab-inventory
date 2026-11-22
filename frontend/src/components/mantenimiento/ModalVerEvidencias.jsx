import { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  RefreshCw,
  ZoomIn,
  Calendar,
  ImageOff,
  Lock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  consultarEvidenciasPorBitacora,
  subirEvidenciaFotografica
} from '../../services/evidenciasService';
import { formatearFechaMantenimiento } from '../../utils/mantenimiento';

const normalizarTipo = (texto) =>
  String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function ModalVerEvidencias({
  mantenimiento,
  abierto,
  alCerrar,
  alSubirEvidencia,
  token
}) {
  const [evidencias, setEvidencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  // Estado para adjuntar nuevas evidencias mientras la orden siga abierta
  const [archivoNuevo, setArchivoNuevo] = useState(null);
  const [tipoNuevo, setTipoNuevo] = useState('Después');
  const [descripcionNueva, setDescripcionNueva] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState(null);
  const inputArchivoRef = useRef(null);

  const cargarEvidencias = async (signal) => {
    if (!mantenimiento?.id_bitacora) return;
    try {
      setCargando(true);
      setError(null);
      const data = await consultarEvidenciasPorBitacora(
        mantenimiento.id_bitacora,
        token,
        signal
      );
      setEvidencias(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error al cargar evidencias');
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!abierto || !mantenimiento?.id_bitacora) return;

    const controlador = new AbortController();
    setErrorSubida(null);
    setArchivoNuevo(null);
    setDescripcionNueva('');
    cargarEvidencias(controlador.signal);

    return () => {
      controlador.abort();
    };
  }, [abierto, mantenimiento?.id_bitacora, token]);

  if (!abierto || !mantenimiento) return null;

  const ordenFinalizada = mantenimiento.estado_mantenimiento === 'Completado';
  const esCorrectivo = normalizarTipo(mantenimiento.tipo_mantenimiento) === 'correctivo';
  const tiposCargados = evidencias.map((ev) => normalizarTipo(ev.tipo_evidencia));
  const tieneAntes = tiposCargados.includes('antes');
  const tieneDespues = tiposCargados.includes('despues');

  const manejarSeleccionArchivo = (e) => {
    const file = e.target.files?.[0];
    setErrorSubida(null);
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorSubida('Solo se admiten imágenes JPG, PNG o WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorSubida('La imagen supera el límite máximo de 5 MB.');
      return;
    }

    setArchivoNuevo(file);
  };

  const manejarSubida = async (e) => {
    e.preventDefault();
    if (!archivoNuevo) {
      setErrorSubida('Seleccione una imagen antes de subirla.');
      return;
    }

    try {
      setSubiendo(true);
      setErrorSubida(null);
      await subirEvidenciaFotografica(
        {
          foto: archivoNuevo,
          id_bitacora: mantenimiento.id_bitacora,
          tipo_evidencia: tipoNuevo,
          descripcion: descripcionNueva.trim() || `Evidencia (${tipoNuevo})`
        },
        token
      );
      setArchivoNuevo(null);
      setDescripcionNueva('');
      if (inputArchivoRef.current) {
        inputArchivoRef.current.value = '';
      }
      await cargarEvidencias();
      if (alSubirEvidencia) {
        alSubirEvidencia();
      }
    } catch (err) {
      setErrorSubida(err.message || 'No fue posible subir la evidencia fotográfica.');
    } finally {
      setSubiendo(false);
    }
  };

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
          {ordenFinalizada ? (
            <div className="mant-evidencias-solo-lectura" role="note">
              <Lock size={15} />
              <span>Orden finalizada — historial técnico de solo consulta.</span>
            </div>
          ) : (
            <div className="mant-evidencias-requisitos">
              {esCorrectivo ? (
                <>
                  <span className={`mant-req-chip ${tieneAntes ? 'mant-req-chip--ok' : 'mant-req-chip--pendiente'}`}>
                    {tieneAntes ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    Foto Antes: {tieneAntes ? 'Lista' : 'Pendiente'}
                  </span>
                  <span className={`mant-req-chip ${tieneDespues ? 'mant-req-chip--ok' : 'mant-req-chip--pendiente'}`}>
                    {tieneDespues ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    Foto Después: {tieneDespues ? 'Lista' : 'Pendiente'}
                  </span>
                </>
              ) : (
                <span className={`mant-req-chip ${evidencias.length > 0 ? 'mant-req-chip--ok' : 'mant-req-chip--pendiente'}`}>
                  {evidencias.length > 0 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  Evidencia para cierre: {evidencias.length > 0 ? 'Cumplida' : 'Se requiere al menos 1 foto'}
                </span>
              )}
            </div>
          )}

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
              <p>No se han adjuntado fotografías para esta orden de mantenimiento.</p>
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

          {!ordenFinalizada && (
            <form className="mant-evidencias-subir" onSubmit={manejarSubida}>
              <h3 className="mant-evidencia-titulo">
                <Upload size={16} />
                <span>Adjuntar nueva evidencia</span>
              </h3>

              {errorSubida && (
                <div className="mant-alerta-error" role="alert">
                  <span>{errorSubida}</span>
                </div>
              )}

              <div className="mant-grid-dos-cols">
                <div className="mant-campo">
                  <label htmlFor="ev-tipo-nuevo" className="mant-label">
                    Momento de la fotografía
                  </label>
                  <select
                    id="ev-tipo-nuevo"
                    className="mant-input"
                    value={tipoNuevo}
                    onChange={(e) => setTipoNuevo(e.target.value)}
                    disabled={subiendo}
                  >
                    <option value="Antes">Antes de la intervención</option>
                    <option value="Durante">Durante el procedimiento</option>
                    <option value="Después">Después de reparar</option>
                  </select>
                </div>

                <div className="mant-campo">
                  <label htmlFor="ev-archivo-nuevo" className="mant-label">
                    Archivo (JPG, PNG o WEBP, máx. 5 MB)
                  </label>
                  <input
                    id="ev-archivo-nuevo"
                    ref={inputArchivoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="mant-input"
                    onChange={manejarSeleccionArchivo}
                    disabled={subiendo}
                  />
                </div>
              </div>

              <div className="mant-campo">
                <label htmlFor="ev-desc-nueva" className="mant-label">
                  Descripción (opcional)
                </label>
                <input
                  id="ev-desc-nueva"
                  type="text"
                  className="mant-input"
                  placeholder="Ej. Equipo encendido y operando normalmente tras limpieza..."
                  value={descripcionNueva}
                  onChange={(e) => setDescripcionNueva(e.target.value)}
                  disabled={subiendo}
                />
              </div>

              <div className="mant-evidencias-subir-acciones">
                <button
                  type="submit"
                  className="mant-btn-primario"
                  disabled={subiendo || !archivoNuevo}
                >
                  {subiendo ? (
                    <>
                      <RefreshCw className="mant-spinner-btn" size={15} />
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      <span>Subir evidencia</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
