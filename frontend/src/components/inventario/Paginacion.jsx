import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import {
  EQUIPOS_POR_PAGINA,
  generarPaginas,
} from '../../utils/inventario';

export default function Paginacion({
  pagina,
  total,
  onCambiar,
}) {
  const totalPaginas = Math.max(
    1,
    Math.ceil(total / EQUIPOS_POR_PAGINA)
  );

  const inicio =
    (pagina - 1) * EQUIPOS_POR_PAGINA;

  const fin = Math.min(
    inicio + EQUIPOS_POR_PAGINA,
    total
  );

  return (
    <div className="inv-paginacion">
      <p>
        {total === 0
          ? 'Mostrando 0 equipos'
          : `Mostrando ${inicio + 1}–${fin} de ${total.toLocaleString(
              'es-CR'
            )} equipos`}
      </p>

      <nav
        className="inv-controles-paginacion"
        aria-label="Paginación del inventario"
      >
        <button
          type="button"
          aria-label="Página anterior"
          disabled={pagina === 1}
          onClick={() =>
            onCambiar(pagina - 1)
          }
        >
          <ChevronLeft size={15} />
        </button>

        {generarPaginas(
          pagina,
          totalPaginas
        ).map((numero, indice) =>
          numero === '...' ? (
            <span
              className="inv-puntos"
              key={`puntos-${indice}`}
            >
              ...
            </span>
          ) : (
            <button
              type="button"
              key={numero}
              className={
                pagina === numero
                  ? 'inv-pagina-activa'
                  : ''
              }
              aria-label={`Ir a la página ${numero}`}
              aria-current={
                pagina === numero
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                onCambiar(numero)
              }
            >
              {numero}
            </button>
          )
        )}

        <button
          type="button"
          aria-label="Página siguiente"
          disabled={pagina === totalPaginas}
          onClick={() =>
            onCambiar(pagina + 1)
          }
        >
          <ChevronRight size={15} />
        </button>
      </nav>
    </div>
  );
}
