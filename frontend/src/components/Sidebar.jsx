import {
  House,
  Package,
  Wrench,
  TriangleAlert,
  History,
  ChartNoAxesColumn,
  Users,
  Settings,
  LogOut
} from 'lucide-react';

import logoBlanco from '../assets/images/logo-ulatina-blanco.png';
import '../styles/sidebar.css';

const opcionesPrincipales = [
  { id: 'inicio', nombre: 'Inicio', Icono: House },
  { id: 'inventario', nombre: 'Inventario', Icono: Package },
  { id: 'mantenimiento', nombre: 'Mantenimiento', Icono: Wrench },
  { id: 'incidencias', nombre: 'Incidencias', Icono: TriangleAlert },
  { id: 'historial', nombre: 'Historial', Icono: History },
  { id: 'reportes', nombre: 'Reportes', Icono: ChartNoAxesColumn }
];

const opcionesAdministracion = [
  { id: 'usuarios', nombre: 'Usuarios', Icono: Users },
  { id: 'configuracion', nombre: 'Configuración', Icono: Settings }
];

// "Carlos Rodríguez" -> "CR"
function obtenerIniciales(nombre) {
  const letras = String(nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase());

  return letras.join('') || '?';
}

export default function Sidebar({
  paginaActual,
  cambiarPagina,
  usuario,
  cerrarSesion
}) {
  const esSuperadministrador =
    usuario?.rol?.trim().toLowerCase() === 'superadministrador';

  const nombreUsuario = usuario?.nombre?.trim() || 'Mi perfil';
  const perfilActivo = paginaActual === 'perfil';

  const renderizarOpcion = ({ id, nombre, Icono }) => (
    <button
      key={id}
      type="button"
      className={`sidebar-link ${
        paginaActual === id ? 'sidebar-link-active' : ''
      }`}
      onClick={() => cambiarPagina(id)}
      aria-current={paginaActual === id ? 'page' : undefined}
    >
      <span className="sidebar-link-icono">
        <Icono size={18} strokeWidth={1.9} aria-hidden="true" />
      </span>

      <span className="sidebar-link-texto">{nombre}</span>
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img
          src={logoBlanco}
          alt="Universidad Latina de Costa Rica"
          className="sidebar-logo"
        />
      </div>

      <nav className="sidebar-navigation" aria-label="Menú principal">
        <div className="sidebar-grupo">
          <span className="sidebar-section-title">PRINCIPAL</span>

          <div className="sidebar-menu">
            {opcionesPrincipales.map(renderizarOpcion)}
          </div>
        </div>
      </nav>

      {esSuperadministrador && (
        <nav
          className="sidebar-grupo sidebar-admin"
          aria-label="Administración"
        >
          <span className="sidebar-section-title">
            ADMINISTRACIÓN
          </span>

          <div className="sidebar-menu">
            {opcionesAdministracion.map(renderizarOpcion)}
          </div>
        </nav>
      )}

      <div className="sidebar-bottom">
        <button
          type="button"
          className={`sidebar-perfil ${
            perfilActivo ? 'sidebar-perfil-active' : ''
          }`}
          onClick={() => cambiarPagina('perfil')}
          aria-current={perfilActivo ? 'page' : undefined}
          aria-label={`Mi perfil: ${nombreUsuario}`}
          title={nombreUsuario}
        >
          <span className="sidebar-avatar" aria-hidden="true">
            {obtenerIniciales(usuario?.nombre)}
          </span>

          <span className="sidebar-perfil-texto">
            <strong>{nombreUsuario}</strong>
            {usuario?.rol && <small>{usuario.rol}</small>}
          </span>
        </button>

        <button
          type="button"
          className="sidebar-link sidebar-logout"
          onClick={cerrarSesion}
        >
          <span className="sidebar-link-icono">
            <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>

          <span className="sidebar-link-texto">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}