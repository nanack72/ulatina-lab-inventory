import { useState } from 'react';
import Sidebar from '../components/Sidebar';

const nombresPaginas = {
  inicio: 'Inicio',
  inventario: 'Inventario',
  mantenimiento: 'Mantenimiento',
  incidencias: 'Incidencias',
  historial: 'Historial',
  reportes: 'Reportes',
  usuarios: 'Usuarios',
  configuracion: 'Configuración',
  perfil: 'Mi perfil'
};

export default function MainLayout({ usuario, cerrarSesion }) {
  const [paginaActual, cambiarPagina] = useState('inicio');

  const nombrePagina = nombresPaginas[paginaActual] || 'Inicio';

  return (
    <div className="main-layout">
      <Sidebar
        paginaActual={paginaActual}
        cambiarPagina={cambiarPagina}
        usuario={usuario}
        cerrarSesion={cerrarSesion}
      />

      <main className="main-content">
        <header className="main-header">
          <div>
            <span className="main-breadcrumb">Sistema / </span>
            <strong>{nombrePagina}</strong>
          </div>

          <div className="main-user">
            <strong>{usuario?.nombre || 'Usuario'}</strong>
            <span>{usuario?.rol || ''}</span>
          </div>
        </header>

        <section className="main-page">
          <h1>{nombrePagina}</h1>

          <p>
            {paginaActual === 'inicio'
              ? `Bienvenido al sistema, ${usuario?.nombre || 'usuario'}.`
              : `Estamos preparando la sección de ${nombrePagina.toLowerCase()}.`}
          </p>
        </section>
      </main>
    </div>
  );
}
