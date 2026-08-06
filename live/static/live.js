// The live-view runtime: history policy, the health of the stream, and the one
// way to listen to it.
//
// Everything ELSE this framework does is attributes (live/client.rkt) and the
// two vendored extensions beside this file. What is left over is what an
// attribute cannot say:
//
//   * a page has ONE stream and every event name rides it, but the SSE
//     extension only knows how to SWAP a payload into an element. An event
//     whose payload is not markup — a JSON frame a script draws itself — had
//     no way in but to declare a swap and then cancel it. `live.on(name, fn)`
//     is that way in: the connection is still htmx's, and this is the only
//     thing holding the EventSource.
//
//   * Back and Forward must show the CURRENT state, not a snapshot. htmx caches
//     the history element's markup and restores it verbatim, which is right for
//     a static page and wrong for one whose whole point is that the server
//     changes under it. Cache size zero makes a restore a fetch — of the same
//     region, into the same place, so the chrome around it still survives.
//   * a stream can stop without saying so. `sseOpen` / `sseError` catch the
//     clean drops; a socket that stays open while nothing comes down it looks
//     identical to a quiet afternoon, and only a beat that failed to arrive
//     tells them apart. The server sends one on a cadence it names in the
//     payload, so the window below is the STREAM's number, not a copy of it.
//
// What this writes: one class on <html>, or none. Nothing here paints — the
// host app styles these names (live/client.rkt exports them), because a
// framework that shipped a look would be a look you have to undo.
(function(){
  var CONNECTING='live-connecting',STALE='live-stale';

  // The heartbeat's event name, live/hub.rkt's `heartbeat-event`. The other
  // end spells it in Racket; live/tests/client.rkt is what keeps the two
  // strings the same one.
  var BEAT='live:hb';

  // Until the first beat says otherwise. The server writes one as it opens the
  // stream, so this is only ever the window for a connection that opened and
  // then said nothing at all.
  var DEFAULT_CADENCE=15;

  // How late a beat may be before a connection that still LOOKS open is a lie.
  // Two missed beats plus slack for a phone's throttled timers and a loaded
  // server: early enough to be useful, late enough that nobody sees it on a
  // healthy link.
  var GRACE=2.5,SLACK=2000;

  // And how long a connection we KNOW is down may stay "reconnecting" before
  // it is just down. Short, because there is nothing to wait for a beat from:
  // the socket already said it was gone, and every second after this one is a
  // second of reading a page that may have moved on.
  var DROP_MS=5000;

  var root=document.documentElement;
  var cadence=DEFAULT_CADENCE,lastBeat=0,timer=null,watched=null;

  // name -> [handler]. Kept here rather than on the EventSource because the
  // source is replaced on a reconnect and a subscriber must not have to know.
  var handlers={};

  function windowMs(){return cadence*GRACE*1000+SLACK}

  function setState(s){
    root.classList.toggle(CONNECTING,s==='connecting');
    root.classList.toggle(STALE,s==='stale');
  }

  function armIn(ms){
    if(timer)clearTimeout(timer);
    timer=setTimeout(function(){setState('stale')},ms);
  }

  // Live is the quiet state: no class at all, so a page whose runtime never
  // booted is not permanently mid-reconnect.
  function alive(){
    lastBeat=Date.now();
    setState('live');
    armIn(windowMs());
  }

  // ---- the stream --------------------------------------------------------
  //
  // The connection is htmx's (the sse extension owns creating it and bringing
  // it back); this only listens. `sseOpen` hands over the EventSource, which is
  // the only way to hear an event nothing on the page swaps on.

  // Everything this page wants to hear, attached to whichever source is
  // current. A reconnect makes a new EventSource; the subscriber list is ours,
  // so it survives that and nothing re-registers.
  function attach(source){
    source.addEventListener(BEAT,function(ev){
      var n=parseFloat(ev.data);
      if(n>0)cadence=n;
      alive();
    });
    Object.keys(handlers).forEach(function(name){
      source.addEventListener(name,function(ev){
        handlers[name].forEach(function(fn){fn(ev.data,ev)});
      });
    });
  }

  document.body.addEventListener('htmx:sseOpen',function(e){
    var source=e.detail&&e.detail.source;
    if(source&&source!==watched){
      watched=source;
      attach(source);
    }
    alive();
  });

  // Subscribe to one event name on the page's stream. `fn` is handed the
  // frame's data as a string — what it MEANS is the caller's, exactly as it is
  // on the server. Register before the stream opens (a deferred script does);
  // a name registered later is picked up on the next reconnect.
  window.live={
    on:function(name,fn){
      (handlers[name]=handlers[name]||[]).push(fn);
      if(watched&&handlers[name].length===1)
        watched.addEventListener(name,function(ev){
          handlers[name].forEach(function(f){f(ev.data,ev)});
        });
    }
  };

  // A drop the browser noticed. EventSource is already coming back (the stream
  // says how soon, `retry:`), so the first thing this is, is reconnecting —
  // and if it is still that in DROP_MS it is not reconnecting, it is down.
  //
  // The guard is what makes that clock run: a failed retry fires this again,
  // and re-arming on every attempt would be a page that says "reconnecting"
  // for as long as it keeps failing to.
  function dropped(){
    if(root.classList.contains(STALE)||root.classList.contains(CONNECTING))return;
    setState('connecting');
    armIn(DROP_MS);
  }
  document.body.addEventListener('htmx:sseError',dropped);
  document.body.addEventListener('htmx:sseClose',dropped);

  // A phone throttles a background tab's timers, so the watchdog on a tab
  // coming back from an hour asleep is late by however long the browser felt
  // like. The clock is not throttled: ask it instead of trusting the timer.
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState!=='visible'||!lastBeat)return;
    if(Date.now()-lastBeat>windowMs())setState('stale');
  });

  // ---- history -----------------------------------------------------------
  //
  // Deferred like every script here, so htmx is defined by now.
  htmx.config.historyCacheSize=0;
})();
