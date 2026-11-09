import { useEffect, useState } from 'react';
import {
  ArrowRight,
  History,
  RefreshCw,
  AlertCircle,
  Pencil,
} from 'lucide-react';

import { obtenerHistorialCambios } from '../../services/historialCambiosService';

import '../../styles/historialCambios.css';

const ETIQUETAS = {
  nombre: 'Nombre del equipo',
  numero_serie: 'Número de serie',
  placa_institucional: 'Placa institucional',
  marca: 'Marca',
  modelo: 'Modelo',
  anio: 'Año',
  caracteristicas: 'Características',
  comentarios: 'Comentarios',
  id_categoria: 'Categoría',
};

function nombreCampo(campo) {
  return (
    ETIQUETAS[campo] ||
    String(campo || 'Campo desconocido')
      .replaceAll('_', ' ')
  );
}

function valorVisible(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 'Sin registrar';
  }

  return String(valor);
}

function fechaVisible(fecha) {
  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Costa_Rica',
  }).format(valor);
}

export default function HistorialCambios({
  idEquipo,
  token,
}) {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);
      setError('');

      try {
        const datos = await obtenerHistorialCambios(
          idEquipo,
          token,
          controlador.signal
        );

        if (!controlador.signal.aborted) {
          setRegistros(
            [...datos].sort(
              (a, b) =>
                new Date(b.fecha) - new Date(a.fecha) ||
                b.id_historial_cambio -
                  a.id_historial_cambio
            )
          );
        }
      } catch (err) {
        if (controlador.signal.aborted) return;

        setError(
          err.message ||
          'No se pudo cargar el historial.'
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargar();
    return () => controlador.abort();
  }, [idEquipo, token, recarga]);

  return (
    <section className="hc-panel">
      <header className="hc-encabezado">
        <div className="hc-titulo">
          <span className="hc-icono">
            <History size={20} />
          </span>

          <div>
            <h2>Historial de modificaciones</h2>
            <p>
              Consulte los cambios realizados
              en los datos del equipo.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="hc-actualizar"
          onClick={() => setRecarga((v) => v + 1)}
          disabled={cargando}
          aria-label="Actualizar historial"
          title="Actualizar historial"
        >
          <RefreshCw size={17} />
        </button>
      </header>

      <div className="hc-contenido">
        {cargando && (
          <p role="status">Cargando modificaciones...</p>
        )}

        {!cargando && error && (
          <div className="hc-error" role="alert">
            <AlertCircle size={19} />
            <span>{error}</span>
          </div>
        )}

        {!cargando && !error && (
          <>
            <p className="hc-total">
              {registros.length}{' '}
              {registros.length === 1
                ? 'modificación encontrada'
                : 'modificaciones encontradas'}
            </p>

            {registros.length === 0 ? (
              <p>
                Este equipo todavía no tiene
                modificaciones registradas.
              </p>
            ) : (
              <div className="hc-lista">
                {registros.map((registro) => (
                  <article
                    className="hc-registro"
                    key={registro.id_historial_cambio}
                  >
                    <div className="hc-registro-superior">
                      <div className="hc-campo">
                        <Pencil size={16} />
                        <h3>
                          {nombreCampo(
                            registro.campo_modificado
                          )}
                        </h3>
                      </div>

                      <time dateTime={registro.fecha}>
                        {fechaVisible(registro.fecha)}
                      </time>
                    </div>

                    <div className="hc-comparacion">
                      <div className="hc-valor hc-valor-anterior">
                        <span>Valor anterior</span>
                        <strong>
                          {valorVisible(
                            registro.valor_anterior
                          )}
                        </strong>
                      </div>

                      <ArrowRight
                        size={19}
                        className="hc-flecha"
                        aria-hidden="true"
                      />

                      <div className="hc-valor hc-valor-nuevo">
                        <span>Valor nuevo</span>
                        <strong>
                          {valorVisible(
                            registro.valor_nuevo
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="hc-responsable">
                      Responsable:{' '}
                      <strong>
                        {registro.nombre_usuario ||
                          'No disponible'}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
