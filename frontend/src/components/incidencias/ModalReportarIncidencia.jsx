import { useState } from 'react';
import { X, AlertTriangle, RefreshCw, Flame } from 'lucide-react';
import { crearIncidencia } from '../../services/incidenciasService';

export default function ModalReportarIncidencia({
  abierto,
  alCerrar,
  alGuardarExitoso,
  equiposDisponibles = [],
  token
}) {
  const [idEquipo, setIdEquipo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcionFalla, setDescripcionFalla] = useState('');
  const [prioridad, setPrioridad] = useState('Media');

  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState(null);

  if (!abierto) return null;

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setErrorFormulario(null);

    if (!idEquipo) {
      setErrorFormulario('Debe seleccionar el equipo con la falla.');
      return;
    }

    if (!titulo.trim()) {
      setErrorFormulario('Debe indicar un título breve para la incidencia.');
      return;
    }

    if (!descripcionFalla.trim()) {
      setErrorFormulario('Debe detallar los síntomas o la anomalía observada.');
      return;
    }

    try {
      setGuardando(true);

      const payload = {
        id_equipo: Number(idEquipo),
        titulo: titulo.trim(),
        descripcion_falla: descripcionFalla.trim(),
        prioridad: prioridad // Se envía en minúsculas inicialmente
      };

      await crearIncidencia(payload, token);

      // Limpieza
      setIdEquipo('');
      setTitulo('');
      setDescripcionFalla('');
      setPrioridad('Media');

      alGuardarExitoso();
    } catch (err) {
      setErrorFormulario(err.message || 'Error al registrar la incidencia');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="inci-modal-backdrop" onClick={alCerrar}>
      <div
        className="inci-modal-contenido"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="inci-modal-titulo"
      >
        <header className="inci-modal-cabecera">
          <div>
            <h2 id="inci-modal-titulo" className="inci-modal-titulo">
              Reportar Falla Técnica o Incidencia
            </h2>
            <p className="inci-modal-subtitulo">
              Notificación rápida de desperfectos en activos tecnológicos de laboratorio.
            </p>
          </div>
          <button
            type="button"
            className="inci-modal-cerrar"
            onClick={alCerrar}
            disabled={guardando}
            aria-label="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </header>

        {errorFormulario && (
          <div className="inci-alerta-error" role="alert">
            <AlertTriangle size={18} />
            <span>{errorFormulario}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="inci-formulario">
          <div className="inci-campo">
            <label htmlFor="inci-select-equipo" className="inci-label">
              Activo Afectado <span className="inci-requerido">*</span>
            </label>
            <select
              id="inci-select-equipo"
              className="inci-input"
              value={idEquipo}
              onChange={(e) => setIdEquipo(e.target.value)}
              required
            >
              <option value="">-- Seleccionar equipo de laboratorio --</option>
              {equiposDisponibles.map((eq) => (
                <option key={eq.id_equipo} value={eq.id_equipo}>
                  {eq.placa_institucional || eq.numero_serie || `ID #${eq.id_equipo}`} — {eq.nombre} ({eq.laboratorio || 'Lab'})
                </option>
              ))}
            </select>
          </div>

          <div className="inci-grid-dos-cols">
            <div className="inci-campo">
              <label htmlFor="inci-input-titulo" className="inci-label">
                Título del Problema <span className="inci-requerido">*</span>
              </label>
              <input
                id="inci-input-titulo"
                type="text"
                className="inci-input"
                placeholder="Ej. Teclado no responde, reinicios continuos..."
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
              />
            </div>

            <div className="inci-campo">
              <label htmlFor="inci-select-prio" className="inci-label">
                Nivel de Prioridad <span className="inci-requerido">*</span>
              </label>
              <select
                id="inci-select-prio"
                className="inci-input"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
              >
                <option value="Crítica">Crítica (Impide uso del laboratorio)</option>
                <option value="Alta">Alta (Falla severa de hardware)</option>
                <option value="Media">Media (Problema funcional parcial)</option>
                <option value="Baja">Baja (Detalle cosmético o menor)</option>
              </select>
            </div>
          </div>

          <div className="inci-campo">
            <label htmlFor="inci-textarea-desc" className="inci-label">
              Descripción Detallada de la Falla <span className="inci-requerido">*</span>
            </label>
            <textarea
              id="inci-textarea-desc"
              className="inci-textarea"
              rows={4}
              placeholder="Explique qué ocurre, mensajes de error en pantalla o circunstancias en que se detectó la falla..."
              value={descripcionFalla}
              onChange={(e) => setDescripcionFalla(e.target.value)}
              required
            />
          </div>

          <footer className="inci-modal-pie">
            <button
              type="button"
              className="inci-btn-secundario"
              onClick={alCerrar}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inci-btn-primario"
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <RefreshCw className="inci-spinner-btn" size={16} />
                  <span>Enviando reporte...</span>
                </>
              ) : (
                'Registrar Incidencia'
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
