// Client prefs: one value per pref, as a data attribute on <html>
// (data-theme, ...), persisted in this browser under olai.<pref>. Nothing goes
// to the server — same as the collapse state. The <head> boot script
// (olai/web/render) restores them before the first paint; from there the
// element IS the state. A row carries its name in data-pref, so a second pref
// is a second row and no change here.
(function(){
  var AUTO='auto',root=document.documentElement;
  function mark(){
    document.querySelectorAll('.ol-pref').forEach(function(row){
      var v=root.dataset[row.dataset.pref]||AUTO;
      row.querySelectorAll('.ol-pref-opt').forEach(function(b){
        var on=b.dataset.value===v;
        b.classList.toggle('is-on',on);
        b.setAttribute('aria-pressed',on?'true':'false');
      });
    });
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('.ol-pref-opt');if(!b)return;
    var row=b.closest('.ol-pref');if(!row)return;
    e.preventDefault();
    var p=row.dataset.pref,v=b.dataset.value;
    if(v===AUTO)delete root.dataset[p];else root.dataset[p]=v;
    try{v===AUTO?localStorage.removeItem('olai.'+p):localStorage.setItem('olai.'+p,v)}
    catch(e){}
    mark();
  });
  mark();
})();
