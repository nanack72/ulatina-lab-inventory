import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Flame,
  Clock,
  CheckCircle,
  ShieldAlert
} from 'lucide-react';

import TablaIncidencias from '../components/incidencias/TablaIncidencias';
import ModalReportarIncidencia from '../components/incidencias/ModalReportarIncidencia';

import {
  consultarIncidencias,
  actualizarEstadoIncidencia
} from '../services/incidenciasService';
import { obtenerEquipos } from '../services/equiposService';
import {
  PRIORIDADES_INCIDENCIA,
  ESTADOS_INCIDENCIA
} from '../utils/incidencias';

import '../styles/incidencias.css';

export default function Incidencias({ token, usuario }) {
  const [incidencias, setIncidencias] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Modales y estados
  const [modalAbierto, setModalAbierto] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);

  const cargarDatos = useCallback(async (signal) => {
    try {
      setCargando(true);
      setError(null);

      const params = {
        busqueda: busqueda.trim() || undefined,
        prioridad: filtroPrioridad || undefined,
        estado: filtroEstado || undefined
      };

      const [resInci, resEquipos] = await Promise.all([
        consultarIncidencias(params, token, signal),
        obtenerEquipos(token, signal).catch(() => [])
      ]);

      setIncidencias(resInci.data || []);
      if (Array.isArray(resEquipos)) {
        setEquipos(resEquipos);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error al consultar las incidencias técnicas');
      }
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroPrioridad, filtroEstado, token]);

  useEffect(() => {
    const controlador = new AbortController();
    cargarDatos(controlador.signal);

    return () => controlador.abort();
  }, [cargarDatos]);

  const manejarCambioEstado = async (idIncidencia, nuevoEstado) => {
    try {
      setActualizandoId(idIncidencia);
      await actualizarEstadoIncidencia(idIncidencia, nuevoEstado, token);
      await cargarDatos();
    } catch (err) {
      alert('No se pudo actualizar el estado: ' + err.message);
    } finally {
      setActualizandoId(null);
    }
  };

  // Métricas
  const totalCriticas = incidencias.filter(
    (i) => i.prioridad === 'Crítica' || i.prioridad === 'Critica' || i.prioridad === 'Alta'
  ).length;
  const totalAbiertas = incidencias.filter((i) => i.estado_incidencia === 'Abierta').length;
  const totalEnRevision = incidencias.filter((i) => i.estado_incidencia === 'En Revisión').length;
  const totalResueltas = incidencias.filter((i) => i.estado_incidencia === 'Resuelta').length;

  return (
    <div className="inci-contenedor">
      {/* Encabezado */}
      <header className="inci-encabezado">
        <div className="inci-encabezado-texto">
          <h1 className="inci-titulo">Gestión de Incidencias Técnicas</h1>
          <p className="inci-subtitulo">
            Registro, clasificación y resolución de desperfectos en equipos tecnológicos de laboratorio.
          </p>
        </div>

        <button
          type="button"
          className="inci-btn-nuevo"
          onClick={() => setModalAbierto(true)}
        >
          <Plus size={18} />
          <span>Reportar Incidencia</span>
        </button>
      </header>

      {error && (
        <div className="inci-alerta-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tarjetas resumen (Cuadrícula modular de 4 tarjetas) */}
      <section className="inci-kpis-grid">
        <article className="inci-kpi-card">
          <div className="inci-kpi-icono inci-kpi-icono--fuego">
            <Flame size={20} />
          </div>
          <div className="inci-kpi-info">
            <span className="inci-kpi-etiqueta">Críticas / Altas</span>
            <span className="inci-kpi-valor">{totalCriticas}</span>
            <span className="inci-kpi-detalle">Atención prioritaria</span>
          </div>
        </article>

        <article className="inci-kpi-card">
          <div className="inci-kpi-icono inci-kpi-icono--rojo">
            <AlertTriangle size={20} />
          </div>
          <div className="inci-kpi-info">
            <span className="inci-kpi-etiqueta">Abiertas</span>
            <span className="inci-kpi-valor">{totalAbiertas}</span>
            <span className="inci-kpi-detalle">Pendientes de revisión</span>
          </div>
        </article>

        <article className="inci-kpi-card">
          <div className="inci-kpi-icono inci-kpi-icono--azul">
            <Clock size={20} />
          </div>
          <div className="inci-kpi-info">
            <span className="inci-kpi-etiqueta">En Revisión</span>
            <span className="inci-kpi-valor">{totalEnRevision}</span>
            <span className="inci-kpi-detalle">Bajo inspección técnica</span>
          </div>
        </article>

        <article className="inci-kpi-card">
          <div className="inci-kpi-icono inci-kpi-icono--verde">
            <CheckCircle size={20} />
          </div>
          <div className="inci-kpi-info">
            <span className="inci-kpi-etiqueta">Resueltas</span>
            <span className="inci-kpi-valor">{totalResueltas}</span>
            <span className="inci-kpi-detalle">Operatividad restablecida</span>
          </div>
        </article>
      </section>

      {/* Barra de Filtros */}
      <section className="inci-filtros-barra">
        <div className="inci-buscador-wrap">
          <Search size={18} className="inci-icono-buscar" />
          <input
            type="text"
            className="inci-input-busqueda"
            placeholder="Buscar por placa, equipo o título de la falla..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="inci-selectores-filtros">
          <select
            className="inci-select"
            value={filtroPrioridad}
            onChange={(e) => setFiltroPrioridad(e.target.value)}
            aria-label="Filtrar por prioridad"
          >
            <option value="">Todas las prioridades</option>
            {PRIORIDADES_INCIDENCIA.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className="inci-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_INCIDENCIA.map((est) => (
              <option key={est} value={est}>
                {est}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Tabla */}
      <section className="inci-seccion-tabla">
        <TablaIncidencias
          incidencias={incidencias}
          cargando={cargando}
          alCambiarEstado={manejarCambioEstado}
          actualizandoId={actualizandoId}
        />
      </section>

      {/* Modal */}
      <ModalReportarIncidencia
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        alGuardarExitoso={() => {
          setModalAbierto(false);
          cargarDatos();
        }}
        equiposDisponibles={equipos}
        token={token}
      />
    </div>
  );
}
