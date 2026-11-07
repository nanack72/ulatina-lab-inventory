import { useEffect, useMemo, useState } from 'react';

import {
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';

import FiltroSelect from '../components/inventario/FiltroSelect';
import FilaEquipo from '../components/inventario/FilaEquipo';
import Paginacion from '../components/inventario/Paginacion';

import { useEquipos } from '../hooks/useEquipos';

import {
  EQUIPOS_POR_PAGINA,
  FILTROS_INICIALES,
  FILTROS_SELECT,
  filtrarEquipos,
  normalizar,
  opcionesUnicas,
} from '../utils/inventario';

import '../styles/inventario.css';

export default function Inventario({
  token,
  puedeRegistrar = false,
  onRegistrarEquipo,
  onVerEquipo,
  onEditarEquipo,
  onTrasladarEquipo,
  onSesionExpirada,
}) {
  // ========================================
  // CONSULTAR EQUIPOS DESDE NEON
  // ========================================

  const {
    equipos,
    cargando,
    error,
    recargar,
  } = useEquipos(token, onSesionExpirada);

  // ========================================
  // ESTADOS DEL INVENTARIO
  // ========================================

  const [filtros, setFiltros] = useState(
    FILTROS_INICIALES
  );

  const [pagina, setPagina] = useState(1);

  const [menuAbierto, setMenuAbierto] = useState(null);

  // ========================================
  // FUNCIONES DE FILTROS
  // ========================================

  function cambiarFiltro(clave, valor) {
    setFiltros((anteriores) => ({
      ...anteriores,
      [clave]: valor,

      ...(clave === 'sede'
        ? { laboratorio: '' }
        : {}),
    }));

    setPagina(1);
    setMenuAbierto(null);
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_INICIALES);
    setPagina(1);
    setMenuAbierto(null);
  }

  function actualizarInventario() {
    setMenuAbierto(null);
    recargar();
  }

  function cambiarPagina(numero) {
    setPagina(numero);
    setMenuAbierto(null);
  }

  // ========================================
  // OPCIONES DE LOS FILTROS
  // ========================================

  const opciones = useMemo(() => {
    const equiposSede = filtros.sede
      ? equipos.filter(
          (equipo) =>
            normalizar(equipo.sede) ===
            normalizar(filtros.sede)
        )
      : equipos;

    return {
      sede: opcionesUnicas(
        equipos,
        'sede'
      ),

      laboratorio: opcionesUnicas(
        equiposSede,
        'laboratorio'
      ),

      categoria: opcionesUnicas(
        equipos,
        'categoria'
      ),

      estado: opcionesUnicas(
        equipos,
        'estado'
      ),
    };
  }, [equipos, filtros.sede]);

  // ========================================
  // APLICAR FILTROS
  // ========================================

  const equiposFiltrados = useMemo(
    () => filtrarEquipos(equipos, filtros),
    [equipos, filtros]
  );

  const filtrosActivos = [
    ...FILTROS_SELECT
      .filter(({ clave }) => filtros[clave])
      .map(({ clave, chip }) => ({
        clave,
        nombre: chip(filtros[clave]),
      })),

    ...(filtros.busqueda
      ? [
          {
            clave: 'busqueda',
            nombre: `Búsqueda: ${filtros.busqueda}`,
          },
        ]
      : []),
  ];

  // ========================================
  // PAGINACIÓN
  // ========================================

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      equiposFiltrados.length /
        EQUIPOS_POR_PAGINA
    )
  );

  const paginaActual = Math.min(
    pagina,
    totalPaginas
  );

  const inicio =
    (paginaActual - 1) *
    EQUIPOS_POR_PAGINA;

  const equiposPagina = equiposFiltrados.slice(
    inicio,
    inicio + EQUIPOS_POR_PAGINA
  );

  // ========================================
  // PERMISOS Y ACCIONES
  // ========================================

  const mostrarRegistrar =
    puedeRegistrar &&
    typeof onRegistrarEquipo === 'function';

  // VER DETALLE
  const abrirDetalle =
    typeof onVerEquipo === 'function'
      ? (equipo) => {
          setMenuAbierto(null);
          onVerEquipo(equipo.original);
        }
      : undefined;

  // EDITAR EQUIPO
  const abrirEdicion =
    typeof onEditarEquipo === 'function'
      ? (equipo) => {
          setMenuAbierto(null);
          onEditarEquipo(equipo.original);
        }
      : undefined;

  // TRASLADAR EQUIPO
  const abrirTraslado =
    typeof onTrasladarEquipo === 'function'
      ? (equipo) => {
          setMenuAbierto(null);
          onTrasladarEquipo(equipo.original);
        }
      : undefined;

  // Mostrar la columna de acciones si existe
  // al menos una opción disponible.
  const mostrarAcciones = Boolean(
    abrirDetalle ||
    abrirEdicion ||
    abrirTraslado
  );

  // ========================================
  // CERRAR MENÚ AL HACER CLIC FUERA
  // ========================================

  useEffect(() => {
    if (menuAbierto === null) {
      return undefined;
    }

    function cerrarConClicFuera(evento) {
      if (
        !(evento.target instanceof Element) ||
        !evento.target.closest(
          '.inv-menu-contenedor, .inv-menu-desplegable'
        )
      ) {
        setMenuAbierto(null);
      }
    }

    function cerrarConEscape(evento) {
      if (evento.key === 'Escape') {
        setMenuAbierto(null);
      }
    }

    function cerrarAlDesplazarse() {
      setMenuAbierto(null);
    }

    document.addEventListener(
      'mousedown',
      cerrarConClicFuera
    );

    document.addEventListener(
      'keydown',
      cerrarConEscape
    );

    window.addEventListener(
      'scroll',
      cerrarAlDesplazarse,
      true
    );

    window.addEventListener(
      'resize',
      cerrarAlDesplazarse
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        cerrarConClicFuera
      );

      document.removeEventListener(
        'keydown',
        cerrarConEscape
      );

      window.removeEventListener(
        'scroll',
        cerrarAlDesplazarse,
        true
      );

      window.removeEventListener(
        'resize',
        cerrarAlDesplazarse
      );
    };
  }, [menuAbierto]);

  // ========================================
  // INTERFAZ DEL INVENTARIO
  // ========================================

  return (
    <div className="inv-pagina">

      {/* ENCABEZADO */}
      <div className="inv-encabezado">
        <div className="inv-encabezado-texto">
          <h1>Inventario</h1>

          <p>
            Administre y consulte los equipos
            tecnológicos registrados.
          </p>
        </div>

        <div className="inv-acciones">

          {/* ACTUALIZAR INVENTARIO */}
          <button
            type="button"
            className="inv-boton-actualizar"
            onClick={actualizarInventario}
            disabled={cargando}
            title="Actualizar equipos"
            aria-label="Actualizar inventario"
          >
            <RefreshCw size={17} />
          </button>

          {/* REGISTRAR EQUIPO */}
          {mostrarRegistrar && (
            <button
              type="button"
              className="inv-boton-registrar"
              onClick={onRegistrarEquipo}
            >
              <Plus size={17} />
              <span>Registrar equipo</span>
            </button>
          )}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <section className="inv-contenedor">

        {/* ==================================
            BUSCADOR Y FILTROS
            ================================== */}

        <div className="inv-barra-filtros">

          <div className="inv-buscador">
            <Search
              size={18}
              aria-hidden="true"
            />

            <input
              type="search"
              placeholder="Buscar por placa, serie, marca o modelo..."
              aria-label="Buscar equipos"
              value={filtros.busqueda}
              onChange={(evento) =>
                cambiarFiltro(
                  'busqueda',
                  evento.target.value
                )
              }
            />
          </div>

          <div className="inv-selectores">
            {FILTROS_SELECT.map(
              ({ clave, etiqueta }) => (
                <FiltroSelect
                  key={clave}
                  etiqueta={etiqueta}
                  valor={filtros[clave]}
                  opciones={opciones[clave]}
                  onChange={(valor) =>
                    cambiarFiltro(clave, valor)
                  }
                />
              )
            )}
          </div>
        </div>

        {/* ==================================
            FILTROS ACTIVOS
            ================================== */}

        {filtrosActivos.length > 0 && (
          <div className="inv-filtros-activos">

            <span className="inv-etiqueta-filtros">
              Filtros activos:
            </span>

            <div className="inv-chips">
              {filtrosActivos.map(
                ({ clave, nombre }) => (
                  <button
                    key={clave}
                    type="button"
                    className="inv-chip"
                    onClick={() =>
                      cambiarFiltro(clave, '')
                    }
                    title={`Quitar filtro ${nombre}`}
                  >
                    {nombre}

                    <X
                      size={12}
                      aria-hidden="true"
                    />
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="inv-limpiar"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* ==================================
            MENSAJES DE ERROR
            ================================== */}

        {error && (
          <div
            className="inv-mensaje inv-mensaje--error"
            role="alert"
          >
            <AlertCircle size={19} />

            <span>{error}</span>

            <button
              type="button"
              onClick={actualizarInventario}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* MENSAJE DE CARGA */}
        {cargando && !error && (
          <div
            className="inv-mensaje"
            role="status"
          >
            Cargando equipos autorizados...
          </div>
        )}

        {/* ==================================
            TABLA DE EQUIPOS
            ================================== */}

        {!cargando && !error && (
          <>
            <div className="inv-tabla-contenedor">
              <table className="inv-tabla">

                {/* ENCABEZADOS */}
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Equipo</th>
                    <th>Categoría</th>
                    <th>Marca / Modelo</th>
                    <th>Ubicación</th>
                    <th>Estado</th>

                    {mostrarAcciones && (
                      <th className="inv-columna-acciones">
                        <span className="inv-sr-only">
                          Acciones
                        </span>
                      </th>
                    )}
                  </tr>
                </thead>

                {/* FILAS */}
                <tbody>
                  {equiposPagina.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          mostrarAcciones ? 7 : 6
                        }
                        className="inv-tabla-vacia"
                      >
                        {equipos.length === 0
                          ? 'No hay equipos disponibles para tu usuario.'
                          : 'No se encontraron equipos con los filtros seleccionados.'}
                      </td>
                    </tr>
                  ) : (
                    equiposPagina.map((equipo) => (
                      <FilaEquipo
                        key={equipo.clave}
                        equipo={equipo}

                        menuAbierto={
                          menuAbierto === equipo.clave
                        }

                        onAlternarMenu={() =>
                          setMenuAbierto(
                            menuAbierto === equipo.clave
                              ? null
                              : equipo.clave
                          )
                        }

                        onVer={abrirDetalle}
                        onEditar={abrirEdicion}
                        onTrasladar={abrirTraslado}
                      />
                    ))
                  )}
                </tbody>

              </table>
            </div>

            {/* ==================================
                PAGINACIÓN
                ================================== */}

            <Paginacion
              pagina={paginaActual}
              total={equiposFiltrados.length}
              onCambiar={cambiarPagina}
            />

          </>
        )}
      </section>
    </div>
  );
}
