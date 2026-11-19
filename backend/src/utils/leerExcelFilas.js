const ExcelJS = require('exceljs');
// Adaptador de la carga histórica: conserva filas y valores sin depender de xlsx.
async function leerLibroComoFilas(ruta) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const Sheets = {};
  for (const hoja of libro.worksheets) {
    const filas = [];
    for (let n = 1; n <= hoja.rowCount; n++) {
      const fila = hoja.getRow(n),
        valores = [];
      for (let c = 1; c <= hoja.columnCount; c++) {
        let valor = fila.getCell(c).value;
        if (valor instanceof Date)
          valor = valor.getTime() / 86400000 + (libro.properties.date1904 ? 24107 : 25569);
        else if (valor && typeof valor === 'object')
          valor =
            valor.result ??
            (valor.richText ? valor.richText.map((p) => p.text).join('') : valor.text) ??
            '';
        valores.push(valor ?? '');
      }
      filas.push(valores);
    }
    Sheets[hoja.name] = filas;
  }
  return { Sheets, SheetNames: libro.worksheets.map((h) => h.name) };
}
module.exports = { leerLibroComoFilas };
