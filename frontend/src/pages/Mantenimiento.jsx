import FiltroSelect from '../components/inventario/FiltroSelect';
import FiltrosUbicacion from '../components/comunes/FiltrosUbicacion';
import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  EncabezadoModulo,
  Aviso,
  BusquedaModulo,
  PaginacionModulo,
} from '../components/comunes/Modulo';
import { useListadoModulo } from '../hooks/useListadoModulo';
import { useBusquedaDiferida } from '../hooks/useBusquedaDiferida';
import TablaMantenimientos from '../components/mantenimiento/TablaMantenimientos';
import ModalRegistrarMantenimiento from '../components/mantenimiento/ModalRegistrarMantenimiento';
import ModalVerEvidencias from '../components/mantenimiento/ModalVerEvidencias';
import {
  consultarMantenimientos,
  actualizarEstadoMantenimiento,
} from '../services/mantenimientosService';
import { obtenerEquipos } from '../services/equiposService';
import { TIPOS_MANTENIMIENTO, ESTADOS_MANTENIMIENTO } from '../utils/mantenimiento';
import '../styles/mantenimiento.css';

export default function Mantenimiento({ token }) {
  const [busqueda, setBusqueda] = useState(''),
    [tipo, setTipo] = useState(''),
    [estado, setEstado] = useState('');
  const [limite, setLimite] = useState(10);
  const [ubicacion, setUbicacion] = useState({ sede: '', laboratorio: '' });
  const [pagina, setPagina] = useState(1),
    [registro, setRegistro] = useState(false),
    [seleccionado, setSeleccionado] = useState(null);
  const [actualizando, setActualizando] = useState(null),
    [errorAccion, setErrorAccion] = useState(''),
    [mensaje, setMensaje] = useState('');
  const busquedaDiferida = useBusquedaDiferida(busqueda);
  const cargar = useCallback(
    (signal) =>
      consultarMantenimientos(
        {
          pagina,
          limite,
          id_sede: ubicacion.sede,
          id_laboratorio: ubicacion.laboratorio,
          busqueda: busquedaDiferida,
          tipo_mantenimiento: tipo,
          estado_mantenimiento: estado,
        },
        token,
        signal
      ),
    [ubicacion.sede, ubicacion.laboratorio, pagina, limite, busquedaDiferida, tipo, estado, token]
  );
  const { datos, cargando, error, recargar } = useListadoModulo(cargar);
  const cargarEquipos = useCallback(
    (signal) => (registro ? obtenerEquipos(token, signal) : Promise.resolve([])),
    [registro, token]
  );
  const opciones = useListadoModulo(cargarEquipos);
  async function cambiarEstado(id, valor) {
    if (actualizando !== null) return;
    setActualizando(id);
    setErrorAccion('');
    try {
      await actualizarEstadoMantenimiento(id, { estado_mantenimiento: valor }, token);
      recargar();
      setMensaje('Estado del mantenimiento actualizado.');
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setActualizando(null);
    }
  }
  function filtro(setter, valor) {
    setter(valor);
    setPagina(1);
  }
  return (
    <div className="inv-pagina mod-pagina">
      <EncabezadoModulo
        titulo="Mantenimientos"
        descripcion="Consulte las intervenciones técnicas y sus evidencias fotográficas."
        alActualizar={recargar}
        cargando={cargando}
      >
        <button
          type="button"
          className="btn btn-lg btn-primario"
          onClick={() => {
            setMensaje('');
            setRegistro(true);
          }}
        >
          <Plus size={17} aria-hidden="true" />
          Registrar mantenimiento
        </button>
      </EncabezadoModulo>
      <Aviso error>{errorAccion || error}</Aviso>
      <Aviso>{mensaje}</Aviso>
      <section className="inv-contenedor" aria-label="Listado de mantenimientos">
        <div className="inv-barra-filtros">
          <BusquedaModulo
            etiqueta="Buscar por equipo, placa o trabajo…"
            valor={busqueda}
            onChange={(valor) => filtro(setBusqueda, valor)}
          />
          <div className="inv-selectores">
            <FiltrosUbicacion
              compacto
              token={token}
              valor={ubicacion}
              onChange={(valor) => {
                setUbicacion(valor);
                setPagina(1);
              }}
            />
            <FiltroSelect
              etiqueta="Tipo"
              valor={tipo}
              opciones={TIPOS_MANTENIMIENTO}
              onChange={(valor) => filtro(setTipo, valor)}
            />
            <FiltroSelect
              etiqueta="Estado"
              valor={estado}
              opciones={ESTADOS_MANTENIMIENTO}
              onChange={(valor) => filtro(setEstado, valor)}
            />
          </div>
        </div>
        <TablaMantenimientos
          mantenimientos={datos?.data || []}
          cargando={cargando}
          alSeleccionarEvidencias={setSeleccionado}
          alCambiarEstado={cambiarEstado}
          actualizandoId={actualizando}
        />
        <PaginacionModulo
          pagina={datos?.pagina || pagina}
          total={datos?.total || 0}
          limite={limite}
          singular="mantenimiento"
          plural="mantenimientos"
          alCambiarLimite={(valor) => {
            setLimite(valor);
            setPagina(1);
          }}
          alCambiar={setPagina}
          cargando={cargando}
        />
      </section>
      {registro && (
        <ModalRegistrarMantenimiento
          abierto
          alCerrar={() => setRegistro(false)}
          alGuardarExitoso={(aviso) => {
            setRegistro(false);
            setMensaje(aviso || 'Mantenimiento registrado.');
            recargar();
          }}
          equiposDisponibles={opciones.datos || []}
          errorEquipos={opciones.error}
          cargandoEquipos={opciones.cargando}
          token={token}
        />
      )}
      {seleccionado && (
        <ModalVerEvidencias
          abierto
          mantenimiento={seleccionado}
          alCerrar={() => setSeleccionado(null)}
          alSubirEvidencia={recargar}
          token={token}
        />
      )}
    </div>
  );
}
