BEGIN;
SET LOCAL ROLE pes_owner;
CREATE TABLE public.historial_eliminacion_equipo (
  id_evento integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_equipo integer NOT NULL REFERENCES public.equipo(id_equipo),
  id_usuario integer NOT NULL REFERENCES public.usuario(id_usuario),
  accion varchar(12) NOT NULL CHECK (accion IN ('eliminar', 'restaurar')),
  fecha timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motivo varchar(500) NOT NULL
);
CREATE INDEX historial_eliminacion_equipo_idx
  ON public.historial_eliminacion_equipo (id_equipo, fecha DESC);
-- Conservar también las eliminaciones efectuadas antes de esta migración.
INSERT INTO public.historial_eliminacion_equipo
  (id_equipo, id_usuario, accion, fecha, motivo)
SELECT id_equipo, eliminado_por, 'eliminar', eliminado_en, motivo_eliminacion
FROM public.equipo WHERE eliminado_en IS NOT NULL;
GRANT SELECT, INSERT ON public.historial_eliminacion_equipo TO pes_runtime;
GRANT USAGE ON SEQUENCE public.historial_eliminacion_equipo_id_evento_seq TO pes_runtime;
COMMIT;
