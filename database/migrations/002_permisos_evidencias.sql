-- ============================================================
-- SISTEMA DE GESTIÓN DE INVENTARIO TECNOLÓGICO
-- Migración 002: Permisos de pes_runtime para evidencias fotográficas
-- ============================================================
--
-- Ejecutar como: neondb_owner
-- Requiere: migración 001 aplicada y tabla public.evidencia_fotografica
--
-- Permite al backend registrar evidencias (INSERT) y usar la secuencia
-- de id_evidencia. No se concede UPDATE, DELETE ni TRUNCATE.
-- ============================================================

BEGIN;

SET LOCAL ROLE pes_owner;

GRANT INSERT ON TABLE public.evidencia_fotografica TO pes_runtime;

GRANT USAGE ON SEQUENCE public.evidencia_fotografica_id_evidencia_seq
TO pes_runtime;

COMMIT;

