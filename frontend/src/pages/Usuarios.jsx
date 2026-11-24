import Paginacion from '../components/inventario/Paginacion';
import Notificacion from '../components/comunes/Notificacion';
import { useEffect, useRef, useState } from 'react';
import { Search, RefreshCw, Plus, Pencil, ChevronLeft, ChevronRight, ShieldCheck, Trash2 } from 'lucide-react';

import {
  obtenerUsuarios,
  obtenerOpcionesUsuarios,
  guardarUsuario,
} from '../services/usuariosService';

import { generarPaginas } from '../utils/inventario';
import { filtrarUsuarios } from '../utils/filtrosUsuarios';
import { asignarSedes, asignarLaboratorios, filtrarLaboratorios } from '../utils/asignacionesUsuarios';
import BajaUsuario from '../components/BajaUsuario';
import Configuracion from './Configuracion';

import '../styles/inventario.css';
import '../styles/configuracion.css';
import '../styles/usuarios.css';

const LABORATORIOS_POR_PAGINA = 5;

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
    puede_eliminar_equipos: false,
    sedes: [],
    laboratorios: [],
  };
}

export default function Usuarios({ token, usuarioActual }) {
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioBaja, setUsuarioBaja] = useState(null);
  const [viendoRoles, setViendoRoles] = useState(false);
  const [opciones, setOpciones] = useState({
    roles: [],
    sedes: [],
    laboratorios: [],
  });

  const [busqueda, setBusqueda] = useState('');
  const [busquedaLaboratorios, setBusquedaLaboratorios] = useState('');
  const [filtroSedeLaboratorios, setFiltroSedeLaboratorios] = useState('');
  const [paginaLaboratorios, setPaginaLaboratorios] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [filtrosUsuarios, setFiltrosUsuarios] = useState({ rol: '', sede: '', estado: '' });

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
    setBusquedaLaboratorios('');
    setFiltroSedeLaboratorios('');
    setPaginaLaboratorios(1);
    setUsuarioEditando(null);
    setFormulario(formularioInicial());
    setErrorFormulario('');
    setModalAbierto(true);
  }

  function abrirEdicion(usuario) {
    setBusquedaLaboratorios('');
    setFiltroSedeLaboratorios('');
    setPaginaLaboratorios(1);
    setUsuarioEditando(usuario);

    setFormulario({
      nombre_completo: usuario.nombre_completo,
      correo_institucional: usuario.correo_institucional,
      id_rol: String(usuario.id_rol),
      contrasena: '',
      activo: usuario.activo,
      permiso_inventario:
        usuario.permiso_inventario ?? 'consulta',
      puede_eliminar_equipos: usuario.puede_eliminar_equipos === true,
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
    if (!seleccionada && filtroSedeLaboratorios === String(idSede)) setFiltroSedeLaboratorios('');
    setPaginaLaboratorios(1);
    setFormulario(anterior => asignarSedes(
      anterior,
      seleccionada ? [...anterior.sedes, idSede] : anterior.sedes.filter(id => id !== idSede),
      opciones.laboratorios
    ));
  }

  function cambiarTodasSedes(seleccionar) {
    if (!seleccionar) setFiltroSedeLaboratorios('');
    setPaginaLaboratorios(1);
    setFormulario(anterior => asignarSedes(
      anterior,
      seleccionar ? opciones.sedes.map(sede => sede.id_sede) : [],
      opciones.laboratorios
    ));
  }

  function cambiarLaboratorio(idLaboratorio, seleccionado) {
    setFormulario(anterior => asignarLaboratorios(anterior, [idLaboratorio], opciones.laboratorios, seleccionado));
  }

  function cambiarTodosLaboratorios(seleccionar) {
    setFormulario(anterior => asignarLaboratorios(
      anterior,
      laboratoriosFiltrados.map(laboratorio => laboratorio.id_laboratorio),
      opciones.laboratorios,
      seleccionar
    ));
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
        puede_eliminar_equipos: esRolSuperadministrador || formulario.puede_eliminar_equipos,
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

  const filtrados = filtrarUsuarios(usuarios, { ...filtrosUsuarios, busqueda });
  const hayFiltrosUsuarios = Boolean(busqueda.trim() || filtrosUsuarios.rol || filtrosUsuarios.sede || filtrosUsuarios.estado);

  const total = filtrados.length;
  const totalPaginas = Math.max(
    1,
    Math.ceil(total / limite)
  );

  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * limite;
  const visibles = filtrados.slice(
    inicio,
    inicio + limite
  );

  const laboratoriosDisponibles = opciones.laboratorios.filter(
    (laboratorio) =>
      formulario.sedes.includes(laboratorio.id_sede)
  );

  const sedesParaFiltrar = opciones.sedes.filter(sede => formulario.sedes.includes(sede.id_sede));
  const sedeLaboratoriosActiva = sedesParaFiltrar.some(sede => String(sede.id_sede) === filtroSedeLaboratorios)
    ? filtroSedeLaboratorios : '';
  const hayFiltroLaboratorios = Boolean(busquedaLaboratorios.trim() || sedeLaboratoriosActiva);
  const laboratoriosDeSede = sedeLaboratoriosActiva
    ? laboratoriosDisponibles.filter(laboratorio => String(laboratorio.id_sede) === sedeLaboratoriosActiva)
    : laboratoriosDisponibles;
  const laboratoriosFiltrados = filtrarLaboratorios(laboratoriosDeSede, busquedaLaboratorios);
  const paginasLaboratorios = Math.max(1, Math.ceil(laboratoriosFiltrados.length / LABORATORIOS_POR_PAGINA));
  const paginaLaboratoriosActual = Math.min(paginaLaboratorios, paginasLaboratorios);
  const inicioLaboratorios = (paginaLaboratoriosActual - 1) * LABORATORIOS_POR_PAGINA;
  const finLaboratorios = Math.min(inicioLaboratorios + LABORATORIOS_POR_PAGINA, laboratoriosFiltrados.length);
  const laboratoriosPagina = laboratoriosFiltrados.slice(inicioLaboratorios, finLaboratorios);

  const sedesSeleccionadas = opciones.sedes.filter(sede => formulario.sedes.includes(sede.id_sede)).length;
  const laboratoriosSeleccionados = laboratoriosDisponibles.filter(lab => formulario.laboratorios.includes(lab.id_laboratorio)).length;
  const seleccionadosVisibles = laboratoriosFiltrados.filter(lab => formulario.laboratorios.includes(lab.id_laboratorio)).length;

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

  if (viendoRoles) return <>
    <button type="button" className="usu-volver" onClick={() => { setViendoRoles(false); setRecarga(v => v + 1); }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
      </svg>
      Volver a usuarios
    </button>
    <Configuracion token={token} soloRoles />
  </>;

  return (
    <div className="cfg-pagina usu-pagina">
      <div className="inv-encabezado">
        <div className="inv-encabezado-texto">
          <h1>Usuarios</h1>
          <p>
            Administre las cuentas, roles, permisos de inventario
            y asignaciones de acceso.
          </p>
        </div>
      
        <div className="inv-acciones">
            <button
              type="button"
              className="btn btn-lg btn-icono"
              title="Actualizar usuarios"
              aria-label="Actualizar usuarios"
              disabled={cargando}
              onClick={() =>
                setRecarga((valor) => valor + 1)
              }
            >
              <RefreshCw size={17} />
            </button>

            <button type="button" className="btn btn-lg btn-contorno" onClick={() => setViendoRoles(true)}>Gestionar roles</button>

            <button
              type="button"
              className="btn btn-lg btn-primario"
              disabled={cargando || Boolean(error)}
              onClick={abrirRegistro}
            >
              <Plus size={17} />
              Registrar usuario
            </button>
          </div>
      </div>

      {mensaje && (
        <Notificacion tipo="exito">
          {mensaje}
        </Notificacion>
      )}

      <section
        className="inv-contenedor"
        aria-label="Usuarios registrados"
      >
        <div className="inv-barra-filtros">
          <label className="inv-buscador">
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

          <div className="inv-selectores usu-filtros-listado">
            <label>
              <span className="inv-sr-only">Filtrar usuarios por rol</span>
              <select className="usu-filtro-listado" value={filtrosUsuarios.rol} disabled={cargando}
                onChange={evento => { setFiltrosUsuarios(anterior => ({ ...anterior, rol: evento.target.value })); setPagina(1); }}>
                <option value="">Todos los roles</option>
                {opciones.roles.map(rol => <option key={rol.id_rol} value={String(rol.id_rol)}>{rol.nombre}</option>)}
              </select>
            </label>
            <label>
              <span className="inv-sr-only">Filtrar usuarios por sede</span>
              <select className="usu-filtro-listado" value={filtrosUsuarios.sede} disabled={cargando}
                onChange={evento => { setFiltrosUsuarios(anterior => ({ ...anterior, sede: evento.target.value })); setPagina(1); }}>
                <option value="">Todas las sedes</option>
                {opciones.sedes.map(sede => <option key={sede.id_sede} value={String(sede.id_sede)}>{sede.nombre}</option>)}
              </select>
            </label>
            <label>
              <span className="inv-sr-only">Filtrar usuarios por estado de la cuenta</span>
              <select className="usu-filtro-listado" value={filtrosUsuarios.estado} disabled={cargando}
                onChange={evento => { setFiltrosUsuarios(anterior => ({ ...anterior, estado: evento.target.value })); setPagina(1); }}>
                <option value="">Todos los estados</option>
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
              </select>
            </label>
            {hayFiltrosUsuarios && (
              <button type="button" className="inv-limpiar" onClick={() => {
                setBusqueda('');
                setFiltrosUsuarios({ rol: '', sede: '', estado: '' });
                setPagina(1);
              }}>Limpiar filtros</button>
            )}
          </div>
        </div>

        {error ? (
          <Notificacion tipo="error">
            
            <span>{error}</span>
          </Notificacion>
        ) : cargando ? (
          <div className="cfg-mensaje" role="status">
            Cargando usuarios...
          </div>
        ) : (
          <>
            <div className="inv-tabla-contenedor">
              <table className="inv-tabla usu-tabla">
                <thead>
                  <tr>
                    
                    <th scope="col">Nombre</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    
                  <th scope="col" className="cfg-columna-acciones">Acciones</th>
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

                        
                      <td className="cfg-columna-acciones">
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
                            <button type="button" className="cfg-icono usu-accion-baja"
                              title={Number(usuario.id_usuario) === Number(usuarioActual?.idUsuario)
                                ? 'No puede dar de baja su propia cuenta' : 'Eliminar o desactivar usuario'}
                              aria-label={`Eliminar o desactivar ${usuario.nombre_completo}`}
                              disabled={Number(usuario.id_usuario) === Number(usuarioActual?.idUsuario)}
                              onClick={() => setUsuarioBaja(usuario)}>
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Paginacion pagina={paginaActual} total={total} limite={limite}
              singular="usuario" plural="usuarios" onCambiar={setPagina}
              onCambiarLimite={(valor) => { setLimite(valor); setPagina(1); }} />
          </>
        )}
      </section>

      {usuarioBaja && <BajaUsuario usuario={usuarioBaja} token={token}
        onCerrar={() => setUsuarioBaja(null)}
        onCompletada={resultado => {
          setUsuarioBaja(null);
          setMensaje(resultado.message);
          setRecarga(valor => valor + 1);
        }} />}

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
              <Notificacion tipo="error" alCerrar={() => setErrorFormulario('')}>
                {errorFormulario}
              </Notificacion>
            )}

            <form onSubmit={guardar}>
              <fieldset
                className="cfg-formulario usu-formulario"
                disabled={guardando}
              >
                <label className="cfg-campo usu-dato-basico">
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

                <label className="cfg-campo usu-dato-basico">
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

                <label className={`usu-permiso${esSuperadministrador || formulario.puede_eliminar_equipos ? ' usu-permiso-activo' : ''}`}>
                  <input
                    type="checkbox"
                    checked={esSuperadministrador || formulario.puede_eliminar_equipos}
                    disabled={esSuperadministrador}
                    aria-describedby="usu-permiso-eliminar-ayuda"
                    onChange={(e) => cambiarCampo('puede_eliminar_equipos', e.target.checked)}
                  />
                  <span className="usu-permiso-contenido">
                    <strong>Eliminar y restaurar equipos</strong>
                    <small id="usu-permiso-eliminar-ayuda">
                      {esSuperadministrador
                        ? 'El Superadministrador tiene este permiso habilitado de forma permanente.'
                        : 'Permite retirar y recuperar equipos de los laboratorios asignados. Sus datos, fotos e historiales se conservan.'}
                    </small>
                  </span>
                  <span className="usu-permiso-estado" aria-hidden="true">
                    {esSuperadministrador || formulario.puede_eliminar_equipos ? 'Habilitado' : 'Deshabilitado'}
                  </span>
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

                {esSuperadministrador ? (
                  <div className="usu-acceso-global">
                    <ShieldCheck size={23} aria-hidden="true" />
                    <div>
                      <strong>Acceso a todas las sedes y laboratorios</strong>
                      <p>El rol Superadministrador incluye acceso automático, también a las sedes y laboratorios que se agreguen después.</p>
                    </div>
                  </div>
                ) : (
                <div className="usu-asignaciones-grid">
                  <fieldset className="usu-asignaciones">
                    <legend>Sedes asignadas</legend>
                    <div className="usu-seleccion-cabecera">
                      <span className="usu-contador" role="status">{sedesSeleccionadas} de {opciones.sedes.length} seleccionadas</span>
                      <div className="usu-seleccion-botones">
                        <button type="button" className="btn btn-contorno btn-sm"
                          disabled={opciones.sedes.length === 0 || sedesSeleccionadas === opciones.sedes.length}
                          onClick={() => cambiarTodasSedes(true)}>Seleccionar todas</button>
                        <button type="button" className="btn btn-secundario btn-sm"
                          disabled={sedesSeleccionadas === 0}
                          onClick={() => cambiarTodasSedes(false)}>Quitar todas</button>
                      </div>
                    </div>
                    {opciones.sedes.length === 0 ? (
                      <p className="usu-ayuda">No hay sedes registradas.</p>
                    ) : (
                      <div className="usu-lista-opciones" role="group" aria-label="Opciones de sedes">
                        {opciones.sedes.map(sede => (
                          <label key={sede.id_sede} className="usu-opcion">
                            <input type="checkbox" checked={formulario.sedes.includes(sede.id_sede)}
                              onChange={e => cambiarSede(sede.id_sede, e.target.checked)} />
                            <span>{sede.nombre}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>

                  <fieldset className="usu-asignaciones">
                    <legend>Laboratorios asignados</legend>
                    <div className="usu-seleccion-cabecera">
                      <span className="usu-contador" role="status">{laboratoriosSeleccionados} de {laboratoriosDisponibles.length} asignados</span>
                      <div className="usu-seleccion-botones">
                        <button type="button" className="btn btn-contorno btn-sm"
                          disabled={laboratoriosFiltrados.length === 0 || seleccionadosVisibles === laboratoriosFiltrados.length}
                          onClick={() => cambiarTodosLaboratorios(true)}>
                          {hayFiltroLaboratorios ? 'Seleccionar resultados' : 'Seleccionar todos'}
                        </button>
                        <button type="button" className="btn btn-secundario btn-sm"
                          disabled={seleccionadosVisibles === 0}
                          onClick={() => cambiarTodosLaboratorios(false)}>
                          {hayFiltroLaboratorios ? 'Quitar resultados' : 'Quitar todos'}
                        </button>
                      </div>
                    </div>
                    <div className="usu-filtros-laboratorios">
                    <label className="usu-buscador-laboratorios">
                      <Search size={16} aria-hidden="true" />
                      <span className="inv-sr-only">Buscar laboratorios por nombre, código o sede</span>
                      <input type="search" placeholder="Buscar por nombre, código o sede…"
                        autoComplete="off" maxLength={150}
                        value={busquedaLaboratorios}
                        disabled={laboratoriosDisponibles.length === 0}
                        onChange={e => { setBusquedaLaboratorios(e.target.value); setPaginaLaboratorios(1); }} />
                    </label>
                    <label className="usu-filtro-sede-laboratorios">
                      <span className="inv-sr-only">Filtrar laboratorios por sede asignada</span>
                      <select
                        value={sedeLaboratoriosActiva}
                        disabled={sedesParaFiltrar.length === 0}
                        onChange={evento => {
                          setFiltroSedeLaboratorios(evento.target.value);
                          setPaginaLaboratorios(1);
                        }}
                      >
                        <option value="">Todas las sedes</option>
                        {sedesParaFiltrar.map(sede => (
                          <option key={sede.id_sede} value={String(sede.id_sede)}>{sede.nombre}</option>
                        ))}
                      </select>
                    </label>
                    </div>
                    {hayFiltroLaboratorios && laboratoriosDisponibles.length > 0 && (
                      <p className="usu-ayuda usu-resultados" role="status">
                        {laboratoriosFiltrados.length} resultados. Los botones solo afectan estos resultados.
                      </p>
                    )}
                    {formulario.sedes.length === 0 ? (
                      <p className="usu-ayuda">Seleccione primero una sede.</p>
                    ) : laboratoriosDisponibles.length === 0 ? (
                      <p className="usu-ayuda">Las sedes seleccionadas no tienen laboratorios.</p>
                    ) : laboratoriosFiltrados.length === 0 ? (
                      <p className="usu-ayuda">No se encontraron laboratorios con los filtros seleccionados.</p>
                    ) : (
                      <div className="usu-lista-opciones usu-lista-laboratorios" role="group" aria-label="Opciones de laboratorios">
                        {laboratoriosPagina.map(laboratorio => (
                          <label key={laboratorio.id_laboratorio} className="usu-opcion">
                            <input type="checkbox"
                              checked={formulario.laboratorios.includes(laboratorio.id_laboratorio)}
                              onChange={e => cambiarLaboratorio(laboratorio.id_laboratorio, e.target.checked)} />
                            <span>{laboratorio.nombre}
                              <small>{laboratorio.nombre_sede}{' · '}{laboratorio.codigo}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    {laboratoriosFiltrados.length > 0 && (
                      <div className="usu-pie-laboratorios">
                        <span className="usu-contador" role="status">
                          Mostrando {inicioLaboratorios + 1}–{finLaboratorios} de {laboratoriosFiltrados.length}
                        </span>
                        <nav className="usu-paginacion-laboratorios" aria-label="Páginas de laboratorios asignables">
                          <button type="button" aria-label="Página anterior de laboratorios"
                            disabled={paginaLaboratoriosActual <= 1}
                            onClick={() => setPaginaLaboratorios(paginaLaboratoriosActual - 1)}>
                            <ChevronLeft size={15} aria-hidden="true" />
                          </button>
                          {generarPaginas(paginaLaboratoriosActual, paginasLaboratorios).map((numero, indice) => (
                            numero === '...' ? <span key={`puntos-labs-${indice}`} aria-hidden="true">…</span> : (
                              <button type="button" key={numero}
                                className={paginaLaboratoriosActual === numero ? 'activa' : ''}
                                aria-label={`Página ${numero} de laboratorios`}
                                aria-current={paginaLaboratoriosActual === numero ? 'page' : undefined}
                                onClick={() => setPaginaLaboratorios(numero)}>
                                {numero}
                              </button>
                            )
                          ))}
                          <button type="button" aria-label="Página siguiente de laboratorios"
                            disabled={paginaLaboratoriosActual >= paginasLaboratorios}
                            onClick={() => setPaginaLaboratorios(paginaLaboratoriosActual + 1)}>
                            <ChevronRight size={15} aria-hidden="true" />
                          </button>
                        </nav>
                      </div>
                    )}
                  </fieldset>
                </div>
                )}
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

                <button
                  type="submit"
                  className="btn btn-primario"
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
