import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X, Trash2, Images } from 'lucide-react';
import { cargarImagen } from '../../services/fotosEquipoService';

function Foto({ idEquipo, foto, token, cargar }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!cargar) return;
    const controlador = new AbortController();
    let enlace;
    cargarImagen(idEquipo, foto.id_foto, token, controlador.signal)
      .then((blob) => {
        if (controlador.signal.aborted) return;
        enlace = URL.createObjectURL(blob);
        setUrl(enlace);
      })
      .catch((err) => {
        if (!controlador.signal.aborted) setError(err.message);
      });
    return () => {
      controlador.abort();
      if (enlace) URL.revokeObjectURL(enlace);
    };
  }, [idEquipo, foto.id_foto, token, cargar]);
  return url ? (
    <img src={url} alt={`Foto del equipo: ${foto.nombre_archivo}`} width="960" height="720" />
  ) : (
    <p className="foto-espera">{error || 'Cargando foto…'}</p>
  );
}

export default function CarruselFotos({
  fotos,
  idEquipo,
  token,
  puedeEliminar,
  ocupado,
  onEliminar,
}) {
  const id = useId();
  const pista = useRef(null);
  const visor = useRef(null);
  const galeria = useRef(null);
  const ampliar = useRef(null);
  const pendiente = useRef(null);
  const [indice, setIndice] = useState(0);
  const [anuncio, setAnuncio] = useState('');
  const [ampliada, setAmpliada] = useState(null);
  const [paginaGaleria, setPaginaGaleria] = useState(0);
  const [galeriaAbierta, setGaleriaAbierta] = useState(false);
  const actual = Math.min(indice, Math.max(0, fotos.length - 1));
  const fotoActual = fotos[actual];
  const totalPaginas = Math.max(1, Math.ceil(fotos.length / 9));
  const paginaActual = Math.min(paginaGaleria, totalPaginas - 1);
  const miniaturas = fotos.slice(paginaActual * 9, (paginaActual + 1) * 9);

  useEffect(() => {
    const track = pista.current;
    if (!track) return;
    let temporizador;
    let frame;
    function masCercana() {
      const caja = track.getBoundingClientRect();
      const centro = caja.left + caja.width / 2;
      let elegida = 0,
        distancia = Infinity;
      [...track.children].forEach((slide, i) => {
        const rect = slide.getBoundingClientRect();
        const diferencia = Math.abs(rect.left + rect.width / 2 - centro);
        if (diferencia < distancia) {
          distancia = diferencia;
          elegida = i;
        }
      });
      return elegida;
    }
    function terminar() {
      const i = masCercana();
      pendiente.current = null;
      setIndice(i);
      setAnuncio(`Foto ${i + 1} de ${fotos.length}`);
    }
    const soportaFin = 'onscrollend' in track;
    function mover() {
      if (pendiente.current === null) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setIndice(masCercana()));
      }
      if (!soportaFin) {
        clearTimeout(temporizador);
        temporizador = setTimeout(terminar, 160);
      }
    }
    track.addEventListener('scroll', mover, { passive: true });
    if (soportaFin) track.addEventListener('scrollend', terminar);
    // Una eliminación puede hacer que el navegador reajuste el scroll sin emitir scrollend.
    frame = requestAnimationFrame(() => {
      setIndice(masCercana());
    });
    return () => {
      clearTimeout(temporizador);
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', mover);
      track.removeEventListener('scrollend', terminar);
    };
  }, [fotos]);

  useEffect(() => {
    if (ampliada && !visor.current.open) visor.current.showModal();
  }, [ampliada]);

  function irA(i) {
    const track = pista.current;
    if (!track) return;
    const destino = (i + fotos.length) % fotos.length;
    const slide = track.children[destino];
    if (!slide) return;
    const caja = track.getBoundingClientRect(),
      rect = slide.getBoundingClientRect();
    const desplazamiento = rect.left + rect.width / 2 - (caja.left + caja.width / 2);
    pendiente.current = destino;
    setIndice(destino);
    const vuelta = Math.abs(destino - actual) > 1;
    track.scrollBy({
      left: desplazamiento,
      behavior:
        vuelta || window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
    });
    if (Math.abs(desplazamiento) < 1) pendiente.current = null;
  }
  function avanzar(direccion) {
    irA((pendiente.current ?? actual) + direccion);
  }
  function cerrarVisor() {
    visor.current.close();
  }
  function verTodas() {
    setPaginaGaleria(Math.floor(actual / 9));
    setGaleriaAbierta(true);
    galeria.current.showModal();
  }
  function cerrarGaleria() {
    galeria.current.close();
  }
  function elegirFoto(i) {
    cerrarGaleria();
    irA(i);
  }

  if (!fotoActual) return <p>No hay fotos registradas.</p>;

  return (
    <section
      className="equipo-carrusel"
      aria-label="Fotografías del equipo"
      aria-roledescription="carrusel"
    >
      <div className="foto-escenario">
        <div className="foto-controles">
          <button
            type="button"
            className="foto-anterior"
            aria-label="Foto anterior"
            disabled={fotos.length < 2}
            onClick={() => avanzar(-1)}
          >
            <ChevronLeft aria-hidden="true" size={22} />
          </button>
          <button
            type="button"
            className="foto-siguiente"
            aria-label="Foto siguiente"
            disabled={fotos.length < 2}
            onClick={() => avanzar(1)}
          >
            <ChevronRight aria-hidden="true" size={22} />
          </button>
          <button
            ref={ampliar}
            type="button"
            className="foto-ampliar"
            aria-label="Ampliar foto actual"
            onClick={() => setAmpliada(fotoActual)}
          >
            <Maximize2 aria-hidden="true" size={20} />
          </button>
          {puedeEliminar && (
            <button
              type="button"
              className="foto-papelera"
              aria-label="Eliminar foto actual"
              disabled={ocupado}
              onClick={() => onEliminar(fotoActual)}
            >
              <Trash2 aria-hidden="true" size={18} />
            </button>
          )}
        </div>
        <div
          ref={pista}
          className="foto-pista"
          tabIndex={0}
          role="group"
          aria-label="Fotos; deslice para recorrerlas"
          onPointerDown={() => {
            pendiente.current = null;
          }}
          onWheel={() => {
            pendiente.current = null;
          }}
          onKeyDown={() => {
            pendiente.current = null;
          }}
        >
          {fotos.map((foto, i) => (
            <div
              key={foto.id_foto}
              className="foto-slide"
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`Foto ${i + 1} de ${fotos.length}`}
            >
              {i === actual ? (
                <Foto idEquipo={idEquipo} foto={foto} token={token} cargar />
              ) : (
                <p className="foto-espera">
                  Foto {i + 1}: {foto.nombre_archivo}
                </p>
              )}
            </div>
          ))}
        </div>
        <span className="foto-contador" aria-hidden="true">
          {actual + 1} / {fotos.length}
        </span>
      </div>
      <p className="foto-nombre">{fotoActual.nombre_archivo}</p>
      <div className="foto-pie">
        <nav className="foto-indicadores" aria-label="Elegir foto">
          {fotos
            .map((foto, i) => ({ foto, i }))
            .filter(({ i }) => fotos.length <= 9 || Math.abs(i - actual) <= 2)
            .map(({ foto, i }) => (
              <button
                key={foto.id_foto}
                type="button"
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === actual ? 'true' : undefined}
                onClick={() => irA(i)}
              >
                <span />
              </button>
            ))}
        </nav>
        <button type="button" className="foto-ver-todas" onClick={verTodas}>
          <Images size={16} aria-hidden="true" />
          Ver todas ({fotos.length})
        </button>
      </div>
      <p className="foto-solo-lectores" role="status" aria-live="polite">
        {anuncio}
      </p>
      <dialog
        ref={visor}
        className="foto-visor"
        aria-labelledby={`${id}-titulo`}
        onClose={() => {
          setAmpliada(null);
        }}
      >
        <div className="foto-visor-cabecera">
          <h2 id={`${id}-titulo`}>Foto del equipo</h2>
          <button autoFocus type="button" aria-label="Cerrar imagen ampliada" onClick={cerrarVisor}>
            <X aria-hidden="true" size={24} />
          </button>
        </div>
        {ampliada && (
          <>
            <Foto key={ampliada.id_foto} idEquipo={idEquipo} foto={ampliada} token={token} cargar />
            <p>{ampliada.nombre_archivo}</p>
          </>
        )}
      </dialog>
      <dialog
        ref={galeria}
        className="foto-visor foto-todas"
        aria-labelledby={`${id}-galeria`}
        onClose={() => setGaleriaAbierta(false)}
      >
        <div className="foto-visor-cabecera">
          <div>
            <h2 id={`${id}-galeria`}>Todas las fotos del equipo</h2>
            <p>{fotos.length} fotos · Seleccione una para verla en el carrusel</p>
          </div>
          <button autoFocus type="button" aria-label="Cerrar galería" onClick={cerrarGaleria}>
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        {galeriaAbierta && (
          <div className="foto-mosaico">
            {miniaturas.map((foto, i) => {
              const posicion = paginaActual * 9 + i;
              return (
                <button
                  type="button"
                  className="foto-miniatura"
                  key={foto.id_foto}
                  aria-label={`Seleccionar foto ${posicion + 1}: ${foto.nombre_archivo}`}
                  aria-current={posicion === actual ? 'true' : undefined}
                  onClick={() => elegirFoto(posicion)}
                >
                  <Foto idEquipo={idEquipo} foto={foto} token={token} cargar />
                  <span>
                    {posicion + 1}. {foto.nombre_archivo}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="foto-paginas">
          <button
            type="button"
            disabled={paginaActual === 0}
            onClick={() => setPaginaGaleria(paginaActual - 1)}
          >
            Anterior
          </button>
          <p role="status">
            Página {paginaActual + 1} de {totalPaginas}
          </p>
          <button
            type="button"
            disabled={paginaActual + 1 >= totalPaginas}
            onClick={() => setPaginaGaleria(paginaActual + 1)}
          >
            Siguiente
          </button>
        </div>
      </dialog>
    </section>
  );
}
