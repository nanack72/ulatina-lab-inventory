import Notificacion from '../comunes/Notificacion';
import { useEffect, useRef, useState } from 'react';
import { listarFotos, agregarFoto, borrarFoto } from '../../services/fotosEquipoService';
import AdjuntarFotos from './AdjuntarFotos';
import { MAX_FOTOS_EQUIPO } from '../../utils/limitesFotos';
import CarruselFotos from './CarruselFotos';
import '../../styles/fotosEquipos.css';

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
    if(archivos.length+fotos.length>MAX_FOTOS_EQUIPO){setError(`El equipo puede tener hasta ${MAX_FOTOS_EQUIPO} fotos; tiene ${fotos.length} guardadas.`);return;}
    operando.current=true;setOcupado(true);setError('');setMensaje('');
    const pendientes=[];let guardadas=0;
    for(const archivo of archivos){try{await agregarFoto(idEquipo,archivo,token);guardadas++;}catch(error){pendientes.push(archivo);setError(error.message);}}
    setArchivos(pendientes);setRecarga(v=>v+1);setMensaje(guardadas > 0 ? `${guardadas} fotos guardadas.` : '');
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
    {error&&!eliminando&&<Notificacion tipo="error">{error}</Notificacion>}{mensaje&&<Notificacion tipo="exito">{mensaje}</Notificacion>}
    <CarruselFotos fotos={fotos} idEquipo={idEquipo} token={token} puedeEliminar={puedeEliminar} ocupado={ocupado}
      onEliminar={foto=>{setError('');setConfirmado(false);setEliminando(foto);}} />
    {puedeAgregar&&<details className="fotos-agregar"><summary>Agregar fotos al equipo</summary><AdjuntarFotos archivos={archivos} onChange={setArchivos} disabled={ocupado}/>
      <button type="button" className="btn btn-primario" disabled={ocupado||!archivos.length} onClick={subir}>
        {ocupado?'Guardando…':`Guardar fotos (${archivos.length})`}</button></details>}
    <dialog ref={dialogo} className="cfg-dialogo" aria-labelledby="foto-eliminar-titulo" onClose={()=>setEliminando(null)}
      onCancel={e=>{if(operando.current)e.preventDefault();}}>
      <h2 id="foto-eliminar-titulo">Eliminar foto</h2><p>{eliminando?.nombre_archivo}</p>
      {error && <Notificacion tipo="error">{error}</Notificacion>}
      <label className="cfg-confirmar-check"><input type="checkbox" checked={confirmado} disabled={ocupado}
        onChange={e=>setConfirmado(e.target.checked)}/>Entiendo que esta foto se eliminará permanentemente.</label>
      <div className="cfg-modal-acciones"><button autoFocus type="button" className="btn btn-secundario" disabled={ocupado} onClick={()=>setEliminando(null)}>Cancelar</button>
        <button type="button" className="btn btn-peligro" disabled={ocupado||!confirmado} onClick={eliminar}>Eliminar foto</button></div>
    </dialog>
  </section>;
}
