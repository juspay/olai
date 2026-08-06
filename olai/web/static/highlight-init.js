// Fenced code, painted. highlight.js (vendored beside this file, under hljs/)
// knows the languages and writes the spans; this only says WHICH elements and
// WHEN, and the colours are the skin's (olai/web/markdown).
//
// The language is a class the SERVER put on the <code> — language-<name>, out
// of the fence's info string and through the sanitizer — so nothing here reads
// anything a note's author wrote. A word that is not a language hljs has is a
// block left as plain text: highlighting is a look, and guessing at one is
// worse than not having it.
(function(){
  if(!window.hljs)return;

  // highlight.js has no Racket grammar and Scheme is close enough to read by.
  // The language file may not be there (a checkout that skipped `just
  // vendor`), and registering an alias for a language hljs does not have
  // throws.
  if(hljs.getLanguage('scheme'))
    hljs.registerAliases(['racket','rkt'],{languageName:'scheme'});

  var LANG=/(?:^| )language-([^ ]+)/;

  function paint(){
    document.querySelectorAll('pre > code[class*="language-"]').forEach(function(el){
      // hljs writes this itself, and highlighting twice is how a block ends
      // up with spans inside spans
      if(el.dataset.highlighted)return;
      var m=LANG.exec(el.className);
      if(!m||!hljs.getLanguage(m[1]))return;
      hljs.highlightElement(el);
    });
  }

  // afterSETTLE, for the same reason collapse.js says: a swap replaces the
  // element an event would name, and the settle phase is when the server's
  // markup is finally the DOM's. An outline reloaded under the page and a link
  // followed both arrive that way, and a morph restores the plain text this
  // puts the spans back over.
  document.addEventListener('htmx:afterSettle',paint);

  // The one thing that does not: a finished turn is HTML in a FRAME, drawn by
  // chat.js, and no swap happens at all — so it announces it, and this listens
  // for the announcement rather than being called by name. The day the panel
  // is a live surface too (docs/brainstorming/live-dsl.md), the line above
  // covers it and this one goes away with the announcement.
  document.addEventListener('olai:drawn',paint);

  paint();
})();
