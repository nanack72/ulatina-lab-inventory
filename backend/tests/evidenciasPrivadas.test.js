const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ExcelJS = require('exceljs');
const { leerLibroComoFilas } = require('../src/utils/leerExcelFilas');
function controlador({
  acceso = true,
  url = '/uploads/evidencias/123-abc.png',
  existe = true,
} = {}) {
  const archivo = path.join(__dirname, '../src/controllers/evidenciasController.js'),
    local = createRequire(archivo),
    modulo = { exports: {} };
  vm.runInNewContext(fs.readFileSync(archivo, 'utf8'), {
    module: modulo,
    console,
    require: (n) => {
      if (n === '../config/database')
        return { query: async () => ({ rows: [{ url_foto: url, id_equipo: 1 }] }) };
      if (n === '../utils/accesoEquipos') return { verificarAccesoEquipo: async () => acceso };
      if (n === '../middlewares/uploadMiddleware')
        return {
          DIRECTORIO_EVIDENCIAS: path.resolve(os.tmpdir(), 'evidencias-prueba'),
          eliminarArchivo() {},
          tieneFirmaDeImagen() {
            return true;
          },
        };
      if (n === 'node:fs/promises')
        return {
          access: async () => {
            if (!existe) throw Object.assign(new Error('No existe'), { code: 'ENOENT' });
          },
        };
      return local(n);
    },
  });
  return modulo.exports.obtenerArchivoEvidencia;
}
async function ejecutar(opciones, id = '1') {
  const res = {
    codigo: 200,
    status(n) {
      this.codigo = n;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
    set(headers) {
      this.headers = headers;
      return this;
    },
    sendFile(ruta) {
      this.archivo = ruta;
      return this;
    },
  };
  await controlador(opciones)({ params: { id }, usuario: { idUsuario: 2, rol: 'Tecnico' } }, res);
  return res;
}
test('archivo de evidencia: permiso por equipo, rutas seguras y cabeceras privadas', async () => {
  assert.equal((await ejecutar({ acceso: false })).codigo, 403);
  assert.equal((await ejecutar({}, '12abc')).codigo, 400);
  assert.equal((await ejecutar({ url: '/uploads/evidencias/../../secreto.txt' })).codigo, 404);
  assert.equal((await ejecutar({ existe: false })).codigo, 404);
  const permitida = await ejecutar({});
  assert.equal(permitida.codigo, 200);
  assert.equal(permitida.headers['Cache-Control'], 'private, no-store');
  assert.ok(permitida.archivo.endsWith('123-abc.png'));
});
test('adaptador ExcelJS del seed conserva columnas, celdas vacías y fechas numéricas', async (t) => {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'pes-excel-'));
  const ruta = path.join(directorio, 'prueba.xlsx');
  t.after(() => {
    fs.unlinkSync(ruta);
    fs.rmdirSync(directorio);
  });
  const libro = new ExcelJS.Workbook(),
    hoja = libro.addWorksheet('Mantenimientos 2026');
  hoja.addRow(['Nombre', null, 'Cantidad']);
  hoja.addRow(['Equipo', null, 2]);
  hoja.addRow([new Date('2026-01-01T00:00:00Z'), { formula: '1+1', result: 2 }]);
  hoja.getCell('A3').numFmt = 'yyyy-mm-dd';
  libro.addWorksheet('MANT-Anexo 5').addRow(['Anexo']);
  await libro.xlsx.writeFile(ruta);
  const resultado = await leerLibroComoFilas(ruta);
  assert.deepEqual(resultado.SheetNames, ['Mantenimientos 2026', 'MANT-Anexo 5']);
  assert.deepEqual(resultado.Sheets['Mantenimientos 2026'][1], ['Equipo', '', 2]);
  assert.equal(typeof resultado.Sheets['Mantenimientos 2026'][2][0], 'number');
  assert.equal(resultado.Sheets['Mantenimientos 2026'][2][1], 2);
});
