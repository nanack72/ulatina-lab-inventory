import Paginacion from '../components/inventario/Paginacion';
import Notificacion from '../components/comunes/Notificacion';
import { useEffect, useRef, useState } from 'react';
import { Search, RefreshCw, Plus, Pencil, Trash2 } from 'lucide-react';

import {
  consultarConfiguracion,
  guardarConfiguracion,
  eliminarConfiguracion,
} from '../services/configuracionService';

import '../styles/inventario.css';
import '../styles/configuracion.css';

const CATALOGOS = {
  roles: {
    nombre: 'Roles',
    singular: 'rol',
    id: 'id_rol',
    columnas: [{ campo: 'nombre', titulo: 'Nombre' }],
    campos: [{ campo: 'nombre', titulo: 'Nombre', max: 50, obligatorio: true }],
  },
  categorias: {
    nombre: 'Categorías',
    singular: 'categoría',
    id: 'id_categoria',
    columnas: [
      { campo: 'nombre', titulo: 'Nombre' },
      { campo: 'descripcion', titulo: 'Descripción' },
    ],
    campos: [
      { campo: 'nombre', titulo: 'Nombre', max: 100, obligatorio: true },
      { campo: 'descripcion', titulo: 'Descripción', max: 255 },
      {
        campo: 'anios_revision',
        titulo: 'Revisar por antigüedad a partir de (años)',
        tipo: 'anios',
        ayuda: 'De 1 a 100 años. Dejar vacío para no evaluar esta categoría por antigüedad.',
      },
    ],
  },
  estados: {
    nombre: 'Estados',
    singular: 'estado',
    id: 'id_estado',
    columnas: [
      { campo: 'nombre', titulo: 'Nombre' },
      { campo: 'descripcion', titulo: 'Descripción' },
    ],
    campos: [
      { campo: 'nombre', titulo: 'Nombre', max: 100, obligatorio: true },
      { campo: 'descripcion', titulo: 'Descripción', max: 255 },
      {
        campo: 'requiere_revision',
        titulo: 'Requiere revisión por condición',
        tipo: 'booleano',
        ayuda:
          'Marcar para estados como dañado, inservible u obsoleto. No marcar por mantenimiento rutinario.',
      },
    ],
  },
  sedes: {
    nombre: 'Sedes',
    singular: 'sede',
    id: 'id_sede',
    columnas: [{ campo: 'nombre', titulo: 'Nombre' }],
    campos: [{ campo: 'nombre', titulo: 'Nombre', max: 150, obligatorio: true }],
  },
  laboratorios: {
    nombre: 'Laboratorios',
    singular: 'laboratorio',
    id: 'id_laboratorio',
    columnas: [
      { campo: 'codigo', titulo: 'Código' },
      { campo: 'nombre', titulo: 'Nombre' },
      { campo: 'nombre_sede', titulo: 'Sede' },
    ],
    campos: [
      { campo: 'codigo', titulo: 'Código', max: 50, obligatorio: true },
      { campo: 'nombre', titulo: 'Nombre', max: 150, obligatorio: true },
      { campo: 'id_sede', titulo: 'Sede', tipo: 'sede', obligatorio: true },
    ],
  },
};

export default function Configuracion({ token, soloRoles = false }) {
  const [catalogo, setCatalogo] = useState(soloRoles ? 'roles' : 'categorias');
  const [registros, setRegistros] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSede, setFiltroSede] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [mensaje, setMensaje] = useState('');

  const [modal, setModal] = useState(null);
  const [formulario, setFormulario] = useState({});
  const [errorModal, setErrorModal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminacionConfirmada, setEliminacionConfirmada] = useState(false);

  const dialogoRef = useRef(null);
  const operandoRef = useRef(false);

  const config = CATALOGOS[catalogo];

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);
      setError('');

      try {
        const [datos, listaSedes] = await Promise.all([
          consultarConfiguracion(catalogo, token, controlador.signal),
          catalogo === 'laboratorios'
            ? consultarConfiguracion('sedes', token, controlador.signal)
            : Promise.resolve([]),
        ]);

        if (controlador.signal.aborted) return;

        setRegistros(datos);
        setSedes(listaSedes);
      } catch (err) {
        if (controlador.signal.aborted) return;

        setRegistros([]);
        setSedes([]);
        setError(err.message);
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => controlador.abort();
  }, [token, catalogo, recarga]);

  useEffect(() => {
    if (modal) {
      dialogoRef.current?.showModal();
    } else {
      dialogoRef.current?.close();
    }
  }, [modal]);

  useEffect(() => {
    if (!mensaje) return;

    const temporizador = setTimeout(() => setMensaje(''), 4000);
    return () => clearTimeout(temporizador);
  }, [mensaje]);

  function cambiarCatalogo(clave) {
    if (clave === catalogo) return;

    setCargando(true);
    setRegistros([]);
    setSedes([]);
    setError('');
    setMensaje('');
    setBusqueda('');
    setFiltroSede('');
    setPagina(1);
    setCatalogo(clave);
  }

  function abrirFormulario(registro = null) {
    const datos = {};

    for (const { campo, tipo } of config.campos) {
      datos[campo] = registro?.[campo] ?? (tipo === 'booleano' ? false : '');
    }

    setFormulario(datos);
    setErrorModal('');
    setModal({
      tipo: 'formulario',
      registro,
    });
  }

  function abrirEliminacion(registro) {
    setEliminacionConfirmada(false);
    setErrorModal('');
    setModal({
      tipo: 'eliminar',
      registro,
    });
  }

  function cerrarModal() {
    if (operandoRef.current) return;

    setModal(null);
    setErrorModal('');
  }

  async function guardar(evento) {
    evento.preventDefault();

    if (operandoRef.current) return;

    operandoRef.current = true;
    setGuardando(true);
    setErrorModal('');

    try {
      const datos = {};

      for (const { campo, tipo } of config.campos) {
        datos[campo] =
          tipo === 'booleano'
            ? formulario[campo] === true
            : tipo === 'sede'
              ? Number(formulario[campo])
              : tipo === 'anios'
                ? formulario[campo] === '' || formulario[campo] == null
                  ? null
                  : Number(formulario[campo])
                : String(formulario[campo] ?? '').trim();
      }

      const id = modal.registro?.[config.id];

      const resultado = await guardarConfiguracion(catalogo, id, datos, token);

      setModal(null);
      setMensaje(resultado.message);
      setRecarga((valor) => valor + 1);
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      operandoRef.current = false;
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (operandoRef.current || !eliminacionConfirmada || modal?.tipo !== 'eliminar') return;

    operandoRef.current = true;
    setGuardando(true);
    setErrorModal('');

    try {
      const resultado = await eliminarConfiguracion(catalogo, modal.registro[config.id], token);

      setModal(null);
      setMensaje(resultado.message);
      setRecarga((valor) => valor + 1);
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      operandoRef.current = false;
      setGuardando(false);
    }
  }

  const termino = busqueda.trim().toLocaleLowerCase('es');

  const filtrados = registros.filter(
    (registro) =>
      (catalogo !== 'laboratorios' || !filtroSede || String(registro.id_sede) === filtroSede) &&
      config.columnas.some(({ campo }) =>
        String(registro[campo] ?? '')
          .toLocaleLowerCase('es')
          .includes(termino)
      )
  );

  const total = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * limite;
  const visibles = filtrados.slice(inicio, inicio + limite);

  return (
    <div className="cfg-pagina">
      <div className="inv-encabezado">
        <div className="inv-encabezado-texto">
          <h1>{soloRoles ? 'Roles de usuarios' : 'Configuración'}</h1>
          <p>
            {soloRoles
              ? 'Cree y organice roles personalizados. Los roles del sistema están protegidos; los permisos de inventario se asignan por usuario.'
              : 'Administre las categorías, estados, sedes y laboratorios.'}
          </p>
        </div>

        <div className="inv-acciones">
          <button
            type="button"
            className="btn btn-lg btn-icono"
            aria-label="Actualizar catálogo"
            title="Actualizar catálogo"
            disabled={cargando}
            onClick={() => setRecarga((valor) => valor + 1)}
          >
            <RefreshCw size={17} />
          </button>

          <button
            type="button"
            className="btn btn-lg btn-primario"
            disabled={cargando || Boolean(error)}
            onClick={() => abrirFormulario()}
          >
            <Plus size={17} />
            Agregar {config.singular}
          </button>
        </div>
      </div>

      <div className="cfg-pestanas" role="group" aria-label="Catálogos del sistema">
        {Object.entries(CATALOGOS)
          .filter(([clave]) => (soloRoles ? clave === 'roles' : clave !== 'roles'))
          .map(([clave, opcion]) => (
            <button
              key={clave}
              type="button"
              className={catalogo === clave ? 'activa' : ''}
              aria-pressed={catalogo === clave}
              onClick={() => cambiarCatalogo(clave)}
            >
              {opcion.nombre}
            </button>
          ))}
      </div>

      {mensaje && <Notificacion tipo="exito">{mensaje}</Notificacion>}

      <section className="inv-contenedor" aria-label={config.nombre}>
        <div className="inv-barra-filtros">
          <label className="inv-buscador">
            <Search size={17} aria-hidden="true" />

            <input
              type="search"
              aria-label="Buscar en el catálogo"
              placeholder="Buscar en el catálogo..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </label>

          {catalogo === 'laboratorios' && (
            <label className="cfg-filtro-sede">
              <span className="inv-sr-only">Filtrar laboratorios por sede</span>
              <select
                value={filtroSede}
                disabled={cargando || sedes.length === 0}
                onChange={(evento) => {
                  setFiltroSede(evento.target.value);
                  setPagina(1);
                }}
              >
                <option value="">Todas las sedes</option>
                {sedes.map((sede) => (
                  <option key={sede.id_sede} value={String(sede.id_sede)}>
                    {sede.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error ? (
          <Notificacion tipo="error">
            <span>{error}</span>
          </Notificacion>
        ) : cargando ? (
          <div className="cfg-mensaje" role="status">
            Cargando catálogo...
          </div>
        ) : (
          <>
            <div className="inv-tabla-contenedor">
              <table className="inv-tabla">
                <thead>
                  <tr>
                    {config.columnas.map(({ campo, titulo }) => (
                      <th key={campo} scope="col">
                        {titulo}
                      </th>
                    ))}

                    <th scope="col" className="cfg-columna-acciones">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibles.length === 0 ? (
                    <tr>
                      <td colSpan={config.columnas.length + 1} className="cfg-vacio">
                        No se encontraron registros.
                      </td>
                    </tr>
                  ) : (
                    visibles.map((registro) => (
                      <tr key={registro[config.id]}>
                        {config.columnas.map(({ campo }) => (
                          <td key={campo}>{registro[campo] ?? 'Sin información'}</td>
                        ))}

                        <td className="cfg-columna-acciones">
                          <div className="cfg-acciones-fila">
                            <button
                              type="button"
                              className="cfg-icono"
                              title="Editar"
                              disabled={registro.protegido === true}
                              aria-label={`Editar ${registro.nombre}`}
                              onClick={() => abrirFormulario(registro)}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              className="cfg-icono cfg-icono-rojo"
                              title="Eliminar"
                              disabled={registro.protegido === true}
                              aria-label={`Eliminar ${registro.nombre}`}
                              onClick={() => abrirEliminacion(registro)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Paginacion
              pagina={paginaActual}
              total={total}
              limite={limite}
              singular="registro"
              plural="registros"
              onCambiar={setPagina}
              onCambiarLimite={(valor) => {
                setLimite(valor);
                setPagina(1);
              }}
            />
          </>
        )}
      </section>

      <dialog
        ref={dialogoRef}
        className="cfg-dialogo"
        aria-labelledby="cfg-modal-titulo"
        onCancel={(evento) => {
          evento.preventDefault();
          cerrarModal();
        }}
      >
        {modal && (
          <>
            <h2 id="cfg-modal-titulo">
              {modal.tipo === 'eliminar'
                ? `Eliminar ${config.singular}`
                : `${modal.registro ? 'Editar' : 'Agregar'} ${config.singular}`}
            </h2>

            {errorModal && (
              <Notificacion tipo="error" alCerrar={() => setErrorModal('')}>
                {errorModal}
              </Notificacion>
            )}

            {modal.tipo === 'eliminar' ? (
              <>
                <p className="cfg-confirmacion">
                  ¿Desea eliminar «{modal.registro.nombre}»? Esta acción es permanente. Si está en
                  uso, no se permitirá eliminarlo.
                </p>

                <label className="cfg-confirmar-check">
                  <input
                    type="checkbox"
                    checked={eliminacionConfirmada}
                    disabled={guardando}
                    onChange={(evento) => setEliminacionConfirmada(evento.target.checked)}
                  />
                  <span>Entiendo que esta eliminación es permanente y deseo continuar.</span>
                </label>

                <div className="cfg-modal-acciones">
                  <button
                    type="button"
                    className="btn btn-secundario"
                    disabled={guardando}
                    onClick={cerrarModal}
                    autoFocus
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="btn btn-peligro"
                    disabled={guardando || !eliminacionConfirmada}
                    onClick={eliminar}
                  >
                    {guardando ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={guardar}>
                <fieldset className="cfg-formulario" disabled={guardando}>
                  {config.campos.map(({ campo, titulo, max, obligatorio, tipo, ayuda }, indice) => (
                    <label key={campo} className="cfg-campo">
                      <span>
                        {titulo}
                        {obligatorio ? ' *' : ''}
                      </span>

                      {tipo === 'booleano' ? (
                        <input
                          type="checkbox"
                          checked={formulario[campo] === true}
                          onChange={(e) =>
                            setFormulario((anterior) => ({
                              ...anterior,
                              [campo]: e.target.checked,
                            }))
                          }
                        />
                      ) : tipo === 'anios' ? (
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={formulario[campo] ?? ''}
                          onChange={(e) =>
                            setFormulario((anterior) => ({ ...anterior, [campo]: e.target.value }))
                          }
                        />
                      ) : tipo === 'sede' ? (
                        <select
                          required={obligatorio}
                          value={formulario[campo] ?? ''}
                          onChange={(e) =>
                            setFormulario((anterior) => ({
                              ...anterior,
                              [campo]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Seleccione una sede</option>
                          {sedes.map((sede) => (
                            <option key={sede.id_sede} value={sede.id_sede}>
                              {sede.nombre}
                            </option>
                          ))}
                        </select>
                      ) : campo === 'descripcion' ? (
                        <textarea
                          rows={3}
                          maxLength={max}
                          value={formulario[campo] ?? ''}
                          onChange={(e) =>
                            setFormulario((anterior) => ({
                              ...anterior,
                              [campo]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <input
                          type="text"
                          required={obligatorio}
                          maxLength={max}
                          autoFocus={indice === 0}
                          value={formulario[campo] ?? ''}
                          onChange={(e) =>
                            setFormulario((anterior) => ({
                              ...anterior,
                              [campo]: e.target.value,
                            }))
                          }
                        />
                      )}
                      {ayuda && <small>{ayuda}</small>}
                    </label>
                  ))}
                </fieldset>

                <div className="cfg-modal-acciones">
                  <button
                    type="button"
                    className="btn btn-secundario"
                    disabled={guardando}
                    onClick={cerrarModal}
                  >
                    Cancelar
                  </button>

                  <button type="submit" className="btn btn-primario" disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
