import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  TriangleAlert,
  Wrench,
} from 'lucide-react';

import { useEquipos } from '../hooks/useEquipos';
import { useDatosInicio } from '../hooks/useDatosInicio';

import {
  MANTENIMIENTOS_RECIENTES,
  describirActividad,
  diaYMes,
  plural,
  primerNombre,
  resumirInicio,
  saludo,
  tipoMantenimiento,
  tiempoRelativo,
} from '../utils/dashboard';

import { formatearSede } from '../utils/inventario';

import '../styles/inicio.css';

const ICONOS_ACTIVIDAD = {
  registro: Plus,
  traslado: MapPin,
  estado: ArrowLeftRight,
  completado: Check,
  mantenimiento: Wrench,
};

const ETIQUETAS_MANTENIMIENTO = {
  completado: 'Completado',
  proceso: 'En proceso',
  repuesto: 'Pendiente de repuesto',
};

// ==========================================
// COMPONENTES DE LA PANTALLA
// ==========================================

function TarjetaResumen({ titulo, valor, detalle, icono: Icono, tono }) {
  return (
    <article className="ini-kpi">
      <span className={`ini-icono ini-icono--${tono}`}>
        <Icono size={20} aria-hidden="true" />
      </span>

      <div className="ini-kpi-texto">
        <h2>{titulo}</h2>
        <strong>{valor}</strong>
        <small>{detalle}</small>
      </div>
    </article>
  );
}

function Panel({ titulo, subtitulo, enlace, onEnlace, claseExtra = '', children }) {
  return (
    <section className={`ini-panel ${claseExtra}`}>
      <header className="ini-panel-encabezado">
        <div>
          <h2>{titulo}</h2>
          <p>{subtitulo}</p>
        </div>

        {enlace && onEnlace && (
          <button type="button" className="ini-enlace" onClick={onEnlace}>
            {enlace}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        )}
      </header>

      {children}
    </section>
  );
}

function Aviso({ children, conError = false, onReintentar }) {
  return (
    <div
      className={`ini-aviso ${conError ? 'ini-aviso--error' : ''}`}
      role={conError ? 'alert' : 'status'}
    >
      {conError && <AlertCircle size={17} aria-hidden="true" />}
      <span>{children}</span>

      {conError && onReintentar && (
        <button type="button" onClick={onReintentar}>
          <RefreshCw size={14} aria-hidden="true" />
          Reintentar
        </button>
      )}
    </div>
  );
}

function BotonEquipo({ id, onVerEquipo, className, children }) {
  if (typeof onVerEquipo !== 'function' || id == null) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onVerEquipo({ id_equipo: id })}
    >
      {children}
    </button>
  );
}

// ==========================================
// PANTALLA DE INICIO
// ==========================================

export default function Inicio({
  usuario,
  token,
  puedeRegistrar = false,
  onRegistrarEquipo,
  onVerEquipo,
  onIrA,
  onSesionExpirada,
}) {
  const {
    equipos,
    cargando: cargandoEquipos,
    error: errorEquipos,
    recargar: recargarEquipos,
  } = useEquipos(token, onSesionExpirada);

  const {
    mantenimientos,
    actividad,
    cargando: cargandoDatos,
    errorMantenimientos,
    errorActividad,
    ahora,
    recargar: recargarDatos,
  } = useDatosInicio(token, onSesionExpirada);

  const cargando = cargandoEquipos || cargandoDatos;
  const resumen = resumirInicio(equipos, mantenimientos);

  const hoy = new Date(ahora);
  const { dia, mes } = diaYMes(hoy);
  const nombre = primerNombre(usuario?.nombre);

  // Las cifras no se muestran hasta que existan datos reales.
  const equiposListos = !cargando && !errorEquipos;
  const mantenimientosListos = !cargando && !errorMantenimientos;
  const cifra = (listo, valor) => (listo ? valor : '—');

  function recargarTodo() {
    recargarEquipos();
    recargarDatos();
  }

  // Lo que requiere atención hoy (solo se muestran las cifras mayores a cero).
  const alertas = [
    {
      id: 'repuesto',
      cantidad: resumen.esperandoRepuesto,
      titulo: `${plural(
        resumen.esperandoRepuesto,
        'mantenimiento espera',
        'mantenimientos esperan'
      )} repuesto`,
      detalle: 'Revisar la bitácora de mantenimiento',
      tono: 'ambar',
      icono: Wrench,
      destino: 'mantenimiento',
    },
    {
      id: 'baja',
      cantidad: resumen.fueraDeServicio,
      titulo: `${plural(
        resumen.fueraDeServicio,
        'equipo fuera de servicio',
        'equipos fuera de servicio'
      )}`,
      detalle: 'Dados de baja o inactivos',
      tono: 'rojo',
      icono: TriangleAlert,
      destino: 'inventario',
    },
    {
      id: 'proceso',
      cantidad: resumen.enProceso,
      titulo: `${plural(
        resumen.enProceso,
        'mantenimiento en proceso',
        'mantenimientos en proceso'
      )}`,
      detalle: 'Trabajos técnicos abiertos',
      tono: 'azul',
      icono: Clock,
      destino: 'mantenimiento',
    },
  ].filter((alerta) => alerta.cantidad > 0);

  return (
    <div className="ini-pagina">
      {/* ENCABEZADO */}
      <header className="ini-encabezado">
        <div>
          <h1>
            {saludo(hoy)}
            {nombre ? `, ${nombre}` : ''}
          </h1>

          <p>
            Este es el resumen general de los laboratorios para hoy,{' '}
            <span className="ini-fecha">{dia}</span> de {mes}.
          </p>
        </div>

        {puedeRegistrar && (
          <button
            type="button"
            className="ini-boton-registrar"
            onClick={onRegistrarEquipo}
          >
            <Plus size={17} aria-hidden="true" />
            Registrar equipo
          </button>
        )}
      </header>

      {errorEquipos && (
        <Aviso conError onReintentar={recargarTodo}>
          {errorEquipos}
        </Aviso>
      )}

      {/* TARJETAS DE RESUMEN */}
      <section className="ini-kpis" aria-label="Resumen del inventario">
        <TarjetaResumen
          titulo="Total de equipos"
          valor={cifra(equiposListos, resumen.total)}
          detalle={
            equiposListos
              ? `En ${plural(
                  resumen.laboratorios,
                  'laboratorio',
                  'laboratorios'
                )}`
              : 'Consultando…'
          }
          icono={Package}
          tono="gris"
        />

        <TarjetaResumen
          titulo="Equipos operativos"
          valor={cifra(equiposListos, resumen.operativos)}
          detalle={
            equiposListos
              ? `${resumen.porcentajeOperativos}% del inventario`
              : 'Consultando…'
          }
          icono={Check}
          tono="verde"
        />

        <TarjetaResumen
          titulo="En mantenimiento"
          valor={cifra(equiposListos, resumen.enMantenimiento)}
          detalle={
            !mantenimientosListos
              ? 'Consultando…'
              : resumen.esperandoRepuesto > 0
                ? `${resumen.esperandoRepuesto} esperan repuesto`
                : 'Sin repuestos pendientes'
          }
          icono={Wrench}
          tono="ambar"
        />

        <TarjetaResumen
          titulo="Mantenimientos abiertos"
          valor={cifra(mantenimientosListos, resumen.abiertos)}
          detalle={
            mantenimientosListos
              ? plural(resumen.correctivos, 'correctivo', 'correctivos')
              : 'Consultando…'
          }
          icono={Clock}
          tono="azul"
        />
      </section>

      <div className="ini-fila">
        {/* MANTENIMIENTOS RECIENTES */}
        <Panel
          titulo="Mantenimientos recientes"
          subtitulo="Últimas intervenciones técnicas registradas"
          enlace="Ver mantenimientos"
          onEnlace={() => onIrA?.('mantenimiento')}
          claseExtra="ini-panel--tabla"
        >
          {errorMantenimientos ? (
            <Aviso conError onReintentar={recargarDatos}>
              {errorMantenimientos}
            </Aviso>
          ) : cargando ? (
            <Aviso>Consultando mantenimientos…</Aviso>
          ) : mantenimientos.length === 0 ? (
            <Aviso>Todavía no hay mantenimientos registrados.</Aviso>
          ) : (
            <div className="ini-tabla-contenedor">
              <table className="ini-tabla">
                <thead>
                  <tr>
                    <th scope="col">Equipo</th>
                    <th scope="col">Laboratorio</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {mantenimientos
                    .slice(0, MANTENIMIENTOS_RECIENTES)
                    .map((m) => {
                      const estado = tipoMantenimiento(m.estado_mantenimiento);
                      const correctivo =
                        String(m.tipo_mantenimiento).toLowerCase() ===
                        'correctivo';

                      return (
                        <tr key={m.id_bitacora}>
                          <td>
                            <BotonEquipo
                              id={m.id_equipo}
                              onVerEquipo={onVerEquipo}
                              className="ini-equipo"
                            >
                              {m.nombre_equipo || 'Sin nombre'}
                            </BotonEquipo>
                            <small>{m.placa_institucional || 'Sin placa'}</small>
                          </td>

                          <td>
                            {m.nombre_laboratorio}
                            <small>{formatearSede(m.nombre_sede)}</small>
                          </td>

                          <td>
                            <span
                              className={`ini-pill ${
                                correctivo ? 'ini-pill--ambar' : 'ini-pill--gris'
                              }`}
                            >
                              {m.tipo_mantenimiento}
                            </span>
                          </td>

                          <td>
                            <span className={`ini-pill ini-pill--${estado}`}>
                              {ETIQUETAS_MANTENIMIENTO[estado] ??
                                m.estado_mantenimiento}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* REQUIERE ATENCIÓN */}
        <Panel
          titulo="Requiere atención"
          subtitulo="Elementos prioritarios para hoy"
          claseExtra="ini-panel--atencion"
        >
          {!equiposListos || !mantenimientosListos ? (
            <Aviso
              conError={Boolean(errorEquipos || errorMantenimientos)}
              onReintentar={recargarTodo}
            >
              {errorEquipos || errorMantenimientos
                ? 'No se pudo calcular lo pendiente.'
                : 'Revisando pendientes…'}
            </Aviso>
          ) : alertas.length === 0 ? (
            <Aviso>Todo en orden: no hay elementos pendientes.</Aviso>
          ) : (
            <ul className="ini-alertas">
              {alertas.map(({ id, titulo, detalle, tono, icono: Icono, destino }) => (
                <li key={id}>
                  <button type="button" onClick={() => onIrA?.(destino)}>
                    <span className={`ini-icono ini-icono--${tono}`}>
                      <Icono size={19} aria-hidden="true" />
                    </span>

                    <span className="ini-alerta-texto">
                      <strong>{titulo}</strong>
                      <small>{detalle}</small>
                    </span>

                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ACTIVIDAD RECIENTE */}
      <Panel
        titulo="Actividad reciente"
        subtitulo="Últimos movimientos registrados"
        enlace="Ver historial"
        onEnlace={() => onIrA?.('historial')}
      >
        {errorActividad ? (
          <Aviso conError onReintentar={recargarDatos}>
            {errorActividad}
          </Aviso>
        ) : cargando ? (
          <Aviso>Consultando actividad…</Aviso>
        ) : actividad.length === 0 ? (
          <Aviso>Todavía no hay movimientos registrados.</Aviso>
        ) : (
          <ul className="ini-actividad">
            {actividad.map((movimiento) => {
              const { titulo, icono } = describirActividad(movimiento);
              const Icono = ICONOS_ACTIVIDAD[icono] ?? ArrowLeftRight;

              return (
                <li
                  key={`${movimiento.tipo}-${movimiento.id_equipo}-${movimiento.fecha}`}
                >
                  <span className="ini-icono ini-icono--verde ini-icono--redondo">
                    <Icono size={17} aria-hidden="true" />
                  </span>

                  <div>
                    <strong>{titulo}</strong>
                    <small>
                      <BotonEquipo
                        id={movimiento.id_equipo}
                        onVerEquipo={onVerEquipo}
                        className="ini-equipo ini-equipo--chico"
                      >
                        {movimiento.nombre ||
                          movimiento.placa_institucional ||
                          'Equipo'}
                      </BotonEquipo>
                      {' · '}
                      {tiempoRelativo(movimiento.fecha, ahora)}
                    </small>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}