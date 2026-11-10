import { useCallback, useEffect, useRef, useState } from 'react';

import { obtenerEquipoPorId } from '../services/equiposService';

// Carga un equipo por id.
// onSesionExpirada se llama cuando el backend responde 401
// (token vencido, revocado o usuario desactivado).
export function useEquipo(idEquipo, token, onSesionExpirada) {
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  // Se guarda en una ref para que cambiar la función no dispare otra carga.
  const alExpirarSesion = useRef(onSesionExpirada);

  useEffect(() => {
    alExpirarSesion.current = onSesionExpirada;
  }, [onSesionExpirada]);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);
      setError('');
      setEquipo(null);

      try {
        const resultado = await obtenerEquipoPorId(
          idEquipo,
          token,
          controlador.signal
        );

        if (!controlador.signal.aborted) {
          setEquipo(resultado);
        }
      } catch (err) {
        if (controlador.signal.aborted) return;

        if (err.status === 401) {
          setError('Tu sesión expiró o ya no es válida. Iniciá sesión nuevamente.');
          alExpirarSesion.current?.();
        } else {
          setError(err.message || 'No se pudo consultar el equipo.');
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => controlador.abort();
  }, [idEquipo, token, recarga]);

  const recargar = useCallback(() => setRecarga((valor) => valor + 1), []);

  return { equipo, cargando, error, recargar };
}