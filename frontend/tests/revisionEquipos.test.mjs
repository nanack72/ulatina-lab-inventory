import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resumirRevisionEquipos } from '../src/utils/revisionEquipos.js';

test('el umbral de cinco años incluye 2021 en 2026 pero no 2022', () => {
  const r = resumirRevisionEquipos([{ anio: 2021, anios_revision: 5 }, { anio: 2022, anios_revision: 5 }], 2026);
  assert.equal(r.total, 1); assert.equal(r.porAntiguedad, 1);
});
test('condición y antigüedad no duplican el total', () => {
  const r = resumirRevisionEquipos([
    { anio: 2020, anios_revision: 5, requiere_revision: true },
    { anio: 2025, anios_revision: 5, requiere_revision: true },
    { anio: 2019, anios_revision: 5, requiere_revision: false },
  ], 2026);
  assert.equal(r.total, 3); assert.equal(r.porAntiguedad, 2);
  assert.equal(r.porCondicion, 2); assert.equal(r.ambas, 1);
});
test('los eliminados quedan fuera incluso si cumplen ambos criterios', () => {
  assert.equal(resumirRevisionEquipos([{ eliminado_en: '2026-11-21', anio: 2000, anios_revision: 5, requiere_revision: true }], 2026).total, 0);
});
test('no inventa antigüedad con año ausente, inválido o futuro', () => {
  const equipos = [null, '', undefined, 2027, '2020abc', true, 1899].map(anio => ({ anio, anios_revision: 5 }));
  const r = resumirRevisionEquipos(equipos, 2026);
  assert.equal(r.total, 0); assert.equal(r.sinAnio, equipos.length);
});
test('cada categoría tiene su plazo y puede desactivar el criterio por antigüedad', () => {
  const r = resumirRevisionEquipos([
    { anio: 2010, anios_revision: null },
    { anio: 2020, anios_revision: 10 },
    { anio: 2020, anios_revision: 5 },
  ], 2026);
  assert.equal(r.total, 1); assert.equal(r.sinAnio, 0);
});
test('un estado de mantenimiento no implica deterioro automáticamente', () => {
  assert.equal(resumirRevisionEquipos([{ anio: 2025, anios_revision: 5, estado: 'En mantenimiento', requiere_revision: false }], 2026).total, 0);
});
test('un equipo sin año sí cuenta si su condición requiere revisión', () => {
  const r = resumirRevisionEquipos([{ anio: null, anios_revision: 5, requiere_revision: true }], 2026);
  assert.equal(r.total, 1); assert.equal(r.porCondicion, 1); assert.equal(r.sinAnio, 1);
});
test('usa los datos originales de los equipos adaptados en Inicio', () => {
  assert.equal(resumirRevisionEquipos([{ original: { anio: '2021', anios_revision: 5 } }], 2026).total, 1);
});
