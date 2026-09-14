(function(){
  // Pega aquí la URL de tu Google Apps Script publicado como Web App
  // (termina en /exec). Instrucciones: ver docs/apps-script-inscripciones.gs
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzHDhxFYVik9nUO0EVrXmocy26eqN0Z2Lvtv56j4qpXz6BMlnEWebHMYcN5Wgg8FrMB/exec';

  var racesEl = document.getElementById('races');
  var filtersEl = document.getElementById('campFilters');
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
  if(qCamp === 'GT' || qCamp === 'Grupo C' || qCamp === 'Le Mans Series'){
    currentFilter = qCamp;
  }

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function colorFor(camp){
    if(camp === 'Grupo C') return 'var(--gc)';
    if(camp === 'Le Mans Series') return 'var(--lms)';
    if(camp === 'GT') return 'var(--gt)';
    return 'var(--red)';
  }
  function raceKey(camp, sede, fecha){ return camp + '|' + sede + '|' + fecha; }

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
    var badge = count
      ? '<span class="rb-insc-count">' + count + ' equipo' + (count === 1 ? '' : 's') + ' apuntado' + (count === 1 ? '' : 's') + '</span>'
      : '<span class="rb-insc-count zero">Sin apuntados todavía</span>';
    var list = count
      ? '<div class="rb-insc-list">' + teams.map(function(t, i){
          var p2 = t['Piloto 2'] ? ' / ' + esc(t['Piloto 2']) : '';
          var dia = t['Día'] ? ' <span class="rb-insc-dia">' + esc(t['Día']) + '</span>' : '';
          return '<div class="rb-insc-team"><span><span class="n">' + (i+1) + '.</span> ' + esc(t.Equipo) + ' — ' + esc(t['Piloto 1']) + p2 + '</span>' + dia + '</div>';
        }).join('') + '</div>'
      : '<div class="rb-insc-empty">Todavía no hay equipos apuntados. ¡Sé el primero!</div>';
    return { badge: badge, list: list };
  }

  function raceCardHtml(race, idx){
    var fecha = race.fecha ? new Date(race.fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'long', year:'numeric'}) : 'Fecha por confirmar';

    var formHtml = configured
      ? '<form class="rb-insc-form" data-race="' + idx + '">' +
          '<input type="text" name="equipo" placeholder="Nombre del equipo" required>' +
          '<input type="text" name="piloto1" placeholder="Piloto 1" required>' +
          '<input type="text" name="piloto2" placeholder="Piloto 2 (opcional)">' +
          '<select name="dia" required>' +
            '<option value="" disabled selected>¿Qué día corres?</option>' +
            '<option value="Jueves">Jueves</option>' +
            '<option value="Viernes">Viernes</option>' +
          '</select>' +
          '<button type="submit" class="rb-cta go">Apuntarme →</button>' +
        '</form><div class="rb-insc-msg" data-race-msg="' + idx + '"></div>'
      : '<div class="rb-insc-empty">El apuntarse online está en configuración. Vuelve pronto.</div>';

    return '<div class="rb-insc-race" data-champ="' + esc(race.campeonato) + '" style="--c:' + colorFor(race.campeonato) + '">' +
      '<div class="top">' +
        '<div class="venue">' + esc(race.sede || 'Sede por confirmar') + '</div>' +
        '<span class="chip" style="background:' + colorFor(race.campeonato) + '">' + esc(race.campeonato) + '</span>' +
        '<span class="date">' + fecha + '</span>' +
        '<span data-badge="' + idx + '"></span>' +
      '</div>' +
      '<div data-list="' + idx + '"></div>' +
      formHtml +
    '</div>';
  }

  function paintStatus(idx){
    var race = visibleRaces[idx];
    if(!race) return;
    var badgeEl = racesEl.querySelector('[data-badge="' + idx + '"]');
    var listEl = racesEl.querySelector('[data-list="' + idx + '"]');
    if(!badgeEl || !listEl) return;
    var parts = statusParts(race);
    badgeEl.innerHTML = parts.badge;
    listEl.innerHTML = parts.list;
  }

  function paintAllStatuses(){
    visibleRaces.forEach(function(_, idx){ paintStatus(idx); });
  }

  // Pinta la estructura completa (calendario + formularios). Se llama
  // solo cuando cambia el filtro o llega el calendario por primera vez;
  // así nunca se destruyen formularios a medio rellenar.
  function render(){
    visibleRaces = (temporada.races || []).filter(function(r){
      return currentFilter === 'all' || r.campeonato === currentFilter;
    });
    if(!visibleRaces.length){ racesEl.innerHTML = '<div class="rb-empty">No hay carreras para este filtro.</div>'; return; }
    racesEl.innerHTML = visibleRaces.map(raceCardHtml).join('');
    paintAllStatuses();
  }

  racesEl.addEventListener('submit', function(e){
    e.preventDefault();
    var form = e.target;
    if(!form.classList.contains('rb-insc-form')) return;
    var idx = form.dataset.race;
    var race = visibleRaces[idx];
    var msgEl = racesEl.querySelector('[data-race-msg="' + idx + '"]');
    var equipo = form.equipo.value.trim();
    var piloto1 = form.piloto1.value.trim();
    var piloto2 = form.piloto2.value.trim();
    var dia = form.dia.value;
    if(!equipo || !piloto1 || !dia) return;

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
      paintStatus(idx);
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
    render();
  });

  function syncFilterButtons(){
    filtersEl.querySelectorAll('button').forEach(function(b){
      b.classList.toggle('on', b.dataset.f === currentFilter);
    });
  }

  // Si se llega desde el calendario de la home con una prueba concreta
  // (?sede=...&fecha=...), la resalta y hace scroll hasta ella.
  function highlightRace(){
    if(!qSede || !qFecha) return;
    var idx = visibleRaces.findIndex(function(r){ return r.sede === qSede && r.fecha === qFecha; });
    if(idx === -1) return;
    var el = racesEl.querySelector('.rb-insc-race:nth-child(' + (idx + 1) + ')');
    if(!el) return;
    el.classList.add('highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function(){ el.classList.remove('highlight'); }, 2600);
  }

  // 1) El calendario (rápido, mismo servidor que la página) pinta ya
  //    mismo, con el formulario listo para usar.
  syncFilterButtons();
  fetch('assets/data/temporada-2026.json').then(function(r){ return r.json(); }).then(function(data){
    temporada = data;
    render();
    highlightRace();

    // 2) La lista de apuntados (Google Apps Script, puede tardar varios
    //    segundos) se pide en paralelo y solo repinta los contadores/listas
    //    cuando llega, sin tocar los formularios ya visibles.
    if(configured){
      fetch(SCRIPT_URL).then(function(r){ return r.json(); }).then(function(rows){
        inscripciones = rows || [];
        inscripcionesLoaded = true;
        paintAllStatuses();
      }).catch(function(){
        inscripcionesLoaded = true; // deja de decir "Cargando…"; los formularios siguen funcionando igual
        paintAllStatuses();
      });
    } else {
      inscripcionesLoaded = true;
      paintAllStatuses();
    }
  }).catch(function(){
    racesEl.innerHTML = '<div class="rb-empty">No se ha podido cargar el calendario.</div>';
  });
})();
