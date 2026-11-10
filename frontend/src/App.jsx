import { useRef, useState } from 'react';

import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';

import { cerrarSesion as cerrarSesionAPI } from './services/authService';

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [errorLogout, setErrorLogout] = useState('');

  // Evita enviar varias solicitudes de logout al mismo tiempo
  const cerrandoSesionRef = useRef(false);

  // Guardar temporalmente la sesión autenticada
  const manejarLogin = ({ token, usuario }) => {
    setErrorLogout('');
    setSesion({ token, usuario });
  };

  // Cerrar sesión de forma segura en el backend
  const cerrarSesion = async () => {
    if (cerrandoSesionRef.current || !sesion) {
      return;
    }

    cerrandoSesionRef.current = true;
    setErrorLogout('');

    try {
      // Revocar el token JWT en PostgreSQL
      await cerrarSesionAPI(sesion.token);

      // Limpiar la sesión solamente después de
      // recibir la confirmación del servidor
      setSesion(null);

    } catch (error) {
      // Si el servidor responde 401, el token
      // ya no es válido para usar rutas protegidas
      if (error.status === 401) {
        setSesion(null);
        return;
      }

      console.error('Error al cerrar sesión:', error);

      // Si falla la conexión o el servidor,
      // conservamos la sesión actual
      setErrorLogout(
        error.message ||
        'No fue posible cerrar la sesión. Intentá nuevamente.'
      );

    } finally {
      cerrandoSesionRef.current = false;
    }
  };

  // Mostrar login cuando no hay sesión
  if (!sesion) {
    return <Login onLogin={manejarLogin} />;
  }

  // Mostrar el sistema cuando el usuario inicia sesión
  return (
    <>
      {errorLogout && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            textAlign: 'center',
          }}
        >
          {errorLogout}
        </div>
      )}

      <MainLayout
        usuario={sesion.usuario}
        token={sesion.token}
        cerrarSesion={cerrarSesion}
      />
    </>
  );
}
