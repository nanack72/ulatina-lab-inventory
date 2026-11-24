import { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerPaginaInventario } from '../services/inventarioPaginadoService';
import { adaptarEquipo } from '../utils/inventario';

const VACIO = {
  equipos: [],
  total: 0,
  totalAutorizados: 0,
  paginaActual: 1,
  opciones: { sede: [], laboratorio: [], categoria: [], estado: [] },
};

export function useInventarioPaginado(token, filtros, pagina, limite, onSesionExpirada) {
  const [datos, setDatos] = useState(VACIO);
  const [estado, setEstado] = useState({ clave: '', cargando: true, error: '' });
  const [recarga, setRecarga] = useState(0);
  const alExpirar = useRef(onSesionExpirada);
  useEffect(() => {
    alExpirar.current = onSesionExpirada;
  }, [onSesionExpirada]);
  const consulta = JSON.stringify({ filtros, pagina, limite });
  const clave = JSON.stringify([token, consulta, recarga]);

  useEffect(() => {
    const controlador = new AbortController();
    const solicitud = JSON.parse(consulta);
    async function cargar() {
      setEstado({ clave, cargando: true, error: '' });
      try {
        const resultado = await obtenerPaginaInventario(
          token,
          solicitud.filtros,
          solicitud.pagina,
          solicitud.limite,
          controlador.signal
        );
        if (controlador.signal.aborted) return;
        const opciones = Object.fromEntries(
          Object.entries(resultado.opciones).map(([campo, valores]) => [
            campo,
            valores.toSorted((a, b) => a.localeCompare(b, 'es')),
          ])
        );
        setDatos({
          equipos: resultado.data.map(adaptarEquipo),
          total: resultado.total,
          totalAutorizados: resultado.total_autorizados,
          paginaActual: resultado.pagina,
          opciones,
        });
        setEstado({ clave, cargando: false, error: '' });
      } catch (error) {
        if (controlador.signal.aborted) return;
        setEstado({
          clave,
          cargando: false,
          error: error.message || 'No se pudo cargar el inventario.',
        });
        if (error.status === 401) alExpirar.current?.();
      }
    }
    // Esperar brevemente al escribir; cancelar tanto el temporizador como la consulta anterior.
    const temporizador = setTimeout(cargar, solicitud.filtros.busqueda ? 250 : 0);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [token, consulta, clave]);

  const recargar = useCallback(() => setRecarga((valor) => valor + 1), []);
  return {
    ...datos,
    error: estado.clave === clave ? estado.error : '',
    cargando: estado.clave !== clave || estado.cargando,
    recargar,
  };
}
