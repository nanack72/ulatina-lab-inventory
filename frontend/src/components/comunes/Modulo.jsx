import { useEffect, useId, useRef } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { generarPaginas } from '../../utils/inventario';
import '../../styles/inventario.css';
import '../../styles/modulos.css';

export function EncabezadoModulo({ titulo, descripcion, alActualizar, cargando, children }) {
  return (
    <header className="inv-encabezado">
      <div className="inv-encabezado-texto">
        <h1>{titulo}</h1>
        <p>{descripcion}</p>
      </div>
      <div className="inv-acciones">
        <button
          type="button"
          className="btn btn-lg btn-icono"
          aria-label={'Actualizar ' + titulo.toLowerCase()}
          disabled={cargando}
          onClick={alActualizar}
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
        {children}
      </div>
    </header>
  );
}
export function Aviso({ children, error = false }) {
  if (!children) return null;
  return (
    <div
      className={'mod-aviso ' + (error ? 'mod-aviso-error' : '')}
      role={error ? 'alert' : 'status'}
    >
      <AlertCircle size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
export function Indicador({ titulo, valor, detalle, tono = 'verde' }) {
  return (
    <article className={'mod-indicador mod-indicador-' + tono}>
      <span>{titulo}</span>
      <strong>{valor ?? 0}</strong>
      <small>{detalle}</small>
    </article>
  );
}
export function BusquedaModulo({ valor, onChange, etiqueta }) {
  const id = useId();
  return (
    <label className="inv-buscador" htmlFor={id}>
      <Search size={17} aria-hidden="true" />
      <span className="mod-sr">{etiqueta}</span>
      <input
        id={id}
        name="busqueda"
        type="search"
        placeholder={etiqueta}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Insignia({ children, tono = 'neutral' }) {
  return <span className={'mod-insignia mod-insignia-' + tono}>{children}</span>;
}
export function PaginacionModulo({ pagina, total, limite = 10, alCambiar, cargando }) {
  const paginas = Math.max(1, Math.ceil(total / limite));
  const actual = Math.min(pagina, paginas);
  return (
    <footer className="inv-paginacion">
      <p className="inv-resumen-paginacion">
        Mostrando {total ? (actual - 1) * limite + 1 : 0}–{Math.min(actual * limite, total)} de{' '}
        {total} registros
      </p>
      <nav className="inv-controles-paginacion" aria-label="Páginas de resultados">
        <button
          type="button"
          disabled={cargando || actual === 1}
          aria-label="Página anterior"
          onClick={() => alCambiar(actual - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        {generarPaginas(actual, paginas).map((n, i) =>
          n === '...' ? (
            <span key={'puntos-' + i}>…</span>
          ) : (
            <button
              type="button"
              key={n}
              className={n === actual ? 'inv-pagina-activa' : ''}
              aria-current={n === actual ? 'page' : undefined}
              disabled={cargando}
              onClick={() => alCambiar(n)}
            >
              {n}
            </button>
          )
        )}
        <button
          type="button"
          disabled={cargando || actual === paginas}
          aria-label="Página siguiente"
          onClick={() => alCambiar(actual + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </footer>
  );
}
export function DialogoModulo({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  ocupado = false,
  children,
}) {
  const ref = useRef(null),
    id = useId();
  useEffect(() => {
    const dialogo = ref.current;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
    return () => {
      if (dialogo.open) dialogo.close();
    };
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      className="mod-dialogo"
      aria-labelledby={id}
      aria-describedby={ocupado ? id + '-espera' : undefined}
      onClose={(e) => {
        if (!e.currentTarget.open && abierto) alCerrar();
      }}
      onCancel={(e) => {
        if (ocupado) e.preventDefault();
      }}
    >
      <header className="mod-dialogo-cabecera">
        <div>
          <h2 id={id}>{titulo}</h2>
          {descripcion && <p>{descripcion}</p>}
        </div>
        <button
          type="button"
          className="btn btn-icono"
          aria-label="Cerrar ventana"
          disabled={ocupado}
          onClick={() => ref.current.close()}
        >
          <X size={20} />
        </button>
      </header>
      {ocupado && (
        <p id={id + '-espera'} role="status">
          Guardando. Espere antes de cerrar.
        </p>
      )}
      {abierto && children}
    </dialog>
  );
}
