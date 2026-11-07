import { ChevronDown } from 'lucide-react';

export default function FiltroSelect({
  etiqueta,
  valor,
  opciones,
  onChange,
}) {
  return (
    <div className="inv-select-contenedor">
      <select
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
