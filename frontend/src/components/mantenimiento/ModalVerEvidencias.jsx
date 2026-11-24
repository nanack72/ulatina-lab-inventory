import { useCallback, useRef, useState } from 'react';
import { Lock, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { DialogoModulo, Aviso, Insignia, PaginacionModulo } from '../comunes/Modulo';
import ImagenProtegida from '../comunes/ImagenProtegida';
import { useListadoModulo } from '../../hooks/useListadoModulo';
import {
  consultarEvidenciasPorBitacora,
  subirEvidenciaFotografica,
} from '../../services/evidenciasService';
import { formatearFechaMantenimiento } from '../../utils/mantenimiento';

const normalizarTipo = (texto) =>
  String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function ModalVerEvidencias({
  mantenimiento,
  abierto,
  alCerrar,
  alSubirEvidencia,
  token,
}) {
  const [ampliada, setAmpliada] = useState(null),
    [pagina, setPagina] = useState(1);
  const [archivoNuevo, setArchivoNuevo] = useState(null),
    [tipoNuevo, setTipoNuevo] = useState('Después'),
    [descripcionNueva, setDescripcionNueva] = useState(''),
    [subiendo, setSubiendo] = useState(false),
    [errorSubida, setErrorSubida] = useState('');
  const inputArchivoRef = useRef(null);

  const cargar = useCallback(
    (signal) => consultarEvidenciasPorBitacora(mantenimiento.id_bitacora, token, signal),
    [mantenimiento.id_bitacora, token]
  );
  const { datos, cargando, error, recargar } = useListadoModulo(cargar);
  const lista = datos || [],
    actual = Math.min(pagina, Math.max(1, Math.ceil(lista.length / 6)));

  const ordenFinalizada = mantenimiento.estado_mantenimiento === 'Completado';
  const esCorrectivo = normalizarTipo(mantenimiento.tipo_mantenimiento) === 'correctivo';
  const tiposCargados = lista.map((ev) => normalizarTipo(ev.tipo_evidencia));
  const tieneAntes = tiposCargados.includes('antes');
  const tieneDespues = tiposCargados.includes('despues');

  function manejarSeleccionArchivo(e) {
    const file = e.target.files?.[0];
    setErrorSubida('');
    if (!file) {
      setArchivoNuevo(null);
      return;
    }
    if (!/\.(jpe?g|png|webp)$/i.test(file.name) || file.size > 5242880 || !file.size) {
      setErrorSubida('Adjunte una imagen JPG, PNG o WEBP de hasta 5 MB.');
      e.target.value = '';
      setArchivoNuevo(null);
      return;
    }
    setArchivoNuevo(file);
  }

  async function manejarSubida(e) {
    e.preventDefault();
    if (!archivoNuevo || subiendo) return;
    try {
      setSubiendo(true);
      setErrorSubida('');
      await subirEvidenciaFotografica(
        {
          foto: archivoNuevo,
          id_bitacora: mantenimiento.id_bitacora,
          tipo_evidencia: tipoNuevo,
          descripcion: descripcionNueva.trim() || `Evidencia (${tipoNuevo})`,
        },
        token
      );
      setArchivoNuevo(null);
      setDescripcionNueva('');
      if (inputArchivoRef.current) inputArchivoRef.current.value = '';
      recargar();
      if (alSubirEvidencia) alSubirEvidencia();
    } catch (err) {
      setErrorSubida(err.message || 'No fue posible subir la evidencia fotográfica.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <>
      <DialogoModulo
        abierto={abierto}
        alCerrar={alCerrar}
        titulo="Fotografías del mantenimiento"
        descripcion={
          (mantenimiento.nombre_equipo || 'Equipo sin nombre') + ' · ' + (mantenimiento.placa_institucional || 'Sin placa') + ' · ' + formatearFechaMantenimiento(mantenimiento.fecha_mantenimiento)
        }
        ocupado={subiendo}
      >
        {ordenFinalizada ? (
          <div className="mant-evidencias-solo-lectura" role="note">
            <Lock size={15} aria-hidden="true" />
            <span>Este mantenimiento finalizó. Puede consultar sus datos y fotografías.</span>
          </div>
        ) : (
          <div className="mant-evidencias-requisitos">
            {esCorrectivo ? (
              <>
                <span
                  className={`mant-req-chip ${tieneAntes ? 'mant-req-chip--ok' : 'mant-req-chip--pendiente'}`}
                >
                  {tieneAntes ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  Foto Antes: {tieneAntes ? 'Lista' : 'Pendiente'}
                </span>
                <span
                  className={`mant-req-chip ${tieneDespues ? 'mant-req-chip--ok' : 'mant-req-chip--pendiente'}`}
                >
                  {tieneDespues ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  Foto Después: {tieneDespues ? 'Lista' : 'Pendiente'}
                </span>
              </>
            ) : (
              <span
                className={`mant-req-chip ${lista.length > 0 ? 'mant-req-chip--ok' : 'mant-req-chip--pendiente'}`}
              >
                {lista.length > 0 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                Evidencia para cierre: {lista.length > 0 ? 'Cumplida' : 'Se requiere al menos 1 foto'}
              </span>
            )}
          </div>
        )}
        <Aviso error>{error}</Aviso>
        {cargando ? (
          <p className="mod-vacio" role="status">
            Cargando evidencias…
          </p>
        ) : !lista.length ? (
          <p className="mod-vacio">Este mantenimiento no tiene evidencias.</p>
        ) : (
          <>
            <div className="mod-galeria">
              {lista.slice((actual - 1) * 6, actual * 6).map((e) => (
                <article className="mod-evidencia" key={e.id_evidencia}>
                  <button
                    type="button"
                    aria-label={'Ampliar fotografía: ' + e.tipo_evidencia}
                    onClick={() => setAmpliada(e)}
                  >
                    <ImagenProtegida evidencia={e} token={token} />
                    <span>Ampliar foto</span>
                  </button>
                  <Insignia>{e.tipo_evidencia}</Insignia>
                  <p>{e.descripcion || 'Sin descripción'}</p>
                  <small>{formatearFechaMantenimiento(e.fecha_subida)}</small>
                </article>
              ))}
            </div>
            <PaginacionModulo
              pagina={actual}
              total={lista.length}
              limite={6}
              alCambiar={setPagina}
            />
          </>
        )}
        {!ordenFinalizada && (
          <form className="mod-formulario mant-evidencias-subir" onSubmit={manejarSubida}>
            <h3 className="mant-evidencia-titulo">
              <Upload size={16} aria-hidden="true" />
              <span>Adjuntar nueva evidencia</span>
            </h3>
            <Aviso error>{errorSubida}</Aviso>
            <div className="mod-campos">
              <label className="mod-campo" htmlFor="ev-tipo-nuevo">
                Momento de la fotografía
                <select
                  id="ev-tipo-nuevo"
                  value={tipoNuevo}
                  onChange={(e) => setTipoNuevo(e.target.value)}
                  disabled={subiendo}
                >
                  <option value="Antes">Antes</option>
                  <option value="Durante">Durante</option>
                  <option value="Después">Después</option>
                </select>
              </label>
              <label className="mod-campo" htmlFor="ev-archivo-nuevo">
                Archivo (JPG, PNG o WEBP, máx. 5 MB)
                <input
                  id="ev-archivo-nuevo"
                  ref={inputArchivoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={manejarSeleccionArchivo}
                  disabled={subiendo}
                />
              </label>
            </div>
            <label className="mod-campo" htmlFor="ev-desc-nueva">
              Descripción (opcional)
              <input
                id="ev-desc-nueva"
                type="text"
                maxLength={1000}
                placeholder="Ej. Equipo encendido y operando normalmente tras limpieza..."
                value={descripcionNueva}
                onChange={(e) => setDescripcionNueva(e.target.value)}
                disabled={subiendo}
              />
            </label>
            <div className="mant-evidencias-subir-acciones">
              <button
                type="submit"
                className="btn btn-primario"
                disabled={subiendo || !archivoNuevo}
              >
                <Upload size={15} aria-hidden="true" />
                {subiendo ? 'Subiendo…' : 'Subir evidencia'}
              </button>
            </div>
          </form>
        )}
      </DialogoModulo>
      <DialogoModulo
        abierto={!!ampliada}
        alCerrar={() => setAmpliada(null)}
        titulo="Evidencia ampliada"
      >
        {ampliada && (
          <ImagenProtegida key={ampliada.id_evidencia} evidencia={ampliada} token={token} grande />
        )}
      </DialogoModulo>
    </>
  );
}
