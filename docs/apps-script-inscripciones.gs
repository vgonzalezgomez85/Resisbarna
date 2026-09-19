/**
 * Motor de inscripciones Resisbarna — Google Apps Script
 * ========================================================
 * Este script conecta la web (GitHub Pages) con una Google Sheet.
 * No hay que entender el código: solo seguir los pasos de instalación
 * que te ha dado Claude en el chat. Aquí abajo no hace falta tocar nada.
 *
 * Cada prueba (campeonato + sede) tiene su PROPIA hoja (pestaña) dentro
 * de este mismo Google Sheet, por ejemplo "GT - El Sot" o
 * "Grupo C - Gasclavat". Así cada organizador puede abrir solo la
 * pestaña de su prueba sin ver las demás.
 *
 * Qué hace:
 *  - doGet()  -> si la web pide ?camp=...&sede=..., devuelve solo los
 *                apuntados de esa prueba (la pestaña correspondiente).
 *                Si se pide sin parámetros, devuelve TODAS las pruebas
 *                juntas (se usa en la página de listado para contar
 *                cuántos equipos hay en cada una con una sola llamada).
 *  - doPost() -> cuando alguien se apunta desde la web, añade una fila
 *                nueva en la pestaña de esa prueba (creándola si hace
 *                falta).
 *  - migrarDatosAntiguos() -> función para ejecutar UNA VEZ a mano
 *                (botón ▶ en el editor de Apps Script) si vienes de la
 *                versión anterior con una sola hoja "Inscripciones":
 *                reparte esas filas en las pestañas nuevas, una por
 *                prueba, sin borrar la hoja original.
 */

var HEADERS = ['Timestamp', 'Campeonato', 'Sede', 'Fecha', 'Día', 'Equipo', 'Piloto 1', 'Piloto 2'];
var OLD_SHEET_NAME = 'Inscripciones';

// Nombre de pestaña a partir de campeonato + sede, p.ej. "GT - El Sot".
// Los nombres de hoja de Google Sheets no pueden llevar : \ / ? * [ ]
// ni pasar de 100 caracteres, así que los limpiamos por si acaso.
function sheetNameFor_(campeonato, sede) {
  var name = (campeonato || 'Sin campeonato') + ' - ' + (sede || 'Sin sede');
  name = name.replace(/[:\\\/\?\*\[\]]/g, '-');
  return name.substring(0, 95);
}

function getSheet_(campeonato, sede) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = sheetNameFor_(campeonato, sede);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else {
    // Migración: si la hoja ya existía de antes de añadir alguna columna
    // nueva, la añade al final sin tocar lo que ya hay.
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

// Si una celda ya se guardó como fecha de verdad (versiones anteriores
// de este script, o alguien tecleó una fecha directamente en la hoja),
// la devolvemos como texto "AAAA-MM-DD" en vez de como objeto Date.
function normalizeValue_(value, header) {
  if (!(value instanceof Date)) return value;
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var pattern = header === 'Fecha' ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss";
  return Utilities.formatDate(value, tz, pattern);
}

function rowsFromSheet_(sheet) {
  var values = sheet.getDataRange().getValues();
  var headers = values.shift();
  if (headers.indexOf('Equipo') === -1) return []; // pestaña que no es de inscripciones
  return values
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = normalizeValue_(row[i], h); });
      return obj;
    });
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var data;
  if (params.camp && params.sede) {
    // Una sola prueba: solo su pestaña.
    var sheet = getSheet_(params.camp, params.sede);
    data = rowsFromSheet_(sheet);
  } else {
    // Todas las pruebas juntas, para pintar los contadores del listado
    // con una sola llamada.
    data = [];
    SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (sheet) {
      if (sheet.getName() === OLD_SHEET_NAME) return;
      data = data.concat(rowsFromSheet_(sheet));
    });
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Escribe por NOMBRE de columna (no por posición fija), así si en el
// futuro se añade o reordena alguna columna en la hoja no se desalinean
// los datos.
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var sheet = getSheet_(body.campeonato, body.sede);
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

// Ejecuta esta función UNA VEZ a mano desde el editor (▶ Ejecutar) si
// vienes de la versión anterior del script, que guardaba todo en una
// única hoja "Inscripciones". Reparte cada fila en la pestaña nueva de
// su prueba (creándola si hace falta) y NO borra la hoja original, por
// si quieres comprobar que todo ha migrado bien antes de borrarla tú
// mismo a mano.
function migrarDatosAntiguos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName(OLD_SHEET_NAME);
  if (!old) {
    Logger.log('No hay hoja "' + OLD_SHEET_NAME + '" que migrar. Nada que hacer.');
    return;
  }
  var rows = rowsFromSheet_(old);
  rows.forEach(function (row) {
    var sheet = getSheet_(row.Campeonato, row.Sede);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sheet.appendRow(headers.map(function (h) { return row[h] !== undefined ? row[h] : ''; }));
  });
  Logger.log('Migradas ' + rows.length + ' filas a sus pestañas por prueba. La hoja "' + OLD_SHEET_NAME + '" no se ha tocado: bórrala a mano cuando compruebes que todo está bien.');
}
