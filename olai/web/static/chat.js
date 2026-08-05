// The chat panel: chat frames in, DOM out. One SSE connection for the whole
// page (the body's sse-connect), so this hooks the htmx sse extension rather
// than opening an EventSource of its own — browsers cap those per origin.
//
// Frames are JSON, one per event, and land as TEXT: user text, agent chunks
// and tool titles are set with textContent, never innerHTML. The one
// exception is the `html` a `done` frame carries — Markdown the server
// rendered and sanitized (web/markdown), which replaces the plain text the
// chunks accumulated.
(function(){
  var KEY='olai.chat';
  var panel,dock,body,form,input,sink,turn,agentEl,modelEl,sessionEl,pop,spop;

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

  function line(cls,text){
    var d=document.createElement('div');
    d.className=cls;
    if(text!==undefined)d.textContent=text;
    return d;
  }

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

  function toolLine(id,title,status){
    var sel='[data-tool-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]';
    var el=turn?turn.querySelector(sel):null;
    if(!el){
      el=line('ol-chat-tool');
      el.setAttribute('data-tool-id',id);
      el.appendChild(line('ol-chat-tool-glyph'));
      el.appendChild(line('ol-chat-tool-title'));
      append(el);
    }
    el.setAttribute('data-status',status);
    el.querySelector('.ol-chat-tool-glyph').textContent=GLYPH[status]||'⚙';
    el.querySelector('.ol-chat-tool-title').textContent=title;
  }

  // ---- slash commands ----------------------------------------------------
  //
  // The agent's own command list: server-rendered onto the panel as
  // data-commands (a reloaded page completes right away) and replaced live by
  // a `commands` frame. Typing "/" opens a popover over the input row; picking
  // a row only WRITES "/name " into the input — a command is invoked by
  // sending ordinary prompt text, so nothing about the send path changes.
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
      if(agentEl&&typeof f.html==='string')agentEl.innerHTML=f.html;
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
    // the header's one live bit: which model, learned with the session and
    // again if it changes under one. The page renders whatever was known then.
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
    sink=document.getElementById('ol-chat-sink');
    modelEl=document.getElementById('ol-chat-model');
    sessionEl=document.getElementById('ol-chat-session');
    // What the server knew when it drew the page. Bad JSON is no commands,
    // not a broken panel.
    try{setCommands(JSON.parse(panel.getAttribute('data-commands')||'[]'))}catch(e){}
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
    // A turn was still running when the page was rendered: the panel comes
    // up in the state the server says it is in, not idle. Adopt the
    // replayed turn too, or the next live frame would start a duplicate.
    if(panel.classList.contains('is-busy')){
      setBusy(true);
      var turns=body?body.querySelectorAll('.ol-chat-turn'):[];
      turn=turns[turns.length-1]||null;
      agentEl=turn?turn.querySelector('.ol-chat-msg.is-agent'):null;
    }
    if(body)body.scrollTop=body.scrollHeight;

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

    // The htmx sse extension would swap the frame's JSON into #ol-chat-sink.
    // Cancelling that message is how this panel borrows the page's one
    // connection: the data is ours, the swap never happens.
    document.body.addEventListener('htmx:sseBeforeMessage',function(e){
      var d=e.detail;
      if(!d||d.type!=='chat'||(sink&&d.elt!==sink))return;
      e.preventDefault();
      var f=null;
      try{f=JSON.parse(d.data)}catch(err){return}
      if(f&&f.type)frame(f);
    });
  }

  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',init);
  else init();
})();
