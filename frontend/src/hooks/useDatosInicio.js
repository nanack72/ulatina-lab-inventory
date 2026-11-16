import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  obtenerActividadReciente,
  obtenerMantenimientos,
} from '../services/dashboardService';

const ACTIVIDAD_VISIBLE = 6;

// Mantenimientos y actividad reciente para la pantalla de inicio.
// Cada fuente falla por separado: si una falla, la otra se sigue mostrando.
export function useDatosInicio(token, onSesionExpirada) {
  const [datos, setDatos] = useState(() => ({
    mantenimientos: [],
    actividad: [],
    errorMantenimientos: '',
    errorActividad: '',
    ahora: Date.now(),
  }));
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);

  const alExpirarSesion = useRef(onSesionExpirada);

  useEffect(() => {
    alExpirarSesion.current = onSesionExpirada;
  }, [onSesionExpirada]);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);

      const [mantenimientos, actividad] = await Promise.allSettled([
        obtenerMantenimientos(token, controlador.signal),
        obtenerActividadReciente(
          token,
          controlador.signal,
          ACTIVIDAD_VISIBLE
        ),
      ]);

      if (controlador.signal.aborted) return;

      const fallos = [mantenimientos, actividad].filter(
        (resultado) => resultado.status === 'rejected'
      );

      if (fallos.some((fallo) => fallo.reason?.status === 401)) {
        alExpirarSesion.current?.();
      }

      const mensaje = (resultado) =>
        resultado.status === 'rejected'
          ? resultado.reason?.message || 'No se pudo cargar esta sección.'
          : '';

      setDatos({
        mantenimientos:
          mantenimientos.status === 'fulfilled'
            ? mantenimientos.value
            : [],
        actividad:
          actividad.status === 'fulfilled' ? actividad.value : [],
        errorMantenimientos: mensaje(mantenimientos),
        errorActividad: mensaje(actividad),
        ahora: Date.now(),
      });

      setCargando(false);
    }

    cargar();

    return () => controlador.abort();
  }, [token, recarga]);

  const recargar = useCallback(() => {
    setRecarga((valor) => valor + 1);
  }, []);

  return { ...datos, cargando, recargar };
}