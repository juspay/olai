// The search palette: opening it, closing it, and moving through what it
// found. Nothing here fetches anything — the input carries the fetch (the
// live-query attributes olai/web/search draws), and every hit is an ordinary
// link into the outline's region. What is left is the keyboard.
//
// Three gestures and no fourth: `/` opens the box wherever you are, ↑/↓ walk
// the hits, Escape puts it away. The picked hit is simply the FOCUSED one —
// there is no second notion of a selection to keep in step with the browser's,
// so Enter is the browser activating a link and needs no code at all, except
// in the box itself, where it means the first hit.
//
// Closed is the `hidden` attribute rather than a class of ours: the server
// draws it (a page that is not a query comes up closed, and /search?q=… comes
// up open), a browser with no scripts still obeys it, and there is one word
// for the state instead of two.
(function(){
  // Deferred, so the document is parsed — and the palette is drawn outside
  // every live region, so these three outlive every swap the page will make.
  // Only what is INSIDE the results region is ever replaced, which is why the
  // hits below are looked up per keystroke and these are not.
  var panel=document.querySelector('[data-search-panel]');
  if(!panel)return;
  var input=panel.querySelector('.ol-search-input');

  function open(o){
    panel.hidden=!o;
    if(o){input.focus();input.select();}
  }

  function isOpen(){return !panel.hidden}

  // The hits as they are right now: the list is a live region and re-fetches
  // itself as you type, so a cached NodeList would be a list of elements the
  // last swap threw away.
  function hits(){
    return Array.prototype.slice.call(panel.querySelectorAll('[data-search-hit]'));
  }

  // Down from the box lands on the first hit; past either end goes back to the
  // box, which is where you were going to type anyway.
  function move(delta){
    var list=hits();
    if(!list.length){input.focus();return}
    var i=list.indexOf(document.activeElement);
    var next=i<0?(delta>0?0:list.length-1):i+delta;
    if(next<0||next>=list.length){input.focus();return}
    list[next].focus();
  }

  // ---- the page's own keys -------------------------------------------------

  // `/` is the classic, and it is only ours when nobody is typing: the chat
  // panel's input takes a slash for its commands, and so does anything else
  // with a cursor in it.
  function typing(el){
    if(!el)return false;
    if(el.isContentEditable)return true;
    var tag=el.tagName;
    return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
  }

  function plain(e){return !e.ctrlKey&&!e.metaKey&&!e.altKey}

  document.addEventListener('keydown',function(e){
    if(e.key==='/'&&plain(e)&&!typing(e.target)){
      e.preventDefault();
      open(true);
      return;
    }
    if(!isOpen())return;
    // Escape closes from anywhere: the palette is over the page, and a way out
    // that only works while the box has the focus is a trap once you have
    // arrowed into the list.
    if(e.key==='Escape'){
      e.preventDefault();
      open(false);
      return;
    }
    if(!panel.contains(e.target))return;
    if(e.key==='ArrowDown'){e.preventDefault();move(1);return}
    if(e.key==='ArrowUp'){e.preventDefault();move(-1);return}
    // Enter in the box means the first hit — the one you were looking at while
    // you typed. On a hit it is the browser following a link, which is not
    // ours to do. With nothing found there is nothing to go to, and a form
    // submit would reload the page to say so.
    if(e.key==='Enter'&&e.target===input){
      e.preventDefault();
      var list=hits();
      if(list.length)list[0].click();
    }
  });

  // ---- the mouse -----------------------------------------------------------

  document.addEventListener('click',function(e){
    if(e.target.closest('[data-search-toggle]')){
      e.preventDefault();
      open(!isOpen());
      return;
    }
    if(!isOpen())return;
    // Landing on a hit is a navigation: the outline behind the palette is what
    // you asked to see, so the palette gets out of the way.
    if(e.target.closest('[data-search-hit]')){open(false);return}
    if(!panel.contains(e.target))open(false);
  });
})();
