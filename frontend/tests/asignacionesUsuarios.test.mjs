import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asignarSedes, asignarLaboratorios, filtrarLaboratorios } from '../src/utils/asignacionesUsuarios.js';

const laboratorios = [
  { id_laboratorio: 1, id_sede: 1, nombre: 'Laboratorio de Cómputo', codigo: 'COM-01', nombre_sede: 'Heredia' },
  { id_laboratorio: 2, id_sede: 1, nombre: 'Laboratorio de Redes', codigo: 'RED-01', nombre_sede: 'Heredia' },
  { id_laboratorio: 3, id_sede: 2, nombre: 'Laboratorio de Física', codigo: 'FIS-01', nombre_sede: 'San Pedro' },
];
const formulario = { nombre_completo: 'Persona', sedes: [1, 2], laboratorios: [1, 2, 3] };

test('busca por nombre sin tildes, por código y por sede', () => {
  assert.deepEqual(filtrarLaboratorios(laboratorios, '  computo ').map(l => l.id_laboratorio), [1]);
  assert.deepEqual(filtrarLaboratorios(laboratorios, 'red-01').map(l => l.id_laboratorio), [2]);
  assert.deepEqual(filtrarLaboratorios(laboratorios, 'SAN PEDRO').map(l => l.id_laboratorio), [3]);
  assert.equal(filtrarLaboratorios(laboratorios, '').length, 3);
  assert.equal(filtrarLaboratorios(laboratorios, 'no existe').length, 0);
});
test('quitar una sede retira únicamente sus laboratorios', () => {
  const actualizado = asignarSedes(formulario, [1], laboratorios);
  assert.deepEqual(actualizado.laboratorios, [1, 2]);
  assert.deepEqual(actualizado.sedes, [1]);
  assert.deepEqual(formulario.laboratorios, [1, 2, 3]);
});
test('quitar todas las sedes limpia todas las asignaciones de laboratorios', () => {
  assert.deepEqual(asignarSedes(formulario, [], laboratorios).laboratorios, []);
});
test('seleccionar todas las sedes no asigna laboratorios automáticamente', () => {
  const actualizado = asignarSedes({ ...formulario, sedes: [1], laboratorios: [2] }, [1, 2], laboratorios);
  assert.deepEqual(actualizado.sedes, [1, 2]);
  assert.deepEqual(actualizado.laboratorios, [2]);
});
test('seleccionar resultados conserva los seleccionados fuera de la búsqueda sin duplicarlos', () => {
  const actual = { ...formulario, laboratorios: [1, 3] };
  assert.deepEqual(asignarLaboratorios(actual, [2], laboratorios, true).laboratorios, [1, 3, 2]);
  assert.deepEqual(asignarLaboratorios(actual, [1], laboratorios, true).laboratorios, [1, 3]);
});
test('quitar resultados no desmarca laboratorios ocultos por la búsqueda', () => {
  assert.deepEqual(asignarLaboratorios(formulario, [2], laboratorios, false).laboratorios, [1, 3]);
});
test('nunca asigna laboratorios de sedes no seleccionadas', () => {
  const actual = { ...formulario, sedes: [1], laboratorios: [] };
  assert.deepEqual(asignarLaboratorios(actual, [1, 2, 3], laboratorios, true).laboratorios, [1, 2]);
});
test('una búsqueda sin resultados no cambia la selección', () => {
  assert.deepEqual(asignarLaboratorios(formulario, [], laboratorios, true), formulario);
  assert.deepEqual(asignarLaboratorios(formulario, [], laboratorios, false), formulario);
});
