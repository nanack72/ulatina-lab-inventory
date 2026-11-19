import { useCallback, useState } from 'react';
import { DialogoModulo, Aviso, Insignia, PaginacionModulo } from '../comunes/Modulo';
import ImagenProtegida from '../comunes/ImagenProtegida';
import { useListadoModulo } from '../../hooks/useListadoModulo';
import { consultarEvidenciasPorBitacora } from '../../services/evidenciasService';
import { formatearFechaMantenimiento } from '../../utils/mantenimiento';
export default function ModalVerEvidencias({ mantenimiento, abierto, alCerrar, token }) {
  const [ampliada, setAmpliada] = useState(null),
    [pagina, setPagina] = useState(1);
  const cargar = useCallback(
    (signal) => consultarEvidenciasPorBitacora(mantenimiento.id_bitacora, token, signal),
    [mantenimiento.id_bitacora, token]
  );
  const { datos, cargando, error } = useListadoModulo(cargar);
  const lista = datos || [],
    actual = Math.min(pagina, Math.max(1, Math.ceil(lista.length / 6)));
  return (
    <>
      <DialogoModulo
        abierto={abierto}
        alCerrar={alCerrar}
        titulo={'Evidencias del mantenimiento #' + mantenimiento.id_bitacora}
        descripcion={
          mantenimiento.nombre_equipo + ' · ' + (mantenimiento.placa_institucional || 'Sin placa')
        }
      >
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
                    aria-label={'Ampliar evidencia ' + e.id_evidencia}
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
