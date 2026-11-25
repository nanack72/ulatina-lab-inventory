import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import '../../styles/selectConBusqueda.css';
const normalizar = (texto) =>
  String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export default function SelectConBusqueda({
  id,
  name,
  value,
  onChange,
  opciones,
  placeholder,
  busqueda,
  disabled = false,
  required = false,
}) {
  const uid = useId();
  const [consulta, setConsulta] = useState('');
  const resultados = opciones.filter((o) =>
    normalizar(o.texto + ' ' + (o.busqueda || '')).includes(normalizar(consulta.trim()))
  );
  const elegida = opciones.find((o) => String(o.valor) === String(value));
  const visibles = elegida && !resultados.includes(elegida) ? [elegida, ...resultados] : resultados;
  return (
    <div className="seleccion-buscable">
      <search className="seleccion-buscable-busqueda" aria-label={busqueda}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label={busqueda}
          name={uid + '-buscar'}
          placeholder={busqueda}
          value={consulta}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.preventDefault();
          }}
        />
      </search>
      <select
        id={id}
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        onChange={onChange}
      >
        <option value="">
          {consulta && !resultados.length ? 'Sin coincidencias' : placeholder}
        </option>
        {visibles.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
