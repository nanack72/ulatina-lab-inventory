import test from 'node:test';
import assert from 'node:assert/strict';

import { resumirInicio } from '../src/utils/dashboard.js';

test('resumirInicio usa los totales reales de SQL aunque la lista reciente solo traiga 5 filas', () => {
  const equipos = [
    { estado: 'Operativo', laboratorio: 'Lab 1' },
    { estado: 'En mantenimiento', laboratorio: 'Lab 1' },
  ];
  // Simula que los 5 mantenimientos más recientes están completados, pero existen 12 abiertos históricos
  const recientes = Array.from({ length: 5 }, (_, i) => ({
    id_bitacora: i + 1,
    tipo_mantenimiento: 'Preventivo',
    estado_mantenimiento: 'Completado',
  }));
  const resumenServidor = {
    abiertos: 12,
    enProceso: 8,
    esperandoRepuesto: 4,
    correctivos: 5,
    preventivos: 7,
  };

  const resultado = resumirInicio(equipos, recientes, resumenServidor);
  assert.equal(resultado.abiertos, 12);
  assert.equal(resultado.enProceso, 8);
  assert.equal(resultado.esperandoRepuesto, 4);
  assert.equal(resultado.correctivos, 5);
  assert.equal(resultado.preventivos, 7);
});

test('resumirInicio conserva el cálculo de respaldo si no recibe resumen del servidor', () => {
  const equipos = [{ estado: 'Operativo', laboratorio: 'Lab 1' }];
  const lista = [
    { tipo_mantenimiento: 'Correctivo', estado_mantenimiento: 'En Proceso' },
    { tipo_mantenimiento: 'Preventivo', estado_mantenimiento: 'Pendiente Repuesto' },
    { tipo_mantenimiento: 'Preventivo', estado_mantenimiento: 'Completado' },
  ];

  const resultado = resumirInicio(equipos, lista);
  assert.equal(resultado.abiertos, 2);
  assert.equal(resultado.enProceso, 1);
  assert.equal(resultado.esperandoRepuesto, 1);
  assert.equal(resultado.correctivos, 1);
  assert.equal(resultado.preventivos, 1);
});
