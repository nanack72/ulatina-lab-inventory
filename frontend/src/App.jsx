import { useState } from 'react';

import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';

export default function App() {
  const [sesion, setSesion] = useState(null);

  // Guardar temporalmente la sesión autenticada
  const manejarLogin = ({ token, usuario }) => {
    setSesion({ token, usuario });
  };

  // Cerrar sesión y regresar al login
  const cerrarSesion = () => {
    setSesion(null);
  };

  // Mostrar login cuando no hay sesión
  if (!sesion) {
    return <Login onLogin={manejarLogin} />;
  }

  // Mostrar el sistema cuando el usuario inicia sesión
  return (
    <MainLayout
      usuario={sesion.usuario}
      cerrarSesion={cerrarSesion}
    />
  );
}
