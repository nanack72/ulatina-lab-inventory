import { useId, useState } from 'react';

function validarArchivosFotos(archivos) {
  if (archivos.length > 10) return 'Seleccione como máximo 10 fotos.';
  if (archivos.some(f => !/\.(jpe?g|png|webp)$/i.test(f.name) || f.size > 5*1024*1024 || f.size === 0)) {
    return 'Use fotos JPG, PNG o WEBP de hasta 5 MB cada una.';
  }
  return '';
}
export default function AdjuntarFotos({ archivos, onChange, disabled = false }) {
  const id = useId();
  const [error,setError] = useState('');
  function elegir(lista) {
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
    <small>JPG, PNG o WEBP · Hasta 5 MB por foto · Máximo 10 por equipo.</small>
    {error && <p role="alert">{error}</p>}
    {archivos.length > 0 && <ul>{archivos.map((foto,i) => <li key={`${foto.name}-${i}`}>
      <span>{foto.name}</span><button type="button" disabled={disabled} onClick={() => onChange(archivos.filter((_,indice)=>indice!==i))}
        aria-label={`Quitar ${foto.name}`}>Quitar</button>
    </li>)}</ul>}
  </div>;
}
