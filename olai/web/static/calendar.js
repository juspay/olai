// WHERE YOU ARE, in the sidebar's month.
//
// The server marks the day on the page it renders (web/calendar), and that is
// the whole story for a browser running no JS and for the first paint. It is
// not the story after a CLICK: a link swaps the outline region and nothing
// else — the chrome is never rebuilt, which is the point of the live view — so
// the sidebar keeps the mark from the page you came FROM.
//
// What is current after a swap is the region itself, because the swap is what
// replaced it. So the page carries the answer on it (data-current-key, from
// web/page) and this copies it onto the day whose key matches. No address is
// parsed and no route is spelled here: the key is the server's, on both ends.
(function(){
  function apply(){
    var region=document.getElementById('ol-live');
    var current=region?region.getAttribute('data-current-key'):'';
    document.querySelectorAll('#ol-sidebar [data-day-key]').forEach(function(c){
      var here=!!current&&c.dataset.dayKey===current;
      c.classList.toggle('is-current',here);
      if(here)c.setAttribute('aria-current','page');
      else c.removeAttribute('aria-current');
    });
  }
  // afterSETTLE, like collapse.js: the swap has landed and the region's new
  // attribute is the one this reads. Whole document, not e.target — an
  // outerHTML swap replaces the element the event would name.
  document.addEventListener('htmx:afterSettle',apply);
  apply();
})();
