import { notificar } from '../utils/notificaciones';
import Notificacion from '../components/comunes/Notificacion';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Save, Monitor, Cpu, FileText } from 'lucide-react';

import {
  obtenerEquipoPorId,
  actualizarEquipo,
} from '../services/equiposService';

import { Campo, Seccion } from '../components/inventario/FormularioEquipo';
import { prepararCambiosEquipo } from '../utils/edicionEquipo';

import '../styles/registrarEquipo.css';

// Convierte valores nulos a texto vacío para los inputs.
function texto(valor) {
  return valor === null || valor === undefined
    ? ''
    : String(valor);
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
  

  const enviandoRef = useRef(false);
  
  

  // Cargar la información real del equipo.
  useEffect(() => {
    const controlador = new AbortController();

    async function cargarEquipo() {
      setCargando(true);
      setError('');
      

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

    // Enviar únicamente cambios generales; no reenviar relaciones antiguas.
    const datosEquipo = prepararCambiosEquipo(formulario, equipoOriginal);
    if (Object.keys(datosEquipo).length === 0) {
      setError('No hay cambios para guardar.');
      return;
    }
    enviandoRef.current = true;
    setGuardando(true);
    setError('');
    

    try {
      await actualizarEquipo(idEquipo, datosEquipo, token);

      notificar({ tipo: 'exito', mensaje: 'Equipo actualizado correctamente.' });

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
        <Notificacion tipo="error">
          
          <span>{error}</span>
        </Notificacion>
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
                <Campo etiqueta="Nombre del equipo" requerido htmlFor="editar-nombre">
                  <input
                    type="text"
                    id="editar-nombre"
                    name="nombre"
                    value={formulario.nombre}
                    onChange={actualizarCampo}
                    maxLength={150}
                    required
                  />
                </Campo>

                <Campo etiqueta="Placa institucional" htmlFor="editar-placa_institucional">
                  <input
                    type="text"
                    id="editar-placa_institucional"
                    name="placa_institucional"
                    value={formulario.placa_institucional}
                    onChange={actualizarCampo}
                  />
                </Campo>

                <Campo etiqueta="Número de serie" htmlFor="editar-numero_serie">
                  <input
                    type="text"
                    id="editar-numero_serie"
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
                <Campo etiqueta="Marca" htmlFor="editar-marca">
                  <input
                    type="text"
                    id="editar-marca"
                    name="marca"
                    value={formulario.marca}
                    onChange={actualizarCampo}
                  />
                </Campo>

                <Campo etiqueta="Modelo" htmlFor="editar-modelo">
                  <input
                    type="text"
                    id="editar-modelo"
                    name="modelo"
                    value={formulario.modelo}
                    onChange={actualizarCampo}
                  />
                </Campo>

                <Campo etiqueta="Año" htmlFor="editar-anio">
                  <input
                    type="number"
                    id="editar-anio"
                    name="anio"
                    value={formulario.anio}
                    onChange={actualizarCampo}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    step="1"
                  />
                </Campo>

                <Campo etiqueta="Características" htmlFor="editar-caracteristicas">
                  <textarea
                    id="editar-caracteristicas"
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
              <Campo etiqueta="Comentarios" htmlFor="editar-comentarios">
                <textarea
                  id="editar-comentarios"
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
                className="btn btn-lg btn-secundario"
                onClick={onCancelar}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn btn-lg btn-primario"
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
