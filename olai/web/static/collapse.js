// Collapse state: a class on .sf-node (both panes), persisted per
// data-collapse-key. Unvisited keys keep whatever the server rendered, so
// render-time defaults survive. htmx swaps re-apply through the same pass.
(function(){
  var KEY='olai.collapsed',state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){state={}}
  function set(n,c){
    n.classList.toggle('is-collapsed',c);
    var t=n.querySelector(':scope > .sf-row > .sf-toggle');
    if(t)t.setAttribute('aria-expanded',c?'false':'true');
  }
  function apply(root){
    (root||document).querySelectorAll('[data-collapse-key]').forEach(function(n){
      var v=state[n.dataset.collapseKey];
      set(n,v===undefined?n.classList.contains('is-collapsed'):v);
    });
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('.sf-toggle');if(!t)return;
    var n=t.closest('[data-collapse-key]');if(!n)return;
    e.preventDefault();
    var c=!n.classList.contains('is-collapsed');
    state[n.dataset.collapseKey]=c;
    set(n,c);
    localStorage.setItem(KEY,JSON.stringify(state));
  });
  // An outerHTML swap replaces the element the event would name, so re-apply
  // over the whole document rather than over e.target: a live re-render must
  // not silently unfold what you folded.
  document.addEventListener('htmx:afterSwap',function(){apply()});
  apply();
})();
