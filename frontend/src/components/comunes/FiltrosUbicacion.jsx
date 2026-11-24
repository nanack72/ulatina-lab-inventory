import FiltroSelect from '../inventario/FiltroSelect';
import { useCallback, useId } from 'react';
import { obtenerUbicaciones } from '../../services/ubicacionesService';
import { useListadoModulo } from '../../hooks/useListadoModulo';
import { Aviso } from './Modulo';

export default function FiltrosUbicacion({
  token,
  valor,
  onChange,
  disabled = false,
  compacto = false,
}) {
  const id = useId();
  const cargar = useCallback((signal) => obtenerUbicaciones(token, signal), [token]);
  const { datos, cargando, error } = useListadoModulo(cargar);
  const laboratorios = (datos?.laboratorios || []).filter(
    (l) => !valor.sede || String(l.id_sede) === valor.sede
  );
  if (compacto)
    return (
      <>
        <Aviso error>{error}</Aviso>
        <FiltroSelect
          etiqueta="Sede"
          valor={valor.sede}
          disabled={disabled || cargando || !!error}
          opciones={(datos?.sedes || []).map((s) => ({
            valor: String(s.id_sede),
            texto: s.nombre,
          }))}
          onChange={(sede) => onChange({ sede, laboratorio: '' })}
        />
        <FiltroSelect
          etiqueta="Laboratorio"
          valor={valor.laboratorio}
          disabled={disabled || cargando || !!error}
          opciones={laboratorios.map((l) => ({ valor: String(l.id_laboratorio), texto: l.nombre }))}
          onChange={(laboratorio) => onChange({ ...valor, laboratorio })}
        />
      </>
    );
  return (
    <>
      <Aviso error>{error}</Aviso>
      <label className="mod-campo" htmlFor={id + '-sede'}>
        Sede
        <select
          id={id + '-sede'}
          value={valor.sede}
          disabled={disabled || cargando || !!error}
          onChange={(e) => onChange({ sede: e.target.value, laboratorio: '' })}
        >
          <option value="">Todas las sedes</option>
          {(datos?.sedes || []).map((s) => (
            <option key={s.id_sede} value={s.id_sede}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="mod-campo" htmlFor={id + '-laboratorio'}>
        Laboratorio
        <select
          id={id + '-laboratorio'}
          value={valor.laboratorio}
          disabled={disabled || cargando || !!error}
          onChange={(e) => onChange({ ...valor, laboratorio: e.target.value })}
        >
          <option value="">Todos los laboratorios</option>
          {laboratorios.map((l) => (
            <option key={l.id_laboratorio} value={l.id_laboratorio}>
              {l.nombre}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
