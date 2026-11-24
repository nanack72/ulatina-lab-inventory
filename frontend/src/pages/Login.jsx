import Notificacion from '../components/comunes/Notificacion';
import { useEffect, useState } from 'react';
import { ClipboardList, Monitor, Wrench } from 'lucide-react';
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

  useEffect(() => {
    const tema = document.querySelector('meta[name="theme-color"]');
    const anterior = tema?.getAttribute('content');
    tema?.setAttribute('content', '#075640');
    return () => {
      if (tema) tema.setAttribute('content', anterior || '#f5f6f7');
    };
  }, []);

  const manejarLogin = async (event) => {
    event.preventDefault();
    setError('');

    if (!correo.trim() || !contrasena) {
      setError('Ingrese su correo y contraseña.');
      return;
    }

    try {
      setCargando(true);

      const sesion = await iniciarSesion(correo.trim(), contrasena);

      if (recordarme) {
        localStorage.setItem('ulatina_correo_recordado', correo.trim());
      } else {
        localStorage.removeItem('ulatina_correo_recordado');
      }

      // Cerrar el teclado antes de entrar y comenzar en el encabezado del sistema.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onLogin(sesion);
      requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-page">
      {/* PANEL INSTITUCIONAL: información e identidad visual. */}
      <section className="login-institutional" aria-label="Presentación del sistema">
        <div className="login-light-trail" aria-hidden="true">
          <svg viewBox="0 0 1000 900" preserveAspectRatio="xMidYMid slice" focusable="false">
            <defs>
              <linearGradient id="login-trail-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#b3d334" stopOpacity="0.85" />
                <stop offset="0.55" stopColor="#adf68a" stopOpacity="0.9" />
                <stop offset="1" stopColor="#87f4d5" stopOpacity="0.65" />
              </linearGradient>
              <filter id="login-trail-blur" x="-50%" y="-200%" width="200%" height="500%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
              <radialGradient id="login-trail-glow">
                <stop offset="0" stopColor="#d1ff73" stopOpacity="0.8" />
                <stop offset="1" stopColor="#d1ff73" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path
              d="M -85 675 C 110 670 250 795 420 735 S 620 640 725 582 S 875 563 930 425"
              fill="none"
              stroke="url(#login-trail-gradient)"
              strokeWidth="13"
              filter="url(#login-trail-blur)"
              opacity="0.7"
            />
            <path
              d="M -85 675 C 110 670 250 795 420 735 S 620 640 725 582 S 875 563 930 425"
              fill="none"
              stroke="url(#login-trail-gradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 515 684 C 680 806 915 745 940 605"
              stroke="#8fdac2"
              strokeOpacity="0.24"
              strokeDasharray="2 9"
              strokeWidth="2"
              fill="none"
            />
            <circle cx="580" cy="681" r="45" fill="url(#login-trail-glow)" />
            <circle cx="580" cy="681" r="4" fill="#eeffb2" />
            <circle cx="923" cy="445" r="30" fill="url(#login-trail-glow)" />
            <circle cx="923" cy="445" r="3" fill="#e9ffda" />
          </svg>
        </div>

        <div className="login-institutional-content">
          <div className="login-brand">
            <img src={logoBlanco} alt="Universidad Latina de Costa Rica" className="login-logo" />
          </div>

          <div className="login-presentation">
            <span className="login-accent-line" aria-hidden="true" />
            <h1>
              Sistema de Gestión de
              <br className="login-desktop-break" /> Inventario Tecnológico
            </h1>
            <h2>Facultad de Ingenierías y TICs</h2>
            <p>
              Plataforma para la gestión y seguimiento de equipos tecnológicos, mantenimientos e
              incidencias de los laboratorios universitarios.
            </p>

            <ul className="login-features" aria-label="Áreas de gestión">
              <li>
                <Monitor aria-hidden="true" />
                <span>Control de equipos</span>
              </li>
              <li>
                <Wrench aria-hidden="true" />
                <span>Gestión de mantenimientos</span>
              </li>
              <li>
                <ClipboardList aria-hidden="true" />
                <span>Registro de incidencias</span>
              </li>
            </ul>
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
            <p>Inicie sesión con su cuenta institucional para continuar.</p>
          </div>

          <form className="login-form" onSubmit={manejarLogin}>
            {/* CORREO */}
            <div className="login-field">
              <label htmlFor="correo">Correo institucional</label>

              <div className="login-input-wrapper">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>

                <input
                  id="correo"
                  name="correo"
                  type="email"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                  placeholder="correo@ulatina.net"
                  autoComplete="username"
                  required
                  disabled={cargando}
                />
              </div>
            </div>

            {/* CONTRASEÑA */}
            <div className="login-field">
              <label htmlFor="contrasena">Contraseña</label>

              <div className="login-input-wrapper">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>

                <input
                  id="contrasena"
                  name="contrasena"
                  type={mostrarContrasena ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(event) => setContrasena(event.target.value)}
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                  required
                  disabled={cargando}
                />

                {/* OJITO */}
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setMostrarContrasena((anterior) => !anterior)}
                  disabled={cargando}
                  aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                  onChange={(event) => setRecordarme(event.target.checked)}
                  disabled={cargando}
                />
                <span>Recordarme</span>
              </label>

              <button
                type="button"
                className="login-forgot"
                onClick={() => setMostrarModalRecuperacion(true)}
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            {/* MENSAJE DE ERROR */}
            {error && (
              <Notificacion tipo="error" alCerrar={() => setError('')}>
                {error}
              </Notificacion>
            )}

            {/* BOTÓN */}
            <button type="submit" className="login-submit" disabled={cargando}>
              {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
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
          <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
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
                Por normativas de seguridad institucional y control de auditoría de los laboratorios
                universitarios, el restablecimiento de contraseñas no se procesa mediante
                auto-servicio público para resguardar la integridad de los activos tecnológicos.
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
                    <strong>Ubicación física:</strong> Sede Heredia, Edificio Central, Piso 2,
                    Oficina de TICs.
                  </li>
                  <li>
                    <strong>Extensión telefónica:</strong> 4200 (Lunes a Viernes, 8:00 a. m. a 6:00
                    p. m.)
                  </li>
                </ul>
              </div>

              <p className="login-modal-nota">
                Para validar su identidad, proporcione su nombre completo, correo institucional y
                rol asignado al comunicarse con el departamento técnico.
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
