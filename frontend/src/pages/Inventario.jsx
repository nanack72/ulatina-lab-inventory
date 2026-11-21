import { useEffect, useRef, useState } from 'react';

import {
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
  Upload,
} from 'lucide-react';

import FiltroSelect from '../components/inventario/FiltroSelect';
import FilaEquipo from '../components/inventario/FilaEquipo';
import FilaEquipoEliminado from '../components/inventario/FilaEquipoEliminado';
import RestaurarEquipo from '../components/inventario/RestaurarEquipo';
import Paginacion from '../components/inventario/Paginacion';
import ImportarEquipos from '../components/inventario/ImportarEquipos';

import { useInventarioPaginado } from '../hooks/useInventarioPaginado';

import {

  EQUIPOS_POR_PAGINA,
  FILTROS_INICIALES,
  FILTROS_SELECT,
} from '../utils/inventario';

import '../styles/inventario.css';

// ==========================================
// INVENTARIO DE EQUIPOS
// ==========================================

export default function Inventario({
  token,
  puedeRegistrar = false,
  puedeGestionarEliminados = false,
  onRegistrarEquipo,
  onVerEquipo,
  onSesionExpirada,
}) {
  // ========================================
  // ESTADOS DEL INVENTARIO
  // ========================================

  const [filtros, setFiltros] = useState(
    FILTROS_INICIALES
  );

  const [vista, setVista] = useState('activos');
  const [equipoRestaurar, setEquipoRestaurar] = useState(null);
  const [avisoRestauracion, setAvisoRestauracion] = useState('');
  const verEliminados = puedeGestionarEliminados && vista === 'eliminados';
  const filtrosConsulta = { ...filtros, vista: verEliminados ? 'eliminados' : 'activos' };

  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(EQUIPOS_POR_PAGINA);

  const { equipos: equiposPagina, total, totalAutorizados, paginaActual, opciones,
    cargando, error, recargar } = useInventarioPaginado(token, filtrosConsulta, pagina, limite, onSesionExpirada);

  const tablaRef = useRef(null);
  const enfocarPaginaRef = useRef(false);
  useEffect(() => {
    if (!cargando && enfocarPaginaRef.current) {
      enfocarPaginaRef.current = false;
      if (!error) tablaRef.current?.focus();
    }
  }, [cargando, error]);

  const [mostrarImportacion, setMostrarImportacion] = useState(false);

  // ========================================
  // FILTROS Y NAVEGACIÓN
  // ========================================

  function cambiarVista(nuevaVista) {
    if (nuevaVista === (verEliminados ? 'eliminados' : 'activos')) return;
    setVista(nuevaVista);
    setFiltros({ ...FILTROS_INICIALES });
    setPagina(1);
    setAvisoRestauracion('');
  }

  function navegarVistas(evento) {
    const teclas = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!teclas.includes(evento.key)) return;
    evento.preventDefault();
    const botones = Array.from(evento.currentTarget.querySelectorAll('[role="tab"]'));
    const indice = botones.indexOf(document.activeElement);
    const siguiente = evento.key === 'Home' ? 0
      : evento.key === 'End' ? botones.length - 1
      : (indice + (evento.key === 'ArrowRight' ? 1 : -1) + botones.length) % botones.length;
    botones[siguiente]?.focus();
    botones[siguiente]?.click();
  }

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
    if (numero === paginaActual) return;
    enfocarPaginaRef.current = true;
    setPagina(numero);
  }

  function cambiarLimite(nuevoLimite) {
    if (nuevoLimite === limite) return;
    enfocarPaginaRef.current = true;
    setPagina(1);
    setLimite(nuevoLimite);
  }

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
  // PERMISOS Y ACCESO AL DETALLE
  // ========================================

  const mostrarRegistrar =
    puedeRegistrar &&
    typeof onRegistrarEquipo === 'function';

  // La consulta entrega equipos adaptados para
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
            className="btn btn-lg btn-icono"
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

          {puedeRegistrar && (
            <button
              type="button"
              className="btn btn-lg btn-contorno"
              onClick={() => setMostrarImportacion(true)}
            >
              <Upload size={17} aria-hidden="true" />
              <span>Importar equipos</span>
            </button>
          )}

          {/* REGISTRAR EQUIPO */}
          {mostrarRegistrar && (
            <button
              type="button"
              className="btn btn-lg btn-primario inv-boton-registrar"
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

      {equipoRestaurar && puedeGestionarEliminados && (
        <RestaurarEquipo equipo={equipoRestaurar} token={token}
          onCerrar={() => setEquipoRestaurar(null)}
          onRestaurado={(mensaje) => {
            setEquipoRestaurar(null);
            setAvisoRestauracion(mensaje);
            recargar();
          }}
          onSesionExpirada={onSesionExpirada}
        />
      )}
      {avisoRestauracion && <p className="inv-mensaje" role="status">{avisoRestauracion}</p>}
      {puedeGestionarEliminados && (
        <div className="inv-pestanas" role="tablist" aria-label="Vista del inventario" onKeyDown={navegarVistas}>
          {[
            ['activos', 'Activos'],
            ['eliminados', 'Eliminados'],
          ].map(([valor, etiqueta]) => {
            const seleccionada = valor === (verEliminados ? 'eliminados' : 'activos');
            return (
              <button
                key={valor}
                id={`inv-pestana-${valor}`}
                type="button"
                role="tab"
                aria-selected={seleccionada}
                aria-controls="inv-panel-vista"
                tabIndex={seleccionada ? 0 : -1}
                className={`inv-pestana${seleccionada ? ' activa' : ''}`}
                onClick={() => cambiarVista(valor)}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>
      )}
      <section
        id="inv-panel-vista"
        className="inv-contenedor"
        role={puedeGestionarEliminados ? 'tabpanel' : undefined}
        aria-labelledby={puedeGestionarEliminados ? `inv-pestana-${verEliminados ? 'eliminados' : 'activos'}` : undefined}
        tabIndex={puedeGestionarEliminados ? 0 : undefined}
      >

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

            <div ref={tablaRef} className="inv-tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla del inventario">

              <table className="inv-tabla">
                <caption className="inv-sr-only">{verEliminados ? 'Equipos eliminados de los laboratorios autorizados' : 'Equipos del inventario autorizado'}</caption>

                {/* ENCABEZADOS */}
                {verEliminados ? (
                  <thead><tr>
                    <th scope="col">Placa</th><th scope="col">Equipo</th>
                    <th scope="col">Ubicación</th><th scope="col">Fecha de eliminación</th>
                    <th scope="col">Eliminado por</th><th scope="col">Motivo</th>
                    <th scope="col">Acciones</th>
                  </tr></thead>
                ) : (
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
                )}

                {/* FILAS */}
                <tbody>

                  {equiposPagina.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="inv-tabla-vacia"
                      >
                        {totalAutorizados === 0
                          ? (verEliminados ? 'No hay equipos eliminados en tus laboratorios autorizados.' : 'No hay equipos disponibles para tu usuario.')
                          : 'No se encontraron equipos con los filtros seleccionados.'}
                      </td>
                    </tr>
                  ) : (
                    equiposPagina.map((equipo) => (
                      verEliminados ? (
                        <FilaEquipoEliminado key={equipo.clave} equipo={equipo} onRestaurar={setEquipoRestaurar} />
                      ) : (
                        <FilaEquipo key={equipo.clave} equipo={equipo} onVer={abrirDetalle} />
                      )
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
              total={total}
              limite={limite}
              onCambiar={cambiarPagina}
              onCambiarLimite={cambiarLimite}
            />

          </>
        )}

      </section>

      {mostrarImportacion && (
        <ImportarEquipos
          abierto={true}
          token={token}
          onCerrar={() => setMostrarImportacion(false)}
          onImportados={() => {
            setPagina(1);
            recargar();
          }}
        />
      )}
    </div>
  );
}
