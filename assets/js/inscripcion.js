(function(){
  // Pega aquí la URL de tu Google Apps Script publicado como Web App
  // (termina en /exec). Instrucciones: ver docs/apps-script-inscripciones.gs
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzHDhxFYVik9nUO0EVrXmocy26eqN0Z2Lvtv56j4qpXz6BMlnEWebHMYcN5Wgg8FrMB/exec';

  var racesEl = document.getElementById('races');
  var filtersEl = document.getElementById('campFilters');
  var currentFilter = 'all';
  var temporada = null;
  var inscripciones = [];
  var configured = SCRIPT_URL.indexOf('http') === 0;

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

  function raceCardHtml(race, idx){
    var fecha = race.fecha ? new Date(race.fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'long', year:'numeric'}) : 'Fecha por confirmar';
    var teams = teamsFor(race);
    var count = teams.length;
    var countBadge = count
      ? '<span class="rb-insc-count">' + count + ' equipo' + (count === 1 ? '' : 's') + ' apuntado' + (count === 1 ? '' : 's') + '</span>'
      : '<span class="rb-insc-count zero">Sin apuntados todavía</span>';
    var listHtml = teams.length
      ? '<div class="rb-insc-list">' + teams.map(function(t, i){
          var p2 = t['Piloto 2'] ? ' / ' + esc(t['Piloto 2']) : '';
          return '<div class="rb-insc-team"><span><span class="n">' + (i+1) + '.</span> ' + esc(t.Equipo) + ' — ' + esc(t['Piloto 1']) + p2 + '</span></div>';
        }).join('') + '</div>'
      : '<div class="rb-insc-empty">Todavía no hay equipos apuntados. ¡Sé el primero!</div>';

    var formHtml = configured
      ? '<form class="rb-insc-form" data-race="' + idx + '">' +
          '<input type="text" name="equipo" placeholder="Nombre del equipo" required>' +
          '<input type="text" name="piloto1" placeholder="Piloto 1" required>' +
          '<input type="text" name="piloto2" placeholder="Piloto 2 (opcional)">' +
          '<button type="submit" class="rb-cta go">Apuntarme →</button>' +
        '</form><div class="rb-insc-msg" data-race-msg="' + idx + '"></div>'
      : '<div class="rb-insc-empty">El apuntarse online está en configuración. Vuelve pronto.</div>';

    return '<div class="rb-insc-race" data-champ="' + esc(race.campeonato) + '" style="--c:' + colorFor(race.campeonato) + '">' +
      '<div class="top">' +
        '<div class="venue">' + esc(race.sede || 'Sede por confirmar') + '</div>' +
        '<span class="chip" style="background:' + colorFor(race.campeonato) + '">' + esc(race.campeonato) + '</span>' +
        '<span class="date">' + fecha + '</span>' +
        countBadge +
      '</div>' +
      listHtml +
      formHtml +
    '</div>';
  }

  function render(){
    var races = (temporada.races || []).filter(function(r){
      return currentFilter === 'all' || r.campeonato === currentFilter;
    });
    if(!races.length){ racesEl.innerHTML = '<div class="rb-empty">No hay carreras para este filtro.</div>'; return; }
    racesEl.innerHTML = races.map(raceCardHtml).join('');
  }

  racesEl.addEventListener('submit', function(e){
    e.preventDefault();
    var form = e.target;
    if(!form.classList.contains('rb-insc-form')) return;
    var idx = form.dataset.race;
    var races = (temporada.races || []).filter(function(r){ return currentFilter === 'all' || r.campeonato === currentFilter; });
    var race = races[idx];
    var msgEl = racesEl.querySelector('[data-race-msg="' + idx + '"]');
    var equipo = form.equipo.value.trim();
    var piloto1 = form.piloto1.value.trim();
    var piloto2 = form.piloto2.value.trim();
    if(!equipo || !piloto1) return;

    var payload = {
      campeonato: race.campeonato,
      sede: race.sede,
      fecha: race.fecha,
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
      inscripciones.push({ Campeonato: race.campeonato, Sede: race.sede, Fecha: race.fecha, Equipo: equipo, 'Piloto 1': piloto1, 'Piloto 2': piloto2 });
      form.reset();
      msgEl.textContent = '¡Apuntado! Ya apareces en la lista.';
      msgEl.className = 'rb-insc-msg ok';
      render();
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

  Promise.all([
    fetch('assets/data/temporada-2026.json').then(function(r){ return r.json(); }),
    configured ? fetch(SCRIPT_URL).then(function(r){ return r.json(); }).catch(function(){ return []; }) : Promise.resolve([])
  ]).then(function(results){
    temporada = results[0];
    inscripciones = results[1] || [];
    render();
  }).catch(function(){
    racesEl.innerHTML = '<div class="rb-empty">No se ha podido cargar el calendario.</div>';
  });
})();
