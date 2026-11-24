import { useEffect } from 'react';

// En teléfono las tablas se muestran como tarjetas (ver tablasMovil.css).
// Cada celda necesita su encabezado como data-label; se copia desde el
// <thead> para no repetirlo en cada tabla de la aplicación.
function etiquetarTabla(tabla) {
  const etiquetas = [...tabla.querySelectorAll('thead th')].map((th) =>
    th.classList.contains('inv-columna-detalle') ? '' : th.textContent.trim()
  );

  tabla.querySelectorAll('tbody tr').forEach((fila) => {
    [...fila.children].forEach((celda, indice) => {
      if (celda.colSpan > 1) return;
      const etiqueta = etiquetas[indice] ?? '';
      if (celda.dataset.label !== etiqueta) celda.dataset.label = etiqueta;
    });
  });
}

export function useTablasEnTarjetas(selector = '.main-page') {
  useEffect(() => {
    const raiz = document.querySelector(selector);
    if (!raiz) return undefined;

    let pendiente = 0;
    const etiquetarTodas = () => {
      pendiente = 0;
      raiz.querySelectorAll('table').forEach(etiquetarTabla);
    };

    etiquetarTodas();
    const observador = new MutationObserver(() => {
      if (!pendiente) pendiente = requestAnimationFrame(etiquetarTodas);
    });
    observador.observe(raiz, { childList: true, subtree: true });

    return () => {
      observador.disconnect();
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, [selector]);
}
