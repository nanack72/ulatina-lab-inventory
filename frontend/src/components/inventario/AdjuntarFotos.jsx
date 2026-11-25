import Notificacion from '../comunes/Notificacion';
import { useEffect, useId, useRef, useState } from 'react';
import { MAX_FOTOS_EQUIPO, MAX_FOTOS_POR_CARGA } from '../../utils/limitesFotos';

function validarArchivosFotos(archivos, maxFotos) {
  if (archivos.length > maxFotos) return `Puede agregar como máximo ${maxFotos} fotos más.`;
  if (
    archivos.some(
      (f) => !/\.(jpe?g|png|webp)$/i.test(f.name) || f.size > 5 * 1024 * 1024 || f.size === 0
    )
  ) {
    return 'Use fotos JPG, PNG o WEBP de hasta 5 MB cada una.';
  }
  return '';
}
function VistaPrevia({ archivo }) {
  const imagenRef = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(archivo);
    imagenRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [archivo]);
  return (
    <img
      ref={imagenRef}
      className="foto-seleccionada-preview"
      alt={`Vista previa de ${archivo.name}`}
      width="72"
      height="56"
    />
  );
}

export default function AdjuntarFotos({
  archivos,
  onChange,
  disabled = false,
  mostrarVistaPrevia = false,
  maxFotos = MAX_FOTOS_EQUIPO,
}) {
  const id = useId();
  const [error, setError] = useState('');
  function elegir(lista) {
    if (Array.from(lista || []).length > MAX_FOTOS_POR_CARGA) {
      setError(
        `Seleccione hasta ${MAX_FOTOS_POR_CARGA} archivos por vez. Puede repetir para agregar más.`
      );
      return;
    }
    const nuevas = [...archivos, ...Array.from(lista || [])];
    const problema = validarArchivosFotos(nuevas, maxFotos);
    setError(problema);
    if (!problema) onChange(nuevas);
  }
  return (
    <div
      className="fotos-adjuntar"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!disabled) elegir(e.dataTransfer.files);
      }}
    >
      <label htmlFor={id}>Agregar fotos o arrastrarlas aquí</label>
      <input
        id={id}
        name="fotos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        onChange={(e) => {
          elegir(e.target.files);
          e.target.value = '';
        }}
      />
      <small>
        JPG, PNG o WEBP · Hasta 5 MB por foto · Máximo {MAX_FOTOS_EQUIPO} por equipo; seleccione
        hasta {MAX_FOTOS_POR_CARGA} archivos por vez.
      </small>
      {maxFotos < MAX_FOTOS_EQUIPO && <small>Puede agregar hasta {maxFotos} fotos más.</small>}
      {error && (
        <Notificacion tipo="error" alCerrar={() => setError('')}>
          {error}
        </Notificacion>
      )}
      {archivos.length > 0 && (
        <ul>
          {archivos.map((foto, i) => (
            <li key={`${foto.name}-${i}`}>
              {mostrarVistaPrevia && <VistaPrevia archivo={foto} />}
              <span>{foto.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(archivos.filter((_, indice) => indice !== i))}
                aria-label={`Quitar ${foto.name}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
