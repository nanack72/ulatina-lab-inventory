BEGIN;

SET LOCAL ROLE pes_owner;

ALTER TABLE public.evidencia_fotografica
  ADD COLUMN IF NOT EXISTS mime varchar(30),
  ADD COLUMN IF NOT EXISTS datos bytea;

ALTER TABLE public.evidencia_fotografica
  DROP CONSTRAINT IF EXISTS evidencia_fotografica_binario_valido;

ALTER TABLE public.evidencia_fotografica
  ADD CONSTRAINT evidencia_fotografica_binario_valido CHECK (
    (datos IS NULL AND mime IS NULL)
    OR (
      datos IS NOT NULL
      AND mime IN ('image/jpeg', 'image/png', 'image/webp')
      AND octet_length(datos) BETWEEN 1 AND 2097152
    )
  );

GRANT SELECT, INSERT ON TABLE public.evidencia_fotografica TO pes_runtime;

GRANT USAGE ON SEQUENCE public.evidencia_fotografica_id_evidencia_seq
TO pes_runtime;

COMMIT;
