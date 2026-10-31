import { useState } from 'react';
import { iniciarSesion } from '../services/authService';

import logoBlanco from '../assets/images/logo-ulatina-blanco.png';
import logoGris from '../assets/images/logo-ulatina-gris.png';

import '../styles/login.css';

export default function Login({ onLogin }) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const manejarLogin = async (event) => {
    event.preventDefault();
    setError('');

    if (!correo.trim() || !contrasena) {
      setError('Ingresá tu correo y contraseña.');
      return;
    }

    try {
      setCargando(true);

      const sesion = await iniciarSesion(
        correo.trim(),
        contrasena
      );

      onLogin(sesion);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-page">

      {/* PANEL INSTITUCIONAL */}
      <section className="login-institutional">
        <div className="login-institutional-content">

          <div className="login-brand">
            <img
              src={logoBlanco}
              alt="Universidad Latina de Costa Rica"
              className="login-logo"
            />
          </div>

          <div className="login-presentation">
            <h1>
              Sistema de Gestión de
              <br />
              Inventario Tecnológico
            </h1>

            <h2>Facultad de Ingenierías y TICs</h2>

            <p>
              Plataforma para la gestión y seguimiento de
              equipos tecnológicos, mantenimientos e
              incidencias de los laboratorios universitarios.
            </p>
          </div>

        </div>
      </section>

      {/* PANEL DEL LOGIN */}
      <section className="login-form-section">
        <div className="login-form-container">

          <div className="login-mobile-brand">
            <img
              src={logoGris}
              alt="Universidad Latina de Costa Rica"
              className="login-logo-mobile"
            />
          </div>

          <div className="login-heading">
            <h1>Bienvenido</h1>
            <p>
              Iniciá sesión con tu cuenta institucional
              para continuar.
            </p>
          </div>

          <form
            className="login-form"
            onSubmit={manejarLogin}
          >

            {/* CORREO */}
            <div className="login-field">
              <label htmlFor="correo">
                Correo institucional
              </label>

              <div className="login-input-wrapper">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                  />
                  <path d="m3 7 9 6 9-6" />
                </svg>

                <input
                  id="correo"
                  name="correo"
                  type="email"
                  value={correo}
                  onChange={(event) =>
                    setCorreo(event.target.value)
                  }
                  placeholder="correo@ulatina.net"
                  autoComplete="username"
                  required
                  disabled={cargando}
                />
              </div>
            </div>

            {/* CONTRASEÑA */}
            <div className="login-field">
              <label htmlFor="contrasena">
                Contraseña
              </label>

              <div className="login-input-wrapper">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="11"
                    rx="2"
                  />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>

                <input
                  id="contrasena"
                  name="contrasena"
                  type={
                    mostrarContrasena
                      ? 'text'
                      : 'password'
                  }
                  value={contrasena}
                  onChange={(event) =>
                    setContrasena(event.target.value)
                  }
                  placeholder="Ingresá tu contraseña"
                  autoComplete="current-password"
                  required
                  disabled={cargando}
                />

                {/* OJITO */}
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() =>
                    setMostrarContrasena((anterior) => !anterior)
                  }
                  aria-label={
                    mostrarContrasena
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  aria-pressed={mostrarContrasena}
                >
                  {mostrarContrasena ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.6 6.1A11 11 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.2 2.8" />
                      <path d="M6.6 6.6C3.6 8.6 2 12 2 12s3.5 6 10 6c1.2 0 2.3-.2 3.4-.6" />
                      <path d="M10.3 10.3a2.5 2.5 0 0 0 3.4 3.4" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* OPCIONES */}
            <div className="login-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  disabled
                  title="Disponible próximamente"
                />
                <span>Recordarme</span>
              </label>

              <span className="login-forgot">
                ¿Olvidaste tu contraseña?
              </span>
            </div>

            {/* MENSAJE DE ERROR */}
            {error && (
              <div
                className="login-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* BOTÓN */}
            <button
              type="submit"
              className="login-submit"
              disabled={cargando}
            >
              {cargando
                ? 'Iniciando sesión...'
                : 'Iniciar sesión'}
            </button>

          </form>

        </div>
      </section>
    </div>
  );
}
