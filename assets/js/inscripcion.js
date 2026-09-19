(function(){
  // Pega aquí la URL de tu Google Apps Script publicado como Web App
  // (termina en /exec). Instrucciones: ver docs/apps-script-inscripciones.gs
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyDLRufW-pp6NSHmROJ_ayVNC1UVrV18n_MCYJclqoUwNzrWS4HqG9apVUD8pV5qAga/exec';

  var racesEl = document.getElementById('races');
  var filtersEl = document.getElementById('campFilters');
  var titleEl = document.getElementById('pageTitle');
  var tagEl = document.getElementById('pageTag');
  var crumbEl = document.getElementById('crumb');
  var currentFilter = 'all';
  var temporada = null;
  var inscripciones = [];
  var inscripcionesLoaded = false;
  var configured = SCRIPT_URL.indexOf('http') === 0;
  var visibleRaces = [];

  var qs = new URLSearchParams(location.search);
  var qCamp = qs.get('camp');
  var qSede = qs.get('sede');
  var qFecha = qs.get('fecha');
  // Si llegan los tres parámetros (los mismos que ya usan los enlaces
  // "Inscríbete →" de la home), esta página deja de ser el listado y se
  // convierte en la página dedicada solo a esa prueba: cada carrera
  // tiene así su propia URL, con su propio formulario y su propia hoja
  // de Google Sheets detrás.
  var detailMode = !!(qCamp && qSede && qFecha);

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function colorFor(camp){
    if(camp === 'Grupo C') return 'var(--gc)';
    if(camp === 'Le Mans Series') return 'var(--lms)';
    if(camp === 'GT') return 'var(--gt)';
    return 'var(--red)';
  }
  function raceKey(camp, sede, fecha){ return camp + '|' + sede + '|' + fecha; }
  // Grupo C y Le Mans Series se corren en solitario (solo piloto + día);
  // GT se sigue corriendo por equipos de dos pilotos.
  function isIndividual(campeonato){ return campeonato === 'Grupo C' || campeonato === 'Le Mans Series'; }
  function raceHref(race){
    return 'inscripcion.html?' + new URLSearchParams({ camp: race.campeonato, sede: race.sede, fecha: race.fecha }).toString();
  }
  function fechaLarga(fecha){
    return fecha ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'long', year:'numeric'}) : 'Fecha por confirmar';
  }

  function teamsFor(race){
    var key = raceKey(race.campeonato, race.sede, race.fecha);
    return inscripciones.filter(function(row){
      return raceKey(row.Campeonato, row.Sede, row.Fecha) === key;
    });
  }

  // Contador + lista de apuntados de una prueba (se puede repintar solo
  // esto, sin tocar el formulario, cuando llegan los datos de la hoja).
  function statusParts(race){
    if(!inscripcionesLoaded){
      return { badge: '<span class="rb-insc-count loading">Cargando apuntados…</span>', list: '' };
    }
    var teams = teamsFor(race);
    var count = teams.length;
    var individual = isIndividual(race.campeonato);
    var unidad = individual ? 'piloto' : 'equipo';
    var badge = count
      ? '<span class="rb-insc-count">' + count + ' ' + unidad + (count === 1 ? '' : 's') + ' apuntado' + (count === 1 ? '' : 's') + '</span>'
      : '<span class="rb-insc-count zero">Sin apuntados todavía</span>';
    var list = count
      ? '<div class="rb-insc-list">' + teams.map(function(t, i){
          var diaClase = t['Día'] === 'Jueves' ? ' jueves' : (t['Día'] === 'Viernes' ? ' viernes' : '');
          var dia = t['Día'] ? ' <span class="rb-insc-dia' + diaClase + '">' + esc(t['Día']) + '</span>' : '';
          var nombre = individual
            ? esc(t['Piloto 1'])
            : esc(t.Equipo) + ' — ' + esc(t['Piloto 1']) + (t['Piloto 2'] ? ' / ' + esc(t['Piloto 2']) : '');
          return '<div class="rb-insc-team"><span><span class="n">' + (i+1) + '.</span> ' + nombre + dia + '</span></div>';
        }).join('') + '</div>'
      : '<div class="rb-insc-empty">Todavía no hay ' + (individual ? 'pilotos apuntados' : 'equipos apuntados') + '. ¡Sé el primero!</div>';
    return { badge: badge, list: list };
  }

  // --- Modo listado: una tarjeta por prueba, sin formulario, que enlaza
  // a la página dedicada de esa prueba (raceHref). ---

  function listCardHtml(race, idx){
    return '<div class="rb-insc-race" data-champ="' + esc(race.campeonato) + '" style="--c:' + colorFor(race.campeonato) + '">' +
      '<div class="top">' +
        '<div class="venue">' + esc(race.sede || 'Sede por confirmar') + '</div>' +
        '<span class="chip" style="background:' + colorFor(race.campeonato) + '">' + esc(race.campeonato) + '</span>' +
        '<span class="date">' + fechaLarga(race.fecha) + '</span>' +
        '<span data-badge="' + idx + '"></span>' +
      '</div>' +
      '<a class="rb-cta go" href="' + raceHref(race) + '">Ver e inscribirse →</a>' +
    '</div>';
  }

  function paintListStatus(idx){
    var race = visibleRaces[idx];
    if(!race) return;
    var badgeEl = racesEl.querySelector('[data-badge="' + idx + '"]');
    if(!badgeEl) return;
    badgeEl.innerHTML = statusParts(race).badge;
  }

  function paintAllListStatuses(){
    visibleRaces.forEach(function(_, idx){ paintListStatus(idx); });
  }

  function renderList(){
    visibleRaces = (temporada.races || []).filter(function(r){
      return currentFilter === 'all' || r.campeonato === currentFilter;
    });
    if(!visibleRaces.length){ racesEl.innerHTML = '<div class="rb-empty">No hay carreras para este filtro.</div>'; return; }
    racesEl.innerHTML = visibleRaces.map(listCardHtml).join('');
    paintAllListStatuses();
  }

  // --- Modo prueba: una sola tarjeta grande con el formulario y la
  // lista completa de apuntados de esa carrera. ---

  function renderDetail(race){
    filtersEl.style.display = 'none';
    titleEl.textContent = race.sede + ' · ' + race.campeonato;
    tagEl.textContent = fechaLarga(race.fecha) + '. Apunta a tu equipo a esta prueba y consulta quién ya está apuntado.';
    crumbEl.innerHTML = '<a href="index.html">Inicio</a><span>/</span><a href="inscripcion.html">Inscripción</a><span>/</span><b>' + esc(race.sede) + '</b>';

    var individual = isIndividual(race.campeonato);
    var campos = individual
      ? '<input type="text" name="piloto1" placeholder="Nombre del piloto" required>'
      : '<input type="text" name="equipo" placeholder="Nombre del equipo" required>' +
        '<input type="text" name="piloto1" placeholder="Piloto 1" required>' +
        '<input type="text" name="piloto2" placeholder="Piloto 2 (opcional)">';
    var formHtml = configured
      ? '<form class="rb-insc-form" data-race="0">' +
          campos +
          '<select name="dia" required>' +
            '<option value="" disabled selected>¿Qué día corres?</option>' +
            '<option value="Jueves">Jueves</option>' +
            '<option value="Viernes">Viernes</option>' +
          '</select>' +
          '<button type="submit" class="rb-cta go">Apuntarme →</button>' +
        '</form><div class="rb-insc-msg" data-race-msg="0"></div>'
      : '<div class="rb-insc-empty">El apuntarse online está en configuración. Vuelve pronto.</div>';

    racesEl.innerHTML = '<div class="rb-insc-race" data-champ="' + esc(race.campeonato) + '" style="--c:' + colorFor(race.campeonato) + '">' +
      '<div class="top">' +
        '<div class="venue">' + esc(race.sede || 'Sede por confirmar') + '</div>' +
        '<span class="chip" style="background:' + colorFor(race.campeonato) + '">' + esc(race.campeonato) + '</span>' +
        '<span class="date">' + fechaLarga(race.fecha) + '</span>' +
        '<span data-badge="0"></span>' +
      '</div>' +
      '<div data-list="0"></div>' +
      formHtml +
    '</div>' +
    '<a class="rb-cta" href="inscripcion.html" style="margin-top:18px; display:inline-block">← Ver todas las pruebas</a>';

    paintDetailStatus(race);
  }

  function paintDetailStatus(race){
    var badgeEl = racesEl.querySelector('[data-badge="0"]');
    var listEl = racesEl.querySelector('[data-list="0"]');
    if(!badgeEl || !listEl) return;
    var parts = statusParts(race);
    badgeEl.innerHTML = parts.badge;
    listEl.innerHTML = parts.list;
  }

  racesEl.addEventListener('submit', function(e){
    e.preventDefault();
    var form = e.target;
    if(!form.classList.contains('rb-insc-form')) return;
    var race = detailMode ? currentRace : visibleRaces[form.dataset.race];
    var individual = isIndividual(race.campeonato);
    var msgEl = racesEl.querySelector('[data-race-msg="' + form.dataset.race + '"]');
    var equipo = individual ? '' : form.equipo.value.trim();
    var piloto1 = form.piloto1.value.trim();
    var piloto2 = individual ? '' : form.piloto2.value.trim();
    var dia = form.dia.value;
    if(!piloto1 || !dia) return;
    if(!individual && !equipo) return;

    var payload = {
      campeonato: race.campeonato,
      sede: race.sede,
      fecha: race.fecha,
      dia: dia,
      equipo: equipo,
      piloto1: piloto1,
      piloto2: piloto2
    };

    var btn = form.querySelector('button');
    btn.disabled = true;
    msgEl.textContent = 'Enviando…';
    msgEl.className = 'rb-insc-msg';

    fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function(res){
      if(!res.ok) throw new Error('No se pudo guardar');
      return res.json();
    }).then(function(){
      inscripciones.push({ Campeonato: race.campeonato, Sede: race.sede, Fecha: race.fecha, 'Día': dia, Equipo: equipo, 'Piloto 1': piloto1, 'Piloto 2': piloto2 });
      form.reset();
      msgEl.textContent = '¡Apuntado! Ya apareces en la lista.';
      msgEl.className = 'rb-insc-msg ok';
      if(detailMode){ paintDetailStatus(race); } else { paintListStatus(form.dataset.race); }
      btn.disabled = false;
    }).catch(function(){
      msgEl.textContent = 'No se ha podido guardar. Inténtalo de nuevo en un momento.';
      msgEl.className = 'rb-insc-msg err';
      btn.disabled = false;
    });
  });

  filtersEl.addEventListener('click', function(e){
    if(e.target.tagName !== 'BUTTON') return;
    filtersEl.querySelectorAll('button').forEach(function(b){ b.classList.remove('on'); });
    e.target.classList.add('on');
    currentFilter = e.target.dataset.f;
    renderList();
  });

  function syncFilterButtons(){
    filtersEl.querySelectorAll('button').forEach(function(b){
      b.classList.toggle('on', b.dataset.f === currentFilter);
    });
  }

  var currentRace = null;

  function loadInscripciones(query){
    if(!configured){
      inscripcionesLoaded = true;
      return Promise.resolve();
    }
    var url = query ? SCRIPT_URL + '?' + query : SCRIPT_URL;
    return fetch(url).then(function(r){ return r.json(); }).then(function(rows){
      inscripciones = rows || [];
      inscripcionesLoaded = true;
    }).catch(function(){
      inscripcionesLoaded = true; // deja de decir "Cargando…"; el formulario sigue funcionando igual
    });
  }

  syncFilterButtons();
  fetch('assets/data/temporada-2026.json').then(function(r){ return r.json(); }).then(function(data){
    temporada = data;

    if(detailMode){
      currentRace = (temporada.races || []).find(function(r){
        return r.campeonato === qCamp && r.sede === qSede && r.fecha === qFecha;
      });
      if(!currentRace){
        racesEl.innerHTML = '<div class="rb-empty">No se ha encontrado esa prueba. <a href="inscripcion.html">Ver todas las pruebas</a>.</div>';
        return;
      }
      renderDetail(currentRace);
      // Solo se pide la hoja de ESTA prueba: más rápido y ligero que
      // traer todas las pruebas de la temporada.
      loadInscripciones(new URLSearchParams({ camp: currentRace.campeonato, sede: currentRace.sede }).toString())
        .then(function(){ paintDetailStatus(currentRace); });
    } else {
      renderList();
      // Aquí sí interesa traer todas las pruebas juntas en una sola
      // llamada, para pintar el contador de cada tarjeta del listado.
      loadInscripciones().then(function(){ paintAllListStatuses(); });
    }
  }).catch(function(){
    racesEl.innerHTML = '<div class="rb-empty">No se ha podido cargar el calendario.</div>';
  });
})();
