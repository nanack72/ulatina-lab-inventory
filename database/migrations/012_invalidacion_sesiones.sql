BEGIN;

SET LOCAL ROLE pes_owner;

ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS version_sesion integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuario_version_sesion_positiva'
      AND conrelid = 'public.usuario'::regclass
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT usuario_version_sesion_positiva CHECK (version_sesion >= 1);
  END IF;
END
$$;

GRANT SELECT (version_sesion) ON TABLE public.usuario TO pes_runtime;
GRANT UPDATE (version_sesion) ON TABLE public.usuario TO pes_runtime;

COMMIT;
