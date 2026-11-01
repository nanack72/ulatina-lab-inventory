
-- ============================================================
-- SISTEMA DE GESTIÓN DE INVENTARIO TECNOLÓGICO
-- Migración 001: Permisos mínimos de pes_runtime
-- ============================================================
--
-- Ejecutar como: neondb_owner
-- Requiere:
--   - Rol pes_runtime creado previamente
--   - Rol pes_owner propietario de las tablas
--   - Permiso para SET ROLE pes_owner
--   - Tablas y secuencias previamente creadas
--
-- No contiene credenciales ni datos de usuarios.
-- No crea ni modifica registros del inventario.
-- ============================================================

BEGIN;

-- Utilizar temporalmente el propietario de las tablas
SET LOCAL ROLE pes_owner;

-- ============================================================
-- 1. LECTURA DE TABLAS
-- ============================================================

GRANT SELECT ON TABLE
    public.rol,
    public.usuario_sede,
    public.usuario_laboratorio,
    public.sede,
    public.laboratorio,
    public.categoria,
    public.estado,
    public.equipo,
    public.historial_cambio,
    public.historial_estado,
    public.historial_ubicacion,
    public.bitacora_mantenimiento,
    public.evidencia_fotografica,
    public.incidencia_reporte
TO pes_runtime;

-- ============================================================
-- 2. LECTURA LIMITADA DE USUARIOS
-- ============================================================

-- Retirar lectura general y permisos anteriores por columna
REVOKE SELECT ON TABLE public.usuario
FROM pes_runtime;

REVOKE SELECT (
    id_usuario,
    id_rol,
    nombre_completo,
    correo_institucional,
    contrasena_hash,
    activo,
    fecha_creacion
)
ON TABLE public.usuario
FROM pes_runtime;

-- Conceder solo las columnas utilizadas por el backend
GRANT SELECT (
    id_usuario,
    id_rol,
    nombre_completo,
    correo_institucional,
    contrasena_hash,
    activo
)
ON TABLE public.usuario
TO pes_runtime;

-- ============================================================
-- 3. REGISTRO Y ACTUALIZACIÓN DE EQUIPOS
-- ============================================================

GRANT INSERT, UPDATE
ON TABLE public.equipo
TO pes_runtime;

-- No se concede DELETE ni TRUNCATE

-- ============================================================
-- 4. HISTORIALES AUTOMÁTICOS
-- ============================================================

GRANT INSERT ON TABLE
    public.historial_cambio,
    public.historial_estado,
    public.historial_ubicacion
TO pes_runtime;

-- Requerido actualmente por mantenimientosController.js
GRANT UPDATE (motivo)
ON TABLE public.historial_estado
TO pes_runtime;

-- ============================================================
-- 5. MÓDULO DE MANTENIMIENTO
-- ============================================================

GRANT INSERT
ON TABLE public.bitacora_mantenimiento
TO pes_runtime;

GRANT UPDATE (
    estado_mantenimiento,
    horas_invertidas,
    descripcion_trabajo
)
ON TABLE public.bitacora_mantenimiento
TO pes_runtime;

-- ============================================================
-- 6. SECUENCIAS
-- ============================================================

GRANT USAGE ON SEQUENCE
    public.equipo_id_equipo_seq,
    public.historial_cambio_id_historial_cambio_seq,
    public.historial_estado_id_historial_estado_seq,
    public.historial_ubicacion_id_historial_ubicacion_seq,
    public.bitacora_mantenimiento_id_bitacora_seq
TO pes_runtime;

COMMIT;

-- ============================================================
-- 7. ACCESO AL ESQUEMA Y BASE DE DATOS
-- Ejecutar nuevamente como neondb_owner
-- ============================================================

GRANT CONNECT ON DATABASE "intentoryNeon"
TO pes_runtime;

GRANT USAGE ON SCHEMA public
TO pes_runtime;

-- La vista administrativa pertenece a neondb_owner.
-- El backend no necesita consultarla directamente.
REVOKE SELECT
ON TABLE public.vw_inventario_general
FROM pes_runtime;

-- ============================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================
