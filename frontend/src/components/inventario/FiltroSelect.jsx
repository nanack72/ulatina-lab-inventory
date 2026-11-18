import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

export default function FiltroSelect({
  etiqueta,
  valor,
  opciones,
  onChange,
}) {
  const id = useId();
  return (
    <div className="inv-select-contenedor">
      <label className="selector-etiqueta" htmlFor={id}>Filtrar por {etiqueta.toLowerCase()}</label>
      <select
        id={id}
        name={etiqueta}
        aria-label={`Filtrar por ${etiqueta.toLowerCase()}`}
        value={valor}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        <option value="">{etiqueta}</option>

        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>

      <ChevronDown
        size={14}
        aria-hidden="true"
      />
    </div>
  );
}
