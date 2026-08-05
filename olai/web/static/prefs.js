// Client prefs: one value per pref, as a data attribute on <html>
// (data-theme, ...), stored in this browser under the row's data-store-key —
// olai/web/prefs spells that key, here and in the boot script, so no .js
// builds one. Never sent to the server, same as the collapse state: the boot
// script restores it before the first paint, and the element IS the state.
// Nothing stored is the row's data-default — the theme the sheet draws bare.
(function(){
  // setAttribute, not dataset[name]: a hyphenated pref name is not a dataset
  // key, and the setter throws rather than working.
  var root=document.documentElement;function attr(p){return 'data-'+p}
  function store(row,v){var k=row.dataset.storeKey;
    try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}
  function mark(){
    document.querySelectorAll('.ol-pref').forEach(function(row){
      var p=row.dataset.pref,v=root.getAttribute(attr(p)),
          opts=row.querySelectorAll('.ol-pref-opt'),known=false;
      opts.forEach(function(b){if(b.dataset.value===v)known=true});
      // a value no chip offers (theme renamed, theme dropped): forget it
      if(v!==null&&!known){root.removeAttribute(attr(p));store(row,null);v=null}
      var on=v===null?row.dataset.default:v;
      opts.forEach(function(b){
        var lit=b.dataset.value===on;
        b.classList.toggle('is-on',lit);
        b.setAttribute('aria-pressed',lit?'true':'false');
      });
    });
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('.ol-pref-opt');if(!b)return;
    var row=b.closest('.ol-pref');if(!row)return;
    e.preventDefault();
    // a chip is a theme: picking one picks it, and there is nothing else to be
    var v=b.dataset.value;root.setAttribute(attr(row.dataset.pref),v);
    store(row,v);mark();
  });
  // an outerHTML swap replaces the rows: re-mark over the whole document
  document.addEventListener('htmx:afterSwap',function(){mark()});
  mark();
})();
