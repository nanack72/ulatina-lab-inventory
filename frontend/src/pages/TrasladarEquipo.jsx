import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ArrowLeft,
  ArrowLeftRight,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Building2,
} from 'lucide-react';

import { obtenerEquipoPorId } from '../services/equiposService';

import { trasladarEquipo } from '../services/equiposService';

import {
  obtenerSedes,
  obtenerLaboratorios,
} from '../services/catalogosService';

import '../styles/registrarEquipo.css';
import '../styles/trasladarEquipo.css';

function texto(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }

  return String(valor).trim();
}

function idValido(valor) {
  const numero = Number(valor);

  return Number.isSafeInteger(numero) && numero > 0;
}

function nombreRelacion(valor) {
  if (!valor) return '';

  if (typeof valor !== 'object') {
    return texto(valor);
  }

  return texto(
    valor.nombre ??
    valor.nombre_laboratorio ??
    valor.nombre_sede
  );
}

export default function TrasladarEquipo({
  idEquipo,
  token,
  onCancelar,
  onTrasladado,
}) {
  const [equipo, setEquipo] = useState(null);

  const [sedes, setSedes] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);

  const [formulario, setFormulario] = useState({
    id_sede: '',
    id_laboratorio: '',
    ubicacion_detalle: '',
  });

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [exito, setExito] = useState('');

  const enviandoRef = useRef(false);

  // Cargar equipo y laboratorios autorizados.
  useEffect(() => {
    const controlador = new AbortController();

    async function cargarDatos() {
      setCargando(true);
      setError('');
      setExito('');

      try {
        const [
          datosEquipo,
          datosSedes,
          datosLaboratorios,
        ] = await Promise.all([
          obtenerEquipoPorId(
            idEquipo,
            token,
            controlador.signal
          ),
          obtenerSedes(token, controlador.signal),
          obtenerLaboratorios(token, controlador.signal),
        ]);

        if (controlador.signal.aborted) return;

        setEquipo(datosEquipo);
        setSedes(datosSedes);
        setLaboratorios(datosLaboratorios);

        // Identificamos la ubicación real del equipo.
        const laboratorioActual = datosEquipo.id_laboratorio;

        const laboratorioEncontrado = datosLaboratorios.find(
          (laboratorio) =>
            String(laboratorio.id_laboratorio) ===
            String(laboratorioActual)
        );

        setFormulario({
          id_sede: laboratorioEncontrado
            ? String(laboratorioEncontrado.id_sede)
            : '',
          id_laboratorio:
            laboratorioEncontrado
              ? String(laboratorioEncontrado.id_laboratorio)
              : '',
          ubicacion_detalle: texto(
            datosEquipo.ubicacion_detalle ??
            datosEquipo.ubicacionDetalle
          ),
        });
      } catch (err) {
        if (controlador.signal.aborted) return;

        setError(
          err.message ||
          'No fue posible cargar los datos del traslado.'
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

  // Solo laboratorios autorizados en la sede elegida.
  const laboratoriosFiltrados = useMemo(() => {
    if (!formulario.id_sede) return [];

    return laboratorios.filter(
      (laboratorio) =>
        String(laboratorio.id_sede) ===
        String(formulario.id_sede)
    );
  }, [laboratorios, formulario.id_sede]);

  // Mostrar únicamente sedes con laboratorios autorizados.
  const sedesDisponibles = useMemo(() => {
    return sedes.filter((sede) =>
      laboratorios.some(
        (laboratorio) =>
          String(laboratorio.id_sede) ===
          String(sede.id_sede)
      )
    );
  }, [sedes, laboratorios]);

  const laboratorioActual = laboratorios.find(
    (laboratorio) =>
      String(laboratorio.id_laboratorio) ===
      String(equipo?.id_laboratorio)
  );

  const laboratorioDestino = laboratorios.find(
    (laboratorio) =>
      String(laboratorio.id_laboratorio) ===
      String(formulario.id_laboratorio)
  );

  const ubicacionActual = texto(
    equipo?.ubicacion_detalle ??
    equipo?.ubicacionDetalle
  );

  const idLaboratorioActual = Number(equipo?.id_laboratorio);

  const hayCambios =
    equipo &&
    (
      Number(formulario.id_laboratorio) !== idLaboratorioActual ||
      formulario.ubicacion_detalle.trim() !== ubicacionActual
    );

  function actualizarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario((anterior) => {
      if (name === 'id_sede') {
        return {
          ...anterior,
          id_sede: value,
          id_laboratorio: '',
        };
      }

      return {
        ...anterior,
        [name]: value,
      };
    });

    setError('');
    setConfirmar(false);
  }

  function validarTraslado() {
    if (!idValido(formulario.id_sede)) {
      return 'Debés seleccionar una sede.';
    }

    if (!idValido(formulario.id_laboratorio)) {
      return 'Debés seleccionar un laboratorio.';
    }

    const laboratorioAutorizado = laboratoriosFiltrados.some(
      (laboratorio) =>
        String(laboratorio.id_laboratorio) ===
        String(formulario.id_laboratorio)
    );

    if (!laboratorioAutorizado) {
      return 'No tenés disponible ese laboratorio para el traslado.';
    }

    if (!hayCambios) {
      return 'La nueva ubicación es igual a la ubicación actual.';
    }

    if (formulario.ubicacion_detalle.length > 255) {
      return 'La ubicación detallada no puede superar 255 caracteres.';
    }

    return '';
  }

  function solicitarConfirmacion(evento) {
    evento.preventDefault();

    const mensaje = validarTraslado();

    if (mensaje) {
      setError(mensaje);
      return;
    }

    setError('');
    setConfirmar(true);
  }

  async function confirmarTraslado() {
    if (enviandoRef.current || !equipo || !confirmar) {
      return;
    }

    const mensaje = validarTraslado();

    if (mensaje) {
      setError(mensaje);
      setConfirmar(false);
      return;
    }

    enviandoRef.current = true;
    setGuardando(true);
    setError('');

    try {
      await trasladarEquipo(
        idEquipo,
        {
          id_laboratorio: Number(formulario.id_laboratorio),
          ubicacion_detalle:
            formulario.ubicacion_detalle.trim(),
        },
        token
      );

      setExito('El equipo fue trasladado correctamente.');
      setConfirmar(false);

      if (typeof onTrasladado === 'function') {
        onTrasladado();
      }
    } catch (err) {
      setError(
        err.message ||
        'No fue posible realizar el traslado.'
      );
      setConfirmar(false);
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="registro-pagina">
        <div className="registro-cargando" role="status">
          Cargando información del traslado...
        </div>
      </div>
    );
  }

  return (
    <div className="registro-pagina traslado-pagina">

      {/* VOLVER */}
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
        <h1>Trasladar equipo</h1>
        <p>
          Modifique la ubicación de un equipo tecnológico
          conservando su historial de movimientos.
        </p>
      </div>

      {error && (
        <div
          className="registro-alerta registro-alerta-error"
          role="alert"
        >
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {exito && (
        <div
          className="registro-alerta registro-alerta-exito"
          role="status"
        >
          <CheckCircle2 size={19} />
          <span>{exito}</span>
        </div>
      )}

      {equipo && (
        <form onSubmit={solicitarConfirmacion}>

          {/* IDENTIFICACIÓN DEL EQUIPO */}
          <section className="registro-tarjeta">
            <div className="registro-tarjeta-titulo">
              <span className="registro-tarjeta-icono">
                <ArrowLeftRight size={18} />
              </span>
              <h2>Información del equipo</h2>
            </div>

            <div className="registro-tarjeta-contenido">
              <div className="traslado-equipo-info">
                <div>
                  <span>Equipo</span>
                  <strong>
                    {equipo.nombre || 'Sin nombre'}
                  </strong>
                </div>

                <div>
                  <span>Placa institucional</span>
                  <strong>
                    {equipo.placa_institucional || '—'}
                  </strong>
                </div>

                <div>
                  <span>Número de serie</span>
                  <strong>
                    {equipo.numero_serie || '—'}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* UBICACIONES */}
          <div className="traslado-grid">

            {/* UBICACIÓN ACTUAL */}
            <section className="registro-tarjeta">
              <div className="registro-tarjeta-titulo">
                <span className="registro-tarjeta-icono">
                  <MapPin size={18} />
                </span>
                <h2>Ubicación actual</h2>
              </div>

              <div className="registro-tarjeta-contenido">
                <div className="traslado-ubicacion-actual">
                  <div>
                    <span>Laboratorio</span>
                    <strong>
                      {nombreRelacion(laboratorioActual) ||
                       nombreRelacion(equipo.laboratorio) ||
                       equipo.nombre_laboratorio ||
                       `Laboratorio ${equipo.id_laboratorio}`}
                    </strong>
                  </div>

                  <div>
                    <span>Ubicación detallada</span>
                    <strong>
                      {ubicacionActual ||
                       'Sin ubicación detallada'}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            {/* NUEVA UBICACIÓN */}
            <section className="registro-tarjeta">
              <div className="registro-tarjeta-titulo">
                <span className="registro-tarjeta-icono">
                  <Building2 size={18} />
                </span>
                <h2>Nueva ubicación</h2>
              </div>

              <div className="registro-tarjeta-contenido">
                <div className="traslado-campos">

                  <label className="registro-campo">
                    <span className="registro-etiqueta">
                      Sede
                      <span className="registro-requerido"> *</span>
                    </span>

                    <select
                      name="id_sede"
                      value={formulario.id_sede}
                      onChange={actualizarCampo}
                      required
                      disabled={guardando}
                    >
                      <option value="">
                        Seleccionar sede
                      </option>

                      {sedesDisponibles.map((sede) => (
                        <option
                          key={sede.id_sede}
                          value={sede.id_sede}
                        >
                          {sede.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="registro-campo">
                    <span className="registro-etiqueta">
                      Laboratorio autorizado
                      <span className="registro-requerido"> *</span>
                    </span>

                    <select
                      name="id_laboratorio"
                      value={formulario.id_laboratorio}
                      onChange={actualizarCampo}
                      disabled={
                        !formulario.id_sede || guardando
                      }
                      required
                    >
                      <option value="">
                        Seleccionar laboratorio
                      </option>

                      {laboratoriosFiltrados.map(
                        (laboratorio) => (
                          <option
                            key={laboratorio.id_laboratorio}
                            value={laboratorio.id_laboratorio}
                          >
                            {laboratorio.nombre}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="registro-campo">
                    <span className="registro-etiqueta">
                      Ubicación detallada
                    </span>

                    <input
                      type="text"
                      name="ubicacion_detalle"
                      value={formulario.ubicacion_detalle}
                      onChange={actualizarCampo}
                      placeholder="Ej. Mesa 5, estación 03"
                      maxLength={255}
                      disabled={guardando}
                    />
                  </label>

                </div>
              </div>
            </section>
          </div>

          {/* BOTONES */}
          <div className="registro-acciones">
            <span>
              Los cambios de ubicación quedarán registrados
              en el historial del equipo.
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
                disabled={
                  guardando ||
                  !hayCambios ||
                  !laboratorioDestino
                }
              >
                <ArrowLeftRight size={17} />
                Revisar traslado
              </button>
            </div>
          </div>
        </form>
      )}

      {/* CONFIRMACIÓN DEL TRASLADO */}
      {confirmar && (
        <div className="traslado-confirmacion-fondo">
          <div
            className="traslado-confirmacion"
            role="dialog"
            aria-modal="true"
            aria-labelledby="traslado-confirmacion-titulo"
          >
            <div className="traslado-confirmacion-icono">
              <ArrowLeftRight size={23} />
            </div>

            <h2 id="traslado-confirmacion-titulo">
              ¿Confirmar traslado?
            </h2>

            <p>
              Se actualizará la ubicación de este equipo
              y se conservará el movimiento en su historial.
            </p>

            <div className="traslado-resumen">
              <div>
                <span>Ubicación anterior</span>
                <strong>
                  {nombreRelacion(laboratorioActual) ||
                   equipo?.nombre_laboratorio ||
                   `Laboratorio ${equipo?.id_laboratorio}`}
                </strong>
                <small>
                  {ubicacionActual || 'Sin detalle'}
                </small>
              </div>

              <ArrowLeftRight
                size={20}
                className="traslado-resumen-flecha"
              />

              <div>
                <span>Nueva ubicación</span>
                <strong>
                  {laboratorioDestino?.nombre}
                </strong>
                <small>
                  {formulario.ubicacion_detalle.trim() ||
                   'Sin detalle'}
                </small>
              </div>
            </div>

            <div className="traslado-confirmacion-acciones">
              <button
                type="button"
                className="registro-cancelar"
                disabled={guardando}
                onClick={() => setConfirmar(false)}
              >
                Volver
              </button>

              <button
                type="button"
                className="registro-guardar"
                disabled={guardando}
                onClick={confirmarTraslado}
              >
                {guardando
                  ? 'Trasladando...'
                  : 'Confirmar traslado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
