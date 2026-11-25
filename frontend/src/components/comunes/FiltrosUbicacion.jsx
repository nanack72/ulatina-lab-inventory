import SelectConBusqueda from './SelectConBusqueda';
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
  requerido = false,
  conBusqueda = false,
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
        {requerido && (
          <span className="mod-requerido" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        <select
          id={id + '-sede'}
          required={requerido}
          value={valor.sede}
          disabled={disabled || cargando || !!error}
          onChange={(e) => onChange({ sede: e.target.value, laboratorio: '' })}
        >
          <option value="">{requerido ? 'Seleccione una sede' : 'Todas las sedes'}</option>
          {(datos?.sedes || []).map((s) => (
            <option key={s.id_sede} value={s.id_sede}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="mod-campo">
        <label htmlFor={id + '-laboratorio'}>
          Laboratorio
          {requerido && (
            <span className="mod-requerido" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {conBusqueda ? (
          <SelectConBusqueda
            key={valor.sede}
            id={id + '-laboratorio'}
            name="laboratorio"
            required={requerido}
            value={valor.laboratorio}
            disabled={disabled || cargando || !!error || (requerido && !valor.sede)}
            onChange={(e) => onChange({ ...valor, laboratorio: e.target.value })}
            placeholder={valor.sede ? 'Seleccione un laboratorio' : 'Seleccione primero una sede'}
            busqueda="Buscar laboratorio…"
            opciones={laboratorios.map((l) => ({
              valor: String(l.id_laboratorio),
              texto: l.nombre,
              busqueda: l.codigo || '',
            }))}
          />
        ) : (
          <select
            id={id + '-laboratorio'}
            required={requerido}
            value={valor.laboratorio}
            disabled={disabled || cargando || !!error || (requerido && !valor.sede)}
            onChange={(e) => onChange({ ...valor, laboratorio: e.target.value })}
          >
            <option value="">
              {requerido
                ? valor.sede
                  ? 'Seleccione un laboratorio'
                  : 'Seleccione primero una sede'
                : 'Todos los laboratorios'}
            </option>
            {laboratorios.map((l) => (
              <option key={l.id_laboratorio} value={l.id_laboratorio}>
                {l.nombre}
              </option>
            ))}
          </select>
        )}
      </div>
    </>
  );
}
