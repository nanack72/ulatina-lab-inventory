BEGIN;
SET LOCAL ROLE pes_owner;
ALTER TABLE public.categoria ADD COLUMN anios_revision integer
  CHECK (anios_revision BETWEEN 1 AND 100);
ALTER TABLE public.estado ADD COLUMN requiere_revision boolean NOT NULL DEFAULT false;

-- Umbral inicial para categorías de computadoras; los equipos especializados
-- se configuran por separado y no reciben un plazo arbitrario.
UPDATE public.categoria SET anios_revision = 5
WHERE lower(regexp_replace(normalize(trim(nombre), NFD), U&'[\0300-\036f]', '', 'g'))
  IN ('computo de escritorio', 'computo portatil', 'computadoras de escritorio',
      'computadoras portatiles', 'computadora de escritorio', 'computadora portatil',
      'laptops', 'computadoras');

-- La clasificación es explícita y editable, no depende de buscar palabras
-- parciales en los nombres de estados durante cada consulta.
UPDATE public.estado SET requiere_revision = true
WHERE lower(regexp_replace(normalize(trim(nombre), NFD), U&'[\0300-\036f]', '', 'g'))
  IN ('danado', 'danada', 'inservible', 'obsoleto', 'obsoleta', 'dado de baja',
      'de baja', 'mal estado', 'fuera de servicio');
COMMIT;
