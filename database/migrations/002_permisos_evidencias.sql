BEGIN;

SET LOCAL ROLE pes_owner;

GRANT INSERT ON TABLE public.evidencia_fotografica TO pes_runtime;

GRANT USAGE ON SEQUENCE public.evidencia_fotografica_id_evidencia_seq
TO pes_runtime;

COMMIT;

