import { useEffect, useRef, useState } from 'react';

import {
  ArrowLeft,
  Monitor,
  MapPin,
  Cpu,
  Tag,
  Hash,
  AlertCircle,
  RefreshCw,
  History,
  ClipboardList,
  ArrowLeftRight,
  FileClock,
  MessageSquare,
  Pencil,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';

import { useEquipo } from '../hooks/useEquipo';
import { tipoEstado } from '../utils/inventario';

import HistorialUbicaciones from '../components/inventario/HistorialUbicaciones';
import HistorialEstados from '../components/inventario/HistorialEstados';
import HistorialCambios from '../components/inventario/HistorialCambios';

import '../styles/equipoDetalle.css';

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function texto(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }

  if (typeof valor === 'object') {
    return String(
      valor.nombre ??
      valor.descripcion ??
      valor.nombre_estado ??
      valor.nombre_categoria ??
      valor.nombre_laboratorio ??
      valor.nombre_sede ??
      ''
    ).trim();
  }

  return String(valor).trim();
}

function obtenerValor(...valores) {
  for (const valor of valores) {
    const convertido = texto(valor);

    if (convertido) return convertido;
  }

  return '';
}

function nombreSede(valor) {
  const nombre = texto(valor);

  if (!nombre) return 'No registrada';

  return /^sede\s/i.test(nombre)
    ? nombre
    : `Sede ${nombre}`;
}

// ==========================================
// CAMPO DE INFORMACIÓN
// ==========================================

function Campo({ etiqueta, valor }) {
  return (
    <div className="detalle-campo">
      <span className="detalle-campo-etiqueta">
        {etiqueta}
      </span>

      <span className="detalle-campo-valor">
        {valor || 'No registrado'}
      </span>
    </div>
  );
}

// ==========================================
// TARJETA
// ==========================================

function Tarjeta({ titulo, icono: Icono, children }) {
  return (
    <section className="detalle-tarjeta">
      <div className="detalle-tarjeta-encabezado">
        <span className="detalle-icono">
          <Icono size={18} />
        </span>

        <h2>{titulo}</h2>
      </div>

      <div className="detalle-tarjeta-contenido">
        {children}
      </div>
    </section>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function EquipoDetalle({
  idEquipo,
  token,
  onVolver,
  onEditar,
  onTrasladar,
  onCambiarEstado,
  onSesionExpirada,
}) {
  // ========================================
  // CONSULTAR EQUIPO CON EL HOOK
  // ========================================

  const {
    equipo,
    cargando,
    error,
    recargar,
  } = useEquipo(
    idEquipo,
    token,
    onSesionExpirada
  );

  // ========================================
  // NAVEGACIÓN ENTRE PESTAÑAS
  // ========================================

  const [seccionActiva, setSeccionActiva] =
    useState('detalles');

  const [historialActivo, setHistorialActivo] =
    useState('ubicaciones');

  // ========================================
  // MENÚ MÁS ACCIONES
  // ========================================

  const [menuAccionesAbierto, setMenuAccionesAbierto] =
    useState(false);

  const menuAccionesRef = useRef(null);

  const mostrarMenuAcciones =
    typeof onTrasladar === 'function' ||
    typeof onCambiarEstado === 'function';

  useEffect(() => {
    if (!menuAccionesAbierto) return undefined;

    function cerrarAlHacerClicFuera(evento) {
      if (
        menuAccionesRef.current &&
        !menuAccionesRef.current.contains(evento.target)
      ) {
        setMenuAccionesAbierto(false);
      }
    }

    function cerrarConEscape(evento) {
      if (evento.key === 'Escape') {
        setMenuAccionesAbierto(false);
      }
    }

    document.addEventListener(
      'pointerdown',
      cerrarAlHacerClicFuera
    );

    document.addEventListener(
      'keydown',
      cerrarConEscape
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        cerrarAlHacerClicFuera
      );

      document.removeEventListener(
        'keydown',
        cerrarConEscape
      );
    };
  }, [menuAccionesAbierto]);

  // ========================================
  // DATOS DEL EQUIPO
  // ========================================

  const nombre = obtenerValor(
    equipo?.nombre,
    equipo?.nombre_equipo
  );

  const placa = obtenerValor(
    equipo?.placa_institucional,
    equipo?.placa
  );

  const serie = obtenerValor(
    equipo?.numero_serie,
    equipo?.serie
  );

  const categoria = obtenerValor(
    equipo?.categoria,
    equipo?.nombre_categoria,
    equipo?.categoria_nombre
  );

  const estado = obtenerValor(
    equipo?.estado,
    equipo?.nombre_estado,
    equipo?.estado_nombre
  );

  const sede = obtenerValor(
    equipo?.sede,
    equipo?.nombre_sede,
    equipo?.sede_nombre
  );

  const laboratorio = obtenerValor(
    equipo?.laboratorio,
    equipo?.nombre_laboratorio,
    equipo?.laboratorio_nombre
  );

  const ubicacion = obtenerValor(
    equipo?.ubicacion_detalle,
    equipo?.ubicacionDetalle
  );

  const marca = texto(equipo?.marca);
  const modelo = texto(equipo?.modelo);
  const anio = texto(equipo?.anio ?? equipo?.año);
  const caracteristicas = texto(equipo?.caracteristicas);
  const comentarios = texto(equipo?.comentarios);

  const nombresLaboratorios =
    equipo?.id_laboratorio != null && laboratorio
      ? { [equipo.id_laboratorio]: laboratorio }
      : {};

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div className="detalle-pagina detalle-redisenado detalle-distribucion">

      {/* VOLVER AL INVENTARIO */}
      <div className="detalle-navegacion">
        <button
          type="button"
          className="detalle-volver"
          onClick={onVolver}
        >
          <ArrowLeft size={17} />
          Volver al inventario
        </button>
      </div>

      {/* CARGANDO */}
      {cargando && (
        <div
          className="detalle-mensaje"
          role="status"
        >
          Consultando información del equipo...
        </div>
      )}

      {/* ERROR */}
      {!cargando && error && (
        <div
          className="detalle-mensaje detalle-mensaje--error"
          role="alert"
        >
          <AlertCircle size={21} />

          <span>{error}</span>

          <button
            type="button"
            onClick={recargar}
          >
            <RefreshCw size={15} />
            Reintentar
          </button>
        </div>
      )}

      {/* CONTENIDO */}
      {!cargando && !error && equipo && (
        <>
          {/* ==================================
              ENCABEZADO PRINCIPAL
              ================================== */}

          <header className="detalle-principal">

            <div className="detalle-principal-icono">
              <Monitor size={27} />
            </div>

            <div className="detalle-principal-info">

              <span className="detalle-categoria-superior">
                {categoria || 'Sin categoría'}
              </span>

              <h1>
                {nombre || 'Equipo sin nombre'}
              </h1>

              <div className="detalle-identificadores">
                <span>
                  <Tag size={14} />
                  Placa: {placa || 'No registrada'}
                </span>

                <span>
                  <Hash size={14} />
                  Serie: {serie || 'No registrada'}
                </span>
              </div>

            </div>

            {/* ==================================
                ESTADO Y ACCIONES
                ================================== */}

            <div className="detalle-acciones-encabezado">

              {/* ESTADO ACTUAL */}
              <span
                className={`detalle-estado detalle-estado--${tipoEstado(estado)}`}
              >
                <span className="detalle-estado-punto" />
                {estado || 'Sin estado'}
              </span>

              {/* EDITAR EQUIPO */}
              {typeof onEditar === 'function' && (
                <button
                  type="button"
                  className="detalle-boton-editar"
                  onClick={() => onEditar(equipo)}
                >
                  <Pencil size={15} />
                  Editar equipo
                </button>
              )}

              {/* ==================================
                  MENÚ MÁS ACCIONES
                  ================================== */}

              {mostrarMenuAcciones && (
                <div
                  className="detalle-menu-acciones"
                  ref={menuAccionesRef}
                >

                  <button
                    type="button"
                    className="detalle-boton-mas"
                    aria-expanded={menuAccionesAbierto}
                    aria-haspopup="true"
                    onClick={() =>
                      setMenuAccionesAbierto(
                        (abierto) => !abierto
                      )
                    }
                  >
                    <MoreHorizontal size={17} />
                    Más acciones
                    <ChevronDown size={14} />
                  </button>

                  {menuAccionesAbierto && (
                    <div className="detalle-menu-opciones">

                      {/* TRASLADAR EQUIPO */}
                      {typeof onTrasladar === 'function' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuAccionesAbierto(false);
                            onTrasladar(equipo);
                          }}
                        >
                          <ArrowLeftRight size={16} />
                          Trasladar equipo
                        </button>
                      )}

                      {/* CAMBIAR ESTADO */}
                      {typeof onCambiarEstado === 'function' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuAccionesAbierto(false);
                            onCambiarEstado(equipo);
                          }}
                        >
                          <RefreshCw size={16} />
                          Cambiar estado
                        </button>
                      )}

                    </div>
                  )}

                </div>
              )}

            </div>

          </header>

          {/* ==================================
              PESTAÑAS
              ================================== */}

          <nav
            className="detalle-pestanas"
            aria-label="Secciones del equipo"
          >

            <button
              type="button"
              className={`detalle-pestana ${
                seccionActiva === 'detalles'
                  ? 'detalle-pestana--activa'
                  : ''
              }`}
              aria-current={
                seccionActiva === 'detalles'
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                setSeccionActiva('detalles')
              }
            >
              <ClipboardList size={17} />
              Detalles del equipo
            </button>

            <button
              type="button"
              className={`detalle-pestana ${
                seccionActiva === 'historiales'
                  ? 'detalle-pestana--activa'
                  : ''
              }`}
              aria-current={
                seccionActiva === 'historiales'
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                setSeccionActiva('historiales')
              }
            >
              <History size={17} />
              Historiales
            </button>

          </nav>

          {/* ==================================
              DETALLES DEL EQUIPO
              ================================== */}

          {seccionActiva === 'detalles' && (
            <div className="detalle-columnas">

              {/* COLUMNA IZQUIERDA */}
              <div className="detalle-columna-izquierda">

                <Tarjeta
                  titulo="Datos técnicos"
                  icono={Cpu}
                >
                  <div className="detalle-datos-tecnicos">

                    <Campo
                      etiqueta="Marca"
                      valor={marca}
                    />

                    <Campo
                      etiqueta="Modelo"
                      valor={modelo}
                    />

                    <Campo
                      etiqueta="Año"
                      valor={anio}
                    />

                  </div>

                  <div className="detalle-caracteristicas">
                    <Campo
                      etiqueta="Características"
                      valor={caracteristicas}
                    />
                  </div>

                </Tarjeta>

                <Tarjeta
                  titulo="Observaciones"
                  icono={MessageSquare}
                >
                  <Campo
                    etiqueta="Comentarios"
                    valor={comentarios}
                  />
                </Tarjeta>

              </div>

              {/* COLUMNA DERECHA */}
              <div className="detalle-columna-derecha">

                <Tarjeta
                  titulo="Ubicación"
                  icono={MapPin}
                >
                  <Campo
                    etiqueta="Sede"
                    valor={nombreSede(sede)}
                  />

                  <Campo
                    etiqueta="Laboratorio"
                    valor={laboratorio}
                  />

                  <Campo
                    etiqueta="Ubicación detallada"
                    valor={ubicacion}
                  />
                </Tarjeta>

              </div>

            </div>
          )}

          {/* ==================================
              HISTORIALES
              ================================== */}

          {seccionActiva === 'historiales' && (
            <div className="detalle-historiales">

              <div className="detalle-historial-selector">

                <div className="detalle-historial-selector-texto">
                  <h2>Historiales del equipo</h2>

                  <p>
                    Seleccione el tipo de historial
                    que desea consultar.
                  </p>
                </div>

                <div
                  className="detalle-historial-opciones"
                  aria-label="Tipo de historial"
                >

                  {/* UBICACIONES */}
                  <button
                    type="button"
                    className={`detalle-historial-opcion ${
                      historialActivo === 'ubicaciones'
                        ? 'detalle-historial-opcion--activa'
                        : ''
                    }`}
                    aria-pressed={
                      historialActivo === 'ubicaciones'
                    }
                    onClick={() =>
                      setHistorialActivo('ubicaciones')
                    }
                  >
                    <MapPin size={16} />
                    Ubicaciones
                  </button>

                  {/* ESTADOS */}
                  <button
                    type="button"
                    className={`detalle-historial-opcion ${
                      historialActivo === 'estados'
                        ? 'detalle-historial-opcion--activa'
                        : ''
                    }`}
                    aria-pressed={
                      historialActivo === 'estados'
                    }
                    onClick={() =>
                      setHistorialActivo('estados')
                    }
                  >
                    <ArrowLeftRight size={16} />
                    Estados
                  </button>

                  {/* MODIFICACIONES GENERALES */}
                  <button
                    type="button"
                    className={`detalle-historial-opcion ${
                      historialActivo === 'cambios'
                        ? 'detalle-historial-opcion--activa'
                        : ''
                    }`}
                    aria-pressed={
                      historialActivo === 'cambios'
                    }
                    onClick={() =>
                      setHistorialActivo('cambios')
                    }
                  >
                    <FileClock size={16} />
                    Modificaciones generales
                  </button>

                </div>
              </div>

              {/* HISTORIAL DE UBICACIONES */}
              {historialActivo === 'ubicaciones' && (
                <HistorialUbicaciones
                  idEquipo={idEquipo}
                  token={token}
                  nombresLaboratorios={
                    nombresLaboratorios
                  }
                />
              )}

              {/* HISTORIAL DE ESTADOS */}
              {historialActivo === 'estados' && (
                <HistorialEstados
                  idEquipo={idEquipo}
                  token={token}
                />
              )}

              {/* HISTORIAL DE MODIFICACIONES */}

              {historialActivo === 'cambios' && (
                <HistorialCambios
                  idEquipo={idEquipo}
                  token={token}
                />
              )}
              
            </div>
          )}

        </>
      )}
    </div>
  );
}
