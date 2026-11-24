BEGIN;

SET LOCAL ROLE pes_owner;

GRANT UPDATE (id_usuario_tecnico)
ON TABLE public.bitacora_mantenimiento
TO pes_runtime;

COMMIT;
