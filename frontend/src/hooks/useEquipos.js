import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { obtenerEquipos } from '../services/equiposService';
import { adaptarEquipo } from '../utils/inventario';

export function useEquipos(token, onSesionExpirada) {
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  const alExpirarSesion = useRef(onSesionExpirada);

  useEffect(() => {
    alExpirarSesion.current = onSesionExpirada;
  }, [onSesionExpirada]);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);
      setError('');

      try {
        const datos = await obtenerEquipos(
          token,
          controlador.signal
        );

        if (!controlador.signal.aborted) {
          setEquipos(datos.map(adaptarEquipo));
        }
      } catch (err) {
        if (controlador.signal.aborted) return;

        setEquipos([]);

        if (err.status === 401) {
          setError(
            'Tu sesión expiró o ya no es válida. Iniciá sesión nuevamente.'
          );

          alExpirarSesion.current?.();
        } else {
          setError(
            err.message ||
            'No se pudo cargar el inventario.'
          );
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => controlador.abort();
  }, [token, recarga]);

  const recargar = useCallback(() => {
    setRecarga((valor) => valor + 1);
  }, []);

  return {
    equipos,
    cargando,
    error,
    recargar,
  };
}
