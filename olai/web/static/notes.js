// A note is one line until you open it: the "…" beside it toggles, and the
// open ones are remembered per data-note-key, like the fold in collapse.js.
// Unvisited keys stay the way the server drew them, which is folded.
//
// The script owns the two things CSS cannot answer. WHETHER a note has more in
// it than its line is showing is a measurement — it moves with the window —
// and it is what puts .has-more on the block, so a note that fits carries no
// button at all. WHICH notes you opened is a fact about you, not about the
// outline, so it is .is-expanded and localStorage and nothing on the wire.
(function(){
  var KEY='olai.notes',state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){state={}}
  function set(n,open){
    n.classList.toggle('is-expanded',open);
    var b=n.querySelector('.ol-note-more');
    if(b)b.setAttribute('aria-expanded',open?'true':'false');
  }
  // Folded is the only state a measurement means anything in — an open note is
  // as tall as its own contents, and overflows nothing — so every note is
  // folded, then measured, then put back the way it was. Three passes and not
  // one loop: a write between two reads is a layout per note.
  function apply(){
    var blocks=[].slice.call(document.querySelectorAll('[data-note-key]'));
    blocks.forEach(function(n){n.classList.remove('is-expanded')});
    var more=blocks.map(function(n){
      var t=n.querySelector('.ol-note');
      return !!t&&t.scrollHeight>t.clientHeight+1;
    });
    blocks.forEach(function(n,i){
      n.classList.toggle('has-more',more[i]);
      set(n,more[i]&&state[n.dataset.noteKey]===true);
    });
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('.ol-note-more');if(!b)return;
    var n=b.closest('[data-note-key]');if(!n)return;
    e.preventDefault();
    var open=!n.classList.contains('is-expanded');
    state[n.dataset.noteKey]=open;
    set(n,open);
    // same guard as the read above: storage can be full or forbidden, and a
    // note that threw would be open with nothing remembering it
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
  });
  // afterSETTLE, not afterSwap: the class attribute the server sent lands in
  // the settle phase, and this pass is what goes back on top of it. Whole
  // document, not e.target — an outerHTML swap replaces the element the event
  // would name.
  document.addEventListener('htmx:afterSettle',apply);
  // A narrower window wraps a note that fitted before, so what has more in it
  // is asked again whenever the layout is. Once per frame: a drag fires this
  // by the dozen.
  var pending=false;
  addEventListener('resize',function(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(function(){pending=false;apply()});
  });
  apply();
})();
