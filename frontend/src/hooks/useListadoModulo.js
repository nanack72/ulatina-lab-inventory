import { useEffect, useState } from 'react';

export function useListadoModulo(cargar) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: '' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controlador = new AbortController();
    async function consultar() {
      setEstado((anterior) => ({ ...anterior, cargando: true, error: '' }));
      try {
        const datos = await cargar(controlador.signal);
        if (!controlador.signal.aborted) setEstado({ datos, cargando: false, error: '' });
      } catch (error) {
        if (!controlador.signal.aborted)
          setEstado({ datos: null, cargando: false, error: error.message });
      }
    }
    consultar();
    return () => controlador.abort();
  }, [cargar, version]);
  return { ...estado, recargar: () => setVersion((v) => v + 1) };
}
