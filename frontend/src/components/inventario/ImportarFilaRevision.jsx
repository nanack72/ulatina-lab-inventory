import { useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Pencil, RefreshCw, X } from 'lucide-react';

import AdjuntarFotos from './AdjuntarFotos';
import { camposConError, estadoFila, pistaOriginal } from '../../utils/importacion';

const ESTADOS = {
  listo: { texto: 'Listo para importar', Icono: CheckCircle2 },
  error: { texto: 'Por corregir', Icono: AlertTriangle },
  modificado: { texto: 'Cambios sin validar', Icono: RefreshCw },
};

// Campos de texto que se muestran aparte, dentro de "Más datos"
const CAMPOS_TEXTO = [
  { campo: 'nombre', etiqueta: 'Nombre del equipo *', max: 150 },
  { campo: 'placa_institucional', etiqueta: 'Placa institucional', max: 100 },
  { campo: 'numero_serie', etiqueta: 'Número de serie', max: 100 },
  { campo: 'marca', etiqueta: 'Marca', max: 100 },
  { campo: 'modelo', etiqueta: 'Modelo', max: 100 },
  { campo: 'ubicacion_detalle', etiqueta: 'Ubicación detallada', max: 255 },
];

const ETIQUETAS_ORIGINALES = {
  anio_modelo: 'Año y modelo',
  categoria: 'Categoría',
  laboratorio: 'Laboratorio',
  sede: 'Sede',
  estado: 'Estado',
};

export default function ImportarFilaRevision({
  fila,
  catalogos,
  seleccionada,
  deshabilitado,
  onSeleccionar,
  onCambiarCampo,
  onQuitarImagen,
  onCambiarAdjuntos,
}) {
  const [panel, setPanel] = useState(null); // 'fotos' | 'datos' | null

  const estado = estadoFila(fila);
  const { texto: textoEstado, Icono } = ESTADOS[estado];
  const conError = estado === 'error' ? camposConError(fila.errores) : new Set();

  const imagenes = fila.imagenes || [];
  const adjuntos = fila.adjuntos || [];
  const totalFotos = imagenes.length + adjuntos.length;

  const originales = fila.originales || {};
  const originalesRestantes = Object.entries(originales).filter(
    ([campo, valor]) => Boolean(valor) && campo === 'anio_modelo'
  );

  const alternar = (nombre) => setPanel((actual) => (actual === nombre ? null : nombre));

  // Selectores principales: siempre visibles porque son lo que más se corrige
  const selectores = [
    {
      campo: 'id_categoria',
      etiqueta: 'Categoría *',
      vacio: 'Seleccione…',
      opciones: catalogos.categorias.map((o) => ({
        valor: o.id_categoria,
        texto: o.nombre,
      })),
    },
    {
      campo: 'id_estado',
      etiqueta: 'Estado *',
      vacio: 'Seleccione…',
      opciones: catalogos.estados.map((o) => ({
        valor: o.id_estado,
        texto: o.nombre,
      })),
    },
    {
      campo: 'id_laboratorio',
      etiqueta: 'Laboratorio *',
      vacio: 'Seleccione…',
      opciones: catalogos.laboratorios.map((o) => ({
        valor: o.id_laboratorio,
        texto: `${o.nombre_sede} · ${o.nombre}${o.codigo ? ` · ${o.codigo}` : ''}`,
      })),
    },
  ];

  // Campos de texto con error se muestran de inmediato, sin abrir "Más datos"
  const textosConError = CAMPOS_TEXTO.filter(({ campo }) => conError.has(campo));
  const textosOcultos = CAMPOS_TEXTO.filter(({ campo }) => !conError.has(campo));

  function campoTexto({ campo, etiqueta, max }) {
    return (
      <label className="imp-campo" key={campo}>
        <span>{etiqueta}</span>
        <input
          type="text"
          maxLength={max}
          value={fila[campo] ?? ''}
          aria-invalid={conError.has(campo) || undefined}
          onChange={(e) => onCambiarCampo(campo, e.target.value)}
        />
      </label>
    );
  }

  return (
    <article className={`imp-equipo imp-equipo--${estado}`}>
      <header className="imp-equipo-encabezado">
        <label className="imp-equipo-seleccion">
          <input
            type="checkbox"
            checked={seleccionada}
            onChange={(e) => onSeleccionar(e.target.checked)}
          />

          <span className="imp-equipo-titulo">
            <strong>{fila.nombre || 'Equipo sin nombre'}</strong>
            <small>
              Fila {fila.fila} · Placa {fila.placa_institucional || 'sin placa'}
            </small>
          </span>
        </label>

        <span className={`imp-estado imp-estado--${estado}`}>
          <Icono size={13} aria-hidden="true" />
          {textoEstado}
        </span>
      </header>

      {estado === 'error' && (
        <ul className="imp-problemas">
          {fila.errores.map((mensaje, indice) => (
            <li key={indice}>{mensaje}</li>
          ))}
        </ul>
      )}

      <div className="imp-campos imp-campos--clave">
        {selectores.map(({ campo, etiqueta, vacio, opciones }) => {
          const pista = pistaOriginal(originales, campo);
          const sinValor = !fila[campo];

          return (
            <label className="imp-campo" key={campo}>
              <span>{etiqueta}</span>
              <select
                value={fila[campo] ?? ''}
                aria-invalid={conError.has(campo) || undefined}
                onChange={(e) =>
                  onCambiarCampo(campo, e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">{vacio}</option>
                {opciones.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.texto}
                  </option>
                ))}
              </select>
              {sinValor && pista && (
                <small className="imp-pista">En el Excel decía: «{pista}»</small>
              )}
            </label>
          );
        })}

        {textosConError.map(campoTexto)}
      </div>

      <div className="imp-equipo-pie">
        <button
          type="button"
          className="imp-chip"
          aria-expanded={panel === 'fotos'}
          onClick={() => alternar('fotos')}
        >
          <Camera size={14} aria-hidden="true" />
          Fotos ({totalFotos})
        </button>

        <button
          type="button"
          className="imp-chip"
          aria-expanded={panel === 'datos'}
          onClick={() => alternar('datos')}
        >
          <Pencil size={14} aria-hidden="true" />
          Más datos
        </button>

        {imagenes.length > 0 && (
          <span className="imp-miniaturas" aria-hidden="true">
            {imagenes.slice(0, 4).map((imagen, i) => (
              <img key={i} src={`data:${imagen.mime};base64,${imagen.base64}`} alt="" />
            ))}
          </span>
        )}
      </div>

      {panel === 'fotos' && (
        <div className="imp-panel">
          {imagenes.length > 0 && (
            <div className="fotos-galeria">
              {imagenes.map((imagen, i) => (
                <figure key={i}>
                  <img
                    src={`data:${imagen.mime};base64,${imagen.base64}`}
                    alt={`Foto extraída del Excel para ${fila.nombre || 'este equipo'}`}
                  />
                  <figcaption>{imagen.nombre}</figcaption>
                  <button
                    type="button"
                    className="btn btn-sm btn-secundario"
                    onClick={() => onQuitarImagen(i)}
                  >
                    <X size={14} aria-hidden="true" />
                    Quitar foto
                  </button>
                </figure>
              ))}
            </div>
          )}

          <AdjuntarFotos
            archivos={adjuntos}
            disabled={deshabilitado}
            onChange={onCambiarAdjuntos}
          />
        </div>
      )}

      {panel === 'datos' && (
        <div className="imp-panel">
          {originalesRestantes.length > 0 && (
            <p className="imp-nota">
              {originalesRestantes.map(([campo, valor]) => (
                <span key={campo}>
                  {ETIQUETAS_ORIGINALES[campo]} en el Excel: <strong>{valor}</strong>
                </span>
              ))}
            </p>
          )}

          <div className="imp-campos">
            {textosOcultos.map(campoTexto)}

            <label className="imp-campo">
              <span>Año</span>
              <input
                type="number"
                min="1900"
                max="2100"
                step="1"
                value={fila.anio ?? ''}
                aria-invalid={conError.has('anio') || undefined}
                onChange={(e) => onCambiarCampo('anio', e.target.value)}
              />
            </label>

            {[
              ['caracteristicas', 'Características'],
              ['comentarios', 'Comentarios'],
            ].map(([campo, etiqueta]) => (
              <label className="imp-campo imp-campo-ancho" key={campo}>
                <span>{etiqueta}</span>
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={fila[campo] ?? ''}
                  onChange={(e) => onCambiarCampo(campo, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
