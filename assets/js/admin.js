(function(){
  var OWNER = 'vgonzalezgomez85';
  var REPO = 'Resisbarna';
  var BRANCH = 'main';
  var DATA_PATH = 'assets/data/temporada-2026.json';
  var PDF_DIR = 'assets/pdfs/2026';
  var CLASIF_DIR = 'assets/pdfs/clasificaciones-2026';
  var CAMPEONATOS = ['GT', 'Grupo C', 'Le Mans Series'];
  var DOC_TYPES = ['Resultado carrera', 'Verificaciones', 'Mangas'];
  var MAX_MB = 20;
  var STORAGE_KEY = 'rb_admin_token';

  var authSection = document.getElementById('auth-section');
  var editorSection = document.getElementById('editor-section');
  var tokenInput = document.getElementById('tokenInput');
  var rememberCheck = document.getElementById('rememberToken');
  var connectBtn = document.getElementById('connectBtn');
  var authError = document.getElementById('authError');
  var statusMsg = document.getElementById('statusMsg');
  var saveBtn = document.getElementById('saveBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var groupsEl = document.getElementById('groups');

  var state = { token: null, sha: null, data: null, dirty: false };

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function sanitizeFilename(name){ return name.replace(/[^A-Za-z0-9._-]+/g, '_'); }

  function setStatus(msg, kind){
    statusMsg.textContent = msg || '';
    statusMsg.className = 'admin-status' + (kind ? ' ' + kind : '');
  }

  function api(path, opts){
    opts = opts || {};
    var headers = Object.assign({
      'Authorization': 'Bearer ' + state.token,
      'Accept': 'application/vnd.github+json'
    }, opts.headers || {});
    return fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/' + path, Object.assign({}, opts, { headers: headers }));
  }

  function utf8ToB64(str){ return btoa(unescape(encodeURIComponent(str))); }
  function b64ToUtf8(b64){ return decodeURIComponent(escape(atob(b64))); }

  function fileToB64(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){ resolve(reader.result.split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function getFileSha(path){
    return api('contents/' + path + '?ref=' + BRANCH).then(function(res){
      if(res.status === 404) return null;
      if(!res.ok) throw new Error('No se pudo comprobar ' + path);
      return res.json().then(function(j){ return j.sha; });
    });
  }

  function putFile(path, base64Content, message){
    return getFileSha(path).then(function(sha){
      var body = { message: message, content: base64Content, branch: BRANCH };
      if(sha) body.sha = sha;
      return api('contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
    }).then(function(res){
      if(!res.ok) return res.json().then(function(j){ throw new Error(j.message || 'Error al subir ' + path); });
      return res.json();
    });
  }

  function saveData(message){
    var content = utf8ToB64(serializeData());
    var body = { message: message || 'Actualiza datos de temporada 2026', content: content, branch: BRANCH, sha: state.sha };
    return api('contents/' + DATA_PATH, { method: 'PUT', body: JSON.stringify(body) }).then(function(res){
      if(!res.ok) return res.json().then(function(j){ throw new Error(j.message || 'Error al guardar'); });
      return res.json();
    }).then(function(j){
      state.sha = j.content.sha;
      state.dirty = false;
      saveBtn.disabled = true;
    });
  }

  function markDirty(){ state.dirty = true; saveBtn.disabled = false; setStatus('Cambios sin guardar', ''); }

  function serializeData(){
    var clean = JSON.parse(JSON.stringify(state.data));
    clean.races.forEach(function(r){ delete r._id; });
    clean.clasificaciones.forEach(function(c){ delete c._id; });
    return JSON.stringify(clean, null, 2);
  }

  // ---------- carga inicial ----------
  function loadData(){
    setStatus('Cargando datos…', '');
    return api('contents/' + DATA_PATH + '?ref=' + BRANCH).then(function(res){
      if(res.status === 401 || res.status === 403) throw new Error('TOKEN_INVALIDO');
      if(!res.ok) throw new Error('No se pudo cargar la temporada (' + res.status + ')');
      return res.json();
    }).then(function(j){
      state.sha = j.sha;
      state.data = JSON.parse(b64ToUtf8(j.content));
      authSection.hidden = true;
      editorSection.hidden = false;
      setStatus('', '');
      render();
    });
  }

  // ---------- render ----------
  function findDoc(docsArr, nombre){
    return (docsArr || []).find(function(d){ return d.nombre === nombre; });
  }

  function docSlotHtml(race, docName){
    var doc = findDoc(race.documentos, docName);
    if(doc && doc.href){
      return '<div class="admin-doc">' +
        '<a href="' + doc.href + '" target="_blank">' + esc(docName) + '</a>' +
        '<label>Reemplazar<input type="file" accept="application/pdf" data-race="' + race._id + '" data-doc="' + esc(docName) + '"></label>' +
      '</div>';
    }
    return '<div class="admin-doc">' +
      '<label>Subir ' + esc(docName) + '<input type="file" accept="application/pdf" data-race="' + race._id + '" data-doc="' + esc(docName) + '"></label>' +
    '</div>';
  }

  function raceRowHtml(race){
    return '<div class="admin-row" data-race-id="' + race._id + '">' +
      '<input type="text" class="admin-fecha" value="' + esc(race.fecha || '') + '" placeholder="AAAA-MM-DD" data-race="' + race._id + '">' +
      '<input type="text" class="admin-sede" value="' + esc(race.sede || '') + '" placeholder="Sede" data-race="' + race._id + '">' +
      '<div class="admin-docs">' + DOC_TYPES.map(function(dt){ return docSlotHtml(race, dt); }).join('') + '</div>' +
      '<button class="admin-del" data-del-race="' + race._id + '" title="Eliminar carrera">✕</button>' +
    '</div>';
  }

  function clasifRowHtml(cl){
    var uploadHtml = cl.pdf
      ? '<div class="admin-doc"><a href="' + cl.pdf + '" target="_blank">Ver PDF</a><label>Reemplazar<input type="file" accept="application/pdf" data-clasif="' + cl._id + '"></label></div>'
      : '<div class="admin-doc"><label>Subir PDF<input type="file" accept="application/pdf" data-clasif="' + cl._id + '"></label></div>';
    return '<div class="admin-clasif-row" data-clasif-id="' + cl._id + '">' +
      '<input type="text" class="admin-nombre-clasif" value="' + esc(cl.nombre || '') + '" placeholder="Nombre de la clasificación" data-clasif-nombre="' + cl._id + '">' +
      uploadHtml +
      '<button class="admin-del" data-del-clasif="' + cl._id + '" title="Eliminar">✕</button>' +
    '</div>';
  }

  var nextId = 1;
  function ensureIds(){
    (state.data.races || []).forEach(function(r){ if(!r._id) r._id = 'r' + (nextId++); });
    (state.data.clasificaciones || []).forEach(function(c){ if(!c._id) c._id = 'c' + (nextId++); });
  }

  function render(){
    ensureIds();
    var html = '';
    CAMPEONATOS.forEach(function(camp){
      var races = state.data.races.filter(function(r){ return r.campeonato === camp; });
      html += '<div class="admin-group"><h2>' + esc(camp) + '</h2>' +
        races.map(raceRowHtml).join('') +
        '<button class="admin-add" data-add-race="' + esc(camp) + '">+ Añadir carrera a ' + esc(camp) + '</button>' +
      '</div>';
    });
    html += '<div class="admin-group"><h2>Clasificaciones</h2>' +
      (state.data.clasificaciones || []).map(clasifRowHtml).join('') +
      '<button class="admin-add" data-add-clasif="1">+ Añadir clasificación</button>' +
    '</div>';
    groupsEl.innerHTML = html;
  }

  // ---------- eventos delegados ----------
  groupsEl.addEventListener('input', function(e){
    var t = e.target;
    if(t.classList.contains('admin-fecha')){
      var race = state.data.races.find(function(r){ return r._id === t.dataset.race; });
      if(race){ race.fecha = t.value || null; markDirty(); }
    } else if(t.classList.contains('admin-sede')){
      var race2 = state.data.races.find(function(r){ return r._id === t.dataset.race; });
      if(race2){ race2.sede = t.value || null; markDirty(); }
    } else if(t.classList.contains('admin-nombre-clasif')){
      var cl = state.data.clasificaciones.find(function(c){ return c._id === t.dataset.clasifNombre; });
      if(cl){ cl.nombre = t.value; markDirty(); }
    }
  });

  groupsEl.addEventListener('click', function(e){
    var t = e.target;
    if(t.dataset.delRace){
      state.data.races = state.data.races.filter(function(r){ return r._id !== t.dataset.delRace; });
      markDirty(); render();
    } else if(t.dataset.delClasif){
      state.data.clasificaciones = state.data.clasificaciones.filter(function(c){ return c._id !== t.dataset.delClasif; });
      markDirty(); render();
    } else if(t.dataset.addRace){
      state.data.races.push({ campeonato: t.dataset.addRace, sede: '', fecha: null, documentos: [] });
      markDirty(); render();
    } else if(t.dataset.addClasif){
      state.data.clasificaciones.push({ nombre: '', pdf: null });
      markDirty(); render();
    }
  });

  groupsEl.addEventListener('change', function(e){
    var t = e.target;
    if(t.type !== 'file' || !t.files[0]) return;
    var file = t.files[0];
    if(file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)){
      alert('Solo se pueden subir ficheros PDF.'); t.value = ''; return;
    }
    if(file.size > MAX_MB * 1024 * 1024){
      alert('El fichero pesa más de ' + MAX_MB + 'MB. Comprímelo antes de subirlo.'); t.value = ''; return;
    }

    if(t.dataset.race){
      handleRaceUpload(t.dataset.race, t.dataset.doc, file, t);
    } else if(t.dataset.clasif){
      handleClasifUpload(t.dataset.clasif, file, t);
    }
  });

  function handleRaceUpload(raceId, docName, file, inputEl){
    var race = state.data.races.find(function(r){ return r._id === raceId; });
    if(!race) return;
    setStatus('Subiendo ' + docName + '…', '');
    inputEl.disabled = true;
    var path = PDF_DIR + '/' + sanitizeFilename(file.name);
    fileToB64(file).then(function(b64){
      return putFile(path, b64, 'Sube ' + docName + ' — ' + (race.sede || race.campeonato) + ' ' + (race.fecha || ''));
    }).then(function(){
      race.documentos = race.documentos || [];
      var doc = findDoc(race.documentos, docName);
      if(doc) doc.href = path;
      else race.documentos.push({ nombre: docName, href: path });
      return saveData('Actualiza ' + docName + ' — ' + (race.sede || race.campeonato));
    }).then(function(){
      setStatus('PDF subido y publicado ✓', 'ok');
      render();
    }).catch(function(err){
      setStatus('Error: ' + err.message, 'err');
      inputEl.disabled = false;
    });
  }

  function handleClasifUpload(clasifId, file, inputEl){
    var cl = state.data.clasificaciones.find(function(c){ return c._id === clasifId; });
    if(!cl) return;
    setStatus('Subiendo ' + (cl.nombre || 'clasificación') + '…', '');
    inputEl.disabled = true;
    var path = CLASIF_DIR + '/' + sanitizeFilename(file.name);
    fileToB64(file).then(function(b64){
      return putFile(path, b64, 'Sube clasificación — ' + (cl.nombre || ''));
    }).then(function(){
      cl.pdf = path;
      return saveData('Actualiza clasificación — ' + (cl.nombre || ''));
    }).then(function(){
      setStatus('PDF subido y publicado ✓', 'ok');
      render();
    }).catch(function(err){
      setStatus('Error: ' + err.message, 'err');
      inputEl.disabled = false;
    });
  }

  // ---------- guardar cambios (sede/fecha/altas/bajas) ----------
  saveBtn.addEventListener('click', function(){
    setStatus('Guardando…', '');
    saveData('Edita datos de temporada 2026 desde el panel').then(function(){
      setStatus('Guardado ✓ — la web se actualizará en 1-2 minutos', 'ok');
    }).catch(function(err){
      setStatus('Error: ' + err.message, 'err');
    });
  });

  // ---------- login / logout ----------
  function tryConnect(token){
    state.token = token;
    authError.hidden = true;
    connectBtn.disabled = true;
    loadData().catch(function(err){
      connectBtn.disabled = false;
      if(err.message === 'TOKEN_INVALIDO'){
        authError.textContent = 'El token no es válido, ha caducado, o no tiene permiso de escritura sobre este repositorio.';
      } else {
        authError.textContent = err.message;
      }
      authError.hidden = false;
      localStorage.removeItem(STORAGE_KEY);
    });
  }

  connectBtn.addEventListener('click', function(){
    var token = tokenInput.value.trim();
    if(!token) return;
    if(rememberCheck.checked) localStorage.setItem(STORAGE_KEY, token);
    tryConnect(token);
  });

  logoutBtn.addEventListener('click', function(){
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  var saved = localStorage.getItem(STORAGE_KEY);
  if(saved) tryConnect(saved);
})();
