/**
 * Motor de inscripciones Resisbarna — Google Apps Script
 * ========================================================
 * Este script conecta la web (GitHub Pages) con Google Sheets.
 * No hay que entender el código: solo seguir los pasos de instalación
 * que te ha dado Claude en el chat. Aquí abajo no hace falta tocar nada.
 *
 * IMPORTANTE: este mismo archivo se instala UNA VEZ POR CADA Sheet de
 * campeonato (GT, Grupo C, Le Mans Series). Cada Sheet tiene su propio
 * proyecto de Apps Script (Extensiones → Apps Script desde DENTRO de
 * ese Sheet) y su propio despliegue, con su propia URL /exec. La web
 * guarda las 3 URLs y llama a la que toque según el campeonato.
 *
 * Dentro de cada Sheet, cada prueba (sede) tiene su propia pestaña,
 * creada sola la primera vez que alguien se apunta a esa prueba.
 *
 * Qué hace:
 *  - doGet()  -> si la web pide ?sede=..., devuelve solo los apuntados
 *                de esa prueba (su pestaña). Si se pide sin parámetros,
 *                devuelve TODAS las pruebas de este Sheet juntas (se
 *                usa en la página de listado para contar apuntados).
 *  - doPost() -> cuando alguien se apunta desde la web, añade una fila
 *                nueva en la pestaña de esa prueba (creándola si hace
 *                falta).
 *  - comprobarAcceso() -> función para ejecutar UNA VEZ a mano (▶ en
 *                el editor) tras pegar el código, solo para disparar
 *                la pantalla de autorización de Google si hace falta.
 */

var HEADERS = ['Timestamp', 'Campeonato', 'Sede', 'Fecha', 'Día', 'Equipo', 'Piloto 1', 'Piloto 2'];

// Nombre de pestaña a partir de la sede, p.ej. "El Sot". Los nombres de
// hoja de Google Sheets no pueden llevar : \ / ? * [ ] ni pasar de 100
// caracteres, así que los limpiamos por si acaso.
function sheetNameFor_(sede) {
  var name = (sede || 'Sin sede').replace(/[:\\\/\?\*\[\]]/g, '-');
  return name.substring(0, 95);
}

function getSheet_(sede) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = sheetNameFor_(sede);
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

// Añade una columna extra a la hoja si todavía no la tiene. Se usa para
// el desplegable propio de cada campeonato (p.ej. "Copa" en GT,
// "Categoría" en Grupo C o Le Mans Series), que no es siempre el mismo
// y por eso no está en HEADERS.
function ensureHeader_(sheet, header) {
  if (!header) return;
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (currentHeaders.indexOf(header) === -1) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
  }
}

// Si una celda ya se guardó como fecha de verdad (versiones anteriores
// de este script, o alguien tecleó una fecha directamente en la hoja),
// la devolvemos como texto "AAAA-MM-DD" en vez de como objeto Date.
function normalizeValue_(value, header, tz) {
  if (!(value instanceof Date)) return value;
  var pattern = header === 'Fecha' ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss";
  return Utilities.formatDate(value, tz, pattern);
}

function rowsFromSheet_(sheet) {
  var values = sheet.getDataRange().getValues();
  var headers = values.shift();
  if (headers.indexOf('Equipo') === -1) return []; // pestaña que no es de inscripciones
  var tz = sheet.getParent().getSpreadsheetTimeZone();
  return values
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = normalizeValue_(row[i], h, tz); });
      return obj;
    });
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var data;
  if (params.sede) {
    // Una sola prueba: solo su pestaña.
    data = rowsFromSheet_(getSheet_(params.sede));
  } else {
    // Todas las pruebas de este Sheet juntas, para pintar los
    // contadores del listado con una sola llamada.
    data = [];
    SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (sheet) {
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
  var sheet = getSheet_(body.sede);
  if (body.campoSeleccion) ensureHeader_(sheet, body.campoSeleccion);
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
  if (body.campoSeleccion) values[body.campoSeleccion] = body.seleccion || '';
  sheet.appendRow(headers.map(function (h) { return values[h] !== undefined ? values[h] : ''; }));
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Ejecuta esta función UNA VEZ a mano desde el editor (▶ Ejecutar,
// eligiéndola en el desplegable de funciones) después de pegar este
// código por primera vez en cada Sheet. Solo sirve para disparar en
// ese momento la pantalla de autorización de Google, así no falla la
// primera inscripción real de un usuario.
function comprobarAcceso() {
  Logger.log('OK: "' + SpreadsheetApp.getActiveSpreadsheet().getName() + '"');
}
