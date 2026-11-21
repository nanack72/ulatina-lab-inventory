BEGIN;
SET LOCAL ROLE pes_owner;
ALTER TABLE public.usuario
  ADD COLUMN puede_eliminar_equipos boolean NOT NULL DEFAULT false;
ALTER TABLE public.equipo
  ADD COLUMN eliminado_en timestamptz,
  ADD COLUMN eliminado_por integer REFERENCES public.usuario(id_usuario),
  ADD COLUMN motivo_eliminacion varchar(500),
  ADD CONSTRAINT equipo_eliminacion_completa CHECK (
    (eliminado_en IS NULL AND eliminado_por IS NULL AND motivo_eliminacion IS NULL)
    OR (eliminado_en IS NOT NULL AND eliminado_por IS NOT NULL
        AND motivo_eliminacion IS NOT NULL AND length(trim(motivo_eliminacion)) BETWEEN 5 AND 500)
  );
CREATE INDEX equipo_no_eliminado_idx ON public.equipo(id_equipo DESC)
  WHERE eliminado_en IS NULL;
GRANT SELECT, UPDATE ON public.equipo TO pes_runtime;
GRANT SELECT, INSERT, UPDATE ON public.usuario TO pes_runtime;
COMMIT;
