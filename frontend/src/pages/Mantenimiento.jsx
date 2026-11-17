import { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import TablaMantenimientos from '../components/mantenimiento/TablaMantenimientos';
import ModalRegistrarMantenimiento from '../components/mantenimiento/ModalRegistrarMantenimiento';
import ModalVerEvidencias from '../components/mantenimiento/ModalVerEvidencias';

import { consultarMantenimientos } from '../services/mantenimientosService';
import { obtenerEquipos } from '../services/equiposService';
import { TIPOS_MANTENIMIENTO, ESTADOS_MANTENIMIENTO } from '../utils/mantenimiento';

import '../styles/mantenimiento.css';

export default function Mantenimiento({ token, usuario }) {
  const [mantenimientos, setMantenimientos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros y paginación
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Modales
  const [modalRegistroAbierto, setModalRegistroAbierto] = useState(false);
  const [mantenimientoSeleccionado, setMantenimientoSeleccionado] = useState(null);

  const cargarDatos = useCallback(async (signal) => {
    try {
      setCargando(true);
      setError(null);

      const params = {
        pagina,
        limite: 10,
        busqueda: busqueda.trim() || undefined,
        tipo_mantenimiento: tipoFiltro || undefined,
        estado_mantenimiento: estadoFiltro || undefined
      };

      const [resMant, resEquipos] = await Promise.all([
        consultarMantenimientos(params, token, signal),
        obtenerEquipos(token, signal).catch(() => [])
      ]);

      setMantenimientos(resMant.data || []);
      setTotalPaginas(resMant.totalPaginas || 1);
      setTotalRegistros(resMant.total || 0);

      if (Array.isArray(resEquipos)) {
        setEquipos(resEquipos);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error al cargar el módulo de mantenimientos');
      }
    } finally {
      setCargando(false);
    }
  }, [pagina, busqueda, tipoFiltro, estadoFiltro, token]);

  useEffect(() => {
    const controlador = new AbortController();
    cargarDatos(controlador.signal);

    return () => controlador.abort();
  }, [cargarDatos]);

  const alGuardarExitoso = () => {
    setModalRegistroAbierto(false);
    cargarDatos();
  };

  return (
    <div className="mant-contenedor">
      {/* Encabezado */}
      <header className="mant-encabezado">
        <div className="mant-encabezado-texto">
          <h1 className="mant-titulo">Bitácora de Mantenimientos</h1>
          <p className="mant-subtitulo">
            Registro cronológico, trazabilidad de fallas técnicas y gestión de evidencias fotográficas.
          </p>
        </div>

        <button
          type="button"
          className="mant-btn-nuevo"
          onClick={() => setModalRegistroAbierto(true)}
        >
          <Plus size={18} />
          <span>Registrar Intervención</span>
        </button>
      </header>

      {error && (
        <div className="mant-alerta-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <section className="mant-filtros-barra">
        <div className="mant-buscador-wrap">
          <Search size={18} className="mant-icono-buscar" />
          <input
            type="text"
            className="mant-input-busqueda"
            placeholder="Buscar por placa, serie o nombre del equipo..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </div>

        <div className="mant-selectores-filtros">
          <select
            className="mant-select"
            value={tipoFiltro}
            onChange={(e) => {
              setTipoFiltro(e.target.value);
              setPagina(1);
            }}
            aria-label="Filtrar por tipo de mantenimiento"
          >
            <option value="">Todos los tipos</option>
            {TIPOS_MANTENIMIENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            className="mant-select"
            value={estadoFiltro}
            onChange={(e) => {
              setEstadoFiltro(e.target.value);
              setPagina(1);
            }}
            aria-label="Filtrar por estado del mantenimiento"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_MANTENIMIENTO.map((est) => (
              <option key={est} value={est}>
                {est}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Tabla de Mantenimientos */}
      <section className="mant-seccion-tabla">
        <TablaMantenimientos
          mantenimientos={mantenimientos}
          cargando={cargando}
          alSeleccionarEvidencias={(item) => setMantenimientoSeleccionado(item)}
        />

        {/* Paginación */}
        {totalPaginas > 1 && (
          <footer className="mant-paginacion">
            <span className="mant-paginacion-resumen">
              Mostrando página {pagina} de {totalPaginas} ({totalRegistros} intervenciones)
            </span>
            <div className="mant-paginacion-controles">
              <button
                type="button"
                className="mant-btn-pag"
                disabled={pagina <= 1 || cargando}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                className="mant-btn-pag"
                disabled={pagina >= totalPaginas || cargando}
                onClick={() => setPagina((p) => p + 1)}
                aria-label="Página siguiente"
              >
                <span>Siguiente</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        )}
      </section>

      {/* Modales */}
      <ModalRegistrarMantenimiento
        abierto={modalRegistroAbierto}
        alCerrar={() => setModalRegistroAbierto(false)}
        alGuardarExitoso={alGuardarExitoso}
        equiposDisponibles={equipos}
        token={token}
      />

      <ModalVerEvidencias
        abierto={Boolean(mantenimientoSeleccionado)}
        mantenimiento={mantenimientoSeleccionado}
        alCerrar={() => setMantenimientoSeleccionado(null)}
        token={token}
      />
    </div>
  );
}
