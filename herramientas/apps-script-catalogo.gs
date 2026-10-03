/**
 * Apps Script del Google Sheet MAESTRO (Extensiones → Apps Script).
 *
 * Al editar el Sheet, espera 2 minutos sin tocar nada y lanza el workflow
 * "Catálogo desde Google Sheet" de GitHub, que regenera catalogo.json para la
 * página "Prepara tu coche". Así varias ediciones seguidas lanzan una sola
 * ejecución. Añade también el menú "Resisbarna → Publicar catálogo ahora".
 *
 * Configuración (una vez):
 *   1. Configuración del proyecto → Propiedades del script → añadir
 *      GITHUB_TOKEN = token de GitHub "fine-grained" con Repository access
 *      solo a Resisbarna y Repository permissions → Actions: Read and write
 *      (sin ese permiso GitHub responde 403; diagnostico() ayuda a verlo).
 *   2. Ejecutar la función instalar() y aceptar los permisos.
 *
 * Las ediciones que hace PitWall Control por la API no disparan onEdit; esas
 * las recoge el cron horario del workflow.
 */

var REPO = 'vgonzalezgomez85/Resisbarna';
var WORKFLOW = 'catalogo.yml';
var ESPERA_MS = 2 * 60 * 1000;

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'alEditar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('alEditar').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  lanzarWorkflow(); // comprueba el token y deja la primera ejecución hecha
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Resisbarna')
    .addItem('Publicar catálogo ahora', 'publicarAhora')
    .addToUi();
}

function alEditar() {
  // Si ya hay un lanzamiento pendiente, esa ejecución recogerá esta edición.
  var pendiente = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'lanzarPendiente';
  });
  if (!pendiente) ScriptApp.newTrigger('lanzarPendiente').timeBased().after(ESPERA_MS).create();
}

function lanzarPendiente() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'lanzarPendiente') ScriptApp.deleteTrigger(t);
  });
  lanzarWorkflow();
}

function publicarAhora() {
  lanzarWorkflow();
  SpreadsheetApp.getActive().toast('Catálogo enviado. Estará en la web en 1–2 minutos.', 'Resisbarna');
}

// Para revisar el token: muestra a qué cuenta pertenece y qué ve del repo.
function diagnostico() {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN') || '';
  Logger.log('Token: empieza por %s, %s caracteres', token.slice(0, 11), token.length);
  ['https://api.github.com/user', 'https://api.github.com/repos/' + REPO,
   'https://api.github.com/repos/' + REPO + '/actions/workflows/' + WORKFLOW].forEach(function (url) {
    var r = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
      muteHttpExceptions: true
    });
    var j = {};
    try { j = JSON.parse(r.getContentText()); } catch (e) {}
    Logger.log('%s → %s %s', url, r.getResponseCode(),
               j.login || j.full_name || j.state || j.message || '');
  });
}

function lanzarWorkflow() {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Falta la propiedad GITHUB_TOKEN en la configuración del proyecto.');
  var r = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + REPO + '/actions/workflows/' + WORKFLOW + '/dispatches', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
      payload: JSON.stringify({ ref: 'main' }),
      muteHttpExceptions: true
    });
  if (r.getResponseCode() !== 204) {
    // En un 403, GitHub dice en esta cabecera qué permiso le falta al token.
    var falta = r.getHeaders()['x-accepted-github-permissions'] || r.getHeaders()['X-Accepted-GitHub-Permissions'];
    throw new Error('GitHub respondió ' + r.getResponseCode() + ': ' + r.getContentText() +
                    (falta ? ' | Permisos necesarios: ' + falta : ''));
  }
}
