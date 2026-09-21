(function(){
  var contentEl = document.getElementById('content');
  var filtro = contentEl.dataset.campeonato || null; // null = todas (clasificaciones)
  var modo = contentEl.dataset.modo || 'resultados'; // 'resultados' | 'clasificaciones'

  var COLORS = { 'GT': 'var(--gt)', 'Grupo C': 'var(--gc)', 'Le Mans Series': 'var(--lms)' };
  function colorFor(camp){ return COLORS[camp] || 'var(--red)'; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function pill(doc){
    return '<a class="rb-pill" href="../' + doc.href + '" target="_blank">' + esc(doc.nombre) + '</a>';
  }

  function renderResultados(data){
    var races = (data.races || []).filter(function(r){ return r.campeonato === filtro; });
    if(!races.length){ contentEl.innerHTML = '<div class="rb-empty">Todavía no hay carreras cargadas.</div>'; return; }
    var html = '<div class="rb-cal">';
    races.forEach(function(r, i){
      var fecha = r.fecha ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'}) : '';
      var docs = r.documentos || [];
      html += '<div class="rb-docrow"' + (r.aplazada ? ' data-aplazada="true"' : '') + ' style="--c:' + colorFor(r.campeonato) + '">' +
        '<div class="rb-docnum">' + String(i+1).padStart(2,'0') + '</div>' +
        '<div class="venue">' + esc(r.sede) + (fecha ? ' <span class="date">' + fecha + '</span>' : '') + '</div>' +
        '<div class="pills">' +
          (docs.length ? docs.map(pill).join('') : '<span class="rb-pill soon">Próximamente</span>') +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    contentEl.innerHTML = html;
  }

  function renderClasificaciones(data){
    var items = data.clasificaciones || [];
    if(!items.length){ contentEl.innerHTML = '<div class="rb-empty">Todavía no hay clasificaciones cargadas.</div>'; return; }
    var html = '';
    items.forEach(function(cl){
      html += '<div class="rb-docrow" style="--c:var(--red)">' +
        '<div class="rb-docnum">🏆</div>' +
        '<div class="venue">' + esc(cl.nombre) + '</div>' +
        '<div class="pills">' +
          (cl.pdf ? '<a class="rb-pill" href="../' + cl.pdf + '" target="_blank">Ver PDF</a>' : '<span class="rb-pill soon">Próximamente</span>') +
        '</div>' +
      '</div>';
    });
    contentEl.innerHTML = html;
  }

  fetch('../assets/data/temporada-2026.json').then(function(res){ return res.json(); }).then(function(data){
    if(modo === 'clasificaciones') renderClasificaciones(data);
    else renderResultados(data);
  }).catch(function(){
    contentEl.innerHTML = '<div class="rb-empty">No se han podido cargar los datos de la temporada.</div>';
  });
})();
