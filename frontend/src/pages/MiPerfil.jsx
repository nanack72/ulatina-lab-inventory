import { useEffect, useState } from 'react';
import {
  UserRound,
  Mail,
  Shield,
  Building2,
  LockKeyhole,
  CheckCircle2,
  X,
} from 'lucide-react';


import CambiarContrasena from '../components/CambiarContrasena';
import '../styles/miPerfil.css';

export default function MiPerfil({ usuario, token }) {
  const [mostrarCambio, setMostrarCambio] = useState(false);
  const [mensaje, setMensaje] = useState('');

useEffect(() => {
  if (!mensaje) return;

  const temporizador = setTimeout(() => {
    setMensaje('');
  }, 4000);

  return () => clearTimeout(temporizador);
}, [mensaje]);

  const nombre =
    usuario?.nombreCompleto ||
    usuario?.nombre ||
    'Sin información';

  const correo =
    usuario?.correo ||
    usuario?.email ||
    'Sin información';

  const rol =
    typeof usuario?.rol === 'string'
      ? usuario.rol
      : usuario?.rol?.nombre || 'Sin asignar';

  return (
    <div className="perfil-pagina">
      <div className="perfil-encabezado">
        <h1>Mi perfil</h1>
        <p>Consulte la información de su cuenta y sus permisos.</p>
      </div>

      <section className="perfil-tarjeta">
        <div className="perfil-identidad">
          <div className="perfil-avatar">
            <UserRound size={30} />
          </div>

          <div>
            <h2>{nombre}</h2>
            <p>{rol}</p>
          </div>
        </div>

        <h3>Información personal</h3>

        <div className="perfil-campos">
          <div className="perfil-campo">
            <label>
              <UserRound size={16} />
              Nombre completo
            </label>
            <div>{nombre}</div>
          </div>

          <div className="perfil-campo">
            <label>
              <Mail size={16} />
              Correo electrónico
            </label>
            <div>{correo}</div>
          </div>

          <div className="perfil-campo">
            <label>
              <Shield size={16} />
              Rol asignado
            </label>
            <div>{rol}</div>
          </div>

          <div className="perfil-campo">
            <label>
              <Building2 size={16} />
              Estado de la cuenta
            </label>
            <div>
              {usuario?.estado || 'Consultar al administrador'}
            </div>
          </div>
        </div>
      </section>

      <section className="perfil-tarjeta">
        <div className="perfil-seguridad">
          <div>
            <h3>Seguridad de la cuenta</h3>
            <p>Administre la contraseña de acceso al sistema.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setMensaje('');
              setMostrarCambio(true);
            }}
          >
            <LockKeyhole size={17} />
            Cambiar contraseña
          </button>
        </div>
      </section>

    {mensaje && (
    <div className="perfil-toast" role="status">
        <div className="perfil-toast-icono">
        <CheckCircle2 size={22} />
        </div>

        <div className="perfil-toast-contenido">
        <strong>Contraseña actualizada</strong>
        <span>{mensaje}</span>
        </div>

        <button
        type="button"
        className="perfil-toast-cerrar"
        onClick={() => setMensaje('')}
        aria-label="Cerrar notificación"
        >
        <X size={18} />
        </button>
    </div>
    )}

      {mostrarCambio && (
        <CambiarContrasena
          token={token}
          onCerrar={() => setMostrarCambio(false)}
          onContrasenaCambiada={() => {
            setMostrarCambio(false);
            setMensaje('Contraseña actualizada correctamente.');
          }}
        />
      )}
    </div>
  );
}
