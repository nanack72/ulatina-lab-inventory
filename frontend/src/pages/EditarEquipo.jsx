import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Save,
  Monitor,
  Cpu,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import {
  obtenerEquipoPorId,
  actualizarEquipo,
} from '../services/equiposService';

import '../styles/registrarEquipo.css';

// Convierte valores nulos a texto vacío para los inputs.
function texto(valor) {
  return valor === null || valor === undefined
    ? ''
    : String(valor);
}

function Campo({ etiqueta, requerido = false, children }) {
  return (
    <label className="registro-campo">
      <span className="registro-etiqueta">
        {etiqueta}
        {requerido && (
          <span className="registro-requerido"> *</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Seccion({ titulo, icono: Icono, children }) {
  return (
    <section className="registro-tarjeta">
      <div className="registro-tarjeta-titulo">
        <span className="registro-tarjeta-icono">
          <Icono size={18} />
        </span>
        <h2>{titulo}</h2>
      </div>

      <div className="registro-tarjeta-contenido">
        {children}
      </div>
    </section>
  );
}

export default function EditarEquipo({
  idEquipo,
  token,
  onCancelar,
  onActualizado,
}) {
  const [equipoOriginal, setEquipoOriginal] = useState(null);

  const [formulario, setFormulario] = useState({
    nombre: '',
    placa_institucional: '',
    numero_serie: '',
    marca: '',
    modelo: '',
    anio: '',
    caracteristicas: '',
    comentarios: '',
  });

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const enviandoRef = useRef(false);

  // Cargar la información real del equipo.
  useEffect(() => {
    const controlador = new AbortController();

    async function cargarEquipo() {
      setCargando(true);
      setError('');
      setExito('');

      try {
        const equipo = await obtenerEquipoPorId(
          idEquipo,
          token,
          controlador.signal
        );

        if (controlador.signal.aborted) return;

        setEquipoOriginal(equipo);

        setFormulario({
          nombre: texto(equipo.nombre ?? equipo.nombre_equipo),
          placa_institucional: texto(
            equipo.placa_institucional ?? equipo.placa
          ),
          numero_serie: texto(
            equipo.numero_serie ?? equipo.serie
          ),
          marca: texto(equipo.marca),
          modelo: texto(equipo.modelo),
          anio: texto(equipo.anio ?? equipo.año),
          caracteristicas: texto(equipo.caracteristicas),
          comentarios: texto(equipo.comentarios),
        });
      } catch (err) {
        if (controlador.signal.aborted) return;

        setError(
          err.message || 'No fue posible cargar el equipo.'
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargarEquipo();

    return () => controlador.abort();
  }, [idEquipo, token]);

  function actualizarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));

    setError('');
    setExito('');
  }

  async function guardarCambios(evento) {
    evento.preventDefault();

    if (
      enviandoRef.current ||
      cargando ||
      !equipoOriginal
    ) {
      return;
    }

    if (!formulario.nombre.trim()) {
      setError('Debés ingresar el nombre del equipo.');
      return;
    }

    const anio =
      formulario.anio === ''
        ? null
        : Number(formulario.anio);

    if (
      anio !== null &&
      (
        !Number.isInteger(anio) ||
        anio < 1900 ||
        anio > new Date().getFullYear() + 1
      )
    ) {
      setError('Ingresá un año válido.');
      return;
    }

    // Conservamos los identificadores originales de las
    // relaciones; no permitimos editarlas en esta pantalla.
    const idCategoria =
      equipoOriginal.id_categoria ??
      equipoOriginal.categoria?.id_categoria;

    const idEstado =
      equipoOriginal.id_estado ??
      equipoOriginal.estado?.id_estado;

    const idLaboratorio =
      equipoOriginal.id_laboratorio ??
      equipoOriginal.laboratorio?.id_laboratorio;

    if (
      !Number.isSafeInteger(Number(idCategoria)) ||
      !Number.isSafeInteger(Number(idEstado)) ||
      !Number.isSafeInteger(Number(idLaboratorio)) ||
      Number(idCategoria) <= 0 ||
      Number(idEstado) <= 0 ||
      Number(idLaboratorio) <= 0
    ) {
      setError(
        'No se pudieron identificar la categoría, el estado o el laboratorio originales. Revisá la respuesta del backend antes de actualizar.'
      );
      return;
    }

    // PUT usa los datos editados y mantiene las relaciones
    // originales sin solicitar un traslado ni cambio de estado.
    const datosEquipo = {
      nombre: formulario.nombre.trim(),
      placa_institucional:
        formulario.placa_institucional.trim() || null,
      numero_serie:
        formulario.numero_serie.trim() || null,
      marca: formulario.marca.trim() || null,
      modelo: formulario.modelo.trim() || null,
      anio,
      caracteristicas:
        formulario.caracteristicas.trim() || null,
      comentarios: formulario.comentarios.trim() || null,
      ubicacion_detalle:
        equipoOriginal.ubicacion_detalle ??
        equipoOriginal.ubicacionDetalle ??
        null,
      id_categoria: Number(idCategoria),
      id_estado: Number(idEstado),
      id_laboratorio: Number(idLaboratorio),
    };

    enviandoRef.current = true;
    setGuardando(true);
    setError('');
    setExito('');

    try {
      await actualizarEquipo(idEquipo, datosEquipo, token);

      setExito('Equipo actualizado correctamente.');

      if (typeof onActualizado === 'function') {
        onActualizado();
      }
    } catch (err) {
      setError(
        err.message ||
        'No fue posible actualizar el equipo.'
      );
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  return (
    <div className="registro-pagina">
      <button
        type="button"
        className="registro-volver"
        onClick={onCancelar}
        disabled={guardando}
      >
        <ArrowLeft size={17} />
        Volver al inventario
      </button>

      <div className="registro-encabezado">
        <h1>Editar equipo</h1>
        <p>
          Modifique la información general del equipo tecnológico.
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

      {cargando ? (
        <div className="registro-cargando" role="status">
          Cargando información del equipo...
        </div>
      ) : equipoOriginal ? (
        <form onSubmit={guardarCambios}>
          <div className="registro-grid">
            <Seccion
              titulo="Identificación del equipo"
              icono={Monitor}
            >
              <div className="registro-campos-grid">
                <Campo etiqueta="Nombre del equipo" requerido>
                  <input
                    type="text"
                    name="nombre"
                    value={formulario.nombre}
                    onChange={actualizarCampo}
                    maxLength={150}
                    required
                  />
                </Campo>

                <Campo etiqueta="Placa institucional">
                  <input
                    type="text"
                    name="placa_institucional"
                    value={formulario.placa_institucional}
                    onChange={actualizarCampo}
                  />
                </Campo>

                <Campo etiqueta="Número de serie">
                  <input
                    type="text"
                    name="numero_serie"
                    value={formulario.numero_serie}
                    onChange={actualizarCampo}
                  />
                </Campo>
              </div>
            </Seccion>

            <Seccion
              titulo="Características técnicas"
              icono={Cpu}
            >
              <div className="registro-campos-grid">
                <Campo etiqueta="Marca">
                  <input
                    type="text"
                    name="marca"
                    value={formulario.marca}
                    onChange={actualizarCampo}
                  />
                </Campo>

                <Campo etiqueta="Modelo">
                  <input
                    type="text"
                    name="modelo"
                    value={formulario.modelo}
                    onChange={actualizarCampo}
                  />
                </Campo>

                <Campo etiqueta="Año">
                  <input
                    type="number"
                    name="anio"
                    value={formulario.anio}
                    onChange={actualizarCampo}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    step="1"
                  />
                </Campo>

                <Campo etiqueta="Características">
                  <textarea
                    name="caracteristicas"
                    value={formulario.caracteristicas}
                    onChange={actualizarCampo}
                    rows={4}
                    placeholder="Descripción técnica del equipo"
                  />
                </Campo>
              </div>
            </Seccion>

            <Seccion
              titulo="Comentarios y observaciones"
              icono={FileText}
            >
              <Campo etiqueta="Comentarios">
                <textarea
                  name="comentarios"
                  value={formulario.comentarios}
                  onChange={actualizarCampo}
                  rows={5}
                  placeholder="Observaciones del equipo"
                />
              </Campo>
            </Seccion>

            <Seccion
              titulo="Información que se conserva"
              icono={FileText}
            >
              <p className="registro-aviso">
                La categoría, sede, laboratorio, ubicación
                detallada y estado actual no se modificarán
                desde este formulario. Los cambios de ubicación
                y estado se realizarán desde sus funciones
                específicas para conservar el historial.
              </p>
            </Seccion>
          </div>

          <div className="registro-acciones">
            <span>
              Los campos marcados con * son obligatorios.
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
                disabled={guardando}
              >
                <Save size={17} />
                {guardando
                  ? 'Guardando cambios...'
                  : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
