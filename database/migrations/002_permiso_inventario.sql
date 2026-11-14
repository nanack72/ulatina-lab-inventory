BEGIN;

SET LOCAL ROLE pes_owner;

ALTER TABLE public.usuario
ADD COLUMN permiso_inventario VARCHAR(10)
NOT NULL DEFAULT 'consulta';

ALTER TABLE public.usuario
ADD CONSTRAINT usuario_permiso_inventario_check
CHECK (permiso_inventario IN ('consulta', 'registro', 'edicion'));

UPDATE public.usuario u
SET permiso_inventario = 'edicion'
FROM public.rol r
WHERE r.id_rol = u.id_rol
  AND LOWER(TRIM(r.nombre)) IN (
      'tecnico',
      'técnico',
      'superadministrador'
  );

COMMIT;