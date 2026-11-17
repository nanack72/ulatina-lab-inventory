import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepararCambiosEquipo } from '../src/utils/edicionEquipo.js';

const original = { nombre: 'Equipo', marca: 'Marca', modelo: null, numero_serie: null,
  placa_institucional: 'P-1', anio: 2024, caracteristicas: null, comentarios: 'Anterior',
  id_categoria: 1, id_estado: 1, id_laboratorio: 1, ubicacion_detalle: 'Mesa A' };
const formulario = { nombre: 'Equipo', marca: 'Marca', modelo: '', numero_serie: '',
  placa_institucional: 'P-1', anio: '2024', caracteristicas: '', comentarios: 'Anterior' };

test('sin cambios devuelve un objeto vacío, incluidos espacios y valores opcionales', () => {
  assert.deepEqual(prepararCambiosEquipo({ ...formulario, nombre: ' Equipo ', modelo: ' ' }, original), {});
});
test('envía solo el campo general editado', () => {
  assert.deepEqual(prepararCambiosEquipo({ ...formulario, nombre: 'Nuevo' }, original), { nombre: 'Nuevo' });
});
test('editar comentarios no reenvía relaciones ni campos generales no modificados', () => {
  const cambios = prepararCambiosEquipo({ ...formulario, comentarios: 'Nuevo' }, original);
  assert.deepEqual(cambios, { comentarios: 'Nuevo' });
  const actual = { ...original, id_estado: 2, id_laboratorio: 3, ubicacion_detalle: 'Mesa B', marca: 'Otra' };
  const guardado = { ...actual, ...cambios };
  assert.equal(guardado.id_estado, 2);
  assert.equal(guardado.id_laboratorio, 3);
  assert.equal(guardado.ubicacion_detalle, 'Mesa B');
  assert.equal(guardado.marca, 'Otra');
});
test('borrar un dato opcional se expresa como null', () => {
  assert.deepEqual(prepararCambiosEquipo({ ...formulario, comentarios: ' ' }, original), { comentarios: null });
});
test('permite cambiar o borrar el año sin reenviar el resto', () => {
  assert.deepEqual(prepararCambiosEquipo({ ...formulario, anio: '2025' }, original), { anio: 2025 });
  assert.deepEqual(prepararCambiosEquipo({ ...formulario, anio: '' }, original), { anio: null });
});
test('mantiene compatibilidad con los alias usados al cargar la pantalla', () => {
  const alias = { nombre_equipo: 'Equipo', placa: 'P-1', serie: null, año: 2024,
    marca: 'Marca', comentarios: 'Anterior' };
  assert.deepEqual(prepararCambiosEquipo(formulario, alias), {});
});
