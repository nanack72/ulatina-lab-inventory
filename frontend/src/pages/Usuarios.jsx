import { useEffect, useRef, useState } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

import {
  obtenerUsuarios,
  obtenerOpcionesUsuarios,
  guardarUsuario,
} from '../services/usuariosService';

import { generarPaginas } from '../utils/inventario';

import '../styles/configuracion.css';
import '../styles/usuarios.css';

const POR_PAGINA = 5;

const PERMISOS_INVENTARIO = [
  {
    valor: 'consulta',
    nombre: 'Solo consultar',
  },
  {
    valor: 'registro',
    nombre: 'Consultar y registrar',
  },
  {
    valor: 'edicion',
    nombre: 'Consultar, registrar y editar',
  },
];

function formularioInicial() {
  return {
    nombre_completo: '',
    correo_institucional: '',
    id_rol: '',
    contrasena: '',
    activo: true,
    permiso_inventario: 'consulta',
    sedes: [],
    laboratorios: [],
  };
}

export default function Usuarios({ token, usuarioActual }) {
  const [usuarios, setUsuarios] = useState([]);
  const [opciones, setOpciones] = useState({
    roles: [],
    sedes: [],
    laboratorios: [],
  });

  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [recarga, setRecarga] = useState(0);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');

  const dialogoRef = useRef(null);
  const guardandoRef = useRef(false);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);
      setError('');

      try {
        const [listaUsuarios, datosOpciones] = await Promise.all([
          obtenerUsuarios(token, controlador.signal),
          obtenerOpcionesUsuarios(token, controlador.signal),
        ]);

        if (controlador.signal.aborted) return;

        setUsuarios(listaUsuarios);
        setOpciones(datosOpciones);
      } catch (err) {
        if (controlador.signal.aborted) return;

        setUsuarios([]);
        setError(
          err.message || 'No fue posible cargar los usuarios.'
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => controlador.abort();
  }, [token, recarga]);

  useEffect(() => {
    if (modalAbierto) {
      dialogoRef.current?.showModal();
    } else {
      dialogoRef.current?.close();
    }
  }, [modalAbierto]);

  useEffect(() => {
    if (!mensaje) return;

    const temporizador = setTimeout(
      () => setMensaje(''),
      4000
    );

    return () => clearTimeout(temporizador);
  }, [mensaje]);

  function abrirRegistro() {
    setUsuarioEditando(null);
    setFormulario(formularioInicial());
    setErrorFormulario('');
    setModalAbierto(true);
  }

  function abrirEdicion(usuario) {
    setUsuarioEditando(usuario);

    setFormulario({
      nombre_completo: usuario.nombre_completo,
      correo_institucional: usuario.correo_institucional,
      id_rol: String(usuario.id_rol),
      contrasena: '',
      activo: usuario.activo,
      permiso_inventario:
        usuario.permiso_inventario ?? 'consulta',
      sedes: (usuario.sedes || []).map(Number),
      laboratorios: (usuario.laboratorios || []).map(Number),
    });

    setErrorFormulario('');
    setModalAbierto(true);
  }

  function cerrarModal() {
    if (guardandoRef.current) return;

    setModalAbierto(false);
    setFormulario(formularioInicial());
    setUsuarioEditando(null);
    setErrorFormulario('');
  }

  function cambiarCampo(campo, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function cambiarSede(idSede, seleccionada) {
    setFormulario((anterior) => {
      const sedes = seleccionada
        ? [...new Set([...anterior.sedes, idSede])]
        : anterior.sedes.filter((id) => id !== idSede);

      const laboratoriosPermitidos = new Set(
        opciones.laboratorios
          .filter((laboratorio) =>
            sedes.includes(laboratorio.id_sede)
          )
          .map((laboratorio) => laboratorio.id_laboratorio)
      );

      return {
        ...anterior,
        sedes,
        laboratorios: anterior.laboratorios.filter((id) =>
          laboratoriosPermitidos.has(id)
        ),
      };
    });
  }

  function cambiarLaboratorio(idLaboratorio, seleccionado) {
    setFormulario((anterior) => ({
      ...anterior,
      laboratorios: seleccionado
        ? [
            ...new Set([
              ...anterior.laboratorios,
              idLaboratorio,
            ]),
          ]
        : anterior.laboratorios.filter(
            (id) => id !== idLaboratorio
          ),
    }));
  }

  async function guardar(evento) {
    evento.preventDefault();

    if (guardandoRef.current) return;

    const nombre = formulario.nombre_completo.trim();
    const correo = formulario.correo_institucional.trim();

    if (!nombre || !correo) {
      setErrorFormulario(
        'Ingrese el nombre y el correo del usuario.'
      );
      return;
    }

    const rolElegido = opciones.roles.find(
      (rol) => rol.id_rol === Number(formulario.id_rol)
    );

    if (!rolElegido) {
      setErrorFormulario('Seleccione un rol válido.');
      return;
    }

    const esRolSuperadministrador =
      rolElegido.nombre.trim().toLowerCase() ===
      'superadministrador';

    const permisoInventario = esRolSuperadministrador
      ? 'edicion'
      : formulario.permiso_inventario;

    if (
      !PERMISOS_INVENTARIO.some(
        (permiso) => permiso.valor === permisoInventario
      )
    ) {
      setErrorFormulario(
        'Seleccione un permiso de inventario válido.'
      );
      return;
    }

    if (!usuarioEditando) {
      const bytes = new TextEncoder().encode(
        formulario.contrasena
      ).length;

      if (formulario.contrasena.length < 12 || bytes > 72) {
        setErrorFormulario(
          'La contraseña debe tener al menos 12 caracteres y no superar 72 bytes.'
        );
        return;
      }
    }

    guardandoRef.current = true;
    setGuardando(true);
    setErrorFormulario('');

    try {
      const datos = {
        nombre_completo: nombre,
        correo_institucional: correo,
        id_rol: Number(formulario.id_rol),
        activo: formulario.activo,
        permiso_inventario: permisoInventario,
        sedes: formulario.sedes,
        laboratorios: formulario.laboratorios,
      };

      if (!usuarioEditando) {
        datos.contrasena = formulario.contrasena;
      }

      const resultado = await guardarUsuario(
        usuarioEditando?.id_usuario,
        datos,
        token
      );

      setModalAbierto(false);
      setFormulario(formularioInicial());
      setUsuarioEditando(null);
      setMensaje(resultado.message);
      setRecarga((valor) => valor + 1);
    } catch (err) {
      setErrorFormulario(
        err.message || 'No fue posible guardar el usuario.'
      );
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  const termino = busqueda.trim().toLocaleLowerCase('es');

  const filtrados = usuarios.filter((usuario) =>
    [
      usuario.nombre_completo,
      usuario.correo_institucional,
      usuario.rol,
      usuario.activo ? 'Activa' : 'Inactiva',
    ].some((valor) =>
      String(valor ?? '')
        .toLocaleLowerCase('es')
        .includes(termino)
    )
  );

  const total = filtrados.length;
  const totalPaginas = Math.max(
    1,
    Math.ceil(total / POR_PAGINA)
  );

  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const fin = Math.min(inicio + POR_PAGINA, total);
  const visibles = filtrados.slice(
    inicio,
    inicio + POR_PAGINA
  );

  const laboratoriosDisponibles = opciones.laboratorios.filter(
    (laboratorio) =>
      formulario.sedes.includes(laboratorio.id_sede)
  );

  const rolSeleccionado = opciones.roles.find(
    (rol) => rol.id_rol === Number(formulario.id_rol)
  );

  const esSuperadministrador =
    rolSeleccionado?.nombre?.trim().toLowerCase() ===
    'superadministrador';

  const editandoCuentaPropia =
    usuarioEditando != null &&
    Number(usuarioEditando.id_usuario) ===
      Number(usuarioActual?.idUsuario);

  return (
    <div className="cfg-pagina usu-pagina">
      <div className="cfg-encabezado">
        <div>
          <h1>Usuarios</h1>
          <p>
            Administre las cuentas, roles, permisos de inventario
            y asignaciones de acceso.
          </p>
        </div>
      </div>

      {mensaje && (
        <div className="cfg-exito" role="status">
          {mensaje}
        </div>
      )}

      <section
        className="cfg-tarjeta"
        aria-label="Usuarios registrados"
      >
        <div className="cfg-barra">
          <label className="cfg-busqueda">
            <Search size={17} aria-hidden="true" />

            <input
              type="search"
              placeholder="Buscar por nombre, correo, rol o estado..."
              aria-label="Buscar usuarios"
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
              title="Actualizar usuarios"
              aria-label="Actualizar usuarios"
              disabled={cargando}
              onClick={() =>
                setRecarga((valor) => valor + 1)
              }
            >
              <RefreshCw size={17} />
            </button>

            <button
              type="button"
              className="cfg-primario"
              disabled={cargando || Boolean(error)}
              onClick={abrirRegistro}
            >
              <Plus size={17} />
              Registrar usuario
            </button>
          </div>
        </div>

        {error ? (
          <div
            className="cfg-mensaje cfg-error"
            role="alert"
          >
            <AlertCircle size={19} />
            <span>{error}</span>
          </div>
        ) : cargando ? (
          <div className="cfg-mensaje" role="status">
            Cargando usuarios...
          </div>
        ) : (
          <>
            <div className="cfg-tabla-contenedor">
              <table className="cfg-tabla usu-tabla">
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {visibles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="cfg-vacio"
                      >
                        No se encontraron usuarios.
                      </td>
                    </tr>
                  ) : (
                    visibles.map((usuario) => (
                      <tr key={usuario.id_usuario}>
                        <td>{usuario.nombre_completo}</td>
                        <td>{usuario.correo_institucional}</td>
                        <td>{usuario.rol}</td>

                        <td>
                          <span
                            className={`usu-estado ${
                              usuario.activo
                                ? 'usu-estado-activo'
                                : 'usu-estado-inactivo'
                            }`}
                          >
                            {usuario.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>

                        <td>
                          <div className="cfg-acciones-fila">
                            <button
                              type="button"
                              className="cfg-icono"
                              title="Editar usuario"
                              aria-label={`Editar ${usuario.nombre_completo}`}
                              onClick={() =>
                                abrirEdicion(usuario)
                              }
                            >
                              <Pencil size={16} />
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
                  ? 'Mostrando 0 usuarios'
                  : `Mostrando ${inicio + 1}–${fin} de ${total.toLocaleString(
                      'es-CR'
                    )} usuarios`}
              </p>

              <nav aria-label="Paginación de usuarios">
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={paginaActual <= 1}
                  onClick={() =>
                    setPagina(paginaActual - 1)
                  }
                >
                  <ChevronLeft size={15} />
                </button>

                {generarPaginas(
                  paginaActual,
                  totalPaginas
                ).map((numero, indice) =>
                  numero === '...' ? (
                    <span key={`puntos-${indice}`}>
                      ...
                    </span>
                  ) : (
                    <button
                      key={numero}
                      type="button"
                      className={
                        paginaActual === numero
                          ? 'activa'
                          : ''
                      }
                      aria-label={`Ir a la página ${numero}`}
                      aria-current={
                        paginaActual === numero
                          ? 'page'
                          : undefined
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
                  onClick={() =>
                    setPagina(paginaActual + 1)
                  }
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
        className="cfg-dialogo usu-dialogo"
        aria-labelledby="usu-modal-titulo"
        onCancel={(evento) => {
          evento.preventDefault();
          cerrarModal();
        }}
      >
        {modalAbierto && (
          <>
            <h2 id="usu-modal-titulo">
              {usuarioEditando
                ? 'Editar usuario'
                : 'Registrar usuario'}
            </h2>

            {errorFormulario && (
              <div
                className="cfg-mensaje cfg-error"
                role="alert"
              >
                {errorFormulario}
              </div>
            )}

            <form onSubmit={guardar}>
              <fieldset
                className="cfg-formulario"
                disabled={guardando}
              >
                <label className="cfg-campo">
                  <span>Nombre completo *</span>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    autoFocus
                    autoComplete="off"
                    value={formulario.nombre_completo}
                    onChange={(e) =>
                      cambiarCampo(
                        'nombre_completo',
                        e.target.value
                      )
                    }
                  />
                </label>

                <label className="cfg-campo">
                  <span>Correo electrónico *</span>
                  <input
                    type="email"
                    required
                    maxLength={150}
                    autoComplete="off"
                    value={formulario.correo_institucional}
                    onChange={(e) =>
                      cambiarCampo(
                        'correo_institucional',
                        e.target.value
                      )
                    }
                  />
                </label>

                <div className="usu-dos-columnas">
                  <label className="cfg-campo">
                    <span>Rol *</span>
                    <select
                      required
                      disabled={editandoCuentaPropia}
                      value={formulario.id_rol}
                      onChange={(e) =>
                        cambiarCampo(
                          'id_rol',
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Seleccione un rol
                      </option>

                      {opciones.roles.map((rol) => (
                        <option
                          key={rol.id_rol}
                          value={rol.id_rol}
                        >
                          {rol.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="cfg-campo">
                    <span>Estado de la cuenta *</span>
                    <select
                      disabled={editandoCuentaPropia}
                      value={
                        formulario.activo
                          ? 'activa'
                          : 'inactiva'
                      }
                      onChange={(e) =>
                        cambiarCampo(
                          'activo',
                          e.target.value === 'activa'
                        )
                      }
                    >
                      <option value="activa">Activa</option>
                      <option value="inactiva">Inactiva</option>
                    </select>
                  </label>
                </div>

                <label className="cfg-campo">
                  <span>Permisos de inventario *</span>

                  <select
                    required
                    disabled={esSuperadministrador}
                    value={
                      esSuperadministrador
                        ? 'edicion'
                        : formulario.permiso_inventario
                    }
                    onChange={(e) =>
                      cambiarCampo(
                        'permiso_inventario',
                        e.target.value
                      )
                    }
                  >
                    {PERMISOS_INVENTARIO.map((permiso) => (
                      <option
                        key={permiso.valor}
                        value={permiso.valor}
                      >
                        {permiso.nombre}
                      </option>
                    ))}
                  </select>

                  <small>
                    {esSuperadministrador
                      ? 'El Superadministrador conserva acceso completo.'
                      : 'La edición incluye modificar equipos, trasladarlos y cambiar su estado.'}
                  </small>
                </label>

                {editandoCuentaPropia && (
                  <p className="usu-ayuda">
                    No puede desactivar su propia cuenta ni
                    cambiar su propio rol desde esta pantalla.
                  </p>
                )}

                {!usuarioEditando && (
                  <label className="cfg-campo">
                    <span>Contraseña inicial *</span>
                    <input
                      type="password"
                      required
                      minLength={12}
                      maxLength={72}
                      autoComplete="new-password"
                      value={formulario.contrasena}
                      onChange={(e) =>
                        cambiarCampo(
                          'contrasena',
                          e.target.value
                        )
                      }
                    />
                    <small>
                      Mínimo 12 caracteres y máximo 72 bytes.
                      Los caracteres con tildes pueden ocupar
                      más de un byte.
                    </small>
                  </label>
                )}

                {esSuperadministrador && (
                  <p className="usu-ayuda">
                    El Superadministrador tiene acceso global.
                    No necesita asignaciones para acceder
                    a los laboratorios.
                  </p>
                )}

                <fieldset className="usu-asignaciones">
                  <legend>Sedes asignadas</legend>

                  {opciones.sedes.length === 0 ? (
                    <p className="usu-ayuda">
                      No hay sedes registradas.
                    </p>
                  ) : (
                    <div className="usu-lista-opciones">
                      {opciones.sedes.map((sede) => (
                        <label
                          key={sede.id_sede}
                          className="usu-opcion"
                        >
                          <input
                            type="checkbox"
                            checked={formulario.sedes.includes(
                              sede.id_sede
                            )}
                            onChange={(e) =>
                              cambiarSede(
                                sede.id_sede,
                                e.target.checked
                              )
                            }
                          />
                          <span>{sede.nombre}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                <fieldset className="usu-asignaciones">
                  <legend>Laboratorios asignados</legend>

                  {formulario.sedes.length === 0 ? (
                    <p className="usu-ayuda">
                      Seleccione primero una sede.
                    </p>
                  ) : laboratoriosDisponibles.length === 0 ? (
                    <p className="usu-ayuda">
                      Las sedes seleccionadas no tienen
                      laboratorios.
                    </p>
                  ) : (
                    <div className="usu-lista-opciones">
                      {laboratoriosDisponibles.map(
                        (laboratorio) => (
                          <label
                            key={laboratorio.id_laboratorio}
                            className="usu-opcion"
                          >
                            <input
                              type="checkbox"
                              checked={formulario.laboratorios.includes(
                                laboratorio.id_laboratorio
                              )}
                              onChange={(e) =>
                                cambiarLaboratorio(
                                  laboratorio.id_laboratorio,
                                  e.target.checked
                                )
                              }
                            />

                            <span>
                              {laboratorio.nombre}
                              <small>
                                {laboratorio.nombre_sede}
                                {' · '}
                                {laboratorio.codigo}
                              </small>
                            </span>
                          </label>
                        )
                      )}
                    </div>
                  )}
                </fieldset>
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
          </>
        )}
      </dialog>
    </div>
  );
}