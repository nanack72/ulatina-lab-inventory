import { useState } from 'react';
import { LockKeyhole, Eye, EyeOff, X } from 'lucide-react';
import '../styles/cambiarContrasena.css';

export default function CambiarContrasena({
  token,
  onCerrar,
  onContrasenaCambiada,
}) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e) {
    e.preventDefault();
    setError('');

    if (nueva.length < 12 || nueva.length > 72) {
    setError('La nueva contraseña debe tener entre 12 y 72 caracteres.');
    return;
    }

    if (nueva !== confirmacion) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    if (actual === nueva) {
      setError('La nueva contraseña debe ser diferente de la actual.');
      return;
    }

    setCargando(true);

    try {
      const respuesta = await fetch('/api/auth/mi-contrasena', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contrasenaActual: actual,
          contrasenaNueva: nueva,
        }),
      });

      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(
          resultado.message || 'No se pudo cambiar la contraseña.'
        );
      }

      setActual('');
      setNueva('');
      setConfirmacion('');
      onContrasenaCambiada?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="cc-fondo">
      <section
        className="cc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-titulo"
      >
        <div className="cc-encabezado">
          <div className="cc-titulo">
            <LockKeyhole size={21} />
            <h2 id="cc-titulo">Cambiar contraseña</h2>
          </div>

          <button
            type="button"
            className="cc-cerrar"
            onClick={onCerrar}
            disabled={cargando}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <p className="cc-descripcion">
          Para proteger su cuenta, ingrese su contraseña actual
          y establezca una nueva.
        </p>

        <form onSubmit={guardar}>
          <label htmlFor="cc-actual">Contraseña actual</label>
          <input
            id="cc-actual"
            type={mostrar ? 'text' : 'password'}
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            required
          />

          <label htmlFor="cc-nueva">Nueva contraseña</label>
          <input
            id="cc-nueva"
            type={mostrar ? 'text' : 'password'}
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            required
            minLength={12}
          />

          <label htmlFor="cc-confirmacion">
            Confirmar nueva contraseña
          </label>
          <input
            id="cc-confirmacion"
            type={mostrar ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            required
          />

          <button
            className="cc-visibilidad"
            type="button"
            onClick={() => setMostrar((valor) => !valor)}
          >
            {mostrar ? <EyeOff size={17} /> : <Eye size={17} />}
            {mostrar ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
          </button>

          {error && <p className="cc-error" role="alert">{error}</p>}

          <div className="cc-acciones">
            <button
              type="button"
              className="cc-cancelar"
              onClick={onCerrar}
              disabled={cargando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="cc-guardar"
              disabled={cargando}
            >
              {cargando ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
