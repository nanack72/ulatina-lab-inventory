import FiltrosUbicacion from '../comunes/FiltrosUbicacion';
import { useRef, useState } from 'react';
import { DialogoModulo, Aviso } from '../comunes/Modulo';
import { crearIncidencia } from '../../services/incidenciasService';
import { PRIORIDADES_INCIDENCIA } from '../../utils/incidencias';
export default function ModalReportarIncidencia({
  abierto,
  alCerrar,
  alGuardarExitoso,
  equiposDisponibles = [],
  errorEquipos,
  cargandoEquipos,
  token,
}) {
  const [ubicacion, setUbicacion] = useState({ sede: '', laboratorio: '' });
  const equiposFiltrados = equiposDisponibles.filter(
    (eq) =>
      (!ubicacion.sede || String(eq.id_sede) === ubicacion.sede) &&
      (!ubicacion.laboratorio || String(eq.id_laboratorio) === ubicacion.laboratorio)
  );
  const [equipo, setEquipo] = useState(''),
    [titulo, setTitulo] = useState(''),
    [descripcion, setDescripcion] = useState(''),
    [prioridad, setPrioridad] = useState('Media');
  const [error, setError] = useState(''),
    [guardando, setGuardando] = useState(false),
    ocupado = useRef(false);
  async function guardar(e) {
    e.preventDefault();
    if (ocupado.current) return;
    ocupado.current = true;
    setGuardando(true);
    setError('');
    try {
      await crearIncidencia(
        {
          id_equipo: Number(equipo),
          titulo: titulo.trim(),
          descripcion_falla: descripcion.trim(),
          prioridad,
        },
        token
      );
      alGuardarExitoso();
    } catch (err) {
      setError(err.message);
    } finally {
      ocupado.current = false;
      setGuardando(false);
    }
  }
  return (
    <DialogoModulo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Reportar incidencia"
      descripcion="Describa la falla del equipo para darle seguimiento."
      ocupado={guardando}
    >
      <form className="mod-formulario" onSubmit={guardar}>
        <Aviso error>{error || errorEquipos}</Aviso>
        <div className="mod-campos">
          <FiltrosUbicacion
            token={token}
            valor={ubicacion}
            disabled={guardando}
            onChange={(valor) => {
              setUbicacion(valor);
              setEquipo('');
            }}
          />
        </div>
        <label className="mod-campo" htmlFor="inc-equipo">
          Equipo *
          <select
            id="inc-equipo"
            name="id_equipo"
            required
            value={equipo}
            disabled={guardando || cargandoEquipos}
            onChange={(e) => setEquipo(e.target.value)}
          >
            <option value="">
              {cargandoEquipos ? 'Cargando equipos…' : 'Seleccione un equipo'}
            </option>
            {equiposFiltrados.map((eq) => (
              <option key={eq.id_equipo} value={eq.id_equipo}>
                {eq.placa_institucional || eq.numero_serie || 'Sin placa'} · {eq.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="mod-campos">
          <label className="mod-campo" htmlFor="inc-titulo">
            Título *
            <input
              id="inc-titulo"
              name="titulo"
              required
              maxLength={150}
              value={titulo}
              disabled={guardando}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </label>
          <label className="mod-campo" htmlFor="inc-prioridad">
            Prioridad
            <select
              id="inc-prioridad"
              name="prioridad"
              value={prioridad}
              disabled={guardando}
              onChange={(e) => setPrioridad(e.target.value)}
            >
              {PRIORIDADES_INCIDENCIA.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mod-campo" htmlFor="inc-descripcion">
          Descripción de la falla *
          <textarea
            id="inc-descripcion"
            name="descripcion_falla"
            required
            maxLength={10000}
            rows={5}
            value={descripcion}
            disabled={guardando}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>
        <footer className="mod-acciones">
          <button
            type="button"
            className="btn btn-secundario"
            disabled={guardando}
            onClick={alCerrar}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primario"
            disabled={guardando || cargandoEquipos || !!errorEquipos}
          >
            {guardando ? 'Guardando…' : 'Registrar incidencia'}
          </button>
        </footer>
      </form>
    </DialogoModulo>
  );
}
