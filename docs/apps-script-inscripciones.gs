/**
 * Motor de inscripciones Resisbarna — Google Apps Script
 * ========================================================
 * Este script conecta la web (GitHub Pages) con una Google Sheet.
 * No hay que entender el código: solo seguir los pasos de instalación
 * que te ha dado Claude en el chat. Aquí abajo no hace falta tocar nada.
 *
 * Qué hace:
 *  - doGet()  -> cuando la web pide la lista de apuntados, devuelve
 *                todas las filas de la hoja "Inscripciones" como JSON.
 *  - doPost() -> cuando alguien se apunta desde la web, añade una fila
 *                nueva a la hoja "Inscripciones".
 *  - setup()  -> función para ejecutar UNA VEZ a mano (botón ▶ en el
 *                editor de Apps Script) para crear la hoja con las
 *                columnas correctas si no existe todavía.
 */

var SHEET_NAME = 'Inscripciones';
var HEADERS = ['Timestamp', 'Campeonato', 'Sede', 'Fecha', 'Equipo', 'Piloto 1', 'Piloto 2'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Ejecuta esta función una vez a mano desde el editor (▶ Ejecutar) para
// crear la hoja "Inscripciones" con sus columnas si todavía no existe.
function setup() {
  getSheet_();
}

function doGet(e) {
  var sheet = getSheet_();
  var rows = sheet.getDataRange().getValues();
  var headers = rows.shift();
  var data = rows
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var sheet = getSheet_();
  sheet.appendRow([
    new Date(),
    body.campeonato || '',
    body.sede || '',
    body.fecha || '',
    body.equipo || '',
    body.piloto1 || '',
    body.piloto2 || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
