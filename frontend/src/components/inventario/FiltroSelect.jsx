import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

export default function FiltroSelect({
  etiqueta,
  valor,
  opciones,
  onChange,
  disabled = false,
}) {
  const id = useId();
  return (
    <div className="inv-select-contenedor">
      <label className="selector-etiqueta" htmlFor={id}>Filtrar por {etiqueta.toLowerCase()}</label>
      <select
        id={id}
        disabled={disabled}
        name={etiqueta}
        aria-label={`Filtrar por ${etiqueta.toLowerCase()}`}
        value={valor}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        <option value="">{etiqueta}</option>

        {opciones.map((opcion) => {
          const valorOpcion = typeof opcion === 'string' ? opcion : opcion.valor;
          const textoOpcion = typeof opcion === 'string' ? opcion : opcion.texto;
          return <option key={valorOpcion} value={valorOpcion}>{textoOpcion}</option>;
        })}
      </select>

      <ChevronDown
        size={14}
        aria-hidden="true"
      />
    </div>
  );
}
