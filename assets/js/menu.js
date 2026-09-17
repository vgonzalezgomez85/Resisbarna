(function(){
  var burger = document.querySelector('.rb-burger');
  var panel = document.querySelector('.rb-menu');
  if(!burger || !panel) return;

  var nav = document.querySelector('.rb-top nav');
  if(nav && !panel.children.length){
    nav.querySelectorAll('a').forEach(function(a){
      panel.appendChild(a.cloneNode(true));
    });
  }

  function setOpen(open){
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  burger.addEventListener('click', function(){
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
  });

  panel.addEventListener('click', function(e){
    if(e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') setOpen(false);
  });
})();