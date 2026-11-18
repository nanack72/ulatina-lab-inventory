BEGIN;
SET LOCAL ROLE pes_owner;
GRANT SELECT, INSERT, DELETE ON public.rol TO pes_runtime;
GRANT UPDATE(nombre) ON public.rol TO pes_runtime;
DO $$ DECLARE secuencia text; BEGIN
  secuencia := pg_get_serial_sequence('public.rol','id_rol');
  IF secuencia IS NOT NULL THEN EXECUTE format('GRANT USAGE ON SEQUENCE %s TO pes_runtime', secuencia); END IF;
END $$;
COMMIT;
