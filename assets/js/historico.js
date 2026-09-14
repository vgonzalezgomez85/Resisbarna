(function(){
  var select = document.getElementById('yearSelect');
  var contentEl = document.getElementById('content');

  var YEARS = [];
  for (var y = 2025; y >= 2003; y--) YEARS.push(y);
  select.innerHTML = YEARS.map(function(y){ return '<option value="' + y + '">' + y + '</option>'; }).join('');

  var params = new URLSearchParams(location.search);
  var year = params.get('year');
  if (!year || YEARS.indexOf(parseInt(year, 10)) === -1) year = '2025';

  function colorFor(camp){
    var c = (camp||'').toLowerCase();
    if(c.indexOf('grupo c') !== -1) return 'var(--gc)';
    if(c.indexOf('le mans') !== -1 || c.indexOf('lms') !== -1) return 'var(--lms)';
    if(c === 'gt' || c.indexOf('gran turismo') !== -1 || c.indexOf('resisbarna') !== -1) return 'var(--gt)';
    return 'var(--red)';
  }

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function pill(doc){
    return '<a class="rb-pill" href="../' + doc.href + '" target="_blank">' + esc(doc.nombre) + '</a>';
  }

  function render(data){
    var html = '';

    if(data.documentos_generales && data.documentos_generales.length){
      html += '<div class="head" style="margin-bottom:16px"><span class="tick"></span><h2 style="font-size:22px">Documentos ' + esc(data.year) + '</h2></div>';
      html += '<div class="rb-quick" style="margin-bottom:34px">';
      data.documentos_generales.forEach(function(doc){
        html += '<a href="../' + doc.href + '" target="_blank"><span class="ic">📄</span><span>' + esc(doc.nombre) + '</span></a>';
      });
      html += '</div>';
    }

    if(data.races && data.races.length){
      html += '<div class="rb-cal" style="margin-bottom:34px">';
      data.races.forEach(function(r){
        var c = colorFor(r.campeonato);
        var fecha = r.fecha ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'}) : '';
        var docs = r.documentos || [];
        html += '<div class="rb-docrow" style="--c:' + c + '">' +
          '<div class="rb-docnum">' + esc(r.campeonato || '') + '</div>' +
          '<div class="venue">' + esc(r.sede || r.nombre) + (fecha ? ' <span class="date">' + fecha + '</span>' : '') + '</div>' +
          '<div class="pills">' +
            (docs.length ? docs.map(pill).join('') : '<span class="rb-pill soon">Sin documentos</span>') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    if(data.clasificaciones && data.clasificaciones.length){
      html += '<div class="head" style="margin-bottom:16px"><span class="tick"></span><h2 style="font-size:22px">Clasificaciones ' + esc(data.year) + '</h2></div>';
      html += '<div class="rb-quick">';
      data.clasificaciones.forEach(function(cl){
        html += '<a href="../' + cl.pdf + '" target="_blank"><span class="ic">🏆</span><span>' + esc(cl.nombre) + '</span></a>';
      });
      html += '</div>';
    }

    if(!html) html = '<div class="rb-empty">Todavía no hay datos migrados para esta temporada.</div>';
    contentEl.innerHTML = html;
  }

  function load(y){
    year = y;
    select.value = y;
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

  select.addEventListener('change', function(){ load(select.value); });

  load(year);
})();
