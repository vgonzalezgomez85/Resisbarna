(function(){
  // Página "Prepara tu coche". Los datos salen de assets/data/catalogo.json,
  // que se genera desde el Excel MAESTRO del catálogo (el mismo Google
  // Sheet de PitWall Control) con herramientas/catalogo_desde_excel.py.

  // Copas de cada campeonato de la web. El resto de copas del catálogo
  // aparecen plegadas en "Otras copas".
  var CAMPEONATOS = [
    { id:'gt',  nombre:'GT',             color:'var(--gt)',  reglamento:'reglamentos/gt3.html',     copas:['GT3 RESISBARNA','GT'] },
    { id:'gc',  nombre:'Grupo C',        color:'var(--gc)',  reglamento:'reglamentos/grupo-c.html', copas:['GRUPO C1','GRUPO C2'] },
    { id:'lms', nombre:'Le Mans Series', color:'var(--lms)', reglamento:'reglamentos/lmp-hyp.html', copas:['HYP RESISBARNA','LMP','LMP-2'] }
  ];
  var MATERIAL_LLANTA = { PL:'plástico', '3D':'3D', AL:'aluminio', MG:'magnesio' };

  var copasEl = document.getElementById('copas');
  var resEl = document.getElementById('resultado');
  var busca = document.getElementById('buscaCoche');
  var sugEl = document.getElementById('sugerencias');

  var cat = null;
  var copaSel = null;   // clave de la copa elegida
  var cocheSel = null;  // índice en cat.coches
  var sugs = [], sugIdx = -1;

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function sinTildes(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase(); }
  // "LMP2" y "LMP-2" son la misma copa.
  function clave(s){ return sinTildes(s).replace(/[^A-Z0-9]/g,''); }
  function num(n){ return n==null ? '' : Number(n).toLocaleString('es-ES'); }
  function tiene(x, k){ return x.copas.some(function(c){ return clave(c) === k; }); }
  function campDe(k){
    for(var i=0;i<CAMPEONATOS.length;i++){
      if(CAMPEONATOS[i].copas.some(function(c){ return clave(c) === k; })) return CAMPEONATOS[i];
    }
    return null;
  }
  // Nombre "bonito" de cada copa por su clave: el de la pestaña COPAS/CATEG.
  // o, si no está allí, el primero con que aparece en el material.
  var nombres = {};
  function indexaNombres(){
    cat.copas.forEach(function(c){ nombres[clave(c)] = nombres[clave(c)] || c; });
    ['coches','motores','neumaticos','llantas','engranajes','bancadas'].forEach(function(t){
      cat[t].forEach(function(x){ x.copas.forEach(function(c){ nombres[clave(c)] = nombres[clave(c)] || c; }); });
    });
  }
  function nombreCopa(k){ return nombres[k] || k; }

  // ---------- selector de copas ----------
  function usoCopa(k){
    var n = 0;
    ['coches','motores','neumaticos','llantas','engranajes','bancadas'].forEach(function(t){
      cat[t].forEach(function(x){ if(tiene(x,k)) n++; });
    });
    return n;
  }
  function chip(k, color){
    var n = cat.coches.filter(function(c){ return tiene(c,k); }).length;
    return '<button type="button" class="rb-prep-copa' + (copaSel===k?' on':'') + '" data-copa="' + esc(k) + '" style="--c:' + color + '">' +
      esc(nombreCopa(k)) + '<small>' + n + ' coche' + (n===1?'':'s') + '</small></button>';
  }
  function pintaCopas(){
    var propias = {};
    var html = CAMPEONATOS.map(function(c){
      return '<div class="rb-prep-grupo"><div class="lbl" style="color:' + c.color + '">' + esc(c.nombre) + '</div><div class="chips">' +
        c.copas.map(function(x){ propias[clave(x)] = 1; return chip(clave(x), c.color); }).join('') + '</div></div>';
    }).join('');
    var otras = cat.copas.map(clave).filter(function(k){ return !propias[k] && usoCopa(k) > 0; });
    if(otras.length){
      var abierta = copaSel && otras.indexOf(copaSel) >= 0;
      html += '<details class="rb-prep-otras"' + (abierta?' open':'') + '><summary>Otras copas</summary><div class="chips">' +
        otras.map(function(k){ return chip(k, 'var(--muted)'); }).join('') + '</div></details>';
    }
    copasEl.innerHTML = html;
  }
  copasEl.addEventListener('click', function(e){
    var b = e.target.closest('[data-copa]');
    if(!b) return;
    elegir(b.getAttribute('data-copa'), null, true);
  });

  // ---------- buscador de coches ----------
  function buscar(q){
    var t = sinTildes(q).split(/\s+/).filter(Boolean);
    if(!t.length) return [];
    var r = [];
    cat.coches.forEach(function(c, i){
      var h = sinTildes(c.n + ' ' + c.marca);
      if(t.every(function(x){ return h.indexOf(x) >= 0; })) r.push(i);
    });
    // Primero los coches de copas de la web.
    r.sort(function(a, b){
      var pa = cat.coches[a].copas.some(function(c){ return campDe(clave(c)); }) ? 0 : 1;
      var pb = cat.coches[b].copas.some(function(c){ return campDe(clave(c)); }) ? 0 : 1;
      return pa - pb || cat.coches[a].n.localeCompare(cat.coches[b].n);
    });
    return r.slice(0, 10);
  }
  function pintaSugs(){
    if(!sugs.length){
      sugEl.innerHTML = busca.value.trim() ? '<li class="vacio">No encuentro ese coche en el catálogo</li>' : '';
      sugEl.hidden = !busca.value.trim();
    } else {
      sugEl.innerHTML = sugs.map(function(i, j){
        var c = cat.coches[i];
        return '<li role="option" id="sug' + j + '" data-i="' + i + '"' + (j===sugIdx?' aria-selected="true"':'') + '>' +
          '<b>' + esc(c.n) + '</b><span>' + esc(c.marca) + (c.copas.length ? ' · ' + esc(c.copas.join(', ')) : '') + '</span></li>';
      }).join('');
      sugEl.hidden = false;
    }
    busca.setAttribute('aria-expanded', sugEl.hidden ? 'false' : 'true');
    if(sugIdx >= 0) busca.setAttribute('aria-activedescendant', 'sug' + sugIdx); else busca.removeAttribute('aria-activedescendant');
  }
  function cierraSugs(){ sugEl.hidden = true; busca.setAttribute('aria-expanded','false'); }
  busca.addEventListener('input', function(){ sugs = buscar(busca.value); sugIdx = sugs.length ? 0 : -1; pintaSugs(); });
  busca.addEventListener('focus', function(){ if(busca.value.trim()){ sugs = buscar(busca.value); pintaSugs(); } });
  busca.addEventListener('keydown', function(e){
    if(sugEl.hidden || !sugs.length){ if(e.key === 'Escape') cierraSugs(); return; }
    if(e.key === 'ArrowDown'){ e.preventDefault(); sugIdx = (sugIdx + 1) % sugs.length; pintaSugs(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); sugIdx = (sugIdx - 1 + sugs.length) % sugs.length; pintaSugs(); }
    else if(e.key === 'Enter' && sugIdx >= 0){ e.preventDefault(); eligeCoche(sugs[sugIdx]); }
    else if(e.key === 'Escape'){ cierraSugs(); }
  });
  sugEl.addEventListener('mousedown', function(e){
    var li = e.target.closest('[data-i]');
    if(!li) return;
    e.preventDefault();
    eligeCoche(+li.getAttribute('data-i'));
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.rb-prep-search')) cierraSugs(); });

  function eligeCoche(i){
    var c = cat.coches[i];
    busca.value = c.n;
    cierraSugs();
    // Si el coche está en varias copas, se prefiere una de la web.
    var ks = c.copas.map(clave);
    var k = ks.filter(campDe)[0] || ks[0] || null;
    elegir(k, i, true);
  }

  // ---------- estado + URL ----------
  function elegir(k, i, scroll){
    copaSel = k;
    cocheSel = i;
    var qs = new URLSearchParams();
    if(i != null) qs.set('coche', cat.coches[i].n);
    if(k) qs.set('copa', nombreCopa(k));
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : ''));
    pintaCopas();
    pintaResultado();
    if(scroll) resEl.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  // ---------- resultado ----------
  function seccion(titulo, items, cuerpo, vacio){
    return '<div class="rb-prep-sec"><h3>' + esc(titulo) + (items ? '<span class="n">' + items + '</span>' : '') + '</h3>' +
      (items ? cuerpo : '<p class="rb-prep-nada">' + esc(vacio || 'Nada registrado en el catálogo para esta copa. Consulta el reglamento.') + '</p>') + '</div>';
  }
  function pills(xs){ return '<div class="rb-prep-pills">' + xs.join('') + '</div>'; }
  function pill(t, sub){ return '<span class="rb-prep-pill">' + esc(t) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>'; }
  function filaItem(t, sub){ return '<li><b>' + esc(t) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</li>'; }

  function pintaMaterial(k){
    var f = function(t){ return cat[t].filter(function(x){ return tiene(x,k); }); };
    var motores = f('motores'), neum = f('neumaticos'), llantas = f('llantas'), eng = f('engranajes'), banc = f('bancadas');
    var html = '<div class="rb-prep-grid">';

    html += seccion('Motor', motores.length, '<ul class="rb-prep-list">' + motores.map(function(m){
      var d = [m.ref, m.rpm ? num(m.rpm) + ' rpm' : '', m.iman ? 'imán ' + num(m.iman) : ''].filter(Boolean).join(' · ');
      return filaItem(m.n, d);
    }).join('') + '</ul>');

    html += seccion('Neumáticos', neum.length, '<ul class="rb-prep-list">' + neum.map(function(n){ return filaItem(n.n, n.ref); }).join('') + '</ul>');

    var porTipo = function(xs, campo, valor){ return xs.filter(function(x){ return sinTildes(x[campo]).indexOf(valor) === 0; }); };
    var llantaPill = function(l){
      var m = l.n.match(/\s(PL|3D|AL|MG)$/i);
      return m ? pill(l.n.slice(0, m.index), MATERIAL_LLANTA[m[1].toUpperCase()]) : pill(l.n);
    };
    var del = porTipo(llantas,'tipo','DEL'), tras = porTipo(llantas,'tipo','TRAS');
    var otrasLl = llantas.filter(function(l){ return del.indexOf(l) < 0 && tras.indexOf(l) < 0; });
    html += seccion('Llantas', llantas.length,
      (del.length ? '<h4>Delanteras</h4>' + pills(del.map(llantaPill)) : '') +
      (tras.length ? '<h4>Traseras</h4>' + pills(tras.map(llantaPill)) : '') +
      (otrasLl.length ? '<h4>Otras</h4>' + pills(otrasLl.map(llantaPill)) : ''));

    var ord = function(a, b){ return (a.dientes - b.dientes) || ((a.diametro||0) - (b.diametro||0)); };
    var engPill = function(e){ return pill(e.dientes + ' z', e.diametro != null ? 'Ø ' + num(e.diametro) : ''); };
    var pin = porTipo(eng,'tipo','PI').sort(ord), cor = porTipo(eng,'tipo','COR').sort(ord);
    var otrosEng = eng.filter(function(e){ return pin.indexOf(e) < 0 && cor.indexOf(e) < 0; });
    html += seccion('Engranajes', eng.length,
      (pin.length ? '<h4>Piñones</h4>' + pills(pin.map(engPill)) : '') +
      (cor.length ? '<h4>Coronas</h4>' + pills(cor.map(engPill)) : '') +
      (otrosEng.length ? '<h4>Otros</h4>' + pills(otrosEng.map(engPill)) : ''));

    html += seccion('Bancadas', banc.length, '<ul class="rb-prep-list">' + banc.map(function(b){
      return filaItem(b.n, [b.ref, b.specs].filter(Boolean).join(' · '));
    }).join('') + '</ul>');

    return html + '</div>';
  }

  function fichaCoche(c){
    var foto = c.foto ? '<img class="foto" alt="" loading="lazy" src="https://lh3.googleusercontent.com/d/' + encodeURIComponent(c.foto) + '=w600" onerror="this.remove()">' : '';
    var ks = c.copas.map(clave);
    var datos = [];
    if(c.peso != null) datos.push('<div class="s"><b>' + num(c.peso) + ' g</b><span>peso mínimo</span></div>');
    if(c.creditos != null) datos.push('<div class="s"><b>' + (c.creditos > 0 ? '+' : '') + num(c.creditos) + '</b><span>créditos</span></div>');
    return '<div class="rb-prep-coche">' + foto + '<div class="info">' +
      '<div class="lbl">' + esc(c.marca) + '</div><h2>' + esc(c.n) + '</h2>' +
      (datos.length ? '<div class="rb-stats">' + datos.join('') + '</div>' : '') +
      (ks.length > 1 ? '<div class="rb-prep-multi"><span>Homologado en varias copas. Material de:</span><div class="chips">' +
        ks.map(function(k){ var cp = campDe(k); return '<button type="button" class="rb-prep-copa' + (k===copaSel?' on':'') + '" data-copa-coche="' + esc(k) + '" style="--c:' + (cp?cp.color:'var(--muted)') + '">' + esc(nombreCopa(k)) + '</button>'; }).join('') +
        '</div></div>' : '') +
      '</div></div>';
  }

  function pintaResultado(){
    if(!copaSel && cocheSel == null){
      resEl.innerHTML = '<div class="rb-prep-hint">Busca tu coche o toca una categoría para ver qué material puedes montar.</div>';
      return;
    }
    var camp = copaSel ? campDe(copaSel) : null;
    var color = camp ? camp.color : 'var(--red)';
    var html = '<div class="rb-prep-res" style="--c:' + color + '">';

    if(cocheSel != null) html += fichaCoche(cat.coches[cocheSel]);

    if(!copaSel){
      html += '<p class="rb-prep-nada">Este coche no tiene ninguna copa asignada en el catálogo, así que no sabemos qué material le corresponde. Pregunta a la organización.</p></div>';
      resEl.innerHTML = html;
      return;
    }

    html += '<div class="rb-prep-head"><div><div class="lbl">' + esc(camp ? camp.nombre : 'Copa') + '</div><h2>' + esc(nombreCopa(copaSel)) + '</h2></div>' +
      (camp ? '<a class="rb-cta go" href="' + camp.reglamento + '">Reglamento técnico →</a>' : '') + '</div>';

    html += pintaMaterial(copaSel);

    var coches = [];
    cat.coches.forEach(function(c, i){ if(tiene(c, copaSel)) coches.push(i); });
    coches.sort(function(a, b){ return cat.coches[a].n.localeCompare(cat.coches[b].n); });
    html += '<div class="rb-prep-sec rb-prep-coches"><h3>Coches homologados<span class="n">' + coches.length + '</span></h3>' +
      (coches.length ? '<div class="rb-prep-cochelist">' + coches.map(function(i){
        var c = cat.coches[i];
        return '<button type="button" data-coche="' + i + '"' + (i===cocheSel?' class="on"':'') + '><b>' + esc(c.n) + '</b><span>' + esc(c.marca) +
          (c.peso != null ? ' · ' + num(c.peso) + ' g' : '') + '</span></button>';
      }).join('') + '</div>' : '<p class="rb-prep-nada">No hay coches asignados a esta copa en el catálogo.</p>') + '</div>';

    html += '<p class="rb-prep-nota">Lista orientativa sacada del catálogo de verificaciones (actualizado el ' +
      esc(new Date(cat.generado + 'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' })) +
      '). Si hay dudas, manda el reglamento técnico de cada campeonato.</p></div>';
    resEl.innerHTML = html;
  }

  resEl.addEventListener('click', function(e){
    var b = e.target.closest('[data-coche]');
    if(b){ var i = +b.getAttribute('data-coche'); busca.value = cat.coches[i].n; elegir(copaSel, i, true); return; }
    var k = e.target.closest('[data-copa-coche]');
    if(k) elegir(k.getAttribute('data-copa-coche'), cocheSel, false);
  });

  // ---------- arranque ----------
  fetch('assets/data/catalogo.json').then(function(r){ return r.json(); }).then(function(data){
    cat = data;
    indexaNombres();
    var qs = new URLSearchParams(location.search);
    var qCoche = qs.get('coche'), qCopa = qs.get('copa'), qCamp = qs.get('camp');
    if(qCoche){
      var i = cat.coches.findIndex(function(c){ return sinTildes(c.n) === sinTildes(qCoche); });
      if(i >= 0){
        busca.value = cat.coches[i].n;
        var ks = cat.coches[i].copas.map(clave);
        var k = qCopa && ks.indexOf(clave(qCopa)) >= 0 ? clave(qCopa) : (ks.filter(campDe)[0] || ks[0] || null);
        elegir(k, i, false);
        return;
      }
    }
    if(qCopa){ elegir(clave(qCopa), null, false); return; }
    // ?camp=gt|gc|lms desde las tarjetas de campeonato: primera copa.
    var camp = CAMPEONATOS.filter(function(c){ return c.id === qCamp; })[0];
    if(camp){ elegir(clave(camp.copas[0]), null, false); return; }
    pintaCopas();
    pintaResultado();
  }).catch(function(){
    copasEl.innerHTML = '<div class="rb-empty">No se ha podido cargar el catálogo. Prueba a recargar la página.</div>';
  });
})();
