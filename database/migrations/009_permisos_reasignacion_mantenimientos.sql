-- ============================================================
-- SISTEMA DE GESTIÓN DE INVENTARIO TECNOLÓGICO
-- Migración 009: Permiso UPDATE(id_usuario_tecnico) en bitacora_mantenimiento (RN15)
-- ============================================================
-- Ejecutar como: neondb_owner
-- Permite a pes_runtime reasignar órdenes abiertas a otro técnico
-- activo autorizado antes de desactivar una cuenta (RN15), sin
-- conceder DELETE ni permitir alterar órdenes finalizadas.
-- ============================================================

BEGIN;

SET LOCAL ROLE pes_owner;

GRANT UPDATE (id_usuario_tecnico)
ON TABLE public.bitacora_mantenimiento
TO pes_runtime;

COMMIT;
