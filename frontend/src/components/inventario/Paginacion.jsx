import { useId, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { generarPaginas } from '../../utils/inventario';

const OPCIONES_LIMITE = [10, 20, 50];

export default function Paginacion({ pagina, total, limite, onCambiar, onCambiarLimite, cargando = false, singular = 'equipo', plural = 'equipos' }) {
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  pagina = Math.max(1, Math.min(pagina, totalPaginas));
  const nombre = total === 1 ? singular : plural;
  const inicio = (pagina - 1) * limite;
  const fin = Math.min(inicio + limite, total);
  const [entrada, setEntrada] = useState({ pagina, limite, valor: String(pagina) });
  const destino = entrada.pagina === pagina && entrada.limite === limite
    ? entrada.valor : String(pagina);
  const idLimite = useId();
  const idDestino = useId();

  const paginaDestino = Number(destino);
  const destinoValido = /^\d+$/.test(destino) && Number.isSafeInteger(paginaDestino)
    && paginaDestino >= 1 && paginaDestino <= totalPaginas;

  function irAPagina(evento) {
    evento.preventDefault();
    if (!cargando && destinoValido) onCambiar(paginaDestino);
  }

  return (
    <div className="inv-paginacion">
      <p className="inv-resumen-paginacion">
        {total === 0
          ? `Mostrando 0 ${plural}`
          : <>Mostrando <strong>{inicio + 1}–{fin}</strong> de <strong>{total.toLocaleString('es-CR')}</strong> {nombre}</>}
      </p>

      <div className="inv-paginacion-acciones">
        <div className="inv-cantidad-pagina">
          <label htmlFor={idLimite}>Mostrar</label>
          <span className="inv-cantidad-select">
            <select
              id={idLimite}
              value={limite}
              onChange={(evento) => onCambiarLimite(Number(evento.target.value))}
              aria-label={`${plural} por página`}
              disabled={cargando}
            >
              {OPCIONES_LIMITE.map((numero) => (
                <option value={numero} key={numero}>{numero}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
          <span>por página</span>
        </div>

        <nav className="inv-controles-paginacion" aria-label={`Paginación de ${plural}`}>
          <button type="button" aria-label="Página anterior" disabled={cargando || pagina <= 1}
            onClick={() => onCambiar(pagina - 1)}>
            <ChevronLeft size={15} aria-hidden="true" />
          </button>

          {generarPaginas(pagina, totalPaginas).map((numero, indice) =>
            numero === '...' ? (
              <span className="inv-puntos" key={`puntos-${indice}`}>...</span>
            ) : (
              <button type="button" key={numero}
                className={pagina === numero ? 'inv-pagina-activa' : ''}
                aria-label={`Ir a la página ${numero}`}
                disabled={cargando}
                aria-current={pagina === numero ? 'page' : undefined}
                onClick={() => onCambiar(numero)}>{numero}</button>
            )
          )}

          <button type="button" aria-label="Página siguiente" disabled={cargando || pagina >= totalPaginas}
            onClick={() => onCambiar(pagina + 1)}>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </nav>

        <form className="inv-ir-pagina" onSubmit={irAPagina}>
          <label htmlFor={idDestino}>Ir a página</label>
          <input id={idDestino} type="number" inputMode="numeric" min="1" max={totalPaginas}
            disabled={cargando} step="1" value={destino} onChange={(evento) => setEntrada({ pagina, limite, valor: evento.target.value })}
            aria-invalid={destino !== '' && !destinoValido}
            aria-label={`Número de página, entre 1 y ${totalPaginas}`}/>
          <span className="inv-pagina-de">de {totalPaginas}</span>
          <button className="inv-ir-boton" type="submit" disabled={cargando || !destinoValido || paginaDestino === pagina}>Ir</button>
        </form>
      </div>
    </div>
  );
}
