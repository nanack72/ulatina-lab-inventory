import { useEffect, useState } from 'react';
export function useBusquedaDiferida(valor) {
  const [busqueda, setBusqueda] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setBusqueda(valor), 250);
    return () => clearTimeout(temporizador);
  }, [valor]);
  return busqueda;
}
