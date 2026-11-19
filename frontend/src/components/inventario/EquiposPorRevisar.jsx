import { useEffect, useId, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { consultarEquiposRevision } from '../../services/equiposRevisionService';

const MOTIVOS = {
  antiguedad: 'Antigüedad',
  repuesto: 'Repuesto pendiente',
  inactivo: 'Inactivo / fuera de servicio',
  falla: 'Falla registrada',
  obsoleto: 'Obsolescencia registrada',
};
const LIMITE = 5;

// Los avisos son de solo lectura. Un técnico determina si corresponde sustituir un equipo.
export default function EquiposPorRevisar({ token, onVerEquipo }) {
  const id = useId();
  const [pagina, setPagina] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controlador = new AbortController();
    async function cargar() {
      setCargando(true);
      setError('');
      try {
        const resultado = await consultarEquiposRevision({ pagina, motivo }, token, controlador.signal);
        if (controlador.signal.aborted) return;
        setDatos(resultado);
        if (resultado.pagina !== pagina) setPagina(resultado.pagina);
      } catch (err) {
        if (!controlador.signal.aborted) setError(err.message || 'No se pudieron consultar los equipos.');
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    }
    cargar();
    return () => controlador.abort();
  }, [token, pagina, motivo, recarga]);

  const total = datos?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const paginaVisible = datos?.pagina || pagina;

  return (
    <section className="ini-panel revision-panel" aria-labelledby={id + '-titulo'}>
      <header className="revision-cabecera">
        <div>
          <h2 id={id + '-titulo'}>Equipos por revisar</h2>
          <p>Referencia: {datos?.edad_referencia ?? 8} años. Los avisos no cambian el estado del equipo.</p>
        </div>
        <div className="revision-controles">
          <label htmlFor={id + '-motivo'}>
            Motivo
            <select id={id + '-motivo'} value={motivo} onChange={(e) => { setMotivo(e.target.value); setPagina(1); }}>
              <option value="">Todos los motivos</option>
              {Object.entries(MOTIVOS).map(([clave, etiqueta]) => (
                <option key={clave} value={clave}>{etiqueta}</option>
              ))}
            </select>
          </label>
          <button type="button" className="revision-actualizar" onClick={() => setRecarga((v) => v + 1)} disabled={cargando} aria-label="Actualizar equipos por revisar">
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        </div>
      </header>
      {error && <p className="revision-error" role="alert">{error}</p>}
      <div className="revision-tabla-wrap" role="region" aria-label="Equipos que requieren evaluación" tabIndex={0} aria-busy={cargando}>
        <table className="revision-tabla">
          <caption className="revision-solo-lectores">Equipos que requieren evaluación técnica</caption>
          <thead>
            <tr><th scope="col">Equipo</th><th scope="col">Ubicación</th><th scope="col">Estado actual</th><th scope="col">Motivos de revisión</th></tr>
          </thead>
          <tbody>
            {!cargando && !error && (datos?.data || []).map((e) => (
              <tr key={e.id_equipo}>
                <td>
                  <button className="revision-enlace" type="button" onClick={() => onVerEquipo?.({ id_equipo: e.id_equipo })}>{e.nombre}</button>
                  <small>{e.placa_institucional || 'Sin placa'}</small>
                </td>
                <td>{e.laboratorio}<small>{e.nombre_sede}</small></td>
                <td>{e.estado || 'Sin estado'}</td>
                <td><div className="revision-motivos">
                  {(e.motivos || []).map((m) => (
                    <span key={m} className={'revision-motivo ' + (m === 'falla' ? 'revision-motivo--falla' : '')}>
                      {m === 'antiguedad' ? `${e.antiguedad} años (año ${e.anio})` : MOTIVOS[m] || m}
                    </span>
                  ))}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {cargando && <p className="revision-vacio" role="status">Cargando equipos por revisar…</p>}
        {!cargando && !error && !(datos?.data?.length > 0) && (
          <p className="revision-vacio" role="status">No hay equipos con estos motivos de revisión.</p>
        )}
      </div>
      <p className="revision-nota">
        La antigüedad se estima a partir del año registrado, no de la compra. Un repuesto pendiente requiere seguimiento, pero no confirma su indisponibilidad definitiva.
        {datos?.sin_anio_valido > 0 && ` ${datos.sin_anio_valido} equipo(s) sin año válido no se evalúa(n) por antigüedad.`}
      </p>
      {total > LIMITE && (
        <nav className="revision-paginacion" aria-label="Paginación de equipos por revisar">
          <span>Página {paginaVisible} de {totalPaginas} · {total} equipos</span>
          <div>
            <button type="button" onClick={() => setPagina((v) => Math.max(1, v - 1))} disabled={paginaVisible <= 1 || cargando}>Anterior</button>
            <button type="button" onClick={() => setPagina((v) => Math.min(totalPaginas, v + 1))} disabled={paginaVisible >= totalPaginas || cargando}>Siguiente</button>
          </div>
        </nav>
      )}
    </section>
  );
}
