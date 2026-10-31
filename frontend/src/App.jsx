import { useState } from 'react';
import Login from './pages/Login';

export default function App() {
  const [sesion, setSesion] = useState(null);

  const manejarLogin = ({ token, usuario }) => {
    // Temporal: solo mantenemos la sesión en memoria.
    setSesion({ token, usuario });
  };

  const cerrarSesion = () => {
    setSesion(null);
  };

  if (!sesion) {
    return <Login onLogin={manejarLogin} />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <h1>¡Inicio de sesión exitoso!</h1>

      <p>
        Bienvenido, <strong>{sesion.usuario.nombre}</strong>
      </p>

      <p>
        Rol: <strong>{sesion.usuario.rol}</strong>
      </p>

      <button
        onClick={cerrarSesion}
        style={{
          padding: '12px 24px',
          border: 'none',
          borderRadius: '8px',
          background: '#137757',
          color: '#ffffff',
          cursor: 'pointer',
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
