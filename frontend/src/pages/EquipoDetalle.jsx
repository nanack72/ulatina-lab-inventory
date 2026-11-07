import { useEffect, useState } from 'react';

import {
  ArrowLeft,
  Monitor,
  MapPin,
  Cpu,
  Tag,
  Hash,
  CalendarDays,
  FileText,
  AlertCircle,
  RefreshCw,
  Building2,
} from 'lucide-react';

import { obtenerEquipoPorId } from '../services/equiposService';

import HistorialUbicaciones from '../components/inventario/HistorialUbicaciones';

import '../styles/equipoDetalle.css';

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function texto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
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
    );
  }

  return String(valor);
}

function obtenerValor(...valores) {
  for (const valor of valores) {
    const convertido = texto(valor).trim();

    if (convertido) {
      return convertido;
    }
  }

  return '';
}

function nombreSede(valor) {
  if (!valor) {
    return 'No registrada';
  }

  return /^sede\s/i.test(valor)
    ? valor
    : `Sede ${valor}`;
}

function claseEstado(valor) {
  const estado = texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    estado === 'operativo' ||
    estado === 'activo'
  ) {
    return 'detalle-estado--operativo';
  }

  if (estado.includes('mantenimiento')) {
    return 'detalle-estado--mantenimiento';
  }

  if (
    estado.includes('baja') ||
    estado.includes('fuera de servicio') ||
    estado.includes('inactivo')
  ) {
    return 'detalle-estado--baja';
  }

  return 'detalle-estado--otro';
}

// ==========================================
// COMPONENTE CAMPO
// ==========================================

function Campo({
  etiqueta,
  valor,
  icono: Icono,
}) {
  return (
    <div className="detalle-campo">
      <span className="detalle-campo-etiqueta">
        {Icono && (
          <Icono
            size={15}
            aria-hidden="true"
          />
        )}

        {etiqueta}
      </span>

      <span className="detalle-campo-valor">
        {valor || 'No registrado'}
      </span>
    </div>
  );
}

// ==========================================
// COMPONENTE TARJETA
// ==========================================

function Tarjeta({
  titulo,
  icono: Icono,
  children,
}) {
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
}) {
  // Estados.
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  // ========================================
  // CONSULTAR EQUIPO DESDE NEON
  // ========================================

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarDetalle() {
      setCargando(true);
      setError('');
      setEquipo(null);

      try {
        const resultado = await obtenerEquipoPorId(
          idEquipo,
          token,
          controlador.signal
        );

        if (!controlador.signal.aborted) {
          setEquipo(resultado);
        }
      } catch (err) {
        if (controlador.signal.aborted) {
          return;
        }

        setError(
          err.message ||
          'No se pudo consultar el equipo.'
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    cargarDetalle();

    return () => controlador.abort();
  }, [idEquipo, token, recarga]);

  // ========================================
  // ADAPTAR LOS DATOS DEL EQUIPO
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

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div className="detalle-pagina">

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
      {error && !cargando && (
        <div
          className="detalle-mensaje detalle-mensaje--error"
          role="alert"
        >
          <AlertCircle size={21} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setRecarga(
                (valor) => valor + 1
              )
            }
          >
            <RefreshCw size={15} />
            Reintentar
          </button>
        </div>
      )}

      {/* DETALLE DEL EQUIPO */}
      {!cargando && !error && equipo && (
        <>
          {/* ENCABEZADO PRINCIPAL */}
          <div className="detalle-principal">

            <div className="detalle-principal-icono">
              <Monitor size={30} />
            </div>

            <div className="detalle-principal-info">
              <p className="detalle-subtitulo">
                Información detallada del equipo tecnológico
              </p>

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

            <span
              className={`detalle-estado ${claseEstado(
                estado
              )}`}
            >
              <span className="detalle-estado-punto" />
              {estado || 'Sin estado'}
            </span>
          </div>

          {/* ==================================
              TARJETAS DE INFORMACIÓN
              ================================== */}

          <div className="detalle-grid">

            {/* IDENTIFICACIÓN */}
            <Tarjeta
              titulo="Identificación del equipo"
              icono={FileText}
            >
              <Campo
                etiqueta="Nombre del equipo"
                valor={nombre}
                icono={Monitor}
              />

              <Campo
                etiqueta="Número de serie"
                valor={serie}
                icono={Hash}
              />

              <Campo
                etiqueta="Placa institucional"
                valor={placa}
                icono={Tag}
              />

              <Campo
                etiqueta="Categoría"
                valor={categoria}
                icono={Tag}
              />
            </Tarjeta>

            {/* CARACTERÍSTICAS TÉCNICAS */}
            <Tarjeta
              titulo="Características técnicas"
              icono={Cpu}
            >
              <Campo
                etiqueta="Marca"
                valor={texto(equipo.marca)}
              />

              <Campo
                etiqueta="Modelo"
                valor={texto(equipo.modelo)}
              />

              <Campo
                etiqueta="Año"
                valor={texto(
                  equipo.anio ?? equipo.año
                )}
                icono={CalendarDays}
              />

              <Campo
                etiqueta="Características"
                valor={texto(
                  equipo.caracteristicas
                )}
              />
            </Tarjeta>

            {/* UBICACIÓN */}
            <Tarjeta
              titulo="Ubicación del equipo"
              icono={MapPin}
            >
              <Campo
                etiqueta="Sede"
                valor={nombreSede(sede)}
                icono={Building2}
              />

              <Campo
                etiqueta="Laboratorio"
                valor={laboratorio}
                icono={MapPin}
              />

              <Campo
                etiqueta="Ubicación detallada"
                valor={ubicacion}
              />
            </Tarjeta>

            {/* ESTADO Y OBSERVACIONES */}
            <Tarjeta
              titulo="Estado y observaciones"
              icono={FileText}
            >
              <Campo
                etiqueta="Estado actual"
                valor={estado}
              />

              <Campo
                etiqueta="Comentarios"
                valor={texto(
                  equipo.comentarios
                )}
              />
            </Tarjeta>

          </div>

          {/* ==================================
              HISTORIAL DE UBICACIONES
              ================================== */}

          <HistorialUbicaciones
            idEquipo={idEquipo}
            token={token}
            nombresLaboratorios={
              equipo?.id_laboratorio != null &&
              laboratorio
                ? {
                    [equipo.id_laboratorio]: laboratorio,
                  }
                : {}
            }
          />

        </>
      )}
    </div>
  );
}
