import { useEffect, useMemo, useState } from 'react';

import {
  History,
  MapPin,
  ArrowRight,
  ArrowLeftRight,
  RefreshCw,
  AlertCircle,
  PackagePlus,
} from 'lucide-react';

import {
  obtenerHistorialUbicacion,
} from '../../services/equiposService';

import '../../styles/historialUbicaciones.css';

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function texto(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }

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

function nombreSede(valor) {
  const nombre = texto(valor);

  if (!nombre) return '';

  return /^sede\s/i.test(nombre)
    ? nombre
    : `Sede ${nombre}`;
}

function obtenerTipoMovimiento(movimiento) {
  if (
    [
      'asignacion_inicial',
      'traslado_laboratorio',
      'cambio_ubicacion',
    ].includes(movimiento.tipo_movimiento)
  ) {
    return movimiento.tipo_movimiento;
  }

  // Compatibilidad con respuestas antiguas de la API.
  if (
    movimiento.id_laboratorio_origen == null &&
    movimiento.ubicacion_detalle_anterior == null
  ) {
    return 'asignacion_inicial';
  }

  if (
    String(movimiento.id_laboratorio_origen) !==
    String(movimiento.id_laboratorio_destino)
  ) {
    return 'traslado_laboratorio';
  }

  return 'cambio_ubicacion';
}

function obtenerTitulo(tipo) {
  switch (tipo) {
    case 'asignacion_inicial':
      return 'Asignación inicial';

    case 'traslado_laboratorio':
      return 'Traslado entre laboratorios';

    default:
      return 'Cambio de ubicación interna';
  }
}

function IconoMovimiento({ tipo, size = 16 }) {
  if (tipo === 'asignacion_inicial') {
    return <PackagePlus size={size} />;
  }

  if (tipo === 'traslado_laboratorio') {
    return <ArrowLeftRight size={size} />;
  }

  return <MapPin size={size} />;
}

function obtenerLaboratorio(
  movimiento,
  origen,
  nombresLaboratorios
) {
  const id = origen
    ? movimiento.id_laboratorio_origen
    : movimiento.id_laboratorio_destino;

  const nombre = texto(
    origen
      ? movimiento.nombre_laboratorio_origen
      : movimiento.nombre_laboratorio_destino
  );

  if (nombre) return nombre;

  if (id == null) {
    return 'Sin laboratorio anterior';
  }

  return (
    nombresLaboratorios?.[id] ||
    `Laboratorio ${id}`
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function HistorialUbicaciones({
  idEquipo,
  token,
  nombresLaboratorios = {},
}) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  // ========================================
  // CONSULTAR HISTORIAL
  // ========================================

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarHistorial() {
      setCargando(true);
      setError('');

      try {
        const datos = await obtenerHistorialUbicacion(
          idEquipo,
          token,
          controlador.signal
        );

        if (controlador.signal.aborted) return;

        setMovimientos(datos);
      } catch (err) {
        if (controlador.signal.aborted) return;

        setError(
          err.message ||
          'No se pudo consultar el historial de ubicaciones.'
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

  // ========================================
  // ORDENAR POR FECHA
  // ========================================

  const movimientosOrdenados = useMemo(() => {
    return [...movimientos].sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime();
      const fechaB = new Date(b.fecha).getTime();

      const diferencia =
        (Number.isFinite(fechaB) ? fechaB : 0) -
        (Number.isFinite(fechaA) ? fechaA : 0);

      if (diferencia !== 0) {
        return diferencia;
      }

      return (
        Number(b.id_historial_ubicacion || 0) -
        Number(a.id_historial_ubicacion || 0)
      );
    });
  }, [movimientos]);

  function actualizarHistorial() {
    setRecarga((anterior) => anterior + 1);
  }

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <section className="hist-ubicacion">

      {/* ENCABEZADO */}
      <div className="hist-encabezado">
        <div className="hist-titulo">
          <div className="hist-icono-principal">
            <History size={19} />
          </div>

          <div>
            <h2>Historial de ubicaciones</h2>
            <p>
              Consulte los movimientos registrados
              de este equipo tecnológico.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="hist-actualizar"
          onClick={actualizarHistorial}
          disabled={cargando}
          title="Actualizar historial"
          aria-label="Actualizar historial de ubicaciones"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {/* CARGA */}
      {cargando && (
        <div className="hist-mensaje" role="status">
          Cargando historial de ubicaciones...
        </div>
      )}

      {/* ERROR */}
      {!cargando && error && (
        <div className="hist-error" role="alert">
          <AlertCircle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={actualizarHistorial}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* SIN MOVIMIENTOS */}
      {!cargando &&
        !error &&
        movimientosOrdenados.length === 0 && (
          <div className="hist-vacio">
            <MapPin size={25} />

            <strong>
              Sin movimientos registrados
            </strong>

            <p>
              Este equipo todavía no tiene registros
              de cambios de ubicación.
            </p>
          </div>
        )}

      {/* LÍNEA DE TIEMPO */}
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
                const tipo = obtenerTipoMovimiento(
                  movimiento
                );

                const esInicial =
                  tipo === 'asignacion_inicial';

                const laboratorioOrigen =
                  obtenerLaboratorio(
                    movimiento,
                    true,
                    nombresLaboratorios
                  );

                const laboratorioDestino =
                  obtenerLaboratorio(
                    movimiento,
                    false,
                    nombresLaboratorios
                  );

                const ubicacionAnterior = texto(
                  movimiento.ubicacion_detalle_anterior
                );

                const ubicacionNueva = texto(
                  movimiento.ubicacion_detalle_nueva
                );

                const sedeOrigen = nombreSede(
                  movimiento.nombre_sede_origen
                );

                const sedeDestino = nombreSede(
                  movimiento.nombre_sede_destino
                );

                const responsable =
                  texto(movimiento.nombre_usuario) ||
                  (
                    movimiento.id_usuario != null
                      ? `Usuario ${movimiento.id_usuario}`
                      : 'No disponible'
                  );

                return (
                  <article
                    key={movimiento.id_historial_ubicacion}
                    className={`hist-movimiento hist-movimiento--${tipo}`}
                  >
                    {/* ÍCONO DE LA LÍNEA DE TIEMPO */}
                    <div className="hist-marcador">
                      <IconoMovimiento tipo={tipo} />
                    </div>

                    {/* CONTENIDO */}
                    <div className="hist-contenido">
                      <div className="hist-movimiento-cabecera">
                        <div className="hist-tipo-encabezado">
                          <h3>
                            {obtenerTitulo(tipo)}
                          </h3>

                          <span
                            className={`hist-tipo-etiqueta hist-tipo-etiqueta--${tipo}`}
                          >
                            {esInicial
                              ? 'Inicial'
                              : tipo === 'traslado_laboratorio'
                                ? 'Traslado'
                                : 'Interno'}
                          </span>
                        </div>

                        <time
                          dateTime={movimiento.fecha || undefined}
                        >
                          {formatearFecha(movimiento.fecha)}
                        </time>
                      </div>

                      <div className="hist-cambio">
                        {/* ORIGEN */}
                        <div className="hist-ubicacion-origen">
                          <span>
                            {esInicial
                              ? 'Ubicación anterior'
                              : 'Origen'}
                          </span>

                          <strong>
                            {esInicial
                              ? 'Sin ubicación anterior'
                              : laboratorioOrigen}
                          </strong>

                          {!esInicial && sedeOrigen && (
                            <small>{sedeOrigen}</small>
                          )}

                          <small>
                            {ubicacionAnterior || 'Sin detalle'}
                          </small>
                        </div>

                        {/* FLECHA */}
                        <div className="hist-flecha">
                          <ArrowRight size={19} />
                        </div>

                        {/* DESTINO */}
                        <div className="hist-ubicacion-destino">
                          <span>Destino</span>

                          <strong>
                            {laboratorioDestino}
                          </strong>

                          {sedeDestino && (
                            <small>{sedeDestino}</small>
                          )}

                          <small>
                            {ubicacionNueva || 'Sin detalle'}
                          </small>
                        </div>
                      </div>

                      {/* RESPONSABLE Y MOVIMIENTO */}
                      <div className="hist-movimiento-pie">
                        <span>
                          Responsable:{' '}
                          <strong>{responsable}</strong>
                        </span>

                        <span>
                          Movimiento #
                          {movimiento.id_historial_ubicacion}
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
