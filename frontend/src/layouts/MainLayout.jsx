import { useState } from 'react';

import Sidebar from '../components/Sidebar';
import Inventario from '../pages/Inventario';
import EquipoDetalle from '../pages/EquipoDetalle';
import RegistrarEquipo from '../pages/RegistrarEquipo';
import EditarEquipo from '../pages/EditarEquipo';
import TrasladarEquipo from '../pages/TrasladarEquipo';
import CambiarEstadoEquipo from '../pages/CambiarEstadoEquipo';

// ==========================================
// NOMBRES DE LAS PÁGINAS
// ==========================================

const nombresPaginas = {
  inicio: 'Inicio',
  inventario: 'Inventario',
  mantenimiento: 'Mantenimiento',
  incidencias: 'Incidencias',
  historial: 'Historial',
  reportes: 'Reportes',
  usuarios: 'Usuarios',
  configuracion: 'Configuración',
  perfil: 'Mi perfil',
};

// ==========================================
// NORMALIZAR ROL
// ==========================================

function normalizarRol(rol) {
  const nombre =
    typeof rol === 'object' && rol !== null
      ? rol.nombre ?? rol.nombre_rol ?? ''
      : rol ?? '';

  return String(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function obtenerIdEquipo(equipo) {
  const id = Number(
    equipo?.id_equipo ?? equipo?.id
  );

  if (!Number.isSafeInteger(id) || id <= 0) {
    console.error(
      'El equipo no tiene un identificador válido.'
    );
    return null;
  }

  return id;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function MainLayout({
  usuario,
  token,
  cerrarSesion,
}) {
  const [paginaActual, cambiarPagina] = useState('inicio');

  const [equipoSeleccionado, setEquipoSeleccionado] =
    useState(null);

  const [registrandoEquipo, setRegistrandoEquipo] =
    useState(false);

  const [editandoEquipo, setEditandoEquipo] =
    useState(false);

  const [trasladandoEquipo, setTrasladandoEquipo] =
    useState(false);

  const [cambiandoEstado, setCambiandoEstado] =
    useState(false);

  // ========================================
  // PERMISOS
  // ========================================

  const rol = normalizarRol(usuario?.rol);

  // El backend es quien autoriza realmente
  // las operaciones mediante JWT.
  const usuarioPuedeModificar =
    rol === 'superadministrador' ||
    rol === 'tecnico';

  const nombrePagina =
    nombresPaginas[paginaActual] || 'Inicio';

  // ========================================
  // CERRAR PANTALLAS DEL INVENTARIO
  // ========================================

  function cerrarPantallasInventario() {
    setEquipoSeleccionado(null);
    setRegistrandoEquipo(false);
    setEditandoEquipo(false);
    setTrasladandoEquipo(false);
    setCambiandoEstado(false);
  }

  // ========================================
  // VER DETALLE
  // ========================================

  function verEquipo(equipo) {
    const id = obtenerIdEquipo(equipo);

    if (id === null) return;

    cerrarPantallasInventario();
    setEquipoSeleccionado(id);
  }

  // ========================================
  // REGISTRAR
  // ========================================

  function abrirRegistro() {
    if (!usuarioPuedeModificar) return;

    cerrarPantallasInventario();
    setRegistrandoEquipo(true);
  }

  // ========================================
  // EDITAR
  // ========================================

  function editarEquipo(equipo) {
    if (!usuarioPuedeModificar) return;

    const id = obtenerIdEquipo(equipo);

    if (id === null) return;

    cerrarPantallasInventario();
    setEquipoSeleccionado(id);
    setEditandoEquipo(true);
  }

  // ========================================
  // TRASLADAR
  // ========================================

  function abrirTraslado(equipo) {
    if (!usuarioPuedeModificar) return;

    const id = obtenerIdEquipo(equipo);

    if (id === null) return;

    cerrarPantallasInventario();
    setEquipoSeleccionado(id);
    setTrasladandoEquipo(true);
  }

  // ========================================
  // CAMBIAR ESTADO
  // ========================================

  function abrirCambioEstado(equipo) {
    if (!usuarioPuedeModificar) return;

    const id = obtenerIdEquipo(equipo);

    if (id === null) return;

    cerrarPantallasInventario();
    setEquipoSeleccionado(id);
    setCambiandoEstado(true);
  }

  // ========================================
  // VOLVER AL INVENTARIO
  // ========================================

  function volverAlInventario() {
    cerrarPantallasInventario();
  }

  function guardarCompletado() {
    // Al volver a montar Inventario,
    // se consultan de nuevo los equipos.
    volverAlInventario();
  }

  // ========================================
  // NAVEGACIÓN DEL SIDEBAR
  // ========================================

  function navegarA(pagina) {
    cerrarPantallasInventario();
    cambiarPagina(pagina);
  }

  // ========================================
  // TÍTULO DE LA PANTALLA
  // ========================================

  function obtenerTitulo() {
    if (paginaActual === 'inventario') {
      if (registrandoEquipo) {
        return 'Registrar equipo';
      }

      if (editandoEquipo) {
        return 'Editar equipo';
      }

      if (trasladandoEquipo) {
        return 'Trasladar equipo';
      }

      if (cambiandoEstado) {
        return 'Cambiar estado del equipo';
      }

      if (equipoSeleccionado !== null) {
        return 'Detalle del equipo';
      }
    }

    return nombrePagina;
  }

  // ========================================
  // MOSTRAR CONTENIDO
  // ========================================

  function renderizarContenido() {
    if (paginaActual === 'inventario') {

      // REGISTRO
      if (registrandoEquipo) {
        return (
          <RegistrarEquipo
            token={token}
            onCancelar={volverAlInventario}
            onRegistrado={guardarCompletado}
          />
        );
      }

      // CAMBIO DE ESTADO
      if (
        cambiandoEstado &&
        equipoSeleccionado !== null
      ) {
        return (
          <CambiarEstadoEquipo
            key={equipoSeleccionado}
            idEquipo={equipoSeleccionado}
            token={token}
            onCancelar={volverAlInventario}
            onActualizado={guardarCompletado}
          />
        );
      }

      // TRASLADO
      if (
        trasladandoEquipo &&
        equipoSeleccionado !== null
      ) {
        return (
          <TrasladarEquipo
            key={equipoSeleccionado}
            idEquipo={equipoSeleccionado}
            token={token}
            onCancelar={volverAlInventario}
            onTrasladado={guardarCompletado}
          />
        );
      }

      // EDICIÓN
      if (
        editandoEquipo &&
        equipoSeleccionado !== null
      ) {
        return (
          <EditarEquipo
            key={equipoSeleccionado}
            idEquipo={equipoSeleccionado}
            token={token}
            onCancelar={volverAlInventario}
            onActualizado={guardarCompletado}
          />
        );
      }

      // DETALLE DEL EQUIPO
      if (equipoSeleccionado !== null) {
        return (
          <EquipoDetalle
            key={equipoSeleccionado}
            idEquipo={equipoSeleccionado}
            token={token}
            onVolver={volverAlInventario}
            onEditar={
              usuarioPuedeModificar
                ? editarEquipo
                : undefined
            }
            onTrasladar={
              usuarioPuedeModificar
                ? abrirTraslado
                : undefined
            }
            onCambiarEstado={
              usuarioPuedeModificar
                ? abrirCambioEstado
                : undefined
            }
          />
        );
      }


      // LISTADO DE INVENTARIO
      return (
        <Inventario
          token={token}
          onVerEquipo={verEquipo}
          puedeRegistrar={usuarioPuedeModificar}
          onRegistrarEquipo={abrirRegistro}
          onEditarEquipo={
            usuarioPuedeModificar
              ? editarEquipo
              : undefined
          }
          onTrasladarEquipo={
            usuarioPuedeModificar
              ? abrirTraslado
              : undefined
          }
          onCambiarEstadoEquipo={
            usuarioPuedeModificar
              ? abrirCambioEstado
              : undefined
          }
        />
      );
    }

    // OTRAS PÁGINAS
    return (
      <>
        <h1>{nombrePagina}</h1>

        <p>
          {paginaActual === 'inicio'
            ? `Bienvenido al sistema, ${usuario?.nombre || 'usuario'}.`
            : `Estamos preparando la sección de ${nombrePagina.toLowerCase()}.`}
        </p>
      </>
    );
  }

  // ========================================
  // ESTRUCTURA GENERAL DEL SISTEMA
  // ========================================

  return (
    <div className="main-layout">

      {/* SIDEBAR */}
      <Sidebar
        paginaActual={paginaActual}
        cambiarPagina={navegarA}
        usuario={usuario}
        cerrarSesion={cerrarSesion}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="main-content">

        <header className="main-header">
          <div>
            <span className="main-breadcrumb">
              Sistema /{' '}
            </span>

            <strong>{obtenerTitulo()}</strong>
          </div>

          <div className="main-user">
            <strong>
              {usuario?.nombre || 'Usuario'}
            </strong>

            <span>
              {typeof usuario?.rol === 'string'
                ? usuario.rol
                : usuario?.rol?.nombre || ''}
            </span>
          </div>
        </header>

        <section className="main-page">
          {renderizarContenido()}
        </section>

      </main>
    </div>
  );
}
