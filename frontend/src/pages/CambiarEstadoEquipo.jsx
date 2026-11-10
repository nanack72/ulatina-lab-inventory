import { useEffect, useState, useRef } from 'react';

import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  ArrowRight,
  Save,
} from 'lucide-react';

import {
  obtenerEquipoPorId,
  actualizarEquipo,
} from '../services/equiposService';

import { obtenerEstados } from '../services/catalogosService';

import '../styles/registrarEquipo.css';
import '../styles/cambiarEstadoEquipo.css';

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function texto(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }

  if (typeof valor === 'object') {
    return String(
      valor.nombre ??
      valor.nombre_estado ??
      valor.descripcion ??
      ''
    ).trim();
  }

  return String(valor).trim();
}

function obtenerNombreEstado(equipo, estados) {
  const idEstado = equipo?.id_estado;

  const encontrado = estados.find(
    (estado) =>
      String(estado.id_estado) === String(idEstado)
  );

  return (
    texto(encontrado?.nombre) ||
    texto(equipo?.estado) ||
    texto(equipo?.nombre_estado) ||
    'Estado no disponible'
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function CambiarEstadoEquipo({
  idEquipo,
  token,
  onCancelar,
  onActualizado,
}) {
  const [equipo, setEquipo] = useState(null);
  const [estados, setEstados] = useState([]);

  const [nuevoEstado, setNuevoEstado] = useState('');

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const [confirmando, setConfirmando] = useState(false);

  const enviandoRef = useRef(false);

  // ========================================
  // CARGAR EQUIPO Y ESTADOS DESDE NEON
  // ========================================

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarDatos() {
      setCargando(true);
      setError('');
      setExito('');
      setEquipo(null);

      try {
        const [datosEquipo, datosEstados] =
          await Promise.all([
            obtenerEquipoPorId(
              idEquipo,
              token,
              controlador.signal
            ),
            obtenerEstados(
              token,
              controlador.signal
            ),
          ]);

        if (controlador.signal.aborted) return;

        setEquipo(datosEquipo);
        setEstados(datosEstados);
        setNuevoEstado('');
      } catch (err) {
        if (controlador.signal.aborted) return;

        setError(
          err.message ||
          'No fue posible cargar la información del equipo.'
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargarDatos();

    return () => controlador.abort();
  }, [idEquipo, token]);

  // ========================================
  // ESTADOS DEL FORMULARIO
  // ========================================

  const idEstadoActual = equipo?.id_estado;

  const nombreEstadoActual = obtenerNombreEstado(
    equipo,
    estados
  );

  const estadoDestino = estados.find(
    (estado) =>
      String(estado.id_estado) ===
      String(nuevoEstado)
  );

  const hayCambio =
    equipo !== null &&
    nuevoEstado !== '' &&
    estadoDestino !== undefined &&
    Number(nuevoEstado) !== Number(idEstadoActual);

  // ========================================
  // VALIDAR EL CAMBIO
  // ========================================

  function validarCambio() {
    if (
      !Number.isSafeInteger(Number(idEstadoActual)) ||
      Number(idEstadoActual) <= 0
    ) {
      return 'No se pudo identificar el estado actual del equipo.';
    }

    if (!nuevoEstado) {
      return 'Debés seleccionar el nuevo estado.';
    }

    if (!estadoDestino) {
      return 'El estado seleccionado no es válido.';
    }

    if (!hayCambio) {
      return 'El estado nuevo debe ser diferente del actual.';
    }

    return '';
  }

  // ========================================
  // SOLICITAR CONFIRMACIÓN
  // ========================================

  function revisarCambio(evento) {
    evento.preventDefault();

    const mensaje = validarCambio();

    if (mensaje) {
      setError(mensaje);
      return;
    }

    setError('');
    setConfirmando(true);
  }

  // ========================================
  // GUARDAR CAMBIO EN NEON
  // ========================================

  async function confirmarCambio() {
    if (
      enviandoRef.current ||
      !confirmando ||
      !equipo
    ) {
      return;
    }

    const mensaje = validarCambio();

    if (mensaje) {
      setError(mensaje);
      setConfirmando(false);
      return;
    }

    enviandoRef.current = true;
    setGuardando(true);
    setError('');
    setExito('');

    try {
      // El PUT ya permite actualizaciones parciales.
      // El backend verifica los permisos y PostgreSQL
      // registra el historial de estados.
      await actualizarEquipo(
        idEquipo,
        {
          id_estado: Number(nuevoEstado),
        },
        token
      );

      setExito(
        'El estado del equipo se actualizó correctamente.'
      );

      setConfirmando(false);

      if (typeof onActualizado === 'function') {
        onActualizado();
      }
    } catch (err) {
      setError(
        err.message ||
        'No fue posible cambiar el estado del equipo.'
      );

      setConfirmando(false);
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  // ========================================
  // PANTALLA
  // ========================================

  return (
    <div className="registro-pagina cambio-estado-pagina">

      {/* VOLVER AL INVENTARIO */}
      <button
        type="button"
        className="registro-volver"
        onClick={onCancelar}
        disabled={guardando}
      >
        <ArrowLeft size={17} />
        Volver al inventario
      </button>

      {/* ENCABEZADO */}
      <div className="registro-encabezado">
        <h1>Cambiar estado del equipo</h1>

        <p>
          Actualice el estado del equipo tecnológico
          conservando el historial de cambios.
        </p>
      </div>

      {/* MENSAJE DE ERROR */}
      {error && (
        <div
          className="registro-alerta registro-alerta-error"
          role="alert"
        >
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {/* MENSAJE DE ÉXITO */}
      {exito && (
        <div
          className="registro-alerta registro-alerta-exito"
          role="status"
        >
          <CheckCircle2 size={19} />
          <span>{exito}</span>
        </div>
      )}

      {/* CARGANDO */}
      {cargando && (
        <div
          className="registro-cargando"
          role="status"
        >
          Cargando equipo y estados disponibles...
        </div>
      )}

      {/* FORMULARIO */}
      {!cargando && equipo && (
        <form onSubmit={revisarCambio}>

          {/* INFORMACIÓN DEL EQUIPO */}
          <section className="registro-tarjeta">
            <div className="registro-tarjeta-titulo">
              <span className="registro-tarjeta-icono">
                <ClipboardCheck size={18} />
              </span>

              <h2>Información del equipo</h2>
            </div>

            <div className="registro-tarjeta-contenido">
              <div className="cambio-estado-equipo">
                <div>
                  <span>Equipo</span>
                  <strong>
                    {texto(equipo.nombre) ||
                      'Equipo sin nombre'}
                  </strong>
                </div>

                <div>
                  <span>Placa institucional</span>
                  <strong>
                    {texto(equipo.placa_institucional) ||
                      'No registrada'}
                  </strong>
                </div>

                <div>
                  <span>Número de serie</span>
                  <strong>
                    {texto(equipo.numero_serie) ||
                      'No registrado'}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* SELECCIÓN DEL ESTADO */}
          <section className="registro-tarjeta cambio-estado-tarjeta">
            <div className="registro-tarjeta-titulo">
              <span className="registro-tarjeta-icono">
                <RefreshCw size={18} />
              </span>

              <h2>Actualización del estado</h2>
            </div>

            <div className="registro-tarjeta-contenido">
              <div className="cambio-estado-comparacion">

                {/* ESTADO ACTUAL */}
                <div className="cambio-estado-actual">
                  <span className="cambio-estado-etiqueta">
                    Estado actual
                  </span>

                  <strong>
                    {nombreEstadoActual}
                  </strong>
                </div>

                <div className="cambio-estado-flecha">
                  <ArrowRight size={22} />
                </div>

                {/* ESTADO NUEVO */}
                <div className="cambio-estado-nuevo">
                  <label
                    className="registro-campo"
                    htmlFor="nuevo-estado-equipo"
                  >
                    <span className="registro-etiqueta">
                      Nuevo estado
                      <span className="registro-requerido">
                        {' '}*
                      </span>
                    </span>
                  </label>

                  <select
                    id="nuevo-estado-equipo"
                    value={nuevoEstado}
                    onChange={(evento) => {
                      setNuevoEstado(evento.target.value);
                      setError('');
                      setConfirmando(false);
                    }}
                    disabled={guardando}
                    required
                  >
                    <option value="">
                      Seleccionar estado
                    </option>

                    {estados
                      .filter(
                        (estado) =>
                          String(estado.id_estado) !==
                          String(idEstadoActual)
                      )
                      .map((estado) => (
                        <option
                          key={estado.id_estado}
                          value={estado.id_estado}
                        >
                          {estado.nombre}
                        </option>
                      ))}
                  </select>

                  {estadoDestino?.descripcion && (
                    <p className="cambio-estado-descripcion">
                      {estadoDestino.descripcion}
                    </p>
                  )}
                </div>
              </div>

              {/* AVISO */}
              <div className="cambio-estado-aviso">
                <AlertCircle size={17} />

                <p>
                  Al confirmar el cambio, el sistema
                  conservará el estado anterior, el nuevo,
                  la fecha y el usuario responsable en el
                  historial del equipo.
                </p>
              </div>
            </div>
          </section>

          {/* BOTONES */}
          <div className="registro-acciones">
            <span>
              Seleccione un estado diferente al actual.
            </span>

            <div className="registro-botones">
              <button
                type="button"
                className="registro-cancelar"
                onClick={onCancelar}
                disabled={guardando}
              >
                Cancelar
              </button>
              
            <button
                type="submit"
                className="registro-guardar"
                disabled={cargando || guardando || !hayCambio}
            >
            <Save size={17} />
            Revisar cambio
            </button>

            </div>
          </div>
        </form>
      )}

      {/* CONFIRMACIÓN EN LA MISMA PÁGINA */}
      {confirmando && equipo && (
        <section
          className="cambio-estado-confirmacion"
          aria-labelledby="confirmacion-estado-titulo"
        >
          <div className="cambio-estado-confirmacion-titulo">
            <AlertCircle size={20} />

            <h2 id="confirmacion-estado-titulo">
              ¿Confirmar cambio de estado?
            </h2>
          </div>

          <p>
            Está a punto de cambiar el estado de{' '}
            <strong>{texto(equipo.nombre)}</strong>.
            Esta operación quedará registrada en el
            historial del equipo.
          </p>

          <div className="cambio-estado-resumen">
            <span>{nombreEstadoActual}</span>
            <ArrowRight size={18} />
            <strong>
              {texto(estadoDestino?.nombre)}
            </strong>
          </div>

          <div className="registro-botones cambio-estado-confirmacion-botones">
            <button
              type="button"
              className="registro-cancelar"
              disabled={guardando}
              onClick={() => setConfirmando(false)}
            >
              Volver
            </button>

            <button
              type="button"
              className="registro-guardar"
              disabled={guardando}
              onClick={confirmarCambio}
            >
              <CheckCircle2 size={17} />

              {guardando
                ? 'Guardando...'
                : 'Confirmar cambio'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
