(function(){
  var rb = document.querySelector('.rb'); if(!rb) return;
  var btns = rb.querySelectorAll('.rb-filters button');
  var races = rb.querySelectorAll('.rb-race');
  var hoyISO = new Date().toISOString().slice(0, 10);

  // Una carrera se considera pasada por su fecha en el enlace de
  // inscripción (?fecha=AAAA-MM-DD), salvo que esté marcada como
  // aplazada: esa fecha ya no vale y todavía está por disputarse.
  function esPasada(r){
    if(r.getAttribute('data-aplazada') === 'true') return false;
    var a = r.querySelector('a[href*="fecha="]');
    var m = a && a.getAttribute('href').match(/fecha=([\d-]+)/);
    return m ? m[1] < hoyISO : false;
  }

  var currentFilter = 'all';
  function aplicarFiltro(){
    races.forEach(function(r){
      var coincide = currentFilter === 'all' || r.getAttribute('data-champ') === currentFilter;
      r.style.display = (coincide && !esPasada(r)) ? '' : 'none';
    });
  }

  btns.forEach(function(b){
    b.addEventListener('click', function(){
      btns.forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      currentFilter = b.getAttribute('data-f');
      aplicarFiltro();
    });
  });

  aplicarFiltro();
})();
