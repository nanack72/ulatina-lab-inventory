import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarUsuarios } from '../src/utils/filtrosUsuarios.js';

const usuarios = [
  {
    id_usuario: 1,
    id_rol: 1,
    rol: 'Superadministrador',
    nombre_completo: 'Administradora',
    activo: true,
    sedes: [],
  },
  {
    id_usuario: 2,
    id_rol: 2,
    rol: 'Tecnico',
    nombre_completo: 'José A',
    correo_institucional: 'jose@example.com',
    activo: true,
    sedes: [10],
  },
  {
    id_usuario: 3,
    id_rol: 2,
    rol: 'Tecnico',
    nombre_completo: 'Persona B',
    activo: false,
    sedes: [20],
  },
  {
    id_usuario: 4,
    id_rol: 3,
    rol: 'Coordinador',
    nombre_completo: 'Persona C',
    activo: true,
    sedes: [10, 20],
  },
  {
    id_usuario: 5,
    id_rol: 3,
    rol: 'Coordinador',
    nombre_completo: 'Sin asignación',
    activo: true,
    sedes: [],
  },
];
const ids = (filtros) => filtrarUsuarios(usuarios, filtros).map((u) => u.id_usuario);
test('sin filtros devuelve todos los usuarios sin modificar sus asignaciones', () => {
  assert.deepEqual(ids({}), [1, 2, 3, 4, 5]);
  assert.deepEqual(usuarios[0].sedes, []);
});
test('filtra por identificador de rol', () => {
  assert.deepEqual(ids({ rol: '2' }), [2, 3]);
});
test('la sede incluye asignados y superadministradores con acceso global', () => {
  assert.deepEqual(ids({ sede: '10' }), [1, 2, 4]);
  assert.deepEqual(ids({ sede: '20' }), [1, 3, 4]);
});
test('distingue cuentas activas e inactivas sin confundir sus nombres', () => {
  assert.deepEqual(ids({ estado: 'activa' }), [1, 2, 4, 5]);
  assert.deepEqual(ids({ estado: 'inactiva' }), [3]);
});
test('combina rol, sede, estado y búsqueda sin tildes', () => {
  assert.deepEqual(ids({ rol: '2', sede: '10', estado: 'activa', busqueda: 'jose' }), [2]);
  assert.deepEqual(ids({ rol: '2', sede: '10', estado: 'inactiva' }), []);
});
test('acepta asignaciones con identificadores serializados como texto', () => {
  assert.equal(filtrarUsuarios([{ ...usuarios[1], sedes: ['10'] }], { sede: '10' }).length, 1);
});
test('filtra el conjunto completo antes de aplicar la paginación', () => {
  const lista = Array.from({ length: 12 }, (_, i) => ({ ...usuarios[1], id_usuario: i + 1 }));
  lista[11].activo = false;
  assert.equal(filtrarUsuarios(lista, { estado: 'inactiva' })[0].id_usuario, 12);
});
