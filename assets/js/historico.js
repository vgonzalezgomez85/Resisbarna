(function(){
  var tabsEl = document.getElementById('yearTabs');
  var contentEl = document.getElementById('content');
  var tabs = Array.prototype.slice.call(tabsEl.querySelectorAll('button'));

  var params = new URLSearchParams(location.search);
  var year = params.get('year') || '2025';
  if(!tabs.some(function(t){ return t.dataset.year === year; })) year = '2025';

  function colorFor(camp){
    var c = (camp||'').toLowerCase();
    if(c.indexOf('grupo c') !== -1) return 'var(--gc)';
    if(c.indexOf('le mans') !== -1 || c.indexOf('lms') !== -1) return 'var(--lms)';
    if(c === 'gt' || c.indexOf('gran turismo') !== -1 || c.indexOf('resisbarna') !== -1) return 'var(--gt)';
    return 'var(--red)';
  }

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function pill(label, href){
    return href
      ? '<a class="rb-pill" href="../' + href + '" target="_blank">' + esc(label) + '</a>'
      : '<span class="rb-pill soon">' + esc(label) + ' · no disponible</span>';
  }

  function render(data){
    if(!data || !data.races || !data.races.length){
      contentEl.innerHTML = '<div class="rb-empty">Todavía no hay datos migrados para esta temporada.</div>';
      return;
    }
    var html = '<div class="rb-cal" style="margin-bottom:34px">';
    data.races.forEach(function(r){
      var c = colorFor(r.campeonato);
      var fecha = r.fecha ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'}) : '';
      html += '<div class="rb-docrow" style="--c:' + c + '">' +
        '<div class="rb-docnum">' + esc(r.campeonato || '') + '</div>' +
        '<div class="venue">' + esc(r.sede || r.nombre) + (fecha ? ' <span class="date">' + fecha + '</span>' : '') + '</div>' +
        '<div class="pills">' +
          pill('Mangas', r.documentos && r.documentos.mangas) +
          pill('Verificaciones', r.documentos && r.documentos.verificaciones) +
          pill('Resultado', r.documentos && r.documentos.resultado) +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    if(data.clasificaciones && data.clasificaciones.length){
      html += '<div class="head" style="margin-bottom:16px"><span class="tick"></span><h2 style="font-size:22px">Clasificaciones ' + esc(data.year) + '</h2></div>';
      html += '<div class="rb-quick">';
      data.clasificaciones.forEach(function(cl){
        html += '<a href="../' + cl.pdf + '" target="_blank"><span class="ic">🏆</span><span>' + esc(cl.nombre) + '</span></a>';
      });
      html += '</div>';
    }
    contentEl.innerHTML = html;
  }

  function load(y){
    year = y;
    tabs.forEach(function(t){ t.classList.toggle('on', t.dataset.year === y); });
    var url = new URL(location.href);
    url.searchParams.set('year', y);
    history.replaceState(null, '', url);
    contentEl.innerHTML = '<div class="rb-empty">Cargando…</div>';
    fetch('data/' + y + '.json').then(function(res){
      if(!res.ok) throw new Error('not found');
      return res.json();
    }).then(render).catch(function(){
      contentEl.innerHTML = '<div class="rb-empty">Todavía no hay datos migrados para esta temporada.</div>';
    });
  }

  tabs.forEach(function(t){
    t.addEventListener('click', function(){ load(t.dataset.year); });
  });

  load(year);
})();
