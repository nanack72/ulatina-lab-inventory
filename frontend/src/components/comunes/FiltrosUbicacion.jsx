import { useId } from 'react';
import { opcionesUbicacion } from '../../utils/ubicaciones';
export default function FiltrosUbicacion({ ubicaciones, sede, laboratorio, alCambiar }) {
  const id = useId();
  const opciones = opcionesUbicacion(ubicaciones, sede);
  return (
    <>
      <label htmlFor={id + '-sede'}>
        Sede
        <select
          id={id + '-sede'}
          name="sede"
          value={sede}
          onChange={(e) => alCambiar(e.target.value, '')}
        >
          <option value="">Todas las sedes</option>
          {opciones.sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={id + '-lab'}>
        Laboratorio
        <select
          id={id + '-lab'}
          name="laboratorio"
          value={laboratorio}
          onChange={(e) => alCambiar(sede, e.target.value)}
        >
          <option value="">Todos los laboratorios</option>
          {opciones.laboratorios.map((l) => (
            <option key={l.id_laboratorio} value={l.id_laboratorio}>
              {l.codigo} · {l.nombre}
              {!sede ? ' · ' + l.nombre_sede : ''}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
