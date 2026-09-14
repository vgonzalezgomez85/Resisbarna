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
var HEADERS = ['Timestamp', 'Campeonato', 'Sede', 'Fecha', 'Día', 'Equipo', 'Piloto 1', 'Piloto 2'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else {
    // Migración: si la hoja ya existía de antes de añadir alguna columna
    // nueva (p.ej. "Día"), la añade al final sin tocar lo que ya hay.
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    HEADERS.forEach(function (h) {
      if (currentHeaders.indexOf(h) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
        currentHeaders.push(h);
      }
    });
  }
  // La columna "Fecha" siempre como texto plano, para que Google Sheets
  // no la reconvierta en una fecha de verdad (eso desplaza el día según
  // la zona horaria y rompe el emparejamiento con la carrera).
  var fechaCol = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('Fecha') + 1;
  if (fechaCol > 0) sheet.getRange(2, fechaCol, Math.max(sheet.getMaxRows() - 1, 1)).setNumberFormat('@');
  return sheet;
}

// Ejecuta esta función una vez a mano desde el editor (▶ Ejecutar) para
// crear la hoja "Inscripciones" con sus columnas si todavía no existe,
// o para añadirle las columnas nuevas si el script se ha actualizado.
function setup() {
  getSheet_();
}

// Si una celda ya se guardó como fecha de verdad (versiones anteriores
// de este script, o alguien tecleó una fecha directamente en la hoja),
// la devolvemos como texto "AAAA-MM-DD" en vez de como objeto Date.
function normalizeValue_(value, header) {
  if (!(value instanceof Date)) return value;
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var pattern = header === 'Fecha' ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss";
  return Utilities.formatDate(value, tz, pattern);
}

function doGet(e) {
  var sheet = getSheet_();
  var rows = sheet.getDataRange().getValues();
  var headers = rows.shift();
  var data = rows
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = normalizeValue_(row[i], h); });
      return obj;
    });
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Escribe por NOMBRE de columna (no por posición fija), así si en el
// futuro se añade o reordena alguna columna en la hoja no se desalinean
// los datos.
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var sheet = getSheet_();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = {
    Timestamp: new Date(),
    Campeonato: body.campeonato || '',
    Sede: body.sede || '',
    Fecha: body.fecha || '',
    'Día': body.dia || '',
    Equipo: body.equipo || '',
    'Piloto 1': body.piloto1 || '',
    'Piloto 2': body.piloto2 || ''
  };
  sheet.appendRow(headers.map(function (h) { return values[h] !== undefined ? values[h] : ''; }));
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
