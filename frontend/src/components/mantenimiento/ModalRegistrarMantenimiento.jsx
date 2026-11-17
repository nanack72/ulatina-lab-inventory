import { useState, useRef } from 'react';
import { X, Upload, Camera, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { registrarMantenimiento } from '../../services/mantenimientosService';
import { subirEvidenciaFotografica } from '../../services/evidenciasService';
import { TIPOS_MANTENIMIENTO } from '../../utils/mantenimiento';

export default function ModalRegistrarMantenimiento({
  abierto,
  alCerrar,
  alGuardarExitoso,
  equiposDisponibles = [],
  estadosDisponibles = [],
  token
}) {
  const [idEquipo, setIdEquipo] = useState('');
  const [tipoMantenimiento, setTipoMantenimiento] = useState('Preventivo');
  const [motivoFalla, setMotivoFalla] = useState('');
  const [descripcionTrabajo, setDescripcionTrabajo] = useState('');
  const [horasInvertidas, setHorasInvertidas] = useState('1.0');
  const [actualizarEstado, setActualizarEstado] = useState(false);
  const [idNuevoEstado, setIdNuevoEstado] = useState('');
  const [motivoCambioEstado, setMotivoCambioEstado] = useState('');

  // Evidencia fotográfica inicial
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [previsualizacion, setPrevisualizacion] = useState(null);
  const [tipoEvidencia, setTipoEvidencia] = useState('Antes');
  const [descripcionEvidencia, setDescripcionEvidencia] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState(null);
  const archivoInputRef = useRef(null);

  if (!abierto) return null;

  const manejarSeleccionArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Solo se admiten imágenes JPG, PNG o WEBP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen supera el límite máximo de 5 MB');
      return;
    }

    setArchivoFoto(file);
    setPrevisualizacion(URL.createObjectURL(file));
  };

  const limpiarFoto = () => {
    if (previsualizacion) {
      URL.revokeObjectURL(previsualizacion);
    }
    setArchivoFoto(null);
    setPrevisualizacion(null);
    if (archivoInputRef.current) {
      archivoInputRef.current.value = '';
    }
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setErrorFormulario(null);

    if (!idEquipo) {
      setErrorFormulario('Debe seleccionar el equipo a intervenir.');
      return;
    }

    if (!descripcionTrabajo.trim()) {
      setErrorFormulario('Debe ingresar la descripción del trabajo técnico realizado.');
      return;
    }

    try {
      setGuardando(true);

      const payload = {
        id_equipo: Number(idEquipo),
        tipo_mantenimiento: tipoMantenimiento,
        descripcion_trabajo: descripcionTrabajo.trim(),
        horas_invertidas: Number(horasInvertidas) || 1,
        estado_mantenimiento: 'En Proceso'
      };

      if (tipoMantenimiento === 'Correctivo' && motivoFalla.trim()) {
        payload.motivo_falla = motivoFalla.trim();
      }

      if (actualizarEstado && idNuevoEstado) {
        payload.id_nuevo_estado = Number(idNuevoEstado);
        payload.motivo_cambio_estado =
          motivoCambioEstado.trim() || 'Cambio por intervención técnica';
      }

      const resultado = await registrarMantenimiento(payload, token);
      const idBitacoraCreada = resultado?.id_bitacora;

      // Si el técnico adjuntó foto, se sube como evidencia
      if (archivoFoto && idBitacoraCreada) {
        try {
          await subirEvidenciaFotografica(
            {
              foto: archivoFoto,
              id_bitacora: idBitacoraCreada,
              tipo_evidencia: tipoEvidencia,
              descripcion: descripcionEvidencia.trim() || `Evidencia inicial (${tipoEvidencia})`
            },
            token
          );
        } catch (errorFoto) {
          console.warn('Mantenimiento guardado, pero falló la subida de evidencia:', errorFoto.message);
        }
      }

      limpiarFoto();
      alGuardarExitoso();
    } catch (err) {
      if (err.status === 403) {
        setErrorFormulario(
          'Acceso denegado (403): Tu perfil técnico no tiene asignado el laboratorio de este equipo. Selecciona un activo autorizado o consulta a coordinación.'
        );
      } else if (err.status === 409) {
        setErrorFormulario(
          'Conflicto de integridad (409): El equipo seleccionado ya tiene una intervención activa o su estado actual no admite cambio concurrente.'
        );
      } else {
        setErrorFormulario(
          err.message || 'Error interno al guardar la orden de mantenimiento.'
        );
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mant-modal-backdrop" onClick={alCerrar}>
      <div
        className="mant-modal-contenido"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="mant-modal-titulo"
      >
        <header className="mant-modal-cabecera">
          <div>
            <h2 id="mant-modal-titulo" className="mant-modal-titulo">
              Registrar Intervención Técnica
            </h2>
            <p className="mant-modal-subtitulo">
              Bitácora de mantenimiento y trazabilidad física del hardware.
            </p>
          </div>
          <button
            type="button"
            className="mant-modal-cerrar"
            onClick={alCerrar}
            disabled={guardando}
            aria-label="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </header>

        {errorFormulario && (
          <div className="mant-alerta-error" role="alert">
            <AlertTriangle size={18} />
            <span>{errorFormulario}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="mant-formulario">
          {/* Selector de Equipo */}
          <div className="mant-campo">
            <label htmlFor="mant-select-equipo" className="mant-label">
              Equipo a Intervenir <span className="mant-requerido">*</span>
            </label>
            <select
              id="mant-select-equipo"
              className="mant-input"
              value={idEquipo}
              onChange={(e) => setIdEquipo(e.target.value)}
              required
            >
              <option value="">-- Seleccione un activo tecnológico --</option>
              {equiposDisponibles.map((eq) => (
                <option key={eq.id_equipo} value={eq.id_equipo}>
                  {eq.placa_institucional || eq.numero_serie || `ID #${eq.id_equipo}`} — {eq.nombre} ({eq.laboratorio || 'Lab'})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Mantenimiento y Horas Invertidas en fila de dos columnas */}
          <div className="mant-grid-dos-cols">
            <div className="mant-campo">
              <label htmlFor="mant-select-tipo" className="mant-label">
                Tipo de Mantenimiento <span className="mant-requerido">*</span>
              </label>
              <select
                id="mant-select-tipo"
                className="mant-input"
                value={tipoMantenimiento}
                onChange={(e) => setTipoMantenimiento(e.target.value)}
              >
                {TIPOS_MANTENIMIENTO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="mant-campo">
              <label htmlFor="mant-horas" className="mant-label">
                Horas Invertidas <span className="mant-requerido">*</span>
              </label>
              <input
                id="mant-horas"
                type="number"
                step="0.5"
                min="0.5"
                max="100"
                className="mant-input"
                value={horasInvertidas}
                onChange={(e) => setHorasInvertidas(e.target.value)}
                required
              />
            </div>
          </div>

          {tipoMantenimiento === 'Correctivo' && (
            <div className="mant-campo">
              <label htmlFor="mant-motivo-falla" className="mant-label">
                Motivo de la Falla Reportada
              </label>
              <input
                id="mant-motivo-falla"
                type="text"
                className="mant-input"
                placeholder="Ej. Pantalla azul, sobrecalentamiento, ventilador ruidoso..."
                value={motivoFalla}
                onChange={(e) => setMotivoFalla(e.target.value)}
              />
            </div>
          )}

          {/* Descripción del Trabajo */}
          <div className="mant-campo">
            <label htmlFor="mant-descripcion" className="mant-label">
              Descripción del Trabajo Realizado <span className="mant-requerido">*</span>
            </label>
            <textarea
              id="mant-descripcion"
              className="mant-textarea"
              rows={3}
              placeholder="Detalle los procedimientos ejecutados, repuestos o pruebas..."
              value={descripcionTrabajo}
              onChange={(e) => setDescripcionTrabajo(e.target.value)}
              required
            />
          </div>

          {/* Subida de Evidencia con Multer */}
          <div className="mant-seccion-evidencia">
            <h3 className="mant-evidencia-titulo">
              <Camera size={18} />
              <span>Evidencia Fotográfica (Multer)</span>
            </h3>

            <div className="mant-evidencia-dropzone">
              {previsualizacion ? (
                <div className="mant-previsualizacion-box">
                  <img
                    src={previsualizacion}
                    alt="Previsualización de evidencia"
                    className="mant-img-preview"
                  />
                  <div className="mant-preview-acciones">
                    <span className="mant-preview-nombre">{archivoFoto?.name}</span>
                    <button
                      type="button"
                      className="mant-btn-remover-foto"
                      onClick={limpiarFoto}
                    >
                      Remover foto
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="mant-subida-placeholder"
                  onClick={() => archivoInputRef.current?.click()}
                >
                  <Upload size={28} className="mant-icono-upload" />
                  <p>Haga clic para seleccionar o arrastrar fotografía de evidencia</p>
                  <span>Formatos admitidos: JPG, PNG, WEBP (Máx. 5 MB)</span>
                </div>
              )}

              <input
                ref={archivoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mant-input-file-oculto"
                onChange={manejarSeleccionArchivo}
              />
            </div>

            {archivoFoto && (
              <div className="mant-grid-dos-cols">
                <div className="mant-campo">
                  <label className="mant-label">Momento de Evidencia</label>
                  <select
                    className="mant-input"
                    value={tipoEvidencia}
                    onChange={(e) => setTipoEvidencia(e.target.value)}
                  >
                    <option value="Antes">Antes de la intervención</option>
                    <option value="Durante">Durante el procedimiento</option>
                    <option value="Después">Después de reparar</option>
                  </select>
                </div>
                <div className="mant-campo">
                  <label className="mant-label">Nota de Evidencia</label>
                  <input
                    type="text"
                    className="mant-input"
                    placeholder="Ej. Estado del ventilador con polvo..."
                    value={descripcionEvidencia}
                    onChange={(e) => setDescripcionEvidencia(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <footer className="mant-modal-pie">
            <button
              type="button"
              className="mant-btn-secundario"
              onClick={alCerrar}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="mant-btn-primario"
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <RefreshCw className="mant-spinner-btn" size={16} />
                  <span>Guardando...</span>
                </>
              ) : (
                'Registrar Mantenimiento'
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
