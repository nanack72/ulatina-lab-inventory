import { useEffect, useMemo, useState } from 'react';

import {
  History,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  PackagePlus,
  RefreshCcw,
} from 'lucide-react';

import { obtenerHistorialEstados } from '../../services/equiposService';

import '../../styles/historialUbicaciones.css';
import '../../styles/historialEstados.css';

function texto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function formatearFecha(fecha) {
  if (!fecha) return 'Fecha no disponible';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Costa_Rica',
  }).format(valor);
}

function nombreEstado(nombre, id) {
  if (texto(nombre)) return texto(nombre);

  if (id === null || id === undefined) {
    return 'Sin estado anterior';
  }

  return `Estado ${id}`;
}

export default function HistorialEstados({
  idEquipo,
  token,
}) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarHistorial() {
      setCargando(true);
      setError('');

      try {
        const datos = await obtenerHistorialEstados(
          idEquipo,
          token,
          controlador.signal
        );

        if (controlador.signal.aborted) return;

        setMovimientos(datos);
      } catch (err) {
        if (controlador.signal.aborted) return;

        setMovimientos([]);
        setError(
          err.message ||
          'No se pudo consultar el historial de estados.'
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargarHistorial();

    return () => controlador.abort();
  }, [idEquipo, token, recarga]);

  const movimientosOrdenados = useMemo(() => {
    return [...movimientos].sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime() || 0;
      const fechaB = new Date(b.fecha).getTime() || 0;

      if (fechaA !== fechaB) return fechaB - fechaA;

      return (
        Number(b.id_historial_estado) -
        Number(a.id_historial_estado)
      );
    });
  }, [movimientos]);

  return (
    <section className="hist-ubicacion hist-estados">

      <div className="hist-encabezado">
        <div className="hist-titulo">
          <div className="hist-icono-principal">
            <History size={19} />
          </div>

          <div>
            <h2>Historial de estados</h2>
            <p>
              Consulte los cambios de estado registrados
              para este equipo tecnológico.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="hist-actualizar"
          aria-label="Actualizar historial de estados"
          title="Actualizar historial"
          disabled={cargando}
          onClick={() =>
            setRecarga((valor) => valor + 1)
          }
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {cargando && (
        <div className="hist-mensaje" role="status">
          Cargando historial de estados...
        </div>
      )}

      {!cargando && error && (
        <div className="hist-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setRecarga((valor) => valor + 1)
            }
          >
            Reintentar
          </button>
        </div>
      )}

      {!cargando &&
        !error &&
        movimientosOrdenados.length === 0 && (
          <div className="hist-vacio">
            <History size={25} />
            <strong>Sin cambios de estado registrados</strong>
            <p>
              Este equipo todavía no tiene historial
              de estados.
            </p>
          </div>
        )}

      {!cargando &&
        !error &&
        movimientosOrdenados.length > 0 && (
          <>
            <div className="hist-contador">
              {movimientosOrdenados.length}{' '}
              {movimientosOrdenados.length === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </div>

            <div className="hist-linea-tiempo">
              {movimientosOrdenados.map((movimiento) => {
                const inicial =
                  movimiento.tipo_movimiento ===
                    'asignacion_inicial' ||
                  movimiento.id_estado_anterior == null;

                const anterior = nombreEstado(
                  movimiento.nombre_estado_anterior,
                  movimiento.id_estado_anterior
                );

                const nuevo = nombreEstado(
                  movimiento.nombre_estado_nuevo,
                  movimiento.id_estado_nuevo
                );

                const responsable =
                  texto(movimiento.nombre_usuario) ||
                  (movimiento.id_usuario != null
                    ? `Usuario ${movimiento.id_usuario}`
                    : 'No disponible');

                return (
                  <article
                    key={movimiento.id_historial_estado}
                    className="hist-movimiento hist-estado-movimiento"
                  >
                    <div className="hist-marcador">
                      {inicial ? (
                        <PackagePlus size={16} />
                      ) : (
                        <RefreshCcw size={16} />
                      )}
                    </div>

                    <div className="hist-contenido">
                      <div className="hist-movimiento-cabecera">
                        <div className="hist-tipo-encabezado">
                          <h3>
                            {inicial
                              ? 'Asignación inicial de estado'
                              : 'Cambio de estado'}
                          </h3>

                          <span className="hist-estado-etiqueta">
                            {inicial ? 'Inicial' : 'Cambio'}
                          </span>
                        </div>

                        <time dateTime={movimiento.fecha || undefined}>
                          {formatearFecha(movimiento.fecha)}
                        </time>
                      </div>

                      <div className="hist-cambio">
                        <div className="hist-ubicacion-origen">
                          <span>Estado anterior</span>
                          <strong>{anterior}</strong>
                        </div>

                        <div className="hist-flecha">
                          <ArrowRight size={19} />
                        </div>

                        <div className="hist-ubicacion-destino">
                          <span>Estado nuevo</span>
                          <strong>{nuevo}</strong>
                        </div>
                      </div>

                      <div className="hist-estado-motivo">
                        <span>Motivo</span>
                        <p>
                          {texto(movimiento.motivo) ||
                            'No registrado'}
                        </p>
                      </div>

                      <div className="hist-movimiento-pie">
                        <span>
                          Responsable:{' '}
                          <strong>{responsable}</strong>
                        </span>

                        <span>
                          Movimiento #
                          {movimiento.id_historial_estado}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
    </section>
  );
}
