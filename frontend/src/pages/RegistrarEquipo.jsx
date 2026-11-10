import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Save,
  Monitor,
  Cpu,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import {
  obtenerCategorias,
  obtenerEstados,
  obtenerSedes,
  obtenerLaboratorios,
} from '../services/catalogosService';

import { registrarEquipo } from '../services/equiposService';

import '../styles/registrarEquipo.css';

const FORMULARIO_INICIAL = {
  nombre: '',
  numero_serie: '',
  placa_institucional: '',
  marca: '',
  modelo: '',
  anio: '',
  caracteristicas: '',
  comentarios: '',
  ubicacion_detalle: '',
  id_sede: '',
  id_laboratorio: '',
  id_categoria: '',
  id_estado: '',
};

function nombreCatalogo(elemento) {
  return String(
    elemento?.nombre ??
    elemento?.nombre_sede ??
    elemento?.nombre_laboratorio ??
    elemento?.nombre_categoria ??
    elemento?.nombre_estado ??
    ''
  );
}

function Campo({ etiqueta, requerido = false, children }) {
  return (
    <label className="registro-campo">
      <span className="registro-etiqueta">
        {etiqueta}
        {requerido && <span className="registro-requerido"> *</span>}
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

export default function RegistrarEquipo({
  token,
  onCancelar,
  onRegistrado,
}) {
  const [formulario, setFormulario] = useState(
    FORMULARIO_INICIAL
  );

  const [categorias, setCategorias] = useState([]);
  const [estados, setEstados] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const enviandoRef = useRef(false);

  // Cargar catálogos reales del backend.
  useEffect(() => {
    const controlador = new AbortController();

    async function cargarCatalogos() {
      setCargandoCatalogos(true);
      setError('');

      try {
        const [
          datosCategorias,
          datosEstados,
          datosSedes,
          datosLaboratorios,
        ] = await Promise.all([
          obtenerCategorias(token, controlador.signal),
          obtenerEstados(token, controlador.signal),
          obtenerSedes(token, controlador.signal),
          obtenerLaboratorios(token, controlador.signal),
        ]);

        if (controlador.signal.aborted) return;

        setCategorias(datosCategorias);
        setEstados(datosEstados);
        setSedes(datosSedes);
        setLaboratorios(datosLaboratorios);
      } catch (err) {
        if (controlador.signal.aborted) return;

        setError(
          err.message ||
          'No fue posible cargar los catálogos del sistema.'
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargandoCatalogos(false);
        }
      }
    }

    cargarCatalogos();

    return () => controlador.abort();
  }, [token]);

  // Laboratorios disponibles según sede seleccionada.
  // La API ya debe haber filtrado los laboratorios autorizados.
  const laboratoriosFiltrados = useMemo(() => {
    if (!formulario.id_sede) return [];

    return laboratorios.filter(
      (laboratorio) =>
        String(laboratorio.id_sede) ===
        String(formulario.id_sede)
    );
  }, [laboratorios, formulario.id_sede]);

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
  }

  function validarFormulario() {
    if (!formulario.nombre.trim()) {
      return 'Debés ingresar el nombre del equipo.';
    }

    if (!formulario.id_categoria) {
      return 'Debés seleccionar una categoría.';
    }

    if (!formulario.id_estado) {
      return 'Debés seleccionar el estado del equipo.';
    }

    if (!formulario.id_sede) {
      return 'Debés seleccionar una sede.';
    }

    if (!formulario.id_laboratorio) {
      return 'Debés seleccionar un laboratorio.';
    }

    const autorizado = laboratoriosFiltrados.some(
      (laboratorio) =>
        String(laboratorio.id_laboratorio) ===
        String(formulario.id_laboratorio)
    );

    if (!autorizado) {
      return 'El laboratorio seleccionado no está disponible para tu usuario.';
    }

    if (
      formulario.anio !== '' &&
      (
        !Number.isInteger(Number(formulario.anio)) ||
        Number(formulario.anio) < 1900 ||
        Number(formulario.anio) > new Date().getFullYear() + 1
      )
    ) {
      return 'Ingresá un año válido.';
    }

    return '';
  }

  async function manejarRegistro(evento) {
    evento.preventDefault();

    if (enviandoRef.current || cargandoCatalogos) return;

    const mensajeValidacion = validarFormulario();

    if (mensajeValidacion) {
      setError(mensajeValidacion);
      return;
    }

    enviandoRef.current = true;
    setGuardando(true);
    setError('');
    setExito('');

    const datosEquipo = {
      nombre: formulario.nombre.trim(),
      numero_serie: formulario.numero_serie.trim() || null,
      placa_institucional:
        formulario.placa_institucional.trim() || null,
      marca: formulario.marca.trim() || null,
      modelo: formulario.modelo.trim() || null,
      anio:
        formulario.anio === ''
          ? null
          : Number(formulario.anio),
      caracteristicas:
        formulario.caracteristicas.trim() || null,
      comentarios:
        formulario.comentarios.trim() || null,
      ubicacion_detalle:
        formulario.ubicacion_detalle.trim() || null,
      id_categoria: Number(formulario.id_categoria),
      id_estado: Number(formulario.id_estado),
      id_laboratorio: Number(formulario.id_laboratorio),
    };

    try {
      await registrarEquipo(datosEquipo, token);

      setExito('Equipo registrado correctamente.');

      if (typeof onRegistrado === 'function') {
        onRegistrado();
      }
    } catch (err) {
      setError(
        err.message ||
        'Ocurrió un error al registrar el equipo.'
      );
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  }

  return (
    <div className="registro-pagina">
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
        <div>
          <h1>Registrar equipo</h1>
          <p>
            Complete la información del nuevo equipo tecnológico.
          </p>
        </div>
      </div>

      {/* ERRORES */}
      {error && (
        <div className="registro-alerta registro-alerta-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {/* CONFIRMACIÓN */}
      {exito && (
        <div className="registro-alerta registro-alerta-exito" role="status">
          <CheckCircle2 size={19} />
          <span>{exito}</span>
        </div>
      )}

      {cargandoCatalogos ? (
        <div className="registro-cargando" role="status">
          Cargando categorías, estados, sedes y laboratorios...
        </div>
      ) : (
        <form onSubmit={manejarRegistro}>
          <div className="registro-grid">
            {/* IDENTIFICACIÓN */}
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
                    placeholder="Ej. Computadora laboratorio 301"
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
                    placeholder="Ej. UL-00125"
                  />
                </Campo>

                <Campo etiqueta="Número de serie">
                  <input
                    type="text"
                    name="numero_serie"
                    value={formulario.numero_serie}
                    onChange={actualizarCampo}
                    placeholder="Número de serie"
                  />
                </Campo>

                <Campo etiqueta="Categoría" requerido>
                  <select
                    name="id_categoria"
                    value={formulario.id_categoria}
                    onChange={actualizarCampo}
                    required
                  >
                    <option value="">Seleccionar categoría</option>

                    {categorias.map((categoria) => (
                      <option
                        key={categoria.id_categoria}
                        value={categoria.id_categoria}
                      >
                        {nombreCatalogo(categoria)}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            </Seccion>

            {/* CARACTERÍSTICAS TÉCNICAS */}
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
                    placeholder="Ej. HP"
                  />
                </Campo>

                <Campo etiqueta="Modelo">
                  <input
                    type="text"
                    name="modelo"
                    value={formulario.modelo}
                    onChange={actualizarCampo}
                    placeholder="Ej. ProDesk 400"
                  />
                </Campo>

                <Campo etiqueta="Año">
                  <input
                    type="number"
                    name="anio"
                    value={formulario.anio}
                    onChange={actualizarCampo}
                    placeholder="Ej. 2026"
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
                    placeholder="Procesador, memoria, almacenamiento..."
                    rows={3}
                  />
                </Campo>
              </div>
            </Seccion>

            {/* UBICACIÓN */}
            <Seccion
              titulo="Ubicación del equipo"
              icono={MapPin}
            >
              <div className="registro-campos-grid">
                <Campo etiqueta="Sede" requerido>
                  <select
                    name="id_sede"
                    value={formulario.id_sede}
                    onChange={actualizarCampo}
                    required
                  >
                    <option value="">Seleccionar sede</option>

                    {sedes
                      .filter((sede) =>
                        laboratorios.some(
                          (laboratorio) =>
                            String(laboratorio.id_sede) ===
                            String(sede.id_sede)
                        )
                      )
                      .map((sede) => (
                        <option
                          key={sede.id_sede}
                          value={sede.id_sede}
                        >
                          {nombreCatalogo(sede)}
                        </option>
                      ))}
                  </select>
                </Campo>

                <Campo etiqueta="Laboratorio autorizado" requerido>
                  <select
                    name="id_laboratorio"
                    value={formulario.id_laboratorio}
                    onChange={actualizarCampo}
                    disabled={!formulario.id_sede}
                    required
                  >
                    <option value="">Seleccionar laboratorio</option>

                    {laboratoriosFiltrados.map((laboratorio) => (
                      <option
                        key={laboratorio.id_laboratorio}
                        value={laboratorio.id_laboratorio}
                      >
                        {nombreCatalogo(laboratorio)}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo etiqueta="Ubicación detallada">
                  <input
                    type="text"
                    name="ubicacion_detalle"
                    value={formulario.ubicacion_detalle}
                    onChange={actualizarCampo}
                    placeholder="Ej. Mesa 2, estación 04"
                  />
                </Campo>

                <Campo etiqueta="Estado del equipo" requerido>
                  <select
                    name="id_estado"
                    value={formulario.id_estado}
                    onChange={actualizarCampo}
                    required
                  >
                    <option value="">Seleccionar estado</option>

                    {estados.map((estado) => (
                      <option
                        key={estado.id_estado}
                        value={estado.id_estado}
                      >
                        {nombreCatalogo(estado)}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            </Seccion>

            {/* OBSERVACIONES */}
            <Seccion
              titulo="Observaciones"
              icono={FileText}
            >
              <Campo etiqueta="Comentarios adicionales">
                <textarea
                  name="comentarios"
                  value={formulario.comentarios}
                  onChange={actualizarCampo}
                  placeholder="Observaciones importantes del equipo..."
                  rows={5}
                />
              </Campo>
            </Seccion>
          </div>

          {/* BOTONES */}
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
                disabled={guardando || cargandoCatalogos || !!error && categorias.length === 0}
              >
                <Save size={17} />
                {guardando ? 'Guardando...' : 'Guardar equipo'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
