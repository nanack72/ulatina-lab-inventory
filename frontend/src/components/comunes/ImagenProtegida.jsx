import { useEffect, useState } from 'react';
import { obtenerArchivoEvidencia } from '../../services/evidenciasService';

export default function ImagenProtegida({ evidencia, token, grande = false }) {
  const [url, setUrl] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    const controlador = new AbortController();
    let enlace;
    obtenerArchivoEvidencia(evidencia.id_evidencia, token, controlador.signal)
      .then((blob) => {
        if (controlador.signal.aborted) return;
        enlace = URL.createObjectURL(blob);
        setUrl(enlace);
      })
      .catch((err) => {
        if (!controlador.signal.aborted) setError(err.message);
      });
    return () => {
      controlador.abort();
      if (enlace) URL.revokeObjectURL(enlace);
    };
  }, [evidencia.id_evidencia, token]);
  return url ? (
    <img
      className={grande ? 'mod-imagen-grande' : undefined}
      src={url}
      alt={evidencia.descripcion || 'Evidencia del mantenimiento'}
      width="800"
      height="600"
    />
  ) : (
    <p role={error ? 'alert' : 'status'}>{error || 'Cargando imagen…'}</p>
  );
}
