import { useMemo, useState } from 'react';

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

// ==========================================
// INVENTARIO DE EQUIPOS
// ==========================================

export default function Inventario({
  token,
  puedeRegistrar = false,
  onRegistrarEquipo,
  onVerEquipo,
  onSesionExpirada,
}) {
  // ========================================
  // CONSULTAR EQUIPOS
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

  // ========================================
  // FILTROS Y NAVEGACIÓN
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
  }

  function limpiarFiltros() {
    setFiltros({ ...FILTROS_INICIALES });
    setPagina(1);
  }

  function cambiarPagina(numero) {
    setPagina(numero);
  }

  // ========================================
  // OPCIONES PARA LOS FILTROS
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
      sede: opcionesUnicas(equipos, 'sede'),

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
  // EQUIPOS FILTRADOS
  // ========================================

  const equiposFiltrados = useMemo(
    () => filtrarEquipos(equipos, filtros),
    [equipos, filtros]
  );

  // ========================================
  // FILTROS ACTIVOS
  // ========================================

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
      equiposFiltrados.length / EQUIPOS_POR_PAGINA
    )
  );

  const paginaActual = Math.min(
    pagina,
    totalPaginas
  );

  const inicio =
    (paginaActual - 1) * EQUIPOS_POR_PAGINA;

  const equiposPagina = equiposFiltrados.slice(
    inicio,
    inicio + EQUIPOS_POR_PAGINA
  );

  // ========================================
  // PERMISOS Y ACCESO AL DETALLE
  // ========================================

  const mostrarRegistrar =
    puedeRegistrar &&
    typeof onRegistrarEquipo === 'function';

  // useEquipos entrega equipos adaptados para
  // la tabla y conserva el registro original.
  const abrirDetalle =
    typeof onVerEquipo === 'function'
      ? (equipo) => {
          onVerEquipo(equipo.original ?? equipo);
        }
      : undefined;

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div className="inv-pagina">

      {/* ==================================
          ENCABEZADO DEL INVENTARIO
          ================================== */}

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
            onClick={recargar}
            disabled={cargando}
            title="Actualizar equipos"
            aria-label="Actualizar inventario"
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />
          </button>

          {/* REGISTRAR EQUIPO */}
          {mostrarRegistrar && (
            <button
              type="button"
              className="inv-boton-registrar"
              onClick={onRegistrarEquipo}
            >
              <Plus
                size={17}
                aria-hidden="true"
              />

              <span>Registrar equipo</span>
            </button>
          )}

        </div>
      </div>

      {/* ==================================
          CONTENEDOR PRINCIPAL
          ================================== */}

      <section className="inv-contenedor">

        {/* ==================================
            BUSCADOR Y FILTROS
            ================================== */}

        <div className="inv-barra-filtros">

          {/* BUSCADOR */}
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

          {/* SELECTORES */}
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
            MENSAJE DE ERROR
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
              onClick={recargar}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ==================================
            CARGANDO EQUIPOS
            ================================== */}

        {cargando && !error && (
          <div
            className="inv-mensaje"
            role="status"
          >
            Cargando equipos autorizados...
          </div>
        )}

        {/* ==================================
            TABLA DEL INVENTARIO
            ================================== */}

        {!cargando && !error && (
          <>

            <div className="inv-tabla-contenedor">

              <table className="inv-tabla">

                {/* ENCABEZADOS */}
                <thead>
                  <tr>
                    <th scope="col">Placa</th>
                    <th scope="col">Equipo</th>
                    <th scope="col">Categoría</th>
                    <th scope="col">
                      Marca / Modelo
                    </th>
                    <th scope="col">Ubicación</th>
                    <th scope="col">Estado</th>

                    {/* FLECHA DE DETALLE */}
                    <th
                      scope="col"
                      className="inv-columna-detalle"
                    >
                      <span className="inv-sr-only">
                        Ver detalle
                      </span>
                    </th>
                  </tr>
                </thead>

                {/* FILAS */}
                <tbody>

                  {equiposPagina.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
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
                        onVer={abrirDetalle}
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
