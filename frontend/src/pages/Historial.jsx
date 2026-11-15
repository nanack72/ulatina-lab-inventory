import { useEffect, useState } from 'react';
import {
  History,
  MapPin,
  ArrowLeftRight,
  Settings2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  AlertCircle,
  UserRound,
} from 'lucide-react';

import { obtenerHistorialGeneral } from '../services/historialGeneralService';
import { generarPaginas } from '../utils/inventario';
import '../styles/historialGeneral.css';

const MOVIMIENTOS_POR_PAGINA = 5;

const TIPOS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'ubicacion', texto: 'Ubicaciones' },
  { valor: 'estado', texto: 'Estados' },
  { valor: 'modificacion', texto: 'Modificaciones' },
];

const CONFIGURACION = {
  ubicacion: {
    icono: MapPin,
    nombre: 'Ubicación',
  },
  estado: {
    icono: ArrowLeftRight,
    nombre: 'Estado',
  },
  modificacion: {
    icono: Settings2,
    nombre: 'Modificación',
  },
};

const CAMPOS = {
  numero_serie: 'Número de serie',
  placa_institucional: 'Placa institucional',
  nombre: 'Nombre',
  marca: 'Marca',
  modelo: 'Modelo',
  anio: 'Año',
  caracteristicas: 'Características',
  comentarios: 'Comentarios',
  id_categoria: 'Categoría',
  id_estado: 'Estado',
  id_laboratorio: 'Laboratorio',
  ubicacion_detalle: 'Ubicación detallada',
};

function nombreAccion(accion) {
  if (!accion) return 'Movimiento registrado';

  if (accion.startsWith('Modificación:')) {
    const campo = accion.replace('Modificación:', '').trim();
    const nombre = CAMPOS[campo] || campo.replaceAll('_', ' ');

    return `Modificación de ${nombre.toLowerCase()}`;
  }

  return accion;
}

function formatoFecha(fecha) {
  if (!fecha) return 'Sin fecha';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(valor);
}

function mostrarValor(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 'Sin valor';
  }

  return String(valor);
}

function Movimiento({
  registro,
  expandido,
  onExpandir,
  onVerEquipo,
}) {
  const configuracion = CONFIGURACION[registro.tipo] || {
    icono: History,
    nombre: 'Movimiento',
  };

  const Icono = configuracion.icono;
  const anterior = mostrarValor(registro.valor_anterior);
  const nuevo = mostrarValor(registro.valor_nuevo);

  return (
    <article className="hg-registro">
      <div className="hg-registro-superior">
        <div className="hg-registro-identidad">
          <span className="hg-registro-icono">
            <Icono size={18} />
          </span>

          <div className="hg-registro-titulo">
            <span className="hg-etiqueta">
              {configuracion.nombre}
            </span>

            <strong>{nombreAccion(registro.accion)}</strong>

            <span className="hg-registro-fecha">
              {formatoFecha(registro.fecha)}
            </span>
          </div>
        </div>

        <div className="hg-responsable">
          <span className="hg-responsable-avatar">
            <UserRound size={15} />
          </span>

          <div>
            <small>Responsable</small>
            <span>{registro.usuario || 'Sistema'}</span>
          </div>
        </div>
      </div>

      <div className="hg-registro-equipo">
        <div>
          <small>Equipo tecnológico</small>

          <button
            type="button"
            className="hg-enlace-equipo"
            onClick={() =>
              onVerEquipo?.({ id_equipo: registro.id_equipo })
            }
          >
            {registro.nombre_equipo || 'Equipo sin nombre'}
            <ArrowRight size={14} />
          </button>

          <span className="hg-placa">
            {registro.placa_institucional || 'Sin placa institucional'}
          </span>
        </div>
      </div>

      <div className="hg-registro-valores">
        <div className="hg-valor hg-valor-anterior">
          <small>Valor anterior</small>

          <p
            className={
              expandido ? 'hg-texto-completo' : 'hg-texto-corto'
            }
          >
            {anterior}
          </p>
        </div>

        <span className="hg-flecha">
          <ArrowRight size={18} />
        </span>

        <div className="hg-valor hg-valor-nuevo">
          <small>Valor nuevo</small>

          <p
            className={
              expandido ? 'hg-texto-completo' : 'hg-texto-corto'
            }
          >
            {nuevo}
          </p>
        </div>
      </div>

      <div className="hg-registro-pie">
        <button
          type="button"
          className="hg-ver-detalles"
          onClick={onExpandir}
          aria-expanded={expandido}
        >
          {expandido ? 'Ocultar detalles' : 'Ver detalles'}

          <ChevronDown
            size={16}
            className={expandido ? 'hg-chevron-abierto' : ''}
          />
        </button>
      </div>
    </article>
  );
}

export default function Historial({
  token,
  onVerEquipo,
  onSesionExpirada,
}) {
  const [tipo, setTipo] = useState('todos');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [registroExpandido, setRegistroExpandido] = useState(null);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setPagina(1);
      setBusqueda(textoBusqueda);
    }, 350);

    return () => clearTimeout(temporizador);
  }, [textoBusqueda]);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarHistorial() {
      setCargando(true);
      setError('');

      try {
        const resultado = await obtenerHistorialGeneral(
          token,
          { tipo, busqueda, desde, hasta, pagina },
          controlador.signal
        );

        if (controlador.signal.aborted) return;

        setRegistros(resultado.data || []);
        setTotal(resultado.total || 0);
        setRegistroExpandido(null);
      } catch (err) {
        if (controlador.signal.aborted) return;

        setRegistros([]);
        setTotal(0);
        setError(err.message || 'Error al cargar el historial.');

        if (err.status === 401) {
          onSesionExpirada?.();
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargarHistorial();

    return () => controlador.abort();
  }, [
    token,
    tipo,
    busqueda,
    desde,
    hasta,
    pagina,
    recarga,
    onSesionExpirada,
  ]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(total / MOVIMIENTOS_POR_PAGINA)
  );

  const inicio = (pagina - 1) * MOVIMIENTOS_POR_PAGINA;
  const fin = Math.min(inicio + MOVIMIENTOS_POR_PAGINA, total);

  return (
    <section className="hg-pagina">
      <div className="hg-encabezado">
        <div>
          <h1>Historial</h1>

          <p>
            Consulte la trazabilidad de los equipos tecnológicos
            y sus movimientos registrados.
          </p>
        </div>

        <div className="hg-contador">
          <History size={17} />
          <span>{total} movimientos</span>
        </div>
      </div>

      <div className="hg-pestanas">
        {TIPOS.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            className={
              tipo === opcion.valor
                ? 'hg-pestana activa'
                : 'hg-pestana'
            }
            onClick={() => {
              setTipo(opcion.valor);
              setPagina(1);
            }}
          >
            {opcion.texto}
          </button>
        ))}
      </div>

      <div className="hg-filtros">
        <label className="hg-busqueda">
          <Search size={17} />

          <input
            type="search"
            value={textoBusqueda}
            onChange={(e) => setTextoBusqueda(e.target.value)}
            placeholder="Buscar equipo, placa o usuario..."
            aria-label="Buscar equipo, placa o usuario"
          />
        </label>

        <div className="hg-fechas">
          <label>
            <span>Desde</span>

            <input
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => {
                setDesde(e.target.value);
                setPagina(1);
              }}
            />
          </label>

          <label>
            <span>Hasta</span>

            <input
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => {
                setHasta(e.target.value);
                setPagina(1);
              }}
            />
          </label>

          <button
            type="button"
            className="hg-actualizar"
            title="Actualizar historial"
            aria-label="Actualizar historial"
            onClick={() => setRecarga((valor) => valor + 1)}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="hg-mensaje hg-error" role="alert">
          <AlertCircle size={20} />
          {error}
        </div>
      ) : cargando ? (
        <div className="hg-mensaje" role="status">
          Cargando movimientos...
        </div>
      ) : registros.length === 0 ? (
        <div className="hg-mensaje">
          <History size={28} />
          <span>No se encontraron movimientos.</span>
        </div>
      ) : (
        <div className="hg-lista-tarjetas">
          {registros.map((registro) => {
            const clave = `${registro.tipo}-${registro.id_movimiento}`;
            const expandido = registroExpandido === clave;

            return (
              <Movimiento
                key={clave}
                registro={registro}
                expandido={expandido}
                onExpandir={() =>
                  setRegistroExpandido(expandido ? null : clave)
                }
                onVerEquipo={onVerEquipo}
              />
            );
          })}
        </div>
      )}

      {!cargando && !error && (
        <div className="hg-paginacion">
          <p>
            {total === 0
              ? 'Mostrando 0 movimientos'
              : `Mostrando ${inicio + 1}–${fin} de ${total.toLocaleString(
                  'es-CR'
                )} movimientos`}
          </p>

          <nav
            className="hg-controles-paginacion"
            aria-label="Paginación del historial general"
          >
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => setPagina((actual) => actual - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft size={15} />
            </button>

            {generarPaginas(pagina, totalPaginas).map(
              (numero, indice) =>
                numero === '...' ? (
                  <span
                    className="hg-puntos"
                    key={`puntos-${indice}`}
                  >
                    ...
                  </span>
                ) : (
                  <button
                    type="button"
                    key={numero}
                    className={
                      pagina === numero ? 'hg-pagina-activa' : ''
                    }
                    aria-label={`Ir a la página ${numero}`}
                    aria-current={
                      pagina === numero ? 'page' : undefined
                    }
                    onClick={() => setPagina(numero)}
                  >
                    {numero}
                  </button>
                )
            )}

            <button
              type="button"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((actual) => actual + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight size={15} />
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}