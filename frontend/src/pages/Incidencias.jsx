import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  EncabezadoModulo,
  Aviso,
  Indicador,
  BusquedaModulo,
  PaginacionModulo,
} from '../components/comunes/Modulo';
import { useListadoModulo } from '../hooks/useListadoModulo';
import { useBusquedaDiferida } from '../hooks/useBusquedaDiferida';
import TablaIncidencias from '../components/incidencias/TablaIncidencias';
import ModalReportarIncidencia from '../components/incidencias/ModalReportarIncidencia';
import { consultarIncidencias, actualizarEstadoIncidencia } from '../services/incidenciasService';
import { obtenerEquipos } from '../services/equiposService';
import { PRIORIDADES_INCIDENCIA, ESTADOS_INCIDENCIA } from '../utils/incidencias';

export default function Incidencias({ token }) {
  const [busqueda, setBusqueda] = useState(''),
    [prioridad, setPrioridad] = useState(''),
    [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1),
    [abierto, setAbierto] = useState(false),
    [actualizando, setActualizando] = useState(null);
  const [errorAccion, setErrorAccion] = useState(''),
    [mensaje, setMensaje] = useState('');
  const busquedaDiferida = useBusquedaDiferida(busqueda);
  const cargar = useCallback(
    (signal) =>
      consultarIncidencias({ busqueda: busquedaDiferida, prioridad, estado }, token, signal),
    [busquedaDiferida, prioridad, estado, token]
  );
  const { datos, cargando, error, recargar } = useListadoModulo(cargar);
  const cargarEquipos = useCallback(
    (signal) => (abierto ? obtenerEquipos(token, signal) : Promise.resolve([])),
    [abierto, token]
  );
  const equipos = useListadoModulo(cargarEquipos);
  const lista = datos?.data || [],
    actual = Math.min(pagina, Math.max(1, Math.ceil(lista.length / 10)));
  async function cambiarEstado(id, valor) {
    if (actualizando !== null) return;
    setActualizando(id);
    setErrorAccion('');
    try {
      await actualizarEstadoIncidencia(id, valor, token);
      recargar();
      setMensaje('Estado de la incidencia actualizado.');
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
        titulo="Incidencias"
        descripcion="Registre y dé seguimiento a las fallas de los equipos de laboratorio."
        cargando={cargando}
        alActualizar={recargar}
      >
        <button
          type="button"
          className="btn btn-lg btn-primario"
          onClick={() => {
            setMensaje('');
            setAbierto(true);
          }}
        >
          <Plus size={17} aria-hidden="true" />
          Reportar incidencia
        </button>
      </EncabezadoModulo>
      <Aviso error>{errorAccion || error}</Aviso>
      <Aviso>{mensaje}</Aviso>
      <section className="mod-indicadores" aria-label="Resumen de los resultados filtrados">
        <Indicador
          titulo="Críticas / altas"
          valor={lista.filter((i) => ['Crítica', 'Critica', 'Alta'].includes(i.prioridad)).length}
          detalle="Requieren atención prioritaria"
          tono="rojo"
        />
        <Indicador
          titulo="Abiertas"
          valor={lista.filter((i) => i.estado_incidencia === 'Abierta').length}
          detalle="Pendientes de revisión"
          tono="ambar"
        />
        <Indicador
          titulo="En revisión"
          valor={lista.filter((i) => i.estado_incidencia === 'En Revisión').length}
          detalle="En atención técnica"
        />
        <Indicador
          titulo="Resueltas"
          valor={lista.filter((i) => i.estado_incidencia === 'Resuelta').length}
          detalle="Solucionadas"
        />
      </section>
      <section className="inv-contenedor" aria-label="Listado de incidencias">
        <div className="inv-barra-filtros">
          <BusquedaModulo
            etiqueta="Buscar por equipo, placa o falla…"
            valor={busqueda}
            onChange={(v) => filtro(setBusqueda, v)}
          />
          <div className="mod-selectores">
            <label>
              Prioridad
              <select
                name="prioridad"
                value={prioridad}
                onChange={(e) => filtro(setPrioridad, e.target.value)}
              >
                <option value="">Todas</option>
                {PRIORIDADES_INCIDENCIA.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select
                name="estado"
                value={estado}
                onChange={(e) => filtro(setEstado, e.target.value)}
              >
                <option value="">Todos</option>
                {ESTADOS_INCIDENCIA.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <TablaIncidencias
          incidencias={lista.slice((actual - 1) * 10, actual * 10)}
          cargando={cargando}
          alCambiarEstado={cambiarEstado}
          actualizandoId={actualizando}
        />
        <PaginacionModulo
          pagina={actual}
          total={lista.length}
          alCambiar={setPagina}
          cargando={cargando}
        />
      </section>
      {abierto && (
        <ModalReportarIncidencia
          abierto
          alCerrar={() => setAbierto(false)}
          alGuardarExitoso={() => {
            setAbierto(false);
            setMensaje('Incidencia registrada.');
            recargar();
          }}
          equiposDisponibles={equipos.datos || []}
          errorEquipos={equipos.error}
          cargandoEquipos={equipos.cargando}
          token={token}
        />
      )}
    </div>
  );
}
