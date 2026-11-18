import { useId, useState } from 'react';
import { MAX_FOTOS_EQUIPO, MAX_FOTOS_POR_CARGA } from '../../utils/limitesFotos';

function validarArchivosFotos(archivos) {
  if (archivos.length > MAX_FOTOS_EQUIPO) return `Seleccione como máximo ${MAX_FOTOS_EQUIPO} fotos.`;
  if (archivos.some(f => !/\.(jpe?g|png|webp)$/i.test(f.name) || f.size > 5*1024*1024 || f.size === 0)) {
    return 'Use fotos JPG, PNG o WEBP de hasta 5 MB cada una.';
  }
  return '';
}
export default function AdjuntarFotos({ archivos, onChange, disabled = false }) {
  const id = useId();
  const [error,setError] = useState('');
  function elegir(lista) {
    if (Array.from(lista || []).length > MAX_FOTOS_POR_CARGA) { setError(`Seleccione hasta ${MAX_FOTOS_POR_CARGA} archivos por vez. Puede repetir para agregar más.`); return; }
    const nuevas = [...archivos,...Array.from(lista || [])];
    const problema = validarArchivosFotos(nuevas);
    setError(problema);
    if (!problema) onChange(nuevas);
  }
  return <div className="fotos-adjuntar" onDragOver={e => e.preventDefault()}
    onDrop={e => {e.preventDefault();if(!disabled)elegir(e.dataTransfer.files);}}>
    <label htmlFor={id}>Agregar fotos o arrastrarlas aquí</label>
    <input id={id} name="fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled}
      onChange={e => {elegir(e.target.files);e.target.value='';}} />
    <small>JPG, PNG o WEBP · Hasta 5 MB por foto · Máximo {MAX_FOTOS_EQUIPO} por equipo; seleccione hasta {MAX_FOTOS_POR_CARGA} archivos por vez.</small>
    {error && <p role="alert">{error}</p>}
    {archivos.length > 0 && <ul>{archivos.map((foto,i) => <li key={`${foto.name}-${i}`}>
      <span>{foto.name}</span><button type="button" disabled={disabled} onClick={() => onChange(archivos.filter((_,indice)=>indice!==i))}
        aria-label={`Quitar ${foto.name}`}>Quitar</button>
    </li>)}</ul>}
  </div>;
}
