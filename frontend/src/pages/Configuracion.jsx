import { useEffect, useRef, useState } from 'react';
import {
  Search,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';

import {
  consultarConfiguracion,
  guardarConfiguracion,
  eliminarConfiguracion,
} from '../services/configuracionService';

import { generarPaginas } from '../utils/inventario';
import '../styles/configuracion.css';

const POR_PAGINA = 5;

const CATALOGOS = {
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
    ],
  },
  sedes: {
    nombre: 'Sedes',
    singular: 'sede',
    id: 'id_sede',
    columnas: [
      { campo: 'nombre', titulo: 'Nombre' },
    ],
    campos: [
      { campo: 'nombre', titulo: 'Nombre', max: 150, obligatorio: true },
    ],
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

export default function Configuracion({ token }) {
  const [catalogo, setCatalogo] = useState('categorias');
  const [registros, setRegistros] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [mensaje, setMensaje] = useState('');

  const [modal, setModal] = useState(null);
  const [formulario, setFormulario] = useState({});
  const [errorModal, setErrorModal] = useState('');
  const [guardando, setGuardando] = useState(false);

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
    setPagina(1);
    setCatalogo(clave);
  }

  function abrirFormulario(registro = null) {
    const datos = {};

    for (const { campo } of config.campos) {
      datos[campo] = registro?.[campo] ?? '';
    }

    setFormulario(datos);
    setErrorModal('');
    setModal({
      tipo: 'formulario',
      registro,
    });
  }

  function abrirEliminacion(registro) {
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
          tipo === 'sede'
            ? Number(formulario[campo])
            : String(formulario[campo] ?? '').trim();
      }

      const id = modal.registro?.[config.id];

      const resultado = await guardarConfiguracion(
        catalogo,
        id,
        datos,
        token
      );

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
    if (operandoRef.current) return;

    operandoRef.current = true;
    setGuardando(true);
    setErrorModal('');

    try {
      const resultado = await eliminarConfiguracion(
        catalogo,
        modal.registro[config.id],
        token
      );

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

  const filtrados = registros.filter((registro) =>
    config.columnas.some(({ campo }) =>
      String(registro[campo] ?? '')
        .toLocaleLowerCase('es')
        .includes(termino)
    )
  );

  const total = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const fin = Math.min(inicio + POR_PAGINA, total);
  const visibles = filtrados.slice(inicio, inicio + POR_PAGINA);

  return (
    <div className="cfg-pagina">
      <div className="cfg-encabezado">
        <div>
          <h1>Configuración</h1>
          <p>
            Administre las categorías, estados, sedes y laboratorios.
          </p>
        </div>        
      </div>

      <div
        className="cfg-pestanas"
        role="group"
        aria-label="Catálogos del sistema"
      >
        {Object.entries(CATALOGOS).map(([clave, opcion]) => (
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

      {mensaje && (
        <div className="cfg-exito" role="status">
          {mensaje}
        </div>
      )}

      <section className="cfg-tarjeta" aria-label={config.nombre}>
        <div className="cfg-barra">
          <label className="cfg-busqueda">
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

          <div className="cfg-acciones">
            <button
              type="button"
              className="cfg-actualizar"
              aria-label="Actualizar catálogo"
              title="Actualizar catálogo"
              disabled={cargando}
              onClick={() => setRecarga((valor) => valor + 1)}
            >
              <RefreshCw size={17} />
            </button>

            <button
              type="button"
              className="cfg-primario"
              disabled={cargando || Boolean(error)}
              onClick={() => abrirFormulario()}
            >
              <Plus size={17} />
              Agregar {config.singular}
            </button>
          </div>
        </div>

        {error ? (
          <div className="cfg-mensaje cfg-error" role="alert">
            <AlertCircle size={19} />
            <span>{error}</span>
          </div>
        ) : cargando ? (
          <div className="cfg-mensaje" role="status">
            Cargando catálogo...
          </div>
        ) : (
          <>
            <div className="cfg-tabla-contenedor">
              <table className="cfg-tabla">
                <thead>
                  <tr>
                    {config.columnas.map(({ campo, titulo }) => (
                      <th key={campo} scope="col">
                        {titulo}
                      </th>
                    ))}
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {visibles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={config.columnas.length + 1}
                        className="cfg-vacio"
                      >
                        No se encontraron registros.
                      </td>
                    </tr>
                  ) : (
                    visibles.map((registro) => (
                      <tr key={registro[config.id]}>
                        {config.columnas.map(({ campo }) => (
                          <td key={campo}>
                            {registro[campo] ?? 'Sin información'}
                          </td>
                        ))}

                        <td>
                          <div className="cfg-acciones-fila">
                            <button
                              type="button"
                              className="cfg-icono"
                              title="Editar"
                              aria-label={`Editar ${registro.nombre}`}
                              onClick={() => abrirFormulario(registro)}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              className="cfg-icono cfg-icono-rojo"
                              title="Eliminar"
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

            <div className="cfg-paginacion">
              <p>
                {total === 0
                  ? 'Mostrando 0 registros'
                  : `Mostrando ${inicio + 1}–${fin} de ${total.toLocaleString(
                      'es-CR'
                    )} registros`}
              </p>

              <nav aria-label="Paginación del catálogo">
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={paginaActual <= 1}
                  onClick={() => setPagina(paginaActual - 1)}
                >
                  <ChevronLeft size={15} />
                </button>

                {generarPaginas(paginaActual, totalPaginas).map(
                  (numero, indice) =>
                    numero === '...' ? (
                      <span key={`puntos-${indice}`}>...</span>
                    ) : (
                      <button
                        key={numero}
                        type="button"
                        className={
                          paginaActual === numero ? 'activa' : ''
                        }
                        aria-label={`Ir a la página ${numero}`}
                        aria-current={
                          paginaActual === numero ? 'page' : undefined
                        }
                        onClick={() => setPagina(numero)}
                      >
                        {numero}
                      </button>
                    )
                )}

                <button
                  type="button"
                  aria-label="Página siguiente"
                  disabled={paginaActual >= totalPaginas}
                  onClick={() => setPagina(paginaActual + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </nav>
            </div>
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
              <div className="cfg-mensaje cfg-error" role="alert">
                {errorModal}
              </div>
            )}

            {modal.tipo === 'eliminar' ? (
              <>
                <p className="cfg-confirmacion">
                  ¿Desea eliminar «{modal.registro.nombre}»?
                  Esta acción es permanente. Si está en uso, no se
                  permitirá eliminarlo.
                </p>

                <div className="cfg-modal-acciones">
                  <button
                    type="button"
                    className="cfg-secundario"
                    disabled={guardando}
                    onClick={cerrarModal}
                    autoFocus
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="cfg-peligro"
                    disabled={guardando}
                    onClick={eliminar}
                  >
                    {guardando ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={guardar}>
                <fieldset className="cfg-formulario" disabled={guardando}>
                  {config.campos.map(
                    ({ campo, titulo, max, obligatorio, tipo }, indice) => (
                      <label key={campo} className="cfg-campo">
                        <span>
                          {titulo}{obligatorio ? ' *' : ''}
                        </span>

                        {tipo === 'sede' ? (
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
                              <option
                                key={sede.id_sede}
                                value={sede.id_sede}
                              >
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
                      </label>
                    )
                  )}
                </fieldset>

                <div className="cfg-modal-acciones">
                  <button
                    type="button"
                    className="cfg-secundario"
                    disabled={guardando}
                    onClick={cerrarModal}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="cfg-primario"
                    disabled={guardando}
                  >
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