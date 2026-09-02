# The chat agent

Open the panel in the corner and tell the agent what you want. Ask it to check something off and the checkbox in front of you moves — not because the panel echoed anything, but because the write went to disk, through the same validator a load runs, and came back on the same subscription every other change does.

What you type sits on the right, in a tinted bubble. What the agent answers sits on the left, as prose. The two used to share one shape — a faint box on the human's words — and a glance could not tell them apart.

## Who is talking

**Every stretch of messages is named, with a face and a name over it.** There are three parties in this panel — you, the agent, and any plugin allowed to ring this conversation — and shape alone stopped being enough to tell them apart the moment there was a third. So each *run* of one party's messages opens with a small line saying whose it is.

**It is once per run, not once per message.** An answer that is a paragraph, four tool calls and another paragraph is one turn by one party, and it is named once. Your next message starts a new run and is named again.

**Your face is your own picture**, resolved the same way the picture in the top-right corner is: whatever your proxy sent, else the operator's avatar template, else the gravatar of a real email claim — and the plain silhouette when none of those had one, which is a face like any other and not a failure. On a serve with no login in front of it the line simply says *you*.

**The agent's face is its mark** — the same one the header and the picker draw, so the agent in the title bar and the agent in the transcript are visibly one thing. An agent olai has no mark for gets a plain generic one and its full name beside it; it never borrows another agent's.

**A plugin's face comes from the plugin.** Olai does not draw it and does not keep a table of them — the mark ships with the plugin, so the day a new one delivers a sentence into a conversation it arrives wearing its own face and olai is not changed at all. A plugin that ships none gets a plain generic one and its name in full.

## Which agent

The panel speaks [ACP](https://agentclientprotocol.com), and it talks to whichever agents this machine has. It finds them itself: the pinned Claude Code adapter, which comes with olai — `nix run`, the packaged binary and `just serve` all bake it in, so there is nothing to install and nothing to configure — an **opencode** on the server's own PATH, and **pi**, whose adapter is pinned and shipped like the Claude Code one but whose agent is found the way opencode is: a `pi` on the server's agent search path is the machine saying it has one, and without it there is no pi row.

**A conversation is with ONE agent, and you choose it when the chat starts.** Not a setting, and not something a conversation can be moved to afterwards: the way to talk to the other agent is to start a chat with it. What you choose is remembered *for that conversation* and nowhere else, so a new chat asks again — there is no default quietly deciding for you, and no way to find yourself in a conversation with an agent you did not pick.

With only ONE agent installed there is nothing to ask, so nothing is asked. That is the state olai has always been in, and what is new in it is the header: it says who you are talking to, with the agent's own mark beside the name.

The list itself:

- **found once, when the server starts.** An agent installed while olai is running is offered by the next start. What decides whether the panel has an agent at all is not a thing to change under somebody who is reading it.
- `OLAI_ACP_AGENT` points at a different ACP agent for the Claude row — that override has always meant *read this the way you read Claude Code*, and it still does. `OLAI_ACP_PI` is the pi row's half of the same arrangement: which pi-acp adapter the panel spawns is a pin olai bakes in or a person overrides, never whatever `npx -y pi-acp` would have fetched today.
- Setting it to the empty string turns chat off — the whole panel, not one row of it: nothing is looked for, and the panel says there is no agent and how to get one. The outlines are served the same either way.
- `OLAI_AGENT_PATH` is where the probes look, and defaults to `PATH`. It is worth knowing about because **olai's PATH is not your shell's**: run as a systemd user service (the home-manager unit) it inherits neither your profile nor your login shell, so an `opencode` you can run in a terminal is not necessarily one this process can see. Set it and it REPLACES the search path. For pi it answers a second question too: the `pi` the probe finds there is handed to the pinned adapter as the one it wraps, so the pi the row runs is the pi the probe found rather than one the adapter resolved against its own environment.

With no agent at all the panel still draws, and says which agents olai can talk to and where to get one — because a feature that is silently absent cannot be told apart from one that is broken.

The conversation is the agent's own session for that directory: close olai, reopen it, and you are back in it — with the agent that has it, because which agent a conversation is with is written down beside which conversation it is ([below](#which-conversation-you-come-back-to)). A session id means nothing to the other agent, so this is not a nicety: asking the wrong one to open it gets a refusal. And (for the Claude agent) `claude --resume` in a terminal reaches the same conversations.

### What differs between them

Anything an agent does not offer simply is not drawn — except where you would expect the behaviour, and then the absence is stated rather than left to be discovered:

- **opencode cannot be INTERRUPTED.** Sending is identical on both agents — the message goes at once and waits its turn at the agent — but the Claude agent also takes a message straight into the turn it is running, on the deliberate gesture, and opencode has no such method. So the `interrupt` control simply is not drawn there ([below](#talking-while-it-works)). **Neither can pi, and that is a characteristic rather than a gap**: a message sent while pi is mid-turn **QUEUES** — it reaches pi's adapter immediately and is answered in order, the adapter's own chunk saying so ("Queued message (position n).") — and pi's own way of steering is never in play: the ACP verb for it is not one pi-acp's wire carries, and the `/steering` in pi-acp's slash menu is about pi's message delivery, not this one.
- **opencode's subagents carry no attribution**, so a fan-out is drawn flat — every call in one column — rather than in lanes ([below](#when-the-agent-sends-other-agents)). Nothing here guesses at whose a call was. The same is true of pi's: no stamp, no lanes, no strip — and no background-task faces either.
- **a tool call's name comes from wherever that agent says it.** Claude Code says it in a field of its own; opencode says it at the head of the call's id (`bash:0`), and pi saying it the same way is a fact its adapter shares (`edit:1`). Either way the row keeps the name it was announced with, and a tool olai cannot name is one you are asked about rather than one that is quietly allowed.
- **pi works the same olai tools the other agents work — through the pin's own bridge, because pi's adapter never came with one.** Its harness has no MCP client of its own (its own README: *No MCP*), and the ACP adapter wraps the harness's remote-control drive rather than the harness's config — so the session's MCP servers the panel hands it would have gone nowhere at all without something loading them INTO the agent. That something is the pin's job: the pinned adapter (its patch is `acp/patches/README.md`'s `pi-mcp-servers` section, its shape is two dozen lines) spawns each conversation's pi with the bridge extension loaded and the servers passed along in its environment, and pi's own extension API registers them as ordinary tools — the `olai_*` / `kolu_*` names the other agents use are the names its rows answer by, with the call AND its result in the transcript the way any tool's is. The limits left are honest small ones rather than a lost feature: **a tool's spelling of *ours* is pi's own, so no permission question ever comes back over ACP to here** — pi's own settings govern what it may do, the way the other agents govern theirs; the banner's rows stand **handed** and there is no per-server tick to move them, because attaches are per conversation, not per server; and a conversation run on an adapter olai did not build (the override lane in the pin's scripts) answers for the wiring it actually carries — none of this is the adapter protocol's own vocabulary. What you lose on pi, said elsewhere here rather than repeated: its chats list shows at most pi's **newest fifty** stored conversations — the adapter answers in pages of that size, newest first — and its bash output stays in the tool row's detail rather than under it (file edits draw as diffs, fully).
- **pi's own hello is not conversation.** Open a conversation with pi and its adapter publishes a startup banner for editors — pi's version, maybe an update nag, a list of the context and skills it loaded — and then repeats it into the session as an ordinary message, for clients that draw no banner block. This panel leaves the repeat out, matched on the exact text the open's own answer carried, never on a guess at prose. Stated here rather than left to be discovered, because the difference between pi saying nothing and pi having said nothing is something a transcript owes you: a first turn whose only content would have been that banner is a silent turn, and the panel names silent turns — a banner standing where the silence notice belongs would be the one chunk that made it look answered.

## Which conversation you come back to

**The one you were in.** Olai writes down which conversation the panel holds and opens that one again, so a restart puts you back where you were and nothing else in the directory can take the panel from you: a `claude` you ran in a terminal here, a `/clear` that started a fresh session beside the one it ended, an agent that touched a timestamp for a reason of its own. Before this, the panel came up in whichever session had been written to most recently, which is a different question with the same answer most of the time and somebody else's conversation the rest of it.

If that conversation is GONE — you deleted it, or you have pointed olai at a different agent since — the most recent one in this directory is opened instead, which is what always used to happen. Whichever you get, the header names it.

The note lives with this machine's other state (`~/.local/state/olai/`, or wherever `XDG_STATE_HOME` points), never in the directory being served: it is one conversation id, **the agent that conversation is with**, the model that conversation was on (below), and the path all three belong to — so a directory you serve from two machines remembers a conversation on each. The agent is what makes the rest of it work at all: a session id belongs to one agent, so the boot has to know which one to start before it has one to ask. A note written by an olai that only ever had one agent names none, and is read as being about the one it had — so an upgrade comes back into the conversation it was in rather than into a question. If it cannot be read or written the panel says so in the conversation and carries on — a restart then opens the most recent conversation, which is the old behaviour and a working panel either way.

**chats** lists the stored conversations for this directory — **every installed agent's**, grouped under whose they are. A row says how many messages its conversation holds (the transcript's own count — tool traffic in both directions counts too, so 2913 messages is not 2913 of your sentences: it is the same kind of answer file size used to be, honest about *that* it knows the size), when it was last touched to the minute, and — for Claude conversations — when a `/clear` left it behind, **which conversation replaced it**. That last one the agent never wrote down, so it is inference rather than a reported fact: a conversation that begins with `/clear` replaces the one last touched at that moment, and when two share that moment, or none is there, the row says nothing rather than guesses. The minute stays beside it for the same reason as ever — two rows of one name can share a story too — and the count for the one question neither answers: how big each side of a `/clear` got. Picking one loads it — and makes it the conversation you come back to.

**Picking another agent's conversation switches the panel to that agent**, exactly as `+ new` would: a session id belongs to one agent and means nothing to the other, so opening one is a change of both. One agent at a time stays true of the *process* — olai still runs one — and was never true of the history. Before this the list was asked of whichever agent the panel happened to be talking to, so a single opencode chat took every Claude conversation in the directory off the screen, and the way back to one was to start a new Claude chat purely so the list would name them again.

The agent you are talking to is asked every time you open the list, because it is already running and its list is the one most likely to have just changed. The others are *started* to answer, asked, and stopped again, one at a time — so opening the list is not a reason to start three subprocesses at once — and what they said is reused for a few seconds, which is why opening the list twice in a row is instant. **An agent that could not be asked is named in the list, with its reason**, and the others' conversations stay where they are: "there are none" and "we could not find out" are different answers, and so are "this agent is broken" and "there is no list".

With one agent on the machine the list is exactly what it always was — no headings, because a heading naming the only agent there is says what the panel's header already says.

**An answer arrives as it is written.** The agent sends its answer a few characters at a time — hundreds of pieces for a paragraph — and what olai sends the browser is those pieces, not the paragraph so far. That is the difference between a page that costs the connection the answer and one that costs it the answer three hundred times over: before this, reading five paragraphs off a machine across the world moved a megabyte and arrived in lumps, because every token re-sent everything said before it. The text also settles on a clock — a few times a second — rather than on the agent's, so however fast the tokens land, the words come in at a speed a person can read and the machine is not re-laying-out the page per letter.

**A conversation opens on its newest line.** The panel jumps there at once, so a long transcript is not something you have to scroll down. While you read, new text only follows if you were already at the bottom; scroll up and it stays put.

**The transcript is the pane that scrolls.** The composer, and the strips above it (which servers this conversation has, what is still running, what it wakes on), stay put. A long turn does not carry the box away with the rows.

## Who, and which model, the header names

Under the conversation's title, the header names **the agent** — its mark and its name — and then the model. The agent is there because a conversation is bound to one for its life and "who am I talking to" is a question you answer by looking rather than by reading; the model is there because a turn's cost and character depend on it and nothing else on screen says.

An agent olai has no mark for gets a plain one, and its name in full beside it. It never borrows another agent's mark.

It names the model the agent is **running**, which is not always the one the session was started on: `/model` is handled inside the CLI the adapter wraps, so the adapter never learns of it and its own picker goes on reporting the starting model for the life of the session. What the header follows instead is the CLI's own message, forwarded because olai asks for it whenever it opens a conversation — a new one and a stored one alike.

Two consequences, both of them the adapter's shape rather than a choice:

- **it changes one turn late.** That message is emitted as a turn STARTS, so the turn that ran `/model` still announces the model it began on, and the new one is first heard of when you send the next thing. Nothing else on the wire carries it — the only other trace of the change in that turn is the agent saying so in prose, and reading a sentence is not something olai will do.
- **it is named the way the agent names it.** The running model arrives as an API id (`claude-sonnet-5`) while the picker offers aliases (`sonnet`), so the two are matched up and the header says *Sonnet*. A model the picker does not offer at all is shown as the id it came as, which is truthful about a name nobody gave — never rounded to whichever row looks closest.

**A raw id in that line is a refusal, not a failure**, and the commonest reason for one is worth knowing: the running model never states its **context window**. The CLI reports `claude-opus-5` whether the session has 200k or 1M, so when the only Opus the picker offers is the 1M one, that row is not allowed to answer — naming a window five times the real one, in the line you would read to decide whether to `/compact`, is worse than naming nothing. You get `claude-opus-5`, and what it does not say, it does not say.

## The model you switched to survives a restart

**Switch the chat with `/model` and it stays switched**, across an olai restart and a new deploy — the conversation comes back on the model you put it on, and the header names it before you type anything.

That is a fix rather than a given, and what it is a fix for is worth knowing about because it happens at the agent's end, not olai's. The agent resolves a session's model in a fixed order — the `ANTHROPIC_MODEL` variable, then `settings.json`, then the model the conversation was actually running — and on *resuming* a conversation it deliberately re-asserts the first two over the third. So a machine whose settings pin `"model": "sonnet"` puts every restored conversation back on Sonnet, however it ended. A `/model` lives only in the conversation itself, which is the half that loses. The chat was on Fable on Friday and on Sonnet on Monday, and nothing said why.

So olai writes down which model this conversation is running, and after a restore, if the conversation has come up on a different one, it says so back — through the same model setting the agent's own picker is. What you get is the model you chose; what a *new* conversation gets is still the machine's default, which is what a default is for.

**And a `/model` made in a conversation you came back to is heard at all**, which is the quieter half of the same fix: the CLI's message is forwarded because olai asks for it when it opens a session, and it was only asking when it *started* one. Every conversation after a restart is a restored one, so the header had gone deaf in exactly the conversations you spend your time in — it went on naming the model the session came up on, however many times you switched.

Two things follow, and both are the honest shape of it:

- **only a switch you made while olai was watching is remembered.** A conversation that never left the machine's default comes back on the machine's default — olai has nothing of its own to say about it, and pinning a conversation to whatever the default resolved to that day would be inventing a choice nobody made. One consequence is worth knowing after an upgrade: a `/model` from before this existed is not a switch olai saw, so the first restart still opens on the default and switching again is what makes it stick.
- **a switch made somewhere else, while olai was not running, loses.** The conversation is reachable from a terminal (`claude --resume`), and a `/model` typed there lands in the same place a static pin does, as far as anything on the wire can tell: the restored conversation simply comes up on a model olai's note disagrees with. Olai puts its own note back. Between a panel that loses the choice made *in* it every single restart and one that can lose a choice made elsewhere while it was off, this is the better of the two.

If the model cannot be put back — an agent that will not take the setting — the conversation opens anyway, on whatever the agent chose, and the panel says so in a row rather than in a log. Nothing is retried behind your back; the next restart tries again.

## How full the context is

Beside the model, the header says how much room is left: **`22k/1M`** — tokens in the conversation, and how many fit. It is the other half of the model's own sentence, and it answers the question the panel used to have no answer to at all: *is it time to `/compact`?* Before this, the way you found out was by watching the agent start forgetting.

It comes from the agent, not from a count kept here — ACP carries it (`usage_update`), and olai draws what it is told. Several arrive per turn and the newest wins, so the number moves as a turn runs rather than only at the end.

A **fraction rather than a percentage**, because the window is not a constant: 200k and 1M are both ordinary, and a session moves between them when the model does. "2%" would read identically in both and mean quite different amounts of work left, so both numbers are shown and the division is yours.

Two things follow from it being the agent's number:

- **the window itself can move under a conversation.** The agent seeds it from what it last knew for the model and corrects it when a turn ends, so the first turn after a `/model` can report the old window and then the true one. That is the agent revising something it told us, and the header follows it.
- **an agent that reports nothing gets no line.** The header simply says nothing about room, which is different from a conversation that has spent nothing — that one says `0/200k`. You will see this twice: before the first turn of a fresh conversation, and after **opening a stored one**, which replays its messages without a usage report. In both cases the next turn fills it in.

What a session has **cost** is on the wire too, and is deliberately not drawn: it is a different question, asked at a different moment, and a second number there would buy nothing for the one this line exists to answer.

## Talking while it works

**The box never locks, and what you type while a turn is running goes to the agent immediately — to wait its turn there.** It is an ordinary message: the agent holds it behind the turn it is working on and gets to it when that turn is over, in the order you sent them. Nothing is held in olai, which is why the words are on screen from the moment you press send; what you are looking at is your message sitting in the agent's own queue, marked *queued* until it is picked up.

That is the same thing pressing send does when the agent is idle. **One verb, one meaning, whatever it is doing** — which is worth knowing if you used olai between May and August 2026, when a message sent during a turn was pushed *into* that turn instead. The most visible casualty was `/compact`: compaction is a request that dies if it is interrupted, so typing anything while it ran killed it (*Compacting failed: API Error: Request was aborted*) and the turn went on with the context uncompacted. Your message never has to know what the agent is busy with now.

**Interrupting is its own gesture: Alt+Enter, or the `interrupt` button beside send.** That one really does go *into* the turn in flight, so an agent halfway through the wrong thing can be redirected while it is still doing it — "not that file, the other one" is worth saying at the moment you notice, and that moment is almost never the moment the agent stops. It costs what it sounds like it costs: whatever the turn was in the middle of is torn down to make room. That is the trade, and it is yours to make on purpose.

**Once you have sent a message that had to wait, this conversation stops offering it.** The button goes and Alt+Enter becomes an ordinary send. That is a guard around a bug in the agent adapter olai pins, not a decision about what is useful: interrupting a turn in a conversation that has ever queued leaves that turn never finishing — the words you interrupted with arrive and are answered, but the panel stays on *working…* until you press **cancel**, which does end it and loses nothing. Rather than hand you a button that does that, the panel takes it away for the rest of the conversation. **A new conversation gets it back** (`+ new`, or opening a stored one), because the problem is per conversation. It goes away for good when the pinned adapter is fixed, which a pin bump on its own does not do: the last one moved the adapter four releases and the bug came with it.

**One way in is not guarded, and it is worth knowing which.** Once the agent has armed a **watch** — the thing whose clock rides the strip under the header — interrupting hangs the same way, and because nothing queued there the button is still offered. A shell sent to the background does not do it; a watch does. The recovery is the same one: your words arrive and are answered, and **cancel** ends the turn and loses nothing.

**Not every agent can be interrupted, and the panel simply does not offer it where it cannot.** The agent olai ships with says at startup that it takes one; opencode has no such method, so there is no button and no chord — and nothing else differs. Sending is sending on both. An agent that will not take a second message at all while it is working (an older adapter) refuses it, and you get the refusal on the row with *send again* under it, like any other message that did not land.

**While anything is happening, a line under the transcript says so** — *opencode is working…*, *starting opencode…*, or *waiting on your answer* when the turn has stopped on a form. It sits between the last row and the box, which is where you are looking after you press enter, and it is gone the instant the panel is idle. The header says the same fact up in the chrome; this is the copy you can see without moving your eyes. (The box's own border turning is focus styling — it is the border a click into the box draws — and it never meant anything else.)

The button says **send** the whole time, because that is what it does the whole time. Cancel sits beside it rather than replacing it: sending and stopping are two things you can want at the same moment, and while a turn runs they are usually the two you are choosing between. `interrupt` appears between them while a turn is running, on an agent that takes one.

**Cancel stops the agent, and only that.** There is nothing else for it to do — every message you have typed already went. Anything waiting behind the turn you stopped is at the agent, not here, so it survives and runs next: cancel is about the turn in flight and nothing else. This is a change worth knowing about if you used olai in early 2026: a message sent mid-turn used to be held *by olai* until the turn ended, and cancelling threw away everything that was waiting. Those words were nowhere else. Nothing is held here now, so there is nothing to throw away.

**A message waiting its turn says *queued* under it**, and stops when the agent picks it up. Nothing has gone wrong with it — it is at the agent, next in line — so the bubble is drawn exactly as any other message of yours, and what you get is an answer to "is anything happening about this". The mark comes off by itself when the turns in front of it end.

**If a message cannot be delivered, it stays on screen.** That is a different thing, marked differently. It keeps its own bubble, exactly as you typed it, outlined and marked — and the mark says which of two things happened, because they are not the same thing and they do not deserve the same button.

***not sent*, with send again underneath.** The agent said no: it would not take the **interruption** you asked for, it was not there to be asked, it **refused the turn itself**, or **you cancelled while your message was still on its way** — a fair thing to do, and the cancel wins rather than your message quietly starting the turn back up. Nothing took the message in any of those, so pressing the button sends it for the first time — as an ordinary message, never as a second interruption, so if a turn is still running it goes and waits its turn there. Nothing retries on its own; whether to try again is yours.

**And a conversation the agent will not open is not a dead agent either.** Starting one, or re-opening a stored one, is a request like any other too — so an agent can say no to it: a directory it will not work in, a conversation it no longer has, a mode it cannot resume from. The panel then says *that*, in the agent's own words, where the conversation would be: the header goes on naming the model, because the agent answered and is therefore running; there is no box, because there is nothing to send to; and there is a **try again**, which asks for the same thing that was refused rather than for whatever olai would have picked. Before this the panel said *not running* about a live agent and left an empty transcript with a working box under it. Press *try again* twice and the second press is told there is nothing waiting — the first took it — because two retries of a refused *new conversation* would be a second fresh one wiping the first. That explanation goes away with the agent: a refusal is about one that is running, so a process that dies takes it with it and you are back to the rows it left.

**A message typed while a conversation is opening waits for it.** Opening one takes real time — a freshly picked agent is a subprocess starting, a handshake, and then a whole conversation replayed before it answers — and the box is not locked while it does, so the next thing you type lands in the gap. It goes into the conversation being opened, once it is: nothing is refused, nothing is lost, and nothing is sent twice. Before this it started a second open of its own, against the first, and the message died with it; and a message sent in the seconds after picking an agent lost its own bubble, because the replay of the conversation it was going into empties the transcript it had just been written to. What you see instead is the panel saying it is **starting** — from the moment you click, not from whenever the server's first frame arrives — and your message appearing when there is a conversation for it to appear in.

**A turn the agent refused is a turn that ended, not an agent that has gone.** Starting a turn is a request like any other, and an agent can answer one with an error rather than with a result — it is in a mode it cannot work from, it has lost track of the conversation, it could not reach the model. What you get is the reason, in the conversation, and a panel that is still *ready*: the agent is running, you are still in the conversation you were in, and the next thing you send goes to it. Olai used to read that as the agent having died, and then said *not running* about a process that was running until some later turn happened to succeed.

***no answer — it may not have arrived*, with no button at all.** Your message went out and nothing came back — the agent went quiet, or died with the message on the wire. An agent that took it and *then* went silent looks exactly like one that never took it, so olai will not tell you which, and will not offer you a *send again* that might be a second copy. The words stay in the bubble where you typed them; what to do next is yours, and a look at what the agent did afterwards is usually the answer. The reason also goes into the conversation as a line of its own, so it is still there after the banner has cleared.

**A turn that ends having said nothing is not a turn that went well.** The agent takes the message, answers that the turn is over, and produces no prose, no tool call and no question — so the panel used to draw exactly that: nothing, under the message you just sent, and back to *ready*. It is what an agent that cannot reach a model looks like from here, and it is quiet on purpose at the other end — opencode with a provider key it cannot resolve sends one zero-token usage report and then a **successful** end-of-turn, with no error anywhere on the wire. Olai now says it: a notice in the conversation naming the agent that was silent and telling you to check that it is signed in and that its provider key is in the environment olai itself runs in, and the banner stays up rather than clearing on the way to idle. The commonest cause on a deployed instance is the environment — an agent olai spawns inherits *olai's* environment, not your shell's ([running.md](running.md)).

A turn you **cancelled** before it said anything is not this: it already has a notice of its own, and blaming the agent for stopping when told to would be the panel arguing with you.

## What it can touch

**Olai hands the agent no filesystem.** What olai itself gives it is a closed list of tools that name a NODE, a whole DOCUMENT or the whole TRASH, and nothing smaller than any of them — search, read a subtree, create an outline, add, mark, retitle, note, schedule, move, trash, place a mirror, retire one, wire what a node waits on, and empty the trash, plus the two that do several of those as ONE write (`update` for several fields of one node, `apply` for a list of ops over many) — so the edits it can ask *olai* for are the edits the format can be, and a malformed outline is not something that path can produce. The documents beside the outlines have four verbs of their own — `list_documents` and `read_document` to find one and read it whole, `create_document` and `write_document` to mint one and replace its text — and they are still not file access: the listing is this directory's own set rather than a disk, and neither end of a document call names an offset or a range, because a `.md` is one text. The one verb on that list that DELETES is `empty_trash`, which names `_olai/Trash.olai` and empties it whole — every record in the trash or none, nothing put back by anything in olai, and refused while a live row still points into it. When a write is refused, the validator's own rows come back, pinned to the lines they are about; when a write lands but is worth a second look, the answer says so — advice about something that happened, never a refusal.

**What the agent brings with it is its own.** The default agent is a coding assistant, and a coding assistant edits files: ask it to fix a typo in a `.md` and it will, with its own tools, on its own authority — the same authority it has in a terminal, over the directory it was started in. Olai neither grants that nor pretends it away; what it does is SHOW it, which is the section below. The one thing worth knowing is that an agent editing a `.olai` by hand is writing the format without the validator in front of it — the outlines are plain text and nothing stops that — so if you want an outline changed, ask for the change rather than for the edit, and it goes through the tools.

It can ask you back: when it needs to know which of two things you meant, the question arrives as a form in the conversation, and nothing times out. Dismissing one is an answer too — the agent is told you would not say, never handed a choice you did not make.

## Asking about one node

A row's `•••` menu offers **Ask agent**, and choosing it opens the panel with that node in the box — a chip above what you type, which you can take off again before you send. The turn is then about THAT node rather than about whatever your sentence re-describes: "why is this waiting?" needs no title in it, and two nodes with the same title are not a thing you have to disambiguate in prose.

What the agent is handed is the node's **id**, with its title, its `file:line` and the titles it hangs under, as one line under your message — the same arrangement an attached file gets, and for the same reason: the id is the handle every one of olai's tools takes, so the agent can read the node, mark it, note it or move it through the same gate as always. What it is NOT handed is a copy of the node's contents: a subtree pasted into a prompt stops being true the moment anything writes, and the agent has `read_node` for the live one.

The chip says the title, but the title is not what is sent. Rename the node between arming and sending and the agent gets the name it has now; **delete** it and the send is refused, in the same words a tool call gets for an id nothing declares — because a question about a node is not one to ask without it.

**Archiving it is not that.** What was put away keeps its id and stays askable — the Trash's own rows offer **Ask agent** like any other, and the `@` list will complete one for a query that says `is:trashed` — because "why did we put this away?" is a fair question and refusing it would be olai deciding which of your own rows you may ask about. What the agent is told is that it *was* put away, as a word on the same line (`; archived`): no tool refuses a write into an archive, so a row arriving as ordinary work would be ticked off as ordinary work.

## Naming a file, or a node

**Type `@` and the directory comes up**, filtered as you type — its **files** first and its **nodes** under them, in one list of eight, four rows kept for each kind and either taking the other's unused ones. (That reserve is why a file you were expecting can be missing: nine matching filenames cannot push every node off the list, and a vault full of matching rows cannot bury the file you type every day.) Taking a file writes the whole path into your sentence (`read @notes/cabinets.md `); taking a node writes its id (`look at @hinges `) and puts the node on the message, as a chip above the box. It is the gesture a terminal agent already has, and it is here for the same reason — a vault spells its folders however it spells them, and a path half-remembered reaches the agent as a file that is not there. A row half-remembered was worse: there was no way to name one at all.

What the file half offers is **the files this directory serves** — every outline, every document, every saved page, which is the set the sidebar draws — because they are already on this tab's subscription. Nothing is walked to answer that half and nothing is asked of the server, so a vault with a thousand files costs the same as one with ten. The NODE half is the other way round now: it is the server's own search ([search.md](search.md)), so it arrives a beat after the files rather than with them — which is why each half keeps four rows whatever the other found, and why a list you are already walking does not reshuffle when the nodes land. The archives are in it, unlike in the sidebar, which hides them behind Trash: what a message may NAME is a file the agent will open, an archive is a file, and "what did we put away last month" is a fair thing to ask.

A file row reads the file's **name**, with its folder beside it, and writes the **path**: a `Daily/` vault is a column of identical dates otherwise. `@notes/` works too — a folder is the start of a path like any other prefix.

**The node half is the search you already know** — literally the same one, asked of the server, so `@cab` here selects what `cab` selects in the filter bar, in the `⌘K` palette and in an agent's `search_nodes` — title, id, tag and note, ranked the same way, with a finished node losing ties ([search.md](search.md)). Whatever fits in one word works: `@is:blocked` names something that is waiting, `@#home` names by tag, `@date:today` names something scheduled. What needs a space does not — a quoted phrase, an `OR` — because the word ends where you would expect a word to end, and a completion that swallowed the rest of your sentence on the chance the next word was for it would be worse than one you have to finish elsewhere. `@` **names** one node; the palette **searches**.

That has one honest consequence: an operator with no word in it scores every match the same, so all that orders `@is:blocked` is the rule that puts finished work last, and then the directory's own order — not the eight most relevant. There is nothing to be relevant to.

And one more, from the day the node half became a question: **fewer than three characters offers no nodes** — the floor every box onto this search keeps, because two characters match half an outline by substring. `@ca` offers the files; `@cab` offers both.

**What was put away is not offered, and `@is:trashed` is how you ask** — the ruling that what is archived is drawn on the Trash and nowhere else, arriving here without being restated ([search.md](search.md)'s one-page rule). It is the opposite of the file half of the very same list, deliberately: a path names bytes an agent will read, where a node names a row of a reading. The third list over this set, the `#tag` completion in a row's editor, goes the archived-out way for its own reason — it ranks the vocabulary of the page you are looking at.

A node row reads its **title**, and beside it the **id it writes** and where it sits — the nearest ancestor first, or the file for a node at the top of one, with the `·` belonging to that trail and to nothing else. Two rows with one title are what that is for; a vault gets a pair by copy-paste, and picking blind between them is the thing this feature exists to stop. A row that is there for something in the node's **note** says so, because otherwise it is a row whose every word is unfamiliar.

**Why the id, and not the title.** The sentence has to name something that stays true. A title is prose — not unique, edited by anybody, with no end inside a sentence — so a message carrying one would be a copy going stale between typing it and reading it back next month. The id is the handle every one of olai's tools takes, and it does not change. You never have to read it: the chip above the box says the node's title, live, and the message you send carries the same chip.

**And the chip is not decoration.** Taking a node arms it, exactly as **Ask agent** on a row does — so the agent gets one line under your message naming the node's id, title, `file:line` and the titles it hangs under, resolved by the server against the set as it is at the moment you send. The word says *where in the sentence* you meant it (`compare @a with @b` is unsayable by two chips); the line says *what it is*. Neither is a copy of the other.

**The words are the last word.** What a message is about is the nodes you took off the list that the message still names — so deleting `@hinges` takes the chip away too, and typing the word back brings it back. The `×` on a chip works the same way from the other end: it takes the word out of the sentence. There is nothing to remember and nothing to keep in step. (An **Ask agent** chip is not read back that way — that gesture put a node there *instead* of a sentence, so there are no words for it to be contradicted by.)

**⌘Z does not take a completion back**, and this used to say it did. Taking a row writes into the box the way a program writes rather than the way a finger does, which is what empties the browser's own undo history for that box — so the keystroke that would undo it has nothing to undo. Delete the word instead, and the chip goes with it. (Undo still works on what you typed *before* a completion, in the ordinary way; it is the completion itself that is not on the stack.)

**What it writes is a word, not an attachment.** The `+` button copies a file into a temporary directory and hands the agent the copy's path (see below), which is right for a screenshot on the clipboard and wrong for a file that is already in the directory the agent is working in: the copy stops being true the moment anything writes it. So a completed path goes in as text, the message reads the way you typed it, and the agent opens the file where it lives.

**It never fights an `@` you meant as a person.** `@` is a tag sigil in olai's own format — `@alice` in a row's title is a tag, and the title editor completes those — but none of that vocabulary exists in this box: a message is prose on its way to an agent. Four things follow, and they are what keep the two apart:

- an `@` **inside a word** opens nothing, so `srid@example.com` is an address;
- an `@` whose word matches **no file and no node** draws nothing at all, so `@alice` types straight through and Enter sends;
- if one *does* match something you did not mean, **Escape** puts the list away and leaves the word alone — nothing is ever rewritten that you did not choose;
- and typing a word that happens to be an id **arms nothing**. Only a row you took off the list puts a node on your message; the panel reads back its own words and never yours.

While the list is up the keys are the list's: ↑/↓ walk it — through both blocks, one cursor — Enter or Tab take the row, Escape closes it. A click does the same for a hand already on the mouse. It is the same box the `/` commands use, because it is the same gesture.

**And Enter takes a row of the list you are looking at.** The node half is asked of the server, so it settles for a fifth of a second before it asks and those rows hold still until the next ones land. Enter inside that gap writes nothing rather than putting the word before last's node into your sentence and arming it; the rows catch up a moment later, and the same key takes the one you meant ([editing.md](editing.md) says it where the other lists in this app say it). The FILE rows are matched in your own tab, so they are never behind anything: `@cab` and Enter writes a path at once, as it always has. And a click is never held back at either half — your hand is on the row you can see.

## Pointing back at a node

Ids in the panel are pressable, and pressing one shows you that node: the row scrolls into view and says it is the one being talked about. If it is not drawn on the page you are reading — another outline, a branch you have collapsed — you are landed on its own file's page instead, unfolded to the row and sat on it, because *show this node* promised the row and a collapse may not hide what an address asked for. Neither may the page's DONE PICK: a landing whose target exists but is hidden as done **reveals it for the visit** — it is the row somebody was SENT, and the pick is a default, not a wall. The reveal mints nothing: the flip's strip and its `·` stand exactly as you left them (the page's own word and the panel's default are never touched, and leaving the page ends the courtesy — the pick hides the row again on your next visit, which is what it says). The address in the bar is the row's own (`house.olai#order`), never the zoom (`/#id` stays the permalink it always was). That `#` half may also spell a PLACEMENT's own id — `house.olai#kitchen-herbs`, the mirror's own record rather than the node's, which is how `read_node`'s `mirrors` hands a board row to whoever asks: the landing lands on the mirror row itself when the page draws it, and when the page does not, the id resolves the way the backticked press below resolves it — to the node the placement stands for — and the landing's own depth-first rule answers for that. And a fragment naming no row the opened page draws says so rather than arriving silently at the top of it: one alarm line in the voice every refused act in this app speaks, gone the way transient notices go, because a broken link and a working one used to be the same screen.

Three things in the conversation are ids, and none of them is a syntax anybody had to invent:

- the **chips on your own message**, which are the nodes you asked about;
- **what a write changed** — every edit the agent makes through olai's tools draws a line naming the node, and that name is the node;
- **an id the agent wrote in backticks**, which is how it spells one anyway, because that is how every one of these tools describes its own arguments. A backticked word becomes pressable exactly when the set declares it: `notes.md` and `--commit=off` stay what they are. An id that names a MIRROR shows you the node it is a placement of — the same place a `see` to that mirror lands, and the only one there is: a mirror is drawn wherever its target is, and it is the target a row stands for.

**Which of them are ids is asked of the server**, once per message — the browser used to answer it out of its own copy of the whole directory, and that copy is what it is giving up ([brainstorming/vault-in-browser.md](https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md)). Two things follow, and both are visible:

- a backtick is **plain until the answer lands**, a beat after the words. It is never marked on a guess and unmarked afterwards: a reference that vanishes under your cursor is worse than one that arrives a millisecond late.
- the answer is **what the set said when the message was drawn**. A message is a record of something that happened; a node named an hour ago keeps its mark in that paragraph, even after somebody put it away — and pressing the mark then goes quietly nowhere, because *show this node* cannot be answered about an id nobody draws. The next message that names it asks again.

If the lookup itself fails, the panel says so at the end of the conversation — one line, because one question carries every message's ids. The words are all still there; what is missing is which of them can be pressed.

**A link the agent writes is a link**, and it behaves like every other link in this app: a path to a document (`notes/plan.md`) or an address of olai's own (`/house.olai`, `/#order`, `/today`) opens in the pane you were last reading, in place, with the conversation still beside it — and Alt+click opens it in a pane to the right. A `https://` one opens in a new tab, so a click can never throw the app away.

## What it shows when it changes something

A tool call is one folded line, and what the call CHANGED is not folded away — the arguments are what was asked for, and this is what happened to your files. There are two kinds of change and the panel draws them differently, because they are different things.

**The name on that line is the one the call was announced with**, and it stays put for the life of the call. An agent may rewrite a call's title as it goes — the tool's name while it starts, a sentence about what it is doing while it runs, something else again when it fails — and a row that followed along would rename itself two or three times while you were reading it, taking the name of any lane hanging off it with it. What the row says instead is what the call was called when it appeared. What it was asked, and what came back, are in the fold, where a call's detail always is.

**A file the agent rewrote** — a `.md`, a source file, anything that is not a node — shows its diff, right there in the conversation: the path, how many lines came and went, and the change itself, with the unchanged stretches between two edits collapsed so what you read first is what moved. A long line wraps inside the change — the line number and the +/- stay in their column — so the conversation never grows a horizontal scrollbar. It is TRIMMED to a few lines, and a click opens the rest where it stands. That is the one thing the transcript is for here: an edit like this appears in no outline, so before it was drawn, the only way to see what an agent had done to a file was a terminal.

An edit a SUBAGENT made is drawn the same way, in that agent's own shelf rather than in the conversation — see [when the agent sends other agents](#when-the-agent-sends-other-agents). Same box, same trim, same click; one door away, because the conversation is the main agent's.

**One edit can show up as several of those boxes**, and it is not a bug when it does: the agent reports what its patch actually did, one block per place the change landed, so an edit that touched three parts of a file is three boxes under the one name — each with its own lines and its own counts, each trimmed and expanded on its own. They are three things that happened to that file, and running them together would be the panel deciding they were one.

**An outline never gets a text diff**, and that is deliberate: an outline is one line per node, so a text diff of one would be a single enormous line with everything on it changing at once. What shows instead is what changed about the NODE, in the same words the Commit panel uses for the same edit — *marked done*, *note rewritten*, *moved* — with the outline it lives in and, when the rollup has something to say, its remark underneath. The tree in front of you has already moved anyway; this is the sentence that says which write did it.

That holds for the file rather than for the tool: an agent that edits a `.olai` with its own tools gets the same node-level rows, read out of the two versions of the file, and never lines. If one of those versions does not parse — which is how hand-editing an outline goes wrong — the panel says so and still draws no diff, and the file's own page shows you the validator's rows where they belong.

## How long a call has been running

**A call that is still going says how long it has been going**, on its own line, once it has been running long enough to be worth saying:

```
· grep for worktops                      src/kitchen.ts   · 47s
```

The mark at the head of that line is the only other thing on it about time, and it cannot answer this: `·` is what a call announced a quarter of a second ago wears, and `·` is what one that has been grepping for four minutes wears. So the question you actually have — *is this stuck, or is it working?* — had nothing on screen to answer it. The number ticks, seconds while seconds are the question and minutes once they are not (`47s`, `1m 12s`, `1h 20m`), and it appears only after a few seconds, so the reads and edits that land instantly never flash one.

**It knows nothing about tools**, and that is the point. What earns a number is the status on the wire — the call has not come back — so a shell command, a file watcher, a build, a search, and the tools of some agent olai has never been pointed at all get it, with nothing here having to recognise any of them.

**It shows what the wire calls running**, which is not quite the same as what is running, and guessing at the far side of somebody else's process is not something this panel will do. That distinction used to cost you the longest-running rows in the panel: a monitor, or a shell command sent off to run in the background, arrived here already complete because the tool answered at launch. The fix went where the problem was — the wire — and is a section of its own below.

**And it stops when the call's TURN does**, which is a stronger promise than it sounds. A status is sticky, and the rows a dead or abandoned call leaves are deliberately still on screen to read — so a call nothing ever reported back on says *pending* for as long as the panel is open, which is the honest record of what happened. A clock asked of that alone would count up all afternoon under a process that stopped at lunchtime, which is the same lie the rail under a spawn is careful not to tell, except that a wrong word stays the same size and a wrong number grows.

*Whether this conversation is busy* is the near-miss, and it is worth saying why it is not the question. Ask again after an agent has died — the rows are still there, that is the point of leaving them — and the new turn makes the panel busy again, so every call the last turn walked away from would light back up at once, each with a clock counting from when it first started. So olai marks what each turn leaves behind, on the call, and a later turn cannot take that back.


## When the agent leaves something running

Some calls do not finish when they answer. The agent arms a **monitor** — a command whose every line of output is an event, a websocket it watches, a `kolu watch` over a fleet of terminals — or sends a shell command off with `run_in_background`, and the tool answers immediately: *started, here is the task id*. The work then goes on, past the answer, past the turn, and for a persistent monitor for the rest of the conversation.

That used to be invisible here, and the incident is worth keeping: an orchestrator armed `kolu watch --states waiting,awaiting --held-for 60s --nag 10m` and supervised an entire dispatch off its events, and the panel showed none of it — no arming, no liveness, no death. The person watching had to ask *how do you know you are babysitting right now?*, and the answer — a pid, an event cadence — existed only in the agent's own prose.

**A background task gets the row of the call that armed it, and that row stays live:**

```
… kolu watch --states waiting,awaiting        ◷ kolu fleet watch   · 12m 4s
  │ still running…
```

What is on it is what the harness itself says: the **description** the task was armed with, which is what you recognise your own watch by (the call's title is `Bash`); the **clock**, which is the same readout every running call gets and ticks here for as long as the task is out; and the **rail** under it, the same one a spawned agent hangs, saying something is still going on down there.

**While it is out, it is at the top of the panel too** — a strip under the header, beside the one naming this conversation's tool servers, saying what is running and for how long:

```
● kolu fleet watch 12m 4s
```

That is not a second copy of the row. A background task's row is at its *birth position*: a monitor armed at the top of a three-hour session is three hours of scrollback away by the time you wonder whether it is still up — and you wonder at the bottom, where you are. The strip is above the scroll and never carried away by it, so the question has an answer wherever you are reading. It is absent when nothing is running, which is nearly every conversation.

**An agent the turn sent out is on that same strip**, for the same reason and one step further — pressing it opens what that agent is doing. A background task is not pressable, because a task's own events reach nothing olai can read. That half is [below](#when-the-agent-sends-other-agents).

**And its death lands where you are looking.** When the task ends, the strip clears and a fresh row arrives at the bottom of the transcript, at that moment:

```
Background command "kolu fleet watch" failed with exit code 3
```

The row that armed it keeps its own ending — it is the record of what happened to that call, and scrolling back to it shows the whole story — but the *news* is delivered at the end of the transcript, because a death edited only into history is a death nobody meets. Where the harness sent no sentence with the ending, the row says the plain thing instead: *the background task "kolu fleet watch" ended (killed)*.

**Its death is on the row too, and that is the point.** A monitor that dies is precisely the fact you must not miss — the supervision stops and nothing else says so:

```
✗ kolu watch --states waiting,awaiting   ◷ kolu fleet watch   · failed
  Background command "kolu fleet watch" failed with exit code 3
```

The word after the description is the **harness's own** — `completed`, `failed`, `killed`, `stopped` — because the protocol's four statuses cannot spell the difference, and a monitor you STOPPED did not fail. The sentence under it is the harness's too, and it is drawn without unfolding anything: for this one row it is the whole of what there is to read, and an exit code behind the same click as the arguments is an exit code nobody sees.

**A turn ending does not touch it.** Every other call still running when a turn ends is marked as one the turn walked away from; this is the one kind of call whose whole point is to outlive the turn, so it is left alone and goes on ticking through the next turn, and the next. What DOES end it is the agent dying — a dead agent will never report anything again, so its tasks are abandoned along with its calls and the live faces go out together.

**The honest limits, per layer**, because they are not all in the same place:

- **What the panel draws** is the task's life: armed, still out, and how it ended — in three places, each answering a different question. The ROW is the record of the call; the STRIP is the standing answer to "is it still up?"; the row at the bottom is the news of its ending. Not its individual events, and the strip says nothing about when it last did something, because nothing knows.
- **What the wire carries** is exactly that, and only because olai patches the adapter it ships with (`acp/patches/README.md`). As released, that adapter completes such a call at the moment it launches — the acknowledgement read as the result — so an armed watch and a finished one were the same row and there was nothing to draw a clock or a death from. The patch is [PR #941](https://github.com/agentclientprotocol/claude-agent-acp/pull/941)'s approach on [issue #865](https://github.com/agentclientprotocol/claude-agent-acp/issues/865), extended from async agents to every task the harness registers.
- **What nothing carries** is the events themselves. A monitor's every line reaches the model and the task's own output file, and no message in the stream underneath the adapter carries one — measured, not assumed. What you see instead is the agent's own prose about each event, in the short turns the harness wakes it for, in the agent's voice where it belongs.
- **An agent that is not Claude Code** says none of this, so its background work is drawn as it always was: a call that completed at the moment it started. Nothing here guesses from a tool's name.
## When the agent sends other agents

An agent can spawn agents of its own — one to search, one to read, five at once — and their work comes back to olai on the same wire as everything else the turn does. **It does not come into this conversation.**

That is the ruling, and it came from a real turn: five survey agents and a monitor, and the transcript became a wall of other agents' `cd … && grep …` with the main agent's own words pushed off the top of the screen. The panel was reporting, faithfully and at full length, on work nobody had asked to watch. So the column here is the main agent's and only the main agent's — its prose, its own calls, and every question anybody stops to ask you. A subagent's calls are filed under the agent that made them, and read where that agent is: on the strip, and in the shelf behind it.

**The call that sent the agent out stays exactly where it was.** It is the main agent's own call — it is the record of what happened — so it keeps its place in the conversation, its title, its ending, and the agent's report in its fold. Scrolling back to it a week later still tells the story.

That report is how an async agent comes back, too. The harness injects the completion as a user-role turn — a `<task-notification>` block, stamped `origin.kind: "task-notification"` in the session stream — so the main agent can be woken with the result. That turn is not a message you typed and it is not the main agent answering: the report is filed in the spawning row's fold, the ending is the one-row news at the bottom in the harness's own words, and none of the XML occupies the column.

```
· read every note                        ↳ Explore
│ ● working…
│ ↳ 7 calls
```

**Under it, the rail says the agent is working and the door says how much it has done.** Press the door and that agent's calls open in a shelf above the conversation — the same rows, behind the same rail, with the same folds, the same diffs and the same clocks they would have had in the column. It is the same drawing moved, never a summary of it.

The door is drawn only once there is something behind it. An agent that has just been sent out has made no calls yet — its first act is to read its instructions, which produces nothing — and the rail above already says the true thing about that stretch. An agent that finished having called nothing has its whole answer in the row's own fold.

None of this is anything you turn on, and a turn that spawned nobody looks exactly as it always did.

### The strip is the other door

While an agent is out it is **on the strip above the scroll**, beside the background tasks, saying what it was sent to do and how long it has been gone:

```
● read every note 47s   ● review the notes 12s
```

That is the same strip a `Monitor` sits on and it is there for the same reason — a live fact you can only reach by scrolling is a live fact nobody reads — but for an agent it does one thing more: **it is pressable.** Five agents out is five entries and one shelf; press one and you are reading that agent, press it again and you are not. A background task is not pressable, and that is honest rather than inconsistent: a task's own events are on no wire olai can reach, so there is nothing behind that door and there never will be.

The strip goes quiet when an agent reports back. **The record does not go with it** — the door under the spawning row is permanent, because that row is permanent, and it is where you go when you want to know what an agent actually did an hour after it finished. There is nothing to dismiss and nothing that dismisses — what the strip says is what is out — so a shelf is put away by pressing a door onto it again. **Which door depends on when you are.** While the agent is out that is the strip entry you opened it from; once it has reported, the strip entry is gone and the door under the spawning row is the one that closes it, exactly as it is the one that opens it an hour later. That is the same permanence the record has, and it is why nothing here needs a control of its own: the shelf's only job is to show you an agent, and the thing that names the agent is the thing that puts it away.

**And its ending is still news, on every outing.** A background agent — one the harness registered a task for — says at the bottom of the transcript how each outing ended, the second one exactly as the first, because the row is an hour of scrollback away by then and the strip going quiet is the only other thing that could have told you. A subagent that arms nothing is quiet both times, for the reason it was quiet the first time: it reported into the fold of the row that sent it, and the agent speaks in the next breath. What never happens is one outing of a call being louder than another.

**And it lights again if that agent is sent more work.** A subagent can be resumed — a follow-up instruction over the same transcript, an hour later — and it comes back as the same agent: the same row, the same door, the same entry on the strip, with the count behind that door carrying on from where it stopped. The clock restarts, because it is answering *how long has this been out* and the agent went out again a minute ago; the row's own stamp does not move, because that is where the record starts. Everything the agent does is filed under the call that sent it out in the first place, whichever outing it is on, so there is never a second face for one agent.

### An agent that does not come back

**A subagent's death is said at the end of the transcript, where you are looking**, and not only on a row somewhere above:

```
the agent “survey the web package” ended (failed)
```

It is the same rule a background task's ending follows and it matters more here, because a subagent's calls are no longer in front of you: a fan-out whose agents quietly stop leaves nothing on the screen that changed. So the news comes to the bottom, at the moment it happens, in the harness's own word where there is one — and in olai's own where there is not, which is the turn ending with the agent still out: *the agent “…” ended (never reported back)*.

An agent that came back FINE says nothing here, and that is the difference from a background task. A monitor's completion is news on a row that has been saying *still running* for an hour; a subagent has just reported into the fold of the row that sent it, and the main agent speaks in the next breath. A line per agent per fan-out would be five rows of furniture under an answer.

**A whole agent dying is still one sentence, not one per agent it had out.** When the conversation itself falls over, that is what the panel says — once, at the bottom — and the rows every abandoned agent left are still there to read.

### When it is a subagent that asks

A spawned agent can stop and ask — permission for a tool nothing recognises, or a question with options to pick from — and **the form is in this conversation**, not in that agent's shelf:

```
· explore the outline                    ↳ Explore
│ ↳ explore the outline
│ ┌ Allow `rg --files`?
│ │  [ Allow Once ]  [ Deny ]
```

That is deliberate and it is the one place the rule at the top of this section does not apply, because a question is not the subagent talking. It is a question **to you**, it blocks the turn, and a turn blocked on a form nobody meets hangs for as long as you fail to notice. A form behind a click is a form nobody presses — so a question was never subject to being moved, and there is no state of the panel in which one is hidden.

It is drawn indented behind the same rail its calls would have been, **with the lane naming who is asking** — always, on every form, wherever it sits. The reason is what a form is: the one row here where being wrong about who is speaking changes what you press. And you rarely meet it by reading down to it — a blocked question is announced in the composer, in the header and on the app's agent toggle (the thumb strip, on a phone), so you come looking for a form that may be anywhere.

**That name is what the agent was SENT to do**, and it is worth saying where it comes from, because it is not the title on the row above. An `Agent` call is titled with the tool's name — four agents dispatched in one message are four rows reading *Task* — and a row's title is fixed at the first thing it was called, deliberately, so a call cannot rename itself while you are reading it. The short description the agent was sent with is a different thing, and it is the one every surface here uses: this label, the strip, the shelf's head and the door. It matters most here. Before, a form you doubted had that agent's whole stretch of work under it to read; now its calls are elsewhere, and this line is the only evidence on the row of whose question you are answering.

The form is not copied into the shelf either. One decision drawn as two forms is one of them pressed by somebody who cannot see the other; so a run with a question in it reads as a gap in that agent's calls, and the answer is where the conversation is.

**And the shelf says so.** Reading one agent's work while another stops to ask is the one way this panel could have let a form arrive somewhere you were not looking — so the shelf carries a line saying a question is waiting, and pressing it puts the shelf away and takes you to the form. It is the same press the alert banner makes, and there is still only one form.

**What is deliberately not drawn at all is the subagent's own prose.** The agent olai ships with does not send it: a spawned agent's text and thinking are stripped from the feed unless a client asks for a nested transcript, and olai does not ask. So a running subagent is its calls and its status here, and the one place its own words appear is the report it hands back at the end. That is a floor rather than a preference — but it also means the main agent's voice in this panel is only ever the main agent's, which is worth having.

### What an agent whose feed says none of this looks like

Nothing above is guessed from a tool's name. Whether a call sent an agent out, and which agent a call was made inside, are two facts olai reads off the frames — and an agent that carries neither (opencode does not) is drawn exactly as it always was: one column, every call in it, no strip entries, no doors and no shelf. That is the direction this is safe to be wrong in, and it is the direction it is wrong in.

## When it is waiting on you

A turn that stops on a question does not time out and does not carry on. It hangs — for as long as it takes you to notice — so the panel's job is to make sure you do.

**If the conversation is in front of you, the form appearing is the whole of it.** It arrives where you are already looking, the composer says the agent is waiting on you, and nothing rings. A notification about something already on your screen is nagging, and the surest way to make somebody switch these off.

The one place *where you are already looking* is not the conversation is the shelf that previews one agent's work, and that is why it carries the notice itself — see [when it is a subagent that asks](#when-it-is-a-subagent-that-asks). A surface that takes your eye off the transcript owes you the sentence the transcript would have given you.

That counts ANOTHER TAB of the same olai, too. Two tabs are two documents and one person: the one you are reading says so to the others, so the tab behind it does not chime about a form you are looking at. A different olai — another directory, another address — is not caught by it, and goes on telling you.

**If it is not** — the window behind an editor, the panel put away, olai on another desktop — three things happen at once:

- **one short chime.** Two notes, a third of a second.
- **a system notification**, naming the conversation and the first line of what the agent wants, so you can decide whether to get up without getting up. Clicking it brings olai forward, opens the panel and puts the question on screen. With the panel already open when the question landed, the notification quotes it; with the panel shut, olai has not been reading the conversation and says so plainly instead of quoting something it read ten minutes ago.
- **a mark on the app's icon** — the number waiting, on an installed olai's dock or home-screen icon; a dot on the tab's title and favicon in an ordinary browser tab. The number is QUESTIONS and not chats: the panel holds one conversation, so a **2** means that conversation has asked you two things, never that two conversations want you. **It stays until you look**, not until you dismiss the notification: swiping a banner away does not answer a question, and the mark is the thing that is still true afterwards.

**A turn merely FINISHING is silent, on purpose.** An agent that has finished will still have finished in five minutes; a chime for every turn is a chime people switch off, and it would take the one that matters with it.

Two rows in **preferences** decide all of this — **Alerts**, and **Alert sound** beneath it — and both start ON. They are two rows rather than one because they are two questions: turning the chime off in a quiet office should not also cost you the notification. Turning Alerts off silences all three, and puts the icon back.

The notification is the one part that needs the browser's permission. olai asks for it the first time it actually has something to tell you, which is when the question in the prompt is about something real; if your browser only allows that prompt after a click, the Alerts row carries an **Allow notifications** button. Refuse it and the chime and the icon mark go on working — neither needs permission.

**The honest limit: olai has to be running.** The alerts ride the same live connection everything else in this app does, so they reach you with the window in the background, on another desktop, or behind everything — but a completely closed olai is not listening, and nothing wakes it. There is no push server, and adding one is its own decision rather than a detail of this.

## Attachments

You can paste a file into the box — a screenshot, a photo of a whiteboard — or drag one onto the panel, or pick one with the **+** button — one of the two doors a phone has; the other is the camera, next paragraph. All of those take the same kinds:

- **pictures**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`
- **documents**: `.pdf`, `.txt`, `.md`, `.csv`, `.json`

**On a phone the `+` has a camera beside it.** One tap opens the camera itself rather than a picker: shoot, the photo lands in the strip above the box like any other attachment, and you can shoot again — tap the camera, one more photo joins the strip — until one send carries them all into the same message. It is drawn only where there is a finger to press it: a desktop has no button at all, because a "camera" that opened a file dialog would be a control that lies, and the roll is exactly as reachable there either way. A picture the list above does not take — say a camera that answers with a `.heic` — is named in the refusal, the same as a drop that misses the gate.

The bytes go into a temporary directory belonging to that conversation, never under the directory being served, and the agent is handed the PATH: it reads the file itself, so nothing rides the prompt into the stored session, and nothing attached here can end up committed with your outlines. The files go away when you start a new conversation or stop the server.

A picture shows itself in the strip above the box. Anything else shows its name and how big it is, because a PDF has no thumbnail worth drawing and a broken image icon is a lie about a file that arrived perfectly.

Dropping is aimed at the whole panel rather than at the box: while you are dragging over it the panel says so, and what lights up is what will take the file. Several files in one drop attach in the order you dropped them, and they reach the agent in that order. Anything olai will not take is named where it was dropped — an SVG (a document that can script, whatever the drag calls it), a `.zip`, a file over the 50 MB cap — so a drop never disappears quietly, and whatever it can take in the same drop still attaches.

## kolu

If the machine is running [kolu](https://kolu.dev) — terminals for coding agents — the panel's agent gets kolu's terminals too, and there is nothing to set up: every new conversation looks for the padi daemon this host answers on, and hands the session `kolu mcp` when one is there. It is looked for rather than assumed: olai starts the `kolu` it found and asks it to read something only a running daemon can answer, because a `kolu` on a PATH is not always the one this host is running, and a wrong build will start perfectly well and know nothing.

## odu

If the machine has an answering [odu](https://github.com/juspay/odu), the panel's agent gets CI its own way: every new conversation resolves `odu` on the server's PATH, starts it, and hands the session `odu mcp` when it answers — the run verbs (`run`, `node_rerun`, `node_cancel`, `wait_for_settle`, `lease`/`release`) and odu's own resources, with no olai-invented verb among them. It is looked for rather than assumed, and the probe asks the one question only the right build answers: those verbs must take a per-call `checkout`, because a conversation spans every lane on its board while the server itself is spawned in one directory. An answer without them gets the sentence, not the tools. [odu's own page](plugins/odu.md#the-chat-panels-odu) has the whole of it, including which half of the face stays parked in the server's own directory; [odu's PR #97](https://github.com/juspay/odu/pull/97) is the checkout-targeting shape this asks for.

## Which tool servers a conversation has

**The panel answers it, so you never have to ask the model.** Under the header, where the session title and the model already are, is the list of MCP servers this conversation was handed:

```
olai ✓  kolu ✓  · plus the agent's own
```

Ask an agent which MCP servers it has and you are asking the worst-informed thing in the room: nothing in a conversation's context is a record of what it was handed. The incident that filed this feature is exactly that — an agent asked the question listed two servers, left out kolu, and then used kolu's tools perfectly a moment later.

**A tick means the agent said so.** It is the one mark olai will not infer. A name with no tick means olai handed the server over and nothing has said what became of it — which is every row before the first turn (the agent reports its servers as a turn starts, so a brand-new conversation has been handed them and nothing more) and every row for the whole life of a conversation with an agent that does not report per server at all. ACP itself never does: `session/new` answers with a session id and not one word per server. The Claude Code adapter volunteers it on its own channel; opencode does not, and its conversations draw names without ticks rather than ticks nobody asserted.

**`plus the agent's own` is not a hedge for the sake of one.** Olai lists what olai handed over. Whatever your agent is configured with of its own — a server in your `~/.claude.json` or `opencode.json` — is set up somewhere olai never looks, and olai will not draw a row it has no way to keep honest. So the list is exactly as complete as it says it is.

**A server the agent could not attach says so, in the agent's own word.** `needs-auth` and `failed` are different problems with different fixes, so the panel repeats the word rather than flattening it into "did not attach".

## When a tool server does not arrive

**A server that fails to attach is on screen, not in a log.** If there is a tool a conversation would have been handed — kolu's `kolu`, odu's `odu` — on this host's PATH and it would not answer, the panel says so under the roster — the name, and the reason the probe or the server itself gave:

```
● kolu is missing from this conversation
  it refused to read the daemon's identity: surface-mcp: padi transport down
  /nix/store/…/bin/kolu
```

The reason is the point. Every way of failing looks the same from the outside — the agent simply has fewer tools — and they want different things done about them: a padi that is not running is one thing, a `kolu` that is an older build missing half its verbs is another, a file on PATH that will not run at all is a third, and one that reads and never answers is a fourth. (There is a fifth sentence, `talking to it failed: …`, and seeing it means something unusual: the reason a broken pipe reached you before the reason the file would not run.) The path is there for the same reason: a padi-spawned terminal prepends its own bundled copy of kolu, so *which* one answered is the question this usually turns out to be — and the one failure with no path to name says so instead.

**`PADI_SOCKET` counts as somebody saying kolu should be here.** If the variable is set — a kolu terminal sets it for what it starts, and a person who set it by hand meant it — and there is no `kolu` on the PATH this server was started with, that is a miss and the panel says so. It is worth knowing because *olai's* PATH is not your shell's: run as a systemd user service (the home-manager unit), it inherits neither, so a kolu you can run in a terminal is not necessarily one this process can see. That was the original mystery from the other side.

It is per conversation, because the detection is: start a padi and the next conversation has the terminals, with nothing to restart and nothing left on screen saying otherwise.

**A machine that is simply not running kolu sees none of this**, and that is deliberate — nothing failed. It has no row on the roster either: what the panel reports is a tool server that was here and would not work, or one something said would be; never the absence of one that was never installed.

An agent's report never overrules the probe. If this host's `kolu` would not answer, the session was never given one — so an agent that reports a `kolu` is reporting a `kolu` of its own, out of its own config, and the row here goes on saying what olai found.

## What this conversation wakes on

**A plugin can put a message into this conversation, and you decide which one it may put it into.** Under the roster and the strip of what is running is a third line — one per plugin that has something to watch — saying what the wake would be about and which file you pointed it at:

```
wake on terminal activity · terminals from  [ lanes.olai ▾ ]   3 fleet events waiting
wake on CI runs · runs from  [ lanes.olai ▾ ]
```

**Off is the state you start in, and it is drawn rather than hidden.** No serve turns this on for you, no setting does, and no agent can — the verb behind the picker is the browser's alone. A new conversation, and one you cleared, wakes on nothing until you pick a file, and the row says `off` so that the control is somewhere you can find it before you have ever used it. `clear` is the way back, and it is the same one fact with an empty value rather than a second switch.

**The picker offers the files that could actually be a scope, and that is fewer than the directory holds.** A plugin says which KINDS of file its doorbell can be pointed at — kolu says outlines, because what it reads is the terminals a file's un-done rows claim and only an outline has rows — so a document is not on the list. It used to be: a `.md` sat between the outlines, and a conversation pointed at one heard nothing for ever while the heartbeat below went on saying the watch was running, which is the one thing that must never happen. Beyond the kind, the list is the outlines *you* keep: what is in the Trash and any leftover `Archive.olai` are left out, because a lane you put away claiming a terminal is history rather than live work, and so are the files olai made for itself under `_olai/` — the shelf, the property declarations, the inbox, kolu's own knobs — which are outlines that will never carry a lane. Everything else you have is offered, in full, because which of your outlines is a board is not something olai can know and it will not guess.

**The file is the whole of the scope, and what it MEANS is the plugin's business.** olai never opens it. kolu reads the terminals your board's un-done rows claim and tells this conversation when one of them has stopped and is waiting on a person — see [kolu's own page](plugins/kolu.md) for exactly what it says and when. odu reads the `odu-worktree` values on those same un-done rows and rings when a claimed run first goes red, and again when it settles — [odu's own page](plugins/odu.md#the-ci-doorbell). Pick the board you are working from and you hear about the lanes on it; pick nothing and you hear nothing. That also means picking a *different* file is how you go quiet about one board without going quiet about the tool.

**A message a machine sent looks like one.** It is in the same lane your own messages are in — that is the lane a prompt goes out on — but it is drawn as the full column on the left, never the tinted bubble on the right that means *you said this*, and it opens by naming who is speaking and when. That opening line is not decoration: a conversation you resume later is rebuilt out of the agent's own store, which carries the words and not the mark, so the sentence has to say for itself who wrote it. There is no *send again* under it either — what it says is how something STOOD when it rang, and re-sending that an hour later would be re-sending a claim that has stopped being true. Whatever rang will ring again.

**And it is one line until you ask for the rest.** A doorbell's account can run to several paragraphs — which terminal, which step it is claiming, what the claim was derived from, what else is waiting, and how to make it stop — and all of that unasked, in the middle of a conversation, is a wall. So the row draws the plugin's own opening line with a small ▸ in front of it; press that and the account opens under it. Hovering the line shows the account too, as a second way in rather than the only one. The agent is handed the whole thing either way — it has to act on the ids in it — so what folds is what you are shown, and nothing else.

**Ids in it are pressable, the same as ids the agent names.** When a plugin writes a node's id in backticks — the lane it is ringing about, say — that name is a reference: press it and you are shown the node, exactly as [pressing one in the agent's own prose](#pointing-back-at-a-node) does. That is the reason the line's text is not itself a button any more: the ▸ opens the row, the id goes to the node, and nothing has two meanings. Nothing else in a machine's sentence is interpreted — no headings, no lists, no links — because those words also have to read correctly when you resume the conversation later and the panel no longer knows a machine wrote them.

**It waits for the turn to end rather than joining it.** If the agent is working when a plugin rings, the sentence is held and the count on the strip says how many are waiting — because the alternative to holding words out of sight is not dropping them, it is showing them. It arrives whole at the boundary, however that turn ended, cancelled included. This is not a queue behind the composer: what you type is never held anywhere, and a message that goes out while a turn runs still goes out. It is the machine that waits, and the reason it waits is that an agent interrupted by a message nobody typed would spend an interruption you were saving.

**A doorbell that stops watching says so, once, and the strip keeps saying it.** Two things can do it. Somebody renames, moves or deletes the file you pointed it at; or the file is one your doorbell cannot read — which today can only be a pick you made before the picker started filtering, since the list will not offer you one now. Either way the plugin puts one message into the conversation, in its own words, saying that nothing is being watched any more and what to do about it — and the strip stops drawing the control as on: the file's name stays, so you can see which one it is about, with `gone — pick another file` or `not one this can watch — pick another file` beside it. The picker still opens, because picking another file is the fix.

**Once, and not once per anything.** The message is sent on the change and never again while it stands, a restart does not repeat it, and the heartbeat stops with it — a doorbell that is watching nothing must not be able to send you the sentence that means *the watch is running and had nothing to say*. Point it at a file it can watch and everything starts again, quietly: the strip goes back to normal and nobody tells you it recovered.

**Held sentences are held in memory, and the picks are on disk.** Restart the server and it comes back knowing which conversations wake on which files, holding nothing — which loses nothing, because whatever derived a held sentence looks at its own subject again and rings again.

**Thirty-two picks are kept for this directory, and the oldest one you touched drops off.** A pick is one conversation pointed at one file for one plugin, and the file they live in holds thirty-two of them: make a thirty-third and the row nobody has touched for longest is evicted, which turns that conversation's doorbell off — the strip on it says `off` again, and picking a file there brings it back. It is a count rather than a question about which conversations still exist, because an agent's list of sessions is paged, so *not on the list* is not proof of *gone* and a prune that trusted it would silently delete a doorbell somebody set. A conversation you keep coming back to is a conversation you keep touching, so in practice this is the number that clears out seats you stopped using.

## Node agents

**Put an `agent-session` property on a node and that node has an agent.** There is nothing else to create, nowhere to register it, and no file to edit first: the node's title is the agent's name, its note is its charter, and its **subtree is its memory**. A chat session bound to it is cattle — it can be thrown away and made again at any time, because what the agent knows is written in the outline rather than in a transcript.

```jsonl
{"id":"spaces","ord":"a0","title":"Xyne Spaces — the org OS","custom":{"agent-session":"grok"}}
```

`agent-session` is the one custom key olai reads, and [format.md](format.md#properties) names it as the exception it is. **One key carries both halves** — which engine, and which conversation — split on the first colon:

```
agent-session: grok                 a node agent nobody has started a session for
agent-session: grok:0f3c8d21-…      ...and one that is talking through that conversation
```

The engine is required and the session is optional, so writing the property by hand is how a node agent comes into being and [starting a session](#starting-a-session) is how it gets its second half. The engine travels with the vault, so a board naming an engine this machine has never heard of is a node agent whose row says so rather than one that disappears.

### The AGENTS roster

The sidebar grows an **Agents** section, with the agenda and the inbox rather than beside the pinned shelf, because a row that says *needs you* is the same kind of news they are. **It is literally the query `prop:agent-session`**: put the property on a node and the row is there on the frame the write lands, rename the node and the row says the new name, take the property off and the row is gone. A directory with no node agent has no section at all — not an empty box, not a heading.

Each row says the node's title, the engine, **how the agent stands**, and how many questions are waiting on you. The standing is a word and a dot, never a dot alone:

| | |
|---|---|
| **needs you** | its turn has stopped on a question, and nothing times out |
| **working…** | a turn is in flight |
| **starting…** | its agent is coming up — a subprocess, a handshake, a replay |
| **idle** | the conversation is open and ready |
| **not running** | its agent is not there; this is the one that needs a person |
| **asleep** | it has a session and this is not the conversation olai is in |
| **no session bound** | nobody has started a session for it yet |

The last two are worth reading twice. **Olai runs one conversation at a time**, so at most one node agent has a process at all and every other one is asleep — which is not broken: the session is on disk, and pressing the row opens it. The count beside a row is **what is waiting on you**, and it is honest about what it can be: an agent with no process cannot have said anything since you last looked, so the only thing that accumulates unseen is a question you have not answered.

### The door on the row

An agent-carrying row in an outline wears a **door** under its properties — kolu's Dock-row shape ([plugins/kolu.md](plugins/kolu.md)), pointed at an agent instead of a terminal: how it stands, its engine, **how big its memory is** (the records under it, at any depth), how long ago it last spoke, and **one line of what it last said**.

```
┌─────────────────────────────────────────────────────────────────┐
│ ● Xyne Spaces — the org OS · needs you · grok · memory: this     │
│   subtree (14 rows)                                        2m   │
│   ⏸ Needs your word: digest timestamps in whose timezone?       │
└─────────────────────────────────────────────────────────────────┘
```

**That line is what olai HEARD**, and the qualification is the honest part: it is written down while the panel is in that agent's conversation, at the end of each turn, so an agent olai has never been in a conversation with has no line, and a conversation you drove from a terminal does not move it. It is the agent's own words — never a tool call, never a question the panel is already drawing as *needs you*, and never one of olai's own sentences about the conversation.

### Pressing either one

**Pressing a roster row takes you to that agent**: its node, at its own row in the outline it is written in, and the panel switches to its conversation. Pressing the **door** switches the panel and navigates nowhere, because you are already standing on the node. The outline never narrows for any of this — the panel is the panel, and the board keeps its width.

An agent with no session can only do half of that, and does the half that exists: from the sidebar it goes to the node. Its door is not pressable at all, since the reader is already there.

**The panel's header names the NODE first**, and it is pressable back onto the row. The agent and the model keep the second line, in that order — who, then what it runs on. A conversation no node claims has exactly the header it always had.

### Starting a session

**The row's `•••` menu offers *Start an agent session*** on a node agent that has none yet — a node whose `agent-session` names an engine and no conversation. Pressing it opens a fresh conversation with that engine and writes the conversation back onto the same property, in that order, so the vault never names a session that was not opened.

```
agent-session: claude       →  agent-session: claude:0f3c8d21-…
```

The entry is not offered on a node whose property already names a conversation. Replacing a live session is the *fresh session* affordance — the one that has to say what happens to the transcript — and it ships with [migration](#what-is-not-here-yet-and-in-what-order-it-comes). Until then, re-pointing a bound node is an edit to the property, which is a chip under the title like any other.

A node with no `agent-session` at all is not a node agent and is offered nothing: **writing the property is what creates one**, and the run of chips is three pixels from the menu.

### Where the binding lives, and what a second machine sees

**In the vault, on the node, in the same property.** All of olai's configuration lives in `.olai` files or their properties, and which conversation a node agent is talking through is configuration — so it is the second half of `agent-session` rather than a file somewhere else. Write the property and the binding is there on the frame the write lands; there is no record to keep in step, nothing to restart, and nothing to hand-edit outside the board.

**A session id is machine-local content in a board-durable place, and that is stated rather than hidden.** A vault served from two machines carries **one** pointer, and it is shaped by whichever machine wrote it:

- the other machine **draws the row** — the engine half is durable and true everywhere;
- **pressing it is refused by that machine's own agent**, in the agent's own words, on the roster's line: it does not have that conversation;
- **starting a session there rewrites the property**, and the first machine's pointer is gone.

Last writer wins, visibly, in a file, through the ops layer — rather than silently in a state directory neither machine could see. The subtree is what keeps the two coherent, which is the design working rather than a gap in it: the agent loses nothing when a session is replaced, because the memory was never in the transcript.

**A node that has gone is not on the roster.** Trash the node, or take the property off it, and the row disappears rather than becoming a door onto a record that is not there.

**Two things stay on the machine**, and both are bookkeeping rather than configuration: that a session has been **taught** its contract (below), and the last line it was **heard** to say. Nothing configures either, nothing else can reconstruct them, and a board written to on every turn would be a board committed on every turn. They live beside [the which-conversation note](#which-conversation-you-come-back-to), under `~/.local/state/olai/heard/` (or wherever `XDG_STATE_HOME` points), keyed by the agent and session they are about, capped at thirty-two conversations with the least recently overheard dropped — the same cap the doorbell picks keep, and what an eviction costs is one contract taught a second time.

### An agent-associated session is taught what it is

The whole thing rests on the agent actually writing into its subtree, so olai tells it to. **The first message you send in an agent-associated session carries a standing instruction under it** — the same seam [attachments and armed nodes](#naming-a-file-or-a-node) ride, so it is a blank line and two lines under what you typed — and the same two lines are drawn in the transcript, verbatim, as a notice UNDER your message — which is where they actually went, since olai's additions ride under what you typed rather than over it. What they say: which node this conversation belongs to, that the node's subtree is its memory and how much of it there is, and that **the transcript is history** — the session can be thrown away, and the next one must be able to read that subtree and know everything this one knew.

**A first-turn preamble rather than a system prompt**, and the choice is worth stating because the alternative sounds better than it is. ACP carries no system prompt — there is no field for one on either leg — so getting one would mean patching the pinned adapter and having the feature simply not exist on opencode and on pi. A preamble is also **in the transcript**, where you can read what your agent was told, and it **costs no turn of its own**: a node agent nobody talks to costs nothing, and the lines go out with the first thing you say.

**Once per session, and it is written down.** A second message does not say it again, and neither does a restart. A *fresh* session is untaught — which is the point, since the transcript is exactly what does not carry the contract.

Two honest limits. The notice and the mark go together, and only where the message they rode under was actually TAKEN by the agent — a send the agent refused says nothing and marks nothing, so the transcript never quotes a contract that did not go out. What neither can see is a turn that fails afterwards: the words went, so the contract went with them, and whether the agent finished reading is not something this end can answer. And a node the set no longer declares — the property came off, the record was trashed — teaches nothing at all, because telling an agent its memory is a node that is not there is worse than telling it nothing.

### What is not here yet, and in what order it comes

This is phase one of a ruled plan, and the rest is a plan rather than a list of gaps:

1. **Migration** — an *Unassigned* roster entry holding every conversation no node claims, an **assign to node…** gesture for chats that already exist, the *fresh session* affordance, and the one distillation turn that banks an old chat's knowledge into its new subtree. After it, real chats move over one row at a time.
2. **Derived wakes** — a node agent's [doorbell scope](#what-this-conversation-wakes-on) becomes its subtree, and an agentless wake climbs to the nearest ancestor node agent. The manual control survives for conversations no node claims.
3. **Agency** — a node agent creates child nodes and puts agents on them, writing only inside its own subtree and asking its ancestor for anything above.
