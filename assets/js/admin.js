(function(){
  var OWNER = 'vgonzalezgomez85';
  var REPO = 'Resisbarna';
  var BRANCH = 'main';
  var DATA_PATH = 'assets/data/temporada-2026.json';
  var PDF_DIR = 'assets/pdfs/2026';
  var CLASIF_DIR = 'assets/pdfs/clasificaciones-2026';
  var RESULT_DIR = 'resultados/2026';
  var CAMPEONATOS = ['GT', 'Grupo C', 'Le Mans Series'];
  var DOC_TYPES = ['Resultado carrera', 'Verificaciones', 'Resumen verificaciones', 'Mangas'];
  // El resultado de carrera puede ser el export HTML de PitWall o un PDF
  var HTML_DOCS = ['Resultado carrera'];
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
  function isHtml(file){ return /\.html?$/i.test(file.name) || file.type === 'text/html'; }
  function isPdf(file){ return file.type === 'application/pdf' || /\.pdf$/i.test(file.name); }
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
      renderPublish();
    });
  }

  // ---------- render ----------
  function findDoc(docsArr, nombre){
    return (docsArr || []).find(function(d){ return d.nombre === nombre; });
  }

  function docSlotHtml(race, docName){
    var doc = findDoc(race.documentos, docName);
    var accept = HTML_DOCS.indexOf(docName) >= 0 ? 'application/pdf,.html,.htm' : 'application/pdf';
    if(doc && doc.href){
      return '<div class="admin-doc">' +
        '<a href="' + doc.href + '" target="_blank">' + esc(docName) + '</a>' +
        '<label>Reemplazar<input type="file" accept="' + accept + '" data-race="' + race._id + '" data-doc="' + esc(docName) + '"></label>' +
      '</div>';
    }
    return '<div class="admin-doc">' +
      '<label>Subir ' + esc(docName) + '<input type="file" accept="' + accept + '" data-race="' + race._id + '" data-doc="' + esc(docName) + '"></label>' +
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
    var htmlOk = t.dataset.race && HTML_DOCS.indexOf(t.dataset.doc) >= 0;
    if(!isPdf(file) && !(htmlOk && isHtml(file))){
      alert(htmlOk ? 'Solo se pueden subir ficheros PDF o HTML.' : 'Solo se pueden subir ficheros PDF.'); t.value = ''; return;
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
    var path = (isHtml(file) ? RESULT_DIR : PDF_DIR) + '/' + sanitizeFilename(file.name);
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

  // ---------- publicar prueba (varios ficheros, un solo commit) ----------
  var publishEl = document.getElementById('publish');
  var CAMP_CODE = { 'GT': 'RESISBARNA', 'Grupo C': 'GRUPOC', 'Le Mans Series': 'LEMANS' };
  var CAMP_SLUG = { 'GT': 'gt', 'Grupo C': 'grupo-c', 'Le Mans Series': 'lemans' };
  var DOC_PREFIX = { 'Resultado carrera': 'RESULTADOS', 'Verificaciones': 'VERIFICACIONES', 'Resumen verificaciones': 'RESUMEN_VERIFICACIONES', 'Mangas': 'MANGAS' };
  var pub = { raceId: null, raceManual: false, items: [], busy: false, done: null };

  function norm(str){ return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function slugWords(str){ return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' '); }
  function raceLabel(r){ return r.campeonato + ' · ' + (r.sede || '¿sede?') + (r.fecha ? ' · ' + r.fecha : ''); }
  function hasDoc(r, nombre){ return !!findDoc(r.documentos, nombre); }
  function todayIso(){ var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

  // Prueba por defecto: la más reciente ya disputada (del campeonato indicado, si se sabe)
  function defaultRaceId(champ){
    var hoy = todayIso();
    var pasadas = state.data.races.filter(function(r){ return r.fecha && r.fecha <= hoy && !r.aplazada && (!champ || r.campeonato === champ); })
      .sort(function(a, b){ return a.fecha < b.fecha ? 1 : -1; });
    var r = pasadas[0] || (champ ? null : state.data.races[0]);
    return r ? r._id : (champ ? defaultRaceId() : null);
  }

  function champOfText(n){
    if(n.indexOf('lemans') >= 0) return 'Le Mans Series';
    if(n.indexOf('grupoc') >= 0) return 'Grupo C';
    if(n.indexOf('resisbarna') >= 0) return 'GT';
    return null;
  }

  function clasifCategory(nombre){
    var c = norm(nombre).replace('clasificacion', '').replace('lemansseries', '').replace('grupoc', '');
    return c || 'general';
  }

  // Empareja un PDF de clasificación con una entrada existente (p. ej. "...-gt3_resisbarna.pdf" → "Clasificación Le Mans Series GT3")
  function matchClasif(fileName, race){
    var n = norm(fileName.replace(/\.[^.]+$/, ''));
    var champ = champOfText(n) || race.campeonato;
    var best = null, bestLen = -1;
    state.data.clasificaciones.forEach(function(cl){
      if((champOfText(norm(cl.nombre)) || 'GT') !== champ) return;
      var cat = clasifCategory(cl.nombre);
      var ok = n.indexOf(cat) >= 0 || (cat.indexOf('copa') === 0 && n.indexOf('copa') >= 0);
      if(ok && cat.length > bestLen){ best = cl; bestLen = cat.length; }
    });
    return best ? 'clasif:' + best._id : 'skip';
  }

  function guessTarget(file, race){
    var n = norm(file.name);
    if(!isPdf(file) && !isHtml(file)) return 'skip';
    if(isHtml(file)) return 'doc:Resultado carrera';
    if(n.indexOf('clasific') >= 0) return matchClasif(file.name, race);
    if(n.indexOf('verific') >= 0) return n.indexOf('resumen') >= 0 ? 'doc:Resumen verificaciones' : 'doc:Verificaciones';
    if(n.indexOf('manga') >= 0) return 'doc:Mangas';
    if(n.indexOf('resultado') >= 0) return 'doc:Resultado carrera';
    return 'skip';
  }

  function targetPath(target, file, race){
    var sede = slugWords(race.sede);
    if(target.indexOf('doc:') === 0){
      var docName = target.slice(4);
      if(isHtml(file)) return RESULT_DIR + '/' + CAMP_SLUG[race.campeonato] + '-' + sede.join('-').toLowerCase() + '-2026.html';
      return PDF_DIR + '/' + DOC_PREFIX[docName] + '_' + sede.join('_').toUpperCase() + '_' + CAMP_CODE[race.campeonato] + '_2026.pdf';
    }
    var cl = state.data.clasificaciones.find(function(c){ return 'clasif:' + c._id === target; });
    return (cl && cl.pdf) || (CLASIF_DIR + '/' + sanitizeFilename(file.name));
  }

  function targetOptions(item, race){
    var opts = [['skip', 'No publicar']];
    if(isPdf(item.file) || isHtml(item.file)){
      DOC_TYPES.forEach(function(dt){
        if(isHtml(item.file) && HTML_DOCS.indexOf(dt) < 0) return;
        opts.push(['doc:' + dt, dt + ' de la prueba']);
      });
      if(isPdf(item.file)) state.data.clasificaciones.forEach(function(cl){ opts.push(['clasif:' + cl._id, cl.nombre || 'Clasificación sin nombre']); });
    }
    return opts.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (o[0] === item.target ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }

  function duplicateTargets(){
    var seen = {}, dups = [];
    pub.items.forEach(function(it){
      if(it.target === 'skip') return;
      if(seen[it.target]) dups.push(it.target); else seen[it.target] = true;
    });
    return dups;
  }

  function renderPublish(){
    if(!state.data) return;
    if(!pub.raceId || !state.data.races.some(function(r){ return r._id === pub.raceId; })) pub.raceId = defaultRaceId();
    var race = state.data.races.find(function(r){ return r._id === pub.raceId; });
    var raceOpts = state.data.races.map(function(r){
      return '<option value="' + r._id + '"' + (r._id === pub.raceId ? ' selected' : '') + '>' + esc(raceLabel(r)) + (hasDoc(r, 'Resultado carrera') ? ' ✓' : '') + '</option>';
    }).join('');
    var dups = duplicateTargets();
    var count = pub.items.filter(function(it){ return it.target !== 'skip'; }).length;
    var files = pub.items.map(function(it, i){
      var dest = it.target === 'skip' || !race ? 'No se publica' : '→ ' + targetPath(it.target, it.file, race);
      return '<div class="admin-file' + (it.target === 'skip' ? ' skip' : '') + '">' +
        '<div class="fn">' + esc(it.file.name) + ' <small>' + (it.file.size / 1048576).toFixed(1) + ' MB · ' + esc(dest) + '</small></div>' +
        '<select data-pub-item="' + i + '"' + (pub.busy ? ' disabled' : '') + '>' + targetOptions(it, race) + '</select>' +
      '</div>';
    }).join('');
    var done = pub.done ? '<p class="admin-status ok">' + pub.done + '</p>' : '';
    publishEl.innerHTML = '<h2>Publicar prueba</h2><div class="admin-pub">' +
      '<p>Elige la prueba y arrastra aquí la carpeta con lo que exporta PitWall (resultado HTML, verificaciones, resumen y clasificaciones). Cada fichero se reconoce por su nombre; revisa la lista y pulsa <b>Publicar</b>. Las clasificaciones sustituyen a las actuales.</p>' +
      '<select id="pubRace"' + (pub.busy ? ' disabled' : '') + '>' + raceOpts + '</select>' +
      '<label class="admin-drop" id="pubDrop"><b>Arrastra aquí la carpeta o los ficheros</b><br>o pulsa para elegirlos' +
        '<input type="file" id="pubFiles" multiple accept="application/pdf,.html,.htm"></label>' +
      '<p style="margin-top:-6px"><a href="#" id="pubFolder" style="color:var(--cyan)">Elegir una carpeta entera</a>' +
        '<input type="file" id="pubFolderInput" webkitdirectory hidden></p>' +
      (files ? '<div class="admin-files">' + files + '</div>' : '') +
      (dups.length ? '<p class="admin-status err">Hay dos ficheros con el mismo destino. Cambia uno a "No publicar".</p>' : '') +
      (pub.items.length ? '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
        '<button class="rb-cta go" id="pubGo"' + (pub.busy || !count || dups.length ? ' disabled' : '') + '>Publicar ' + count + ' fichero' + (count === 1 ? '' : 's') + '</button>' +
        '<button class="admin-add" id="pubClear" style="width:auto"' + (pub.busy ? ' disabled' : '') + '>Vaciar lista</button></div>' : '') +
      done + '</div>';
  }

  function addFiles(list){
    pub.done = null;
    var antes = pub.raceId;
    Array.prototype.forEach.call(list, function(file){
      if(/^\./.test(file.name)) return;
      if(file.size > MAX_MB * 1024 * 1024){ setStatus(file.name + ' pesa más de ' + MAX_MB + 'MB y no se añade.', 'err'); return; }
      pub.items.push({ file: file, target: null });
    });
    // Si no se ha elegido prueba a mano, la deduce del nombre de los ficheros (p. ej. "RESISLEMANS" → Le Mans Series)
    if(!pub.raceManual){
      var champ = null;
      pub.items.some(function(it){ champ = champOfText(norm(it.file.name)); return !!champ; });
      if(champ) pub.raceId = defaultRaceId(champ);
    }
    var race = state.data.races.find(function(r){ return r._id === pub.raceId; });
    pub.items.forEach(function(it){ if(it.target === null || pub.raceId !== antes) it.target = guessTarget(it.file, race); });
    renderPublish();
  }

  // Recorre carpetas arrastradas (DataTransferItem.webkitGetAsEntry)
  function readEntries(entry){
    return new Promise(function(resolve){
      if(entry.isFile){ entry.file(function(f){ resolve([f]); }, function(){ resolve([]); }); return; }
      var reader = entry.createReader(), all = [];
      (function next(){
        reader.readEntries(function(batch){
          if(!batch.length){ Promise.all(all.map(readEntries)).then(function(r){ resolve([].concat.apply([], r)); }); return; }
          all = all.concat(Array.prototype.slice.call(batch)); next();
        }, function(){ resolve([]); });
      })();
    });
  }

  publishEl.addEventListener('dragover', function(e){
    if(!e.target.closest('#pubDrop')) return;
    e.preventDefault(); e.target.closest('#pubDrop').classList.add('over');
  });
  publishEl.addEventListener('dragleave', function(e){
    var d = e.target.closest('#pubDrop'); if(d) d.classList.remove('over');
  });
  publishEl.addEventListener('drop', function(e){
    if(!e.target.closest('#pubDrop') || pub.busy) return;
    e.preventDefault();
    var items = e.dataTransfer.items;
    var entries = items ? Array.prototype.map.call(items, function(it){ return it.webkitGetAsEntry && it.webkitGetAsEntry(); }).filter(Boolean) : [];
    if(!entries.length){ addFiles(e.dataTransfer.files); return; }
    Promise.all(entries.map(readEntries)).then(function(r){ addFiles([].concat.apply([], r)); });
  });

  publishEl.addEventListener('change', function(e){
    var t = e.target;
    if(t.id === 'pubFiles' || t.id === 'pubFolderInput'){ addFiles(t.files); t.value = ''; }
    else if(t.id === 'pubRace'){
      pub.raceId = t.value; pub.raceManual = true;
      var race = state.data.races.find(function(r){ return r._id === pub.raceId; });
      pub.items.forEach(function(it){ it.target = guessTarget(it.file, race); });
      pub.done = null; renderPublish();
    } else if(t.dataset.pubItem){
      pub.items[+t.dataset.pubItem].target = t.value; renderPublish();
    }
  });

  publishEl.addEventListener('click', function(e){
    var t = e.target;
    if(t.id === 'pubFolder'){ e.preventDefault(); document.getElementById('pubFolderInput').click(); }
    else if(t.id === 'pubClear'){ pub.items = []; pub.done = null; pub.raceManual = false; renderPublish(); }
    else if(t.id === 'pubGo'){ publishRace(); }
  });

  function gitJson(path, opts){
    return api(path, opts).then(function(res){
      if(!res.ok) return res.json().catch(function(){ return {}; }).then(function(j){
        var err = new Error(j.message || ('Error de GitHub (' + res.status + ')')); err.status = res.status; throw err;
      });
      return res.json();
    });
  }

  function createBlob(b64){
    return gitJson('git/blobs', { method: 'POST', body: JSON.stringify({ content: b64, encoding: 'base64' }) }).then(function(j){ return j.sha; });
  }

  // Sube los ficheros y el JSON de la temporada en un único commit.
  // Si main ha avanzado entretanto (p. ej. el cron del catálogo), reintenta sobre el commit nuevo.
  function commitFiles(blobs, mutate, message, intento){
    intento = intento || 1;
    var head, data, jsonSha;
    return gitJson('git/ref/heads/' + BRANCH).then(function(ref){
      head = ref.object.sha;
      return gitJson('contents/' + DATA_PATH + '?ref=' + head);
    }).then(function(j){
      data = JSON.parse(b64ToUtf8(j.content));
      mutate(data);
      return createBlob(utf8ToB64(JSON.stringify(data, null, 2)));
    }).then(function(sha){
      jsonSha = sha;
      var tree = blobs.map(function(b){ return { path: b.path, mode: '100644', type: 'blob', sha: b.sha }; });
      tree.push({ path: DATA_PATH, mode: '100644', type: 'blob', sha: jsonSha });
      return gitJson('git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head, tree: tree }) });
    }).then(function(tree){
      return gitJson('git/commits', { method: 'POST', body: JSON.stringify({ message: message, tree: tree.sha, parents: [head] }) });
    }).then(function(commit){
      return gitJson('git/refs/heads/' + BRANCH, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    }).then(function(){
      return { data: data, jsonSha: jsonSha };
    }).catch(function(err){
      if(err.status === 422 && intento < 4) return commitFiles(blobs, mutate, message, intento + 1);
      throw err;
    });
  }

  function publishRace(){
    if(state.dirty){ setStatus('Guarda primero los cambios pendientes (botón "Guardar cambios").', 'err'); return; }
    var race = state.data.races.find(function(r){ return r._id === pub.raceId; });
    var items = pub.items.filter(function(it){ return it.target !== 'skip'; });
    if(!race || !items.length) return;
    var raceKey = { campeonato: race.campeonato, sede: race.sede, fecha: race.fecha };
    var plan = items.map(function(it){
      var cl = it.target.indexOf('clasif:') === 0 ? state.data.clasificaciones.find(function(c){ return 'clasif:' + c._id === it.target; }) : null;
      return { file: it.file, path: targetPath(it.target, it.file, race), docName: it.target.indexOf('doc:') === 0 ? it.target.slice(4) : null, clasifNombre: cl ? cl.nombre : null };
    });
    pub.busy = true; renderPublish();
    var hechos = 0;
    setStatus('Subiendo ficheros (0/' + plan.length + ')…', '');
    Promise.all(plan.map(function(p){
      return fileToB64(p.file).then(createBlob).then(function(sha){
        p.sha = sha; hechos++;
        setStatus('Subiendo ficheros (' + hechos + '/' + plan.length + ')…', '');
      });
    })).then(function(){
      setStatus('Publicando…', '');
      return commitFiles(plan, function(data){
        var r = data.races.find(function(x){ return x.campeonato === raceKey.campeonato && x.sede === raceKey.sede && x.fecha === raceKey.fecha; });
        if(!r) throw new Error('La prueba ya no existe en la temporada. Recarga el panel.');
        r.documentos = r.documentos || [];
        plan.forEach(function(p){
          if(p.docName){
            var d = findDoc(r.documentos, p.docName);
            if(d) d.href = p.path; else r.documentos.push({ nombre: p.docName, href: p.path });
          } else if(p.clasifNombre !== null){
            var cl = data.clasificaciones.find(function(c){ return c.nombre === p.clasifNombre; });
            if(cl) cl.pdf = p.path;
          }
        });
        // mantiene el orden habitual de los documentos
        r.documentos.sort(function(a, b){
          var ia = DOC_TYPES.indexOf(a.nombre), ib = DOC_TYPES.indexOf(b.nombre);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
      }, 'Publica resultados de ' + raceLabel(race) + ' desde el panel');
    }).then(function(res){
      state.data = res.data; state.sha = res.jsonSha; state.dirty = false; saveBtn.disabled = true;
      pub.busy = false; pub.items = []; pub.raceManual = false;
      pub.done = 'Publicado ✓ — ' + plan.length + ' fichero' + (plan.length === 1 ? '' : 's') + ' en ' + esc(raceLabel(raceKey)) + '. La web se actualizará en 1-2 minutos.';
      setStatus('Publicado ✓', 'ok');
      render(); pub.raceId = state.data.races.find(function(x){ return x.campeonato === raceKey.campeonato && x.sede === raceKey.sede && x.fecha === raceKey.fecha; })._id;
      renderPublish();
    }).catch(function(err){
      pub.busy = false; renderPublish();
      setStatus('Error: ' + err.message, 'err');
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
