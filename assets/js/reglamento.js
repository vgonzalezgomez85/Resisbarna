/* Motor del reglamento Resisbarna GT3. Datos inyectados por PHP (REGLAMENTO, NOTE_IMGS, LOGO_SLOT, LOGO_POLI). */

function norm(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function credClass(c){ return c < 0 ? 'neg' : c === 0 ? 'zero' : 'pos'; }
function credLabel(c){ return c > 0 ? '+'+c : ''+c; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---- Render de los distintos tipos de bloque ---- */
function renderBloque(b){
  switch(b.tipo){
    case 'texto':
      return `<p>${b.html}</p>`;
    case 'reglas':
      return `<ul class="rules">${b.items.map(it=>{
        const cls = it.estado==='si' ? ' class="yes"' : it.estado==='no' ? ' class="no"' : '';
        return `<li${cls}>${it.txt}</li>`;
      }).join('')}</ul>`;
    case 'specs':
      return `<div class="specs">${b.items.map(s=>
        `<div class="spec"><div class="k">${esc(s.k)}</div><div class="v">${esc(s.v)}${s.small?` <small>${esc(s.small)}</small>`:''}</div></div>`
      ).join('')}</div>`;
    case 'aviso':
      return `<div class="callout ${b.estilo}"><span class="tag">${esc(b.etiqueta)}</span><div>${b.html}</div></div>`;
    case 'tabla':
      return `<table class="ref"><thead><tr>${b.cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${
        b.filas.map(f=>`<tr>${f.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')
      }</tbody></table>`;
    case 'versiones':
      return `<div class="changelog">${b.items.map(v=>`<div class="ver"><span class="vtag">${esc(v.v)}</span><p>${esc(v.txt)}</p></div>`).join('')}</div>`;
    case 'MODELOS': {
      var conCred = !REGLAMENTO.meta || REGLAMENTO.meta.creditos !== false;
      // marcas reales presentes en los modelos
      var marcas = [];
      (REGLAMENTO.modelos||[]).forEach(function(m){ var mk=(m.marca||'').replace('/BA',''); if(mk && marcas.indexOf(mk)===-1) marcas.push(mk); });
      var chips = '<button class="chip active" data-marca="all">Todas</button>' +
        marcas.map(function(mk){ return '<button class="chip" data-marca="'+esc(mk)+'">'+esc(mk)+'</button>'; }).join('');
      var controls = marcas.length > 1
        ? '<div class="homo-controls"><span class="lbl">Marca</span>'+chips+'</div>' : '';
      var thCred = conCred ? '<th data-sort="cred" data-type="num">Créditos<span class="arrow">↕</span></th>' : '';
      var legend = '<div class="legend">' +
        (conCred ? '<span><i style="background:var(--neg)"></i>Créditos negativos</span><span><i style="background:var(--zero)"></i>Neutro (0)</span><span><i style="background:var(--pos)"></i>Créditos positivos</span>' : '') +
        '<span><i style="background:rgba(237,27,47,.6)"></i>Tiene nota de preparación específica</span></div>';
      return controls +
        '<div style="overflow-x:auto;border:1px solid var(--line-soft);border-radius:10px">' +
        '<table class="homo' + (conCred?'':' no-cred') + '" id="homoTable" data-cred="'+(conCred?'1':'0')+'"><thead><tr>' +
        thCred +
        '<th data-sort="model" data-type="txt">Modelo<span class="arrow">↕</span></th>' +
        '<th data-sort="marca" data-type="txt">Marca<span class="arrow">↕</span></th>' +
        '<th class="col-peso" data-sort="peso" data-type="num">Peso mín.<span class="arrow">↕</span></th>' +
        '</tr></thead><tbody id="homoBody"></tbody></table></div>' + legend;
    }
    case 'NOTAS':
      return '<div class="notes-grid" id="notesGrid"></div>';
    default:
      return '';
  }
}

/* ---- Render de una sección entera ---- */
function renderSeccion(sec){
  const cuerpo = sec.bloques.map(renderBloque).join('');
  // texto para el buscador (título + todo el contenido en texto plano)
  const plano = sec.titulo + ' ' + sec.bloques.map(b=>{
    if(b.html) return b.html;
    if(b.items) return JSON.stringify(b.items);
    if(b.filas) return JSON.stringify(b.filas);
    return '';
  }).join(' ').replace(/<[^>]+>/g,' ');
  return `<section class="block" id="${sec.id}" data-title="${esc(plano)}">
    <div class="head"><span class="num">${esc(sec.numero)}</span><h2>${esc(sec.titulo)}</h2></div>
    <div class="body">${cuerpo}</div>
  </section>`;
}

/* ---- Construir la página completa ---- */
function buildPage(){
  const m = REGLAMENTO.meta;
  const hero = `
  <header class="hero">
    <div class="shell">
      <span class="badge-cat">● ${esc(m.etiqueta)}</span>
      <h1>${esc(m.marca)} <span class="gt">${esc(m.modelo)}</span></h1>
      <div class="sub">${esc(m.subtitulo)}</div>
      <div class="meta">
        ${m.datos.map(d=>`<span>${esc(d.campo)} <b>${esc(d.valor)}</b></span>`).join('')}
      </div>
      <div class="sponsors">
        <span class="logo"><img src="${LOGO_SLOT}" alt="Slot.it"></span>
        <span class="logo"><img src="${LOGO_POLI}" alt="Policar"></span>
      </div>
      <div class="searchbar">
        <span class="ico">⌕</span>
        <input type="text" id="search" placeholder="Buscar en el reglamento… (p.ej. «llantas», «piñón», «Mercedes», «+8»)" autocomplete="off">
        <button class="clr" id="clearSearch" aria-label="Limpiar">✕</button>
      </div>
      <div class="search-status" id="searchStatus"></div>
    </div>
  </header>`;

  const nav = `
    <nav class="toc" id="toc">
      <div class="toc-title">Índice</div>
      <div class="toc-scroll">
        ${REGLAMENTO.secciones.map(s=>`<a href="#${s.id}"><span class="n">${esc(s.numero)}</span>${esc(s.nav||s.titulo)}</a>`).join('')}
      </div>
    </nav>`;

  const main = `<main id="main">
      ${REGLAMENTO.secciones.map(renderSeccion).join('')}
      <div class="no-results" id="noResults">
        <div class="big">Sin resultados</div>
        <p>No se encontró nada para tu búsqueda. Prueba con otra palabra.</p>
      </div>
    </main>`;

  const footer = `
  <footer>
    <div>${esc(m.marca)} ${esc(m.modelo)} · Temporada 2026 · <b>${esc(m.datos[0]?m.datos[0].valor:'')}</b> · <b>resisbarna.es</b></div>
    <div class="footer-spons">
      <img src="${LOGO_SLOT}" alt="Slot.it">
      <img src="${LOGO_POLI}" alt="Policar">
    </div>
  </footer>`;

  document.getElementById('app').innerHTML =
    hero + `<div class="shell"><div class="layout">` + nav + main + `</div></div>` + footer;
}

/* ---- Tabla de modelos: filtro, orden, render ---- */
let currentMarca='all', sortKey=null, sortDir=1;
function renderTable(){
  const body=document.getElementById('homoBody'); if(!body) return;
  const conCred = !REGLAMENTO.meta || REGLAMENTO.meta.creditos !== false;
  let rows=REGLAMENTO.modelos.slice();
  if(currentMarca!=='all') rows=rows.filter(x=>x.marca===currentMarca || x.marca===currentMarca+'/BA');
  if(sortKey) rows.sort((a,b)=>{ let av=a[sortKey],bv=b[sortKey]; return (typeof av==='string'?av.localeCompare(bv):av-bv)*sortDir; });
  body.innerHTML = rows.map(x=>`
    <tr data-search="${esc((x.model+' '+x.marca+' '+credLabel(x.cred)+' '+x.peso).toLowerCase())}">
      ${conCred?`<td><span class="cred ${credClass(x.cred)}">${credLabel(x.cred)}</span></td>`:''}
      <td class="model">${esc(x.model)}${x.note?`<a class="has-note" href="#nota-${x.note}" title="Ver nota de preparación">i</a>`:''}</td>
      <td class="marca">${esc(x.marca)}</td>
      <td class="peso col-peso">${(typeof x.peso==='number'?x.peso:parseFloat(x.peso)||0).toFixed(1).replace('.',',')} g</td>
    </tr>`).join('');
  if(typeof applySearch==='function') applySearch();
}

/* ---- Notas por modelo (con sus fotos) ---- */
function renderNotas(){
  const grid=document.getElementById('notesGrid'); if(!grid) return;
  grid.innerHTML = REGLAMENTO.notas.map(nt=>{
    const pics = NOTE_IMGS[nt.n] || [];
    const imgHtml = pics.length
      ? `<div class="note-imgs">${pics.map(src=>`<figure><img src="${src}" alt="${esc(nt.title)} (${esc(nt.mk)})" loading="lazy"></figure>`).join('')}</div>` : '';
    const hint = pics.length >= 2
      ? `<div class="hint"><span class="dot"></span>Lo marcado en color se puede eliminar o modificar</div>` : '';
    return `
    <div class="note" id="nota-${nt.n}" data-search="${esc((nt.title+' '+nt.mk+' '+nt.text).toLowerCase())}">
      <h4><span class="nn">#${nt.n}</span> ${esc(nt.title)} <span class="mk">${esc(nt.mk)}</span></h4>
      <p>${esc(nt.text)}</p>
      ${hint}
      ${imgHtml}
      ${nt.manual?`<div class="manual"><a href="${nt.manual}" target="_blank" rel="noopener">📄 Manual oficial de montaje ↗</a></div>`:''}
    </div>`;
  }).join('');
}

/* ---- Buscador (insensible a mayúsculas y tildes) ---- */
let sections, search, clearBtn, status, noResults;
function clearMarks(el){ el.querySelectorAll('mark').forEach(m=>m.replaceWith(document.createTextNode(m.textContent))); el.normalize(); }
function highlight(el, rawTerm){
  try{
    const q=norm(rawTerm); if(!q) return;
    const walker=document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode:(n)=> n.parentNode.closest('script,style,mark,a.has-note') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes=[]; let n; while(n=walker.nextNode()) nodes.push(n);
    nodes.forEach(node=>{
      const original=node.nodeValue; let normStr=''; const map=[];
      for(let i=0;i<original.length;i++){ const nc=norm(original[i]); for(let j=0;j<nc.length;j++){ normStr+=nc[j]; map.push(i); } }
      const ranges=[]; let from=0, idx;
      while((idx=normStr.indexOf(q,from))!==-1){ ranges.push([map[idx], map[idx+q.length-1]+1]); from=idx+q.length; }
      if(!ranges.length) return;
      const frag=document.createDocumentFragment(); let pos=0;
      ranges.forEach(([s,e])=>{ if(s>pos) frag.appendChild(document.createTextNode(original.slice(pos,s))); const mk=document.createElement('mark'); mk.textContent=original.slice(s,e); frag.appendChild(mk); pos=e; });
      if(pos<original.length) frag.appendChild(document.createTextNode(original.slice(pos)));
      node.replaceWith(frag);
    });
  }catch(e){}
}
function applySearch(){
  const raw=search.value.trim(); const q=norm(raw);
  clearBtn.style.display = raw ? 'flex' : 'none';
  sections.forEach(clearMarks);
  if(!q){
    sections.forEach(s=>s.classList.remove('hidden'));
    document.querySelectorAll('#homoBody tr, .note').forEach(r=>r.classList.remove('hidden'));
    status.textContent=''; noResults.classList.remove('show'); return;
  }
  let visibleSections=0;
  sections.forEach(sec=>{
    let match = norm(sec.dataset.title).includes(q) || norm(sec.textContent).includes(q);
    const rows=sec.querySelectorAll('#homoBody tr');
    const notes=sec.querySelectorAll('.note');
    if(rows.length){
      let any=false;
      rows.forEach(r=>{ const hit=norm(r.dataset.search).includes(q); r.classList.toggle('hidden',!hit); if(hit) any=true; });
      match = any || norm(sec.querySelector('.body').textContent).includes(q);
    }
    if(notes.length){
      let any=false;
      notes.forEach(nt=>{ const hit=norm(nt.dataset.search).includes(q); nt.classList.toggle('hidden',!hit); if(hit) any=true; });
      match = any || norm(sec.dataset.title).includes(q);
    }
    sec.classList.toggle('hidden', !match);
    if(match){ visibleSections++; highlight(sec, raw); }
  });
  noResults.classList.toggle('show', visibleSections===0);
  status.innerHTML = visibleSections ? `Mostrando <b>${visibleSections}</b> sección${visibleSections>1?'es':''} con «${esc(raw)}»` : '';
}

/* ---- Arrancar todo ---- */
function init(){
  buildPage();

  sections = Array.from(document.querySelectorAll('section.block'));
  search = document.getElementById('search');
  clearBtn = document.getElementById('clearSearch');
  status = document.getElementById('searchStatus');
  noResults = document.getElementById('noResults');

  renderTable();
  renderNotas();

  // filtros de marca
  document.querySelectorAll('.chip').forEach(ch=>ch.addEventListener('click',()=>{
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    ch.classList.add('active'); currentMarca=ch.dataset.marca; renderTable();
  }));
  // ordenar tabla
  document.querySelectorAll('#homoTable thead th').forEach(th=>th.addEventListener('click',()=>{
    const key=th.dataset.sort;
    if(sortKey===key) sortDir*=-1; else { sortKey=key; sortDir=1; }
    document.querySelectorAll('#homoTable thead th').forEach(h=>h.classList.remove('sorted'));
    th.classList.add('sorted'); th.querySelector('.arrow').textContent = sortDir>0?'↑':'↓';
    renderTable();
  }));
  // buscador
  search.addEventListener('input', applySearch);
  search.addEventListener('keyup', applySearch);
  clearBtn.addEventListener('click', ()=>{ search.value=''; applySearch(); search.focus(); });
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){ e.preventDefault(); search.focus(); }
    if(e.key==='Escape' && document.activeElement===search){ search.value=''; applySearch(); }
  });

  // lightbox (ampliar fotos)
  const lb=document.getElementById('lightbox'), lbImg=document.getElementById('lbImg'), lbCap=document.getElementById('lbCap');
  document.getElementById('notesGrid').addEventListener('click',e=>{
    const img=e.target.closest('.note-imgs img'); if(!img) return;
    lbImg.src=img.src; lbCap.textContent=img.alt; lb.classList.add('show');
  });
  function closeLb(){ lb.classList.remove('show'); lbImg.src=''; }
  lb.addEventListener('click', closeLb);
  document.getElementById('lbClose').addEventListener('click', closeLb);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && lb.classList.contains('show')) closeLb(); });

  // índice activo al hacer scroll
  if('IntersectionObserver' in window){
    const tocLinks=Array.from(document.querySelectorAll('nav.toc a'));
    const spy=new IntersectionObserver(entries=>{
      entries.forEach(en=>{ if(en.isIntersecting){ const id=en.target.id; tocLinks.forEach(l=>l.classList.toggle('active', l.getAttribute('href')==='#'+id)); } });
    },{rootMargin:'-20% 0px -70% 0px'});
    sections.forEach(s=>spy.observe(s));
  }

  // botón volver arriba
  const totop=document.getElementById('totop');
  window.addEventListener('scroll',()=>{ totop.classList.toggle('show', window.scrollY>500); });
  totop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}

/* ╔══════════════════════════════════════════════════════════════════╗
   ║   🖼️  RECURSOS (fotos y logos)  —  NO EDITAR ESTA PARTE           ║
   ║   Son las imágenes codificadas. Es texto muy largo y normal.       ║
   ╚══════════════════════════════════════════════════════════════════╝ */

/* Arrancar cuando el documento esté listo */
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
