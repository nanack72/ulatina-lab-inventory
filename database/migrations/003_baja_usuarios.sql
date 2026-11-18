-- Ejecutar con el propietario de las tablas. No elimina ni desactiva registros.
BEGIN;
SET LOCAL ROLE pes_owner;
GRANT DELETE ON public.usuario, public.usuario_laboratorio,
  public.usuario_sede, public.token_revocado TO pes_runtime;
-- No se conceden permisos de borrado sobre historiales o actividad.
COMMIT;
