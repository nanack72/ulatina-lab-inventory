import { useState } from 'react';
import { iniciarSesion } from '../services/authService';

import logoBlanco from '../assets/images/logo-ulatina-blanco.png';
import logoGris from '../assets/images/logo-ulatina-gris.png';

import '../styles/login.css';

export default function Login({ onLogin }) {
  const [correo, setCorreo] = useState(() => {
    return localStorage.getItem('ulatina_correo_recordado') || '';
  });
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [recordarme, setRecordarme] = useState(() => {
    return Boolean(localStorage.getItem('ulatina_correo_recordado'));
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mostrarModalRecuperacion, setMostrarModalRecuperacion] = useState(false);

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

      if (recordarme) {
        localStorage.setItem('ulatina_correo_recordado', correo.trim());
      } else {
        localStorage.removeItem('ulatina_correo_recordado');
      }

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
                  checked={recordarme}
                  onChange={(event) =>
                    setRecordarme(event.target.checked)
                  }
                  disabled={cargando}
                />
                <span>Recordarme</span>
              </label>

              <button
                type="button"
                className="login-forgot"
                onClick={() => setMostrarModalRecuperacion(true)}
              >
                ¿Olvidaste tu contraseña?
              </button>
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

      {/* MODAL INSTITUCIONAL DE RECUPERACIÓN */}
      {mostrarModalRecuperacion && (
        <div
          className="login-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-recuperar-titulo"
          onClick={() => setMostrarModalRecuperacion(false)}
        >
          <div
            className="login-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="login-modal-header">
              <div className="login-modal-icon-badge" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="22"
                  height="22"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h2 id="modal-recuperar-titulo">Recuperación de Contraseña</h2>
            </div>

            <div className="login-modal-body">
              <p>
                Por normativas de seguridad institucional y control de auditoría de los laboratorios universitarios, el restablecimiento de contraseñas no se procesa mediante auto-servicio público para resguardar la integridad de los activos tecnológicos.
              </p>

              <div className="login-modal-info-box">
                <p className="login-modal-info-title">Canal oficial de soporte técnico:</p>
                <ul>
                  <li>
                    <strong>Soporte Técnico de Laboratorios:</strong>{' '}
                    <a href="mailto:soporte.laboratorios@ulatina.cr">
                      soporte.laboratorios@ulatina.cr
                    </a>
                  </li>
                  <li>
                    <strong>Ubicación física:</strong> Sede Heredia, Edificio Central, Piso 2, Oficina de TICs.
                  </li>
                  <li>
                    <strong>Extensión telefónica:</strong> 4200 (Lunes a Viernes, 8:00 a. m. a 6:00 p. m.)
                  </li>
                </ul>
              </div>

              <p className="login-modal-nota">
                Para validar su identidad, proporcione su nombre completo, correo institucional y rol asignado al comunicarse con el departamento técnico.
              </p>
            </div>

            <div className="login-modal-footer">
              <button
                type="button"
                className="btn btn-primario"
                onClick={() => setMostrarModalRecuperacion(false)}
              >
                Comprendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
