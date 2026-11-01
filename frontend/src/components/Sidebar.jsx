import {
  House,
  Package,
  Wrench,
  TriangleAlert,
  History,
  ChartNoAxesColumn,
  Users,
  Settings,
  CircleUserRound,
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

export default function Sidebar({
  paginaActual,
  cambiarPagina,
  usuario,
  cerrarSesion
}) {
  const esSuperadministrador =
    usuario?.rol?.trim().toLowerCase() === 'superadministrador';

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
      <Icono size={19} strokeWidth={1.8} />
      <span>{nombre}</span>
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
        <div className="sidebar-menu">
          {opcionesPrincipales.map(renderizarOpcion)}
        </div>

        {esSuperadministrador && (
          <div className="sidebar-admin">
            <span className="sidebar-section-title">
              ADMINISTRACIÓN
            </span>

            <div className="sidebar-menu">
              {opcionesAdministracion.map(renderizarOpcion)}
            </div>
          </div>
        )}
      </nav>

      <div className="sidebar-bottom">
        <button
          type="button"
          className={`sidebar-link ${
            paginaActual === 'perfil' ? 'sidebar-link-active' : ''
          }`}
          onClick={() => cambiarPagina('perfil')}
        >
          <CircleUserRound size={19} strokeWidth={1.8} />
          <span>Mi perfil</span>
        </button>

        <button
          type="button"
          className="sidebar-link sidebar-logout"
          onClick={cerrarSesion}
        >
          <LogOut size={19} strokeWidth={1.8} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
