(function(){
  var rb = document.querySelector('.rb'); if(!rb) return;
  var btns = rb.querySelectorAll('.rb-filters button');
  var races = rb.querySelectorAll('.rb-race');
  btns.forEach(function(b){
    b.addEventListener('click', function(){
      btns.forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      var f = b.getAttribute('data-f');
      races.forEach(function(r){
        r.style.display = (f === 'all' || r.getAttribute('data-champ') === f) ? '' : 'none';
      });
    });
  });
})();
