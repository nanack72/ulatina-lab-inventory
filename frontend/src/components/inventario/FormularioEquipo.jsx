export function Campo({ etiqueta, htmlFor, requerido = false, children }) {
  return (
    <label className="registro-campo" htmlFor={htmlFor}>
      <span className="registro-etiqueta">
        {etiqueta}
        {requerido && <span className="registro-requerido" aria-hidden="true"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function Seccion({ titulo, icono: Icono, children }) {
  return (
    <section className="registro-tarjeta">
      <div className="registro-tarjeta-titulo">
        <span className="registro-tarjeta-icono" aria-hidden="true">
          <Icono size={18} />
        </span>
        <h2>{titulo}</h2>
      </div>
      <div className="registro-tarjeta-contenido">
        {children}
      </div>
    </section>
  );
}
