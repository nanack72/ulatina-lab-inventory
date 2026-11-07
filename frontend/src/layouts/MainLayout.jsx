import { useState } from 'react';

import Sidebar from '../components/Sidebar';
import Inventario from '../pages/Inventario';
import EquipoDetalle from '../pages/EquipoDetalle';
import RegistrarEquipo from '../pages/RegistrarEquipo';
import EditarEquipo from '../pages/EditarEquipo';
import TrasladarEquipo from '../pages/TrasladarEquipo';

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
// NORMALIZAR EL ROL DEL USUARIO
// ==========================================

function normalizarRol(rol) {
  const nombre =
    typeof rol === 'object' && rol !== null
      ? rol?.nombre ?? rol?.nombre_rol ?? ''
      : rol ?? '';

  return String(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function MainLayout({
  usuario,
  token,
  cerrarSesion,
}) {
  // Página seleccionada desde el sidebar.
  const [paginaActual, cambiarPagina] = useState('inicio');

  // Equipo seleccionado.
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);

  // Pantallas del inventario.
  const [registrandoEquipo, setRegistrandoEquipo] = useState(false);
  const [editandoEquipo, setEditandoEquipo] = useState(false);
  const [trasladandoEquipo, setTrasladandoEquipo] = useState(false);

  // ========================================
  // PERMISOS DEL USUARIO
  // ========================================

  const rol = normalizarRol(usuario?.rol);

  // El backend sigue siendo responsable de
  // verificar los permisos reales.
  const usuarioPuedeModificar =
    rol === 'superadministrador' ||
    rol === 'tecnico';

  const nombrePagina =
    nombresPaginas[paginaActual] || 'Inicio';

  // ========================================
  // VER DETALLE DE UN EQUIPO
  // ========================================

  function verEquipo(equipo) {
    const id = equipo?.id_equipo ?? equipo?.id;

    if (id === undefined || id === null) {
      console.error('El equipo no tiene identificador.');
      return;
    }

    setRegistrandoEquipo(false);
    setEditandoEquipo(false);
    setTrasladandoEquipo(false);

    setEquipoSeleccionado(id);
  }

  // ========================================
  // EDITAR EQUIPO
  // ========================================

  function editarEquipo(equipo) {
    if (!usuarioPuedeModificar) return;

    const id = equipo?.id_equipo ?? equipo?.id;

    if (id === undefined || id === null) {
      console.error('El equipo no tiene identificador.');
      return;
    }

    setRegistrandoEquipo(false);
    setTrasladandoEquipo(false);

    setEquipoSeleccionado(id);
    setEditandoEquipo(true);
  }

  // ========================================
  // TRASLADAR EQUIPO
  // ========================================

  function abrirTraslado(equipo) {
    if (!usuarioPuedeModificar) return;

    const id = equipo?.id_equipo ?? equipo?.id;

    if (id === undefined || id === null) {
      console.error('El equipo no tiene identificador.');
      return;
    }

    setRegistrandoEquipo(false);
    setEditandoEquipo(false);

    setEquipoSeleccionado(id);
    setTrasladandoEquipo(true);
  }

  // ========================================
  // REGISTRAR EQUIPO
  // ========================================

  function abrirRegistro() {
    if (!usuarioPuedeModificar) return;

    setEquipoSeleccionado(null);

    setEditandoEquipo(false);
    setTrasladandoEquipo(false);
    setRegistrandoEquipo(true);
  }

  // ========================================
  // VOLVER AL INVENTARIO
  // ========================================

  function volverAlInventario() {
    setEquipoSeleccionado(null);

    setRegistrandoEquipo(false);
    setEditandoEquipo(false);
    setTrasladandoEquipo(false);
  }

  // ========================================
  // FINALIZAR UNA OPERACIÓN
  // ========================================

  function guardarCompletado() {
    // Al regresar, Inventario se monta de
    // nuevo y consulta los equipos actualizados.
    volverAlInventario();
  }

  // ========================================
  // NAVEGACIÓN DEL SIDEBAR
  // ========================================

  function navegarA(pagina) {
    volverAlInventario();
    cambiarPagina(pagina);
  }

  // ========================================
  // TÍTULO DEL ENCABEZADO
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

      if (equipoSeleccionado !== null) {
        return 'Detalle del equipo';
      }
    }

    return nombrePagina;
  }

  // ========================================
  // CONTENIDO DE CADA PÁGINA
  // ========================================

  function renderizarContenido() {
    if (paginaActual === 'inventario') {

      // REGISTRAR EQUIPO
      if (registrandoEquipo) {
        return (
          <RegistrarEquipo
            token={token}
            onCancelar={volverAlInventario}
            onRegistrado={guardarCompletado}
          />
        );
      }

      // TRASLADAR EQUIPO
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

      // EDITAR EQUIPO
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

      // VER DETALLE DEL EQUIPO
      if (equipoSeleccionado !== null) {
        return (
          <EquipoDetalle
            key={equipoSeleccionado}
            idEquipo={equipoSeleccionado}
            token={token}
            onVolver={volverAlInventario}
          />
        );
      }

      // LISTADO DEL INVENTARIO
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
  // ESTRUCTURA PRINCIPAL DEL SISTEMA
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

        {/* ENCABEZADO SUPERIOR */}
        <header className="main-header">
          <div>
            <span className="main-breadcrumb">
              Sistema /{' '}
            </span>

            <strong>
              {obtenerTitulo()}
            </strong>
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

        {/* PÁGINA ACTUAL */}
        <section className="main-page">
          {renderizarContenido()}
        </section>

      </main>
    </div>
  );
}
