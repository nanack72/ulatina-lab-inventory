import { useEffect, useRef, useState } from 'react';
import { listarFotos, cargarImagen, agregarFoto, borrarFoto } from '../../services/fotosEquipoService';
import AdjuntarFotos from './AdjuntarFotos';
import '../../styles/fotosEquipos.css';

function FotoProtegida({ idEquipo,foto,token }) {
  const [url,setUrl] = useState('');
  const [error,setError] = useState('');
  useEffect(()=>{
    const controlador=new AbortController();let enlace;
    cargarImagen(idEquipo,foto.id_foto,token,controlador.signal).then(blob=>{
      if(controlador.signal.aborted)return;
      enlace=URL.createObjectURL(blob);setUrl(enlace);
    }).catch(error=>{if(!controlador.signal.aborted)setError(error.message);});
    return()=>{controlador.abort();if(enlace)URL.revokeObjectURL(enlace);};
  },[idEquipo,foto.id_foto,token]);
  return url ? <img src={url} alt={`Foto del equipo: ${foto.nombre_archivo}`} loading="lazy" />
    : <p>{error || 'Cargando foto…'}</p>;
}
export default function FotosEquipo({ idEquipo,token,puedeAgregar=false,puedeEliminar=false }) {
  const [fotos,setFotos]=useState([]),[archivos,setArchivos]=useState([]),[recarga,setRecarga]=useState(0);
  const [error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[ocupado,setOcupado]=useState(false);
  const [eliminando,setEliminando]=useState(null),[confirmado,setConfirmado]=useState(false);
  const dialogo=useRef(null),operando=useRef(false);
  useEffect(()=>{
    const controlador=new AbortController();
    listarFotos(idEquipo,token,controlador.signal).then(datos=>{if(!controlador.signal.aborted)setFotos(datos);})
      .catch(error=>{if(!controlador.signal.aborted)setError(error.message);});
    return()=>controlador.abort();
  },[idEquipo,token,recarga]);
  useEffect(()=>{if(eliminando)dialogo.current?.showModal();else dialogo.current?.close();},[eliminando]);
  async function subir() {
    if(operando.current || !archivos.length)return;
    if(archivos.length+fotos.length>10){setError('El equipo puede tener hasta 10 fotos.');return;}
    operando.current=true;setOcupado(true);setError('');setMensaje('');
    const pendientes=[];let guardadas=0;
    for(const archivo of archivos){try{await agregarFoto(idEquipo,archivo,token);guardadas++;}catch(error){pendientes.push(archivo);setError(error.message);}}
    setArchivos(pendientes);setRecarga(v=>v+1);setMensaje(`${guardadas} fotos guardadas.`);
    operando.current=false;setOcupado(false);
  }
  async function eliminar() {
    if(operando.current || !confirmado || !eliminando)return;
    operando.current=true;setOcupado(true);setError('');
    try{await borrarFoto(idEquipo,eliminando.id_foto,token);setEliminando(null);setRecarga(v=>v+1);setMensaje('Foto eliminada.');}
    catch(error){setError(error.message);}
    finally{operando.current=false;setOcupado(false);}
  }
  return <section className="detalle-tarjeta fotos-panel">
    <h2>Fotos del equipo</h2><p>Puede agregarlas después del registro y elegir cuáles conservar.</p>
    {error&&<p role="alert" className="fotos-error">{error}</p>}{mensaje&&<p role="status">{mensaje}</p>}
    {fotos.length===0&&<p>No hay fotos registradas.</p>}
    <div className="fotos-galeria">{fotos.map(foto=><figure key={foto.id_foto}>
      <FotoProtegida idEquipo={idEquipo} foto={foto} token={token}/><figcaption>{foto.nombre_archivo}</figcaption>
      {puedeEliminar&&<button type="button" className="btn btn-contorno" disabled={ocupado}
        onClick={()=>{setConfirmado(false);setEliminando(foto);}}>Eliminar foto</button>}
    </figure>)}</div>
    {puedeAgregar&&<><AdjuntarFotos archivos={archivos} onChange={setArchivos} disabled={ocupado}/>
      <button type="button" className="btn btn-primario" disabled={ocupado||!archivos.length} onClick={subir}>
        {ocupado?'Guardando…':`Guardar fotos (${archivos.length})`}</button></>}
    <dialog ref={dialogo} className="cfg-dialogo" aria-labelledby="foto-eliminar-titulo" onClose={()=>setEliminando(null)}
      onCancel={e=>{if(operando.current)e.preventDefault();}}>
      <h2 id="foto-eliminar-titulo">Eliminar foto</h2><p>{eliminando?.nombre_archivo}</p>
      {error && <p role="alert">{error}</p>}
      <label className="cfg-confirmar-check"><input type="checkbox" checked={confirmado} disabled={ocupado}
        onChange={e=>setConfirmado(e.target.checked)}/>Entiendo que esta foto se eliminará permanentemente.</label>
      <div className="cfg-modal-acciones"><button autoFocus type="button" className="btn btn-secundario" disabled={ocupado} onClick={()=>setEliminando(null)}>Cancelar</button>
        <button type="button" className="btn btn-peligro" disabled={ocupado||!confirmado} onClick={eliminar}>Eliminar foto</button></div>
    </dialog>
  </section>;
}
