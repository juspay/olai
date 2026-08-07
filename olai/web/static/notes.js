// A note is one line until you click it, and the note itself is what you
// click: anywhere on the folded line opens it, anywhere on the open note folds
// it again. The open ones are remembered per data-note-key, like the fold in
// collapse.js; unvisited keys stay the way the server drew them, which is
// folded.
//
// The script owns the two things CSS cannot answer. WHETHER a note has more in
// it than its line is showing is a measurement — it moves with the window —
// and it is what puts .has-more on the block, so a note that fits is not a
// control at all. WHICH notes you opened is a fact about you, not about the
// outline, so it is .is-expanded and localStorage and nothing on the wire.
//
// Two clicks are not a toggle, and both of them are somebody reading:
//
//   * one that lands on a LINK follows the link. A note is prose, and prose
//     has links in it.
//   * one that ends a text SELECTION leaves the note where it is — dragging
//     across an open note to copy out of it must not fold the thing you are
//     copying. A drag that moved the pointer, and a selection that starts
//     inside this note, are both that.
//
// (A double click still folds on its first click, then selects its word in the
// folded line. Telling the two apart would cost a timer on every open.)
(function(){
  var KEY='olai.notes',state={},down=null,pending=false;
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){state={}}
  function set(n,open){
    n.classList.toggle('is-expanded',open);
    var b=n.querySelector('.ol-note-more');
    if(b)b.setAttribute('aria-expanded',open?'true':'false');
  }
  // THE QUESTION IS WHAT THE FOLD HIDES, and the only honest way to ask it is
  // to try: every note is folded and measured, then opened and measured, then
  // put back the way it was. The difference between the two heights is the
  // answer, and it does not care how the fold is spelled or what the browser
  // does with the lines it does not draw.
  //
  // It used to ask `scrollHeight > clientHeight` — does the content overflow
  // the box — which is a question about a browser's internals, and browsers
  // have stopped agreeing on it: a line clamp in Chrome 151 DISCARDS the lines
  // past the first, so nothing overflows anything and every note on the page
  // looked like a note with nothing to show. Two heights and a subtraction
  // cannot go stale that way.
  //
  // Four passes and not one loop: a write between two reads is a layout per
  // note, where this is two for the page. Nothing paints in between — the
  // whole thing is one turn of the event loop, and every note ends it wearing
  // what it started with.
  //
  // A note with NO BOX measures nothing, and nothing is not an answer. That is
  // a note inside a folded node — most of a real outline, most of the time —
  // and reading it as "there is nothing to open" is how a whole page of notes
  // stops opening. What was known about one stands until it can be measured
  // again, which is what the observer below is for.
  function apply(){
    var blocks=[].slice.call(document.querySelectorAll('[data-note-key]'));
    function heights(){
      return blocks.map(function(n){
        var t=n.querySelector('.ol-note');
        return t?t.clientHeight:0;
      });
    }
    blocks.forEach(function(n){
      n.classList.remove('is-expanded');
      var t=n.querySelector('.ol-note');
      if(t&&watch)watch.observe(t);
    });
    var folded=heights();
    blocks.forEach(function(n){n.classList.add('is-expanded')});
    var open=heights();
    blocks.forEach(function(n,i){
      if(open[i]>0)n.classList.toggle('has-more',open[i]>folded[i]+1);
      set(n,n.classList.contains('has-more')&&state[n.dataset.noteKey]===true);
    });
  }
  function schedule(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(function(){pending=false;apply()});
  }
  // Everything that can change the answer is the note's box changing: the
  // window narrowing, a fold above it opening, a picture arriving inside it, a
  // font landing. One thing to watch rather than four things to hear about —
  // and the only one of them that says a note nobody could measure is on the
  // screen now.
  var watch=window.ResizeObserver?new ResizeObserver(schedule):null;
  if(!watch)addEventListener('resize',schedule);
  // Where the press started, so the release can tell a click from a drag. A
  // keyboard's click has no press and no coordinates (detail 0), and is never
  // asked.
  document.addEventListener('mousedown',function(e){down={x:e.clientX,y:e.clientY}});
  function dragged(e){
    return !!down&&Math.abs(e.clientX-down.x)+Math.abs(e.clientY-down.y)>4;
  }
  function selecting(n){
    var s=window.getSelection();
    return !!s&&!s.isCollapsed&&!!s.toString()&&n.contains(s.anchorNode);
  }
  document.addEventListener('click',function(e){
    var n=e.target.closest('[data-note-key]');if(!n)return;
    if(!n.classList.contains('has-more'))return;
    if(e.target.closest('a'))return;
    // the second click of a double is not a second decision
    if(e.detail>1)return;
    if(e.detail>0&&(dragged(e)||selecting(n)))return;
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
  apply();
})();
