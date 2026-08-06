// The chat panel: chat frames in, DOM out. One SSE connection for the whole
// page, so this subscribes to the live-view runtime's stream (live.on) rather
// than opening an EventSource of its own — browsers cap those per origin, and
// a second one would be a second story about whether the page is live.
//
// The panel comes out of the server empty and in none of its states. Every
// word in it, and every class on it, arrives as a frame — including the ones
// for what happened before this page existed, which the server replays down
// the connection the moment it is made (web/chat's catch-up). So there is no
// state to read out of the markup at init, and nothing here has to agree with
// a renderer about what a turn looks like.
//
// Frames are JSON, one per event, and land as TEXT: user text, agent chunks
// and tool titles are set with textContent, never innerHTML. The one
// exception is the `html` a `done` frame carries — Markdown the server
// rendered and sanitized (web/markdown), which replaces the plain text the
// chunks accumulated.
(function(){
  var KEY='olai.chat';
  var panel,dock,body,form,input,turn,agentEl,modelEl,sessionEl,pop,spop;

  // ---- open / closed (same shape as collapse.js: a class, remembered) ----
  //
  // The dock (the toggle's and the panel's shared parent) carries the class
  // too: the toggle lives OUTSIDE the panel it opens, and an open panel is on
  // top of where it sits, so app.css takes it away and the header's × becomes
  // the way out.
  function setOpen(o){
    panel.classList.toggle('is-open',o);
    if(dock)dock.classList.toggle('is-open',o);
    try{localStorage.setItem(KEY,o?'1':'0')}catch(e){}
  }

  function setBusy(b){
    panel.classList.toggle('is-busy',b);
    input.disabled=b;
    // Same reason as above: a turn running behind a closed panel is a cue the
    // toggle wears, and the toggle reads it off the dock.
    if(dock)dock.classList.toggle('is-busy',b);
    // nothing to complete into an input nobody can type in
    if(b)closePop();
  }

  // ---- how tall the panel may be -----------------------------------------
  //
  // visualViewport is the strip the browser is actually showing, which on a
  // phone is not the viewport it laid the page out in — the keyboard covers
  // the bottom of that without shrinking it. --visible-h / --visible-bottom
  // are that reading, and web/chat-panel is where they are declared and what
  // the panel is sized by; this is the mirror that keeps them true.
  var visibleH,visibleBottom;

  function measureViewport(){
    var vv=window.visualViewport;
    if(!vv)return;
    // clientHeight, not innerHeight: the layout viewport a fixed box is placed
    // in has no room for scrollbars either, and visualViewport does not count
    // them
    var h=Math.round(vv.height)+'px';
    var bottom=Math.max(0,Math.round(document.documentElement.clientHeight
                                     -vv.height-vv.offsetTop))+'px';
    // Both properties inherit, so writing one costs every node on the page a
    // style recalc — and this fires on every frame of a keyboard sliding up
    // and of an address bar sliding away, most of which move nothing.
    if(h===visibleH&&bottom===visibleBottom)return;
    visibleH=h;visibleBottom=bottom;
    // read before the write that reflows: the panel is about to get shorter,
    // and a reader at the bottom of the transcript stays there rather than
    // watching the message they are answering scroll off
    var stick=body&&panel.classList.contains('is-open')&&nearBottom();
    var style=document.documentElement.style;
    style.setProperty('--visible-h',h);
    style.setProperty('--visible-bottom',bottom);
    if(stick)body.scrollTop=body.scrollHeight;
  }

  // ---- the message body --------------------------------------------------

  function nearBottom(){
    return body.scrollHeight-body.scrollTop-body.clientHeight<48;
  }

  // Scroll only when the reader was already at the bottom: a live turn must
  // not yank the view away from someone reading further up.
  function append(el){
    var stick=nearBottom();
    (turn||body).appendChild(el);
    if(stick)body.scrollTop=body.scrollHeight;
  }

  function make(tag,cls,text){
    var d=document.createElement(tag);
    d.className=cls;
    if(text!==undefined)d.textContent=text;
    return d;
  }

  function line(cls,text){return make('div',cls,text)}

  // A turn owns its user bubble, the agent's text, and its tool lines, so a
  // tool id is only ever looked up inside the turn it belongs to.
  function startTurn(text){
    turn=null;
    var t=line('ol-chat-turn');
    t.appendChild(line('ol-chat-msg is-user',text));
    agentEl=line('ol-chat-msg is-agent');
    t.appendChild(agentEl);
    append(t);
    turn=t;
    setBusy(true);
  }

  var GLYPH={completed:'✓',failed:'✗'};

  // ---- tool calls, folded ------------------------------------------------
  //
  // A tool call is chatter, and it comes up folded: the line is a button, and
  // the title is clamped to it until you ask for the rest (web/chat-panel
  // draws all of that). Only tool calls — what the agent SAID is what the
  // panel is for, and prose never folds.
  //
  // Which calls are open is the PAGE's, not localStorage's: unfolding one is a
  // reading act, not a preference, so a reload comes back to a quiet panel.
  // Keyed by the call's own id, which is what carries a fold through a
  // REBUILD — a reconnect replays the whole conversation into an emptied body
  // (web/chat's catch-up), so the line you were reading is a new element by
  // the time you look back at it, under the same id. Same idea as collapse.js's
  // afterSettle pass, at the one moment a chat line is drawn: there is no htmx
  // swap to hook here, because the panel sits outside the region the outline's
  // events re-swap and is never swapped itself.
  var unfolded={};

  // The one place a fold is written, and it has one spelling: the button's own
  // ARIA state. What expands is the button's own label, so there is no region
  // to name and no class to keep in step with it.
  function setFold(el,open){
    el.setAttribute('aria-expanded',open?'true':'false');
  }

  function toggleFold(el){
    var id=el.getAttribute('data-tool-id');
    if(unfolded[id])delete unfolded[id];else unfolded[id]=true;
    setFold(el,!!unfolded[id]);
  }

  // The shape of a line, once. The triangle and the glyph are hidden from
  // assistive tech, which leaves the button's name as the title — what the
  // line IS.
  function makeToolLine(id){
    var el=make('button','ol-chat-tool');
    el.type='button';
    el.setAttribute('data-tool-id',id);
    el.appendChild(quiet(make('span','ol-chat-tool-fold','▸')));
    el.appendChild(quiet(make('span','ol-chat-tool-glyph')));
    el.appendChild(make('span','ol-chat-tool-title'));
    // folded, unless this same call was open before the body was rebuilt
    setFold(el,!!unfolded[id]);
    return el;
  }

  // One line per tool call, updated in place by id — same id, same line.
  function toolLine(id,title,status){
    var sel='[data-tool-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]';
    var el=turn?turn.querySelector(sel):null;
    if(!el)append(el=makeToolLine(id));
    el.setAttribute('data-status',status);
    el.querySelector('.ol-chat-tool-glyph').textContent=GLYPH[status]||'⚙';
    el.querySelector('.ol-chat-tool-title').textContent=title;
  }

  // Decoration, to a screen reader: a mark and a triangle that say what the
  // words beside them already say.
  function quiet(el){el.setAttribute('aria-hidden','true');return el}

  // ---- slash commands ----------------------------------------------------
  //
  // The agent's own command list: the whole of it in every `commands` frame,
  // one of which this connection was caught up with. Typing "/" opens a
  // popover over the input row; picking a row only WRITES "/name " into the
  // input — a command is invoked by sending ordinary prompt text, so nothing
  // about the send path changes.
  var commands=[],matches=[],picked=-1;

  // Two strings per command, and only what has a name: this list is drawn.
  // An empty one takes the commands button away with it — a button that opens
  // nothing is a button that lies.
  function setCommands(list){
    commands=[];
    for(var i=0;list&&i<list.length;i++){
      var c=list[i];
      if(c&&typeof c.name==='string')
        commands.push({name:c.name,
                       description:typeof c.description==='string'?c.description:''});
    }
    panel.classList.toggle('has-commands',commands.length>0);
  }

  function popOpen(){return !!pop&&!pop.hidden}

  function closePop(){
    if(pop){pop.hidden=true;pop.textContent=''}
    matches=[];picked=-1;
  }

  // What the input is asking to complete: everything after a leading slash, or
  // null when this is not a command line at all. A line that has moved on to
  // arguments ("/foo bar") matches no name, and that closes the popover on the
  // same rule as a typo does.
  function typedPrefix(){
    return input.value.charAt(0)==='/'?input.value.slice(1):null;
  }

  function match(prefix){
    var p=prefix.toLowerCase(),out=[];
    for(var i=0;i<commands.length;i++)
      if(commands[i].name.toLowerCase().indexOf(p)===0)out.push(commands[i]);
    return out;
  }

  function drawPop(list){
    if(!pop||!list.length){closePop();return}
    pop.textContent='';
    for(var i=0;i<list.length;i++){
      var row=line('ol-chat-cmd');
      row.setAttribute('data-index',String(i));
      row.appendChild(line('ol-chat-cmd-name','/'+list[i].name));
      row.appendChild(line('ol-chat-cmd-desc',list[i].description));
      pop.appendChild(row);
    }
    matches=list;
    pop.hidden=false;
    highlight(0);
  }

  // Whatever the input says right now, filtered. An empty prefix is the whole
  // list, which is what the commands button asks for.
  function redraw(){drawPop(match(typedPrefix()||''))}

  // What the input says, or nothing at all: this is the typing path, so a line
  // that stopped being a command line closes the popover.
  function refresh(){
    var p=typedPrefix();
    if(p===null){closePop();return}
    drawPop(match(p));
  }

  function highlight(i){
    var rows=pop.children;
    if(!rows.length)return;
    picked=(i+rows.length)%rows.length;
    for(var j=0;j<rows.length;j++)rows[j].classList.toggle('is-picked',j===picked);
    if(rows[picked].scrollIntoView)rows[picked].scrollIntoView({block:'nearest'});
  }

  // Accepted, not sent: the trailing space is where the arguments go, and the
  // caret stays where it was typing.
  function accept(i){
    var c=matches[i];
    if(!c)return;
    input.value='/'+c.name+' ';
    closePop();
    input.focus();
  }

  // ---- past conversations ------------------------------------------------
  //
  // The agent keeps its conversations, keyed by the directory it works in, and
  // the server comes up in the last one. This is how you get to the others:
  // the list is fetched from the route every time the popover opens (the
  // agent's list is the only one that is right), and picking a row POSTs an
  // id. What the panel then shows arrives as frames — a reset, the replayed
  // turns, the session — the same way everything else here does.
  var sessions=[],sessPicked=-1,sessionsUrl=null,loadUrl=null;

  function spopOpen(){return !!spop&&!spop.hidden}

  function closeSpop(){
    if(spop){spop.hidden=true;spop.textContent=''}
    sessions=[];sessPicked=-1;
  }

  // ISO 8601 is what the agent says; a chat header wants "2026-08-05 14:41".
  function stamp(s){
    return typeof s==='string'?s.slice(0,16).replace('T',' '):'';
  }

  function drawSpop(list){
    if(!spop)return;
    spop.textContent='';
    if(!list.length){
      spop.appendChild(line('ol-chat-cmd-desc','no past chats here'));
      sessions=[];sessPicked=-1;spop.hidden=false;
      return;
    }
    for(var i=0;i<list.length;i++){
      var row=line('ol-chat-cmd');
      row.setAttribute('data-index',String(i));
      if(list[i].current)row.setAttribute('data-current','1');
      row.appendChild(line('ol-chat-cmd-name',list[i].title||'(untitled)'));
      row.appendChild(line('ol-chat-cmd-desc',stamp(list[i].updatedAt)));
      spop.appendChild(row);
    }
    sessions=list;
    spop.hidden=false;
    highlightSess(0);
  }

  function highlightSess(i){
    var rows=spop.querySelectorAll('.ol-chat-cmd');
    if(!rows.length)return;
    sessPicked=(i+rows.length)%rows.length;
    for(var j=0;j<rows.length;j++)rows[j].classList.toggle('is-picked',j===sessPicked);
    if(rows[sessPicked].scrollIntoView)rows[sessPicked].scrollIntoView({block:'nearest'});
  }

  function openSpop(){
    if(!sessionsUrl)return;
    closePop();
    fetch(sessionsUrl).then(function(r){
      if(!r.ok)return r.text().then(function(t){
        append(line('ol-chat-msg is-error',(t||'').trim()||('http '+r.status)));
      });
      return r.json().then(function(j){
        drawSpop((j&&j.sessions)||[]);
      });
    }).catch(function(e){
      append(line('ol-chat-msg is-error',String(e)));
    });
  }

  // Loading the one you are already in would replay it at you for nothing.
  function loadSession(i){
    var s=sessions[i];
    closeSpop();
    if(!s||!loadUrl||s.current)return;
    post(loadUrl,{id:s.id});
  }

  function frame(f){
    if(f.type==='user'){startTurn(f.text)}
    else if(f.type==='chunk'){
      if(!agentEl)startTurn('');
      var stick=nearBottom();
      agentEl.textContent+=f.text;
      if(stick)body.scrollTop=body.scrollHeight;
    }
    else if(f.type==='tool'){
      if(!turn)startTurn('');
      toolLine(f.id,f.title,f.status);
    }
    else if(f.type==='done'){
      if(agentEl&&typeof f.html==='string'){
        agentEl.innerHTML=f.html;
        // Markup arrived without a swap, so nothing on the page would
        // otherwise hear about it: an htmx settle is what every other pass
        // over new markup listens for, and this is the one moment there is no
        // htmx in it. Announced, not called: who cares is theirs to say
        // (static/highlight-init.js is the one who does).
        agentEl.dispatchEvent(new CustomEvent('olai:drawn',{bubbles:true}));
      }
      if(f.stopReason&&f.stopReason!=='end_turn')
        append(line('ol-chat-note',f.stopReason));
      endTurn();
    }
    else if(f.type==='error'){
      append(line('ol-chat-msg is-error',f.message));
      endTurn();
    }
    else if(f.type==='reset'){
      endTurn();
      body.textContent='';
    }
    // A break that already happened, replayed with the conversation: the turns
    // above it are still there, so it draws a line rather than clearing. What
    // the break WAS is the frame's; the word on the line is this side's.
    else if(f.type==='mark'){
      endTurn();
      append(line('ol-chat-sep',f.message||(f.mark==='reset'?'new chat':f.mark)));
    }
    // the header's one live bit: which model, learned with the session and
    // again if it changes under one.
    else if(f.type==='model'){
      if(modelEl)modelEl.textContent=typeof f.name==='string'?f.name:'';
    }
    // the whole command list, replaced. An open popover re-filters in place
    // rather than sitting there offering commands the agent no longer has.
    else if(f.type==='commands'){
      setCommands(f.commands);
      if(popOpen())redraw();
    }
    // which conversation this is. The title turns up a turn or so in (the
    // agent writes it), so an empty one is normal and takes the line away.
    else if(f.type==='session'){
      if(sessionEl)sessionEl.textContent=typeof f.title==='string'?f.title:'';
    }
  }

  function endTurn(){turn=null;agentEl=null;setBusy(false)}

  // ---- posting -----------------------------------------------------------

  // The reply is a status, not content: what the panel draws comes back over
  // SSE, which is what keeps a second tab in step. A refusal (409 busy, 503
  // no agent) is the one thing worth saying here, and it says it inline.
  function post(url,fields){
    var opts={method:'POST'};
    if(fields){
      var parts=[];
      for(var k in fields)parts.push(k+'='+encodeURIComponent(fields[k]));
      opts.headers={'Content-Type':'application/x-www-form-urlencoded'};
      opts.body=parts.join('&');
    }
    fetch(url,opts).then(function(r){
      if(r.ok)return;
      return r.text().then(function(t){
        append(line('ol-chat-msg is-error',(t||'').trim()||('http '+r.status)));
      });
    }).catch(function(e){
      append(line('ol-chat-msg is-error',String(e)));
    });
  }

  // ---- wiring ------------------------------------------------------------

  function init(){
    panel=document.getElementById('ol-chat');
    if(!panel)return;
    dock=panel.closest('.ol-chat-dock');
    body=document.getElementById('ol-chat-body');
    form=document.getElementById('ol-chat-form');
    input=form.querySelector('.ol-chat-input');
    modelEl=document.getElementById('ol-chat-model');
    sessionEl=document.getElementById('ol-chat-session');
    // The popover belongs to the input row and to nothing else, so it is made
    // here rather than rendered: there is no server state in it.
    pop=line('ol-chat-pop');
    pop.id='ol-chat-pop';
    pop.hidden=true;
    form.appendChild(pop);
    // The sessions popover hangs off the HEADER, where its button is: same
    // surface, the other end of the panel.
    var head=panel.querySelector('.ol-chat-head');
    var sbtn=panel.querySelector('[data-chat-sessions]');
    if(head&&sbtn){
      sessionsUrl=sbtn.getAttribute('data-chat-sessions');
      loadUrl=sbtn.getAttribute('data-chat-load');
      spop=line('ol-chat-pop ol-chat-spop');
      spop.id='ol-chat-spop';
      spop.hidden=true;
      head.appendChild(spop);
    }
    var open='0';
    try{open=localStorage.getItem(KEY)||'0'}catch(e){}
    setOpen(open==='1');

    // The keyboard coming up and going down is a visualViewport resize; so is
    // an address bar sliding away, and so is a rotation. Its `scroll` is the
    // visible strip moving inside the layout viewport, which moves the panel's
    // bottom edge just as much.
    measureViewport();
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',measureViewport);
      window.visualViewport.addEventListener('scroll',measureViewport);
    }

    document.addEventListener('click',function(e){
      var t=e.target.closest('[data-post],[data-chat-toggle],[data-chat-commands],[data-chat-sessions]');
      // a click anywhere but the popover's own surface (or the input it
      // completes) puts it away
      if(!t&&!(pop&&pop.contains(e.target))&&e.target!==input)closePop();
      if(!t&&!(spop&&spop.contains(e.target)))closeSpop();
      if(!t)return;
      e.preventDefault();
      // The past conversations, fetched fresh. Pressing it again puts them
      // away, same as the commands button.
      if(t.hasAttribute('data-chat-sessions')){
        if(spopOpen())closeSpop();
        else openSpop();
        return;
      }
      // Two buttons, one path: the floating toggle and the header's ×.
      if(t.hasAttribute('data-chat-toggle')){
        var o=!panel.classList.contains('is-open');
        setOpen(o);
        // a panel that just opened has one thing to do, and it is type
        if(o)input.focus();
        return;
      }
      // The whole list, and pressing it again puts it away. Same popover, so
      // the arrows and Enter work from here on exactly as if it were typed.
      if(t.hasAttribute('data-chat-commands')){
        if(popOpen())closePop();
        else{redraw();input.focus()}
        return;
      }
      post(t.getAttribute('data-post'));
    });

    // The transcript's one control of its own, and its own listener for it:
    // the handler above is the chrome's, and threading a fold through it would
    // buy an ordering invariant kept in prose. collapse.js is the same shape.
    document.addEventListener('click',function(e){
      var tool=e.target.closest('.ol-chat-tool');
      if(tool)toggleFold(tool);
    });

    form.addEventListener('submit',function(e){
      e.preventDefault();
      var text=input.value.trim();
      if(!text)return;
      input.value='';
      closePop();
      post(form.getAttribute('action'),{text:text});
    });

    input.addEventListener('input',refresh);

    // The popover owns these keys only while it is open. Closed, every one of
    // them is the form's — a plain Enter sends, the way it always did.
    input.addEventListener('keydown',function(e){
      if(!popOpen())return;
      if(e.key==='ArrowDown'){e.preventDefault();highlight(picked+1)}
      else if(e.key==='ArrowUp'){e.preventDefault();highlight(picked-1)}
      else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();accept(picked)}
      else if(e.key==='Escape'){e.preventDefault();closePop()}
    });

    // mousedown, not click: it runs before the input loses focus, and the
    // default (that blur) is what accept() would have to undo.
    pop.addEventListener('mousedown',function(e){
      var row=e.target.closest('.ol-chat-cmd');
      if(!row)return;
      e.preventDefault();
      accept(Number(row.getAttribute('data-index')));
    });

    // The sessions popover has no input to own its keys, so it borrows the
    // document's while it is open: arrows move, Enter loads, Esc puts it away.
    if(spop){
      spop.addEventListener('mousedown',function(e){
        var row=e.target.closest('.ol-chat-cmd');
        if(!row)return;
        e.preventDefault();
        loadSession(Number(row.getAttribute('data-index')));
      });
      document.addEventListener('keydown',function(e){
        if(!spopOpen())return;
        if(e.key==='Escape'){e.preventDefault();closeSpop()}
        else if(e.key==='ArrowDown'){e.preventDefault();highlightSess(sessPicked+1)}
        else if(e.key==='ArrowUp'){e.preventDefault();highlightSess(sessPicked-1)}
        else if(e.key==='Enter'){e.preventDefault();loadSession(sessPicked)}
      });
    }

    // The page has ONE stream and every event name rides it; this is how a
    // consumer whose payload is not markup listens to one (live/static/live.js
    // holds the connection). The name is the server's word, carried on the
    // panel — a script that spelled it here would be a second owner of the
    // wire format.
    var name=panel.getAttribute('data-chat-event');
    if(name&&window.live)window.live.on(name,function(data){
      var f=null;
      try{f=JSON.parse(data)}catch(err){return}
      if(f&&f.type)frame(f);
    });
  }

  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',init);
  else init();
})();
