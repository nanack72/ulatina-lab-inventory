import { useState } from 'react';

import Sidebar from '../components/Sidebar';
import Inicio from '../pages/Inicio';
import Inventario from '../pages/Inventario';
import EquipoDetalle from '../pages/EquipoDetalle';
import RegistrarEquipo from '../pages/RegistrarEquipo';
import EditarEquipo from '../pages/EditarEquipo';
import TrasladarEquipo from '../pages/TrasladarEquipo';
import CambiarEstadoEquipo from '../pages/CambiarEstadoEquipo';
import Historial from '../pages/Historial';
import MiPerfil from '../pages/MiPerfil';
import Configuracion from '../pages/Configuracion';
import Usuarios from '../pages/Usuarios';

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
// FUNCIONES AUXILIARES
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
  const esSuperadministrador = rol === 'superadministrador';

  // El backend valida los permisos actuales en cada operación.
  const usuarioPuedeRegistrar =
    esSuperadministrador ||
    ['registro', 'edicion'].includes(
      usuario?.permiso_inventario
    );

  const usuarioPuedeModificar =
    esSuperadministrador ||
    usuario?.permiso_inventario === 'edicion';

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
    if (!usuarioPuedeRegistrar) return;

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
  // ACCESOS DESDE INICIO
  // ========================================

  function registrarDesdeInicio() {
    if (!usuarioPuedeRegistrar) return;

    cambiarPagina('inventario');
    abrirRegistro();
  }

  function verEquipoDesdeInicio(equipo) {
    const id = obtenerIdEquipo(equipo);

    if (id === null) return;

    cambiarPagina('inventario');
    cerrarPantallasInventario();
    setEquipoSeleccionado(id);
  }

  // ========================================
  // VOLVER AL INVENTARIO
  // ========================================

  function volverAlInventario() {
    cerrarPantallasInventario();
  }

  function guardarCompletado() {
    // Inventario se vuelve a montar y consulta los equipos.
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
      if (registrandoEquipo && usuarioPuedeRegistrar) {
        return 'Registrar equipo';
      }

      if (editandoEquipo && usuarioPuedeModificar) {
        return 'Editar equipo';
      }

      if (trasladandoEquipo && usuarioPuedeModificar) {
        return 'Trasladar equipo';
      }

      if (cambiandoEstado && usuarioPuedeModificar) {
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
      if (registrandoEquipo && usuarioPuedeRegistrar) {
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
        usuarioPuedeModificar &&
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
        usuarioPuedeModificar &&
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
        usuarioPuedeModificar &&
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
          puedeRegistrar={usuarioPuedeRegistrar}
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

    // INICIO
    if (paginaActual === 'inicio') {
      return (
        <Inicio
          usuario={usuario}
          token={token}
          puedeRegistrar={usuarioPuedeRegistrar}
          onRegistrarEquipo={registrarDesdeInicio}
          onVerEquipo={verEquipoDesdeInicio}
          onIrA={navegarA}
          onSesionExpirada={cerrarSesion}
        />
      );
    }

    // HISTORIAL GENERAL
    if (paginaActual === 'historial') {
      return (
        <Historial
          token={token}
          onVerEquipo={verEquipoDesdeInicio}
          onSesionExpirada={cerrarSesion}
        />
      );
    }

    // MI PERFIL
    if (paginaActual === 'perfil') {
      return (
        <MiPerfil
          usuario={usuario}
          token={token}
        />
      );
    }

    // ADMINISTRACIÓN DE USUARIOS
    if (paginaActual === 'usuarios') {
      if (!esSuperadministrador) {
        return (
          <div role="alert">
            No tiene permisos para administrar usuarios.
          </div>
        );
      }

      return (
        <Usuarios
          token={token}
          usuarioActual={usuario}
        />
      );
    }

    // CONFIGURACIÓN
    if (paginaActual === 'configuracion') {
      if (!esSuperadministrador) {
        return (
          <div role="alert">
            No tiene permisos para acceder a Configuración.
          </div>
        );
      }

      return <Configuracion token={token} />;
    }

    // OTRAS PÁGINAS
    return (
      <>
        <h1>{nombrePagina}</h1>
        <p>
          Estamos preparando la sección de{' '}
          {nombrePagina.toLowerCase()}.
        </p>
      </>
    );
  }

  // ========================================
  // ESTRUCTURA GENERAL
  // ========================================

  return (
    <div className="main-layout">
      <Sidebar
        paginaActual={paginaActual}
        cambiarPagina={navegarA}
        usuario={usuario}
        cerrarSesion={cerrarSesion}
      />

      <main className="main-content">
        <header className="main-header">
          <div>
            <span className="main-breadcrumb">
              Sistema /{' '}
            </span>

            <strong>{obtenerTitulo()}</strong>
          </div>

          <div className="main-user">
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