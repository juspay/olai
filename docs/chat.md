# The chat agent

Open the panel in the corner and tell the agent what you want. Ask it to check something off and the checkbox in front of you moves — not because the panel echoed anything, but because the write went to disk, through the same validator a load runs, and came back on the same subscription every other change does.

What you type sits on the right, in a tinted bubble. What the agent answers sits on the left, as prose. The two used to share one shape — a faint box on the human's words — and a glance could not tell them apart.

## Which agent

The panel speaks [ACP](https://agentclientprotocol.com), and the default agent is the pinned Claude Code adapter, which comes with olai: `nix run`, the packaged binary and `just serve` all default to it, so there is nothing to install and nothing to configure.

- `OLAI_ACP_AGENT` points at a different ACP agent.
- Setting it to the empty string turns chat off — the panel then says there is no agent and which variable would give it one. The outlines are served the same either way.

The conversation is the agent's own session for that directory: close olai, reopen it, and you are back in it — and (for the default agent) `claude --resume` in a terminal reaches the same conversations.

## Which conversation you come back to

**The one you were in.** Olai writes down which conversation the panel holds and opens that one again, so a restart puts you back where you were and nothing else in the directory can take the panel from you: a `claude` you ran in a terminal here, a `/clear` that started a fresh session beside the one it ended, an agent that touched a timestamp for a reason of its own. Before this, the panel came up in whichever session had been written to most recently, which is a different question with the same answer most of the time and somebody else's conversation the rest of it.

If that conversation is GONE — you deleted it, or you have pointed olai at a different agent since — the most recent one in this directory is opened instead, which is what always used to happen. Whichever you get, the header names it.

The note lives with this machine's other state (`~/.local/state/olai/`, or wherever `XDG_STATE_HOME` points), never in the directory being served: it is one conversation id, the model that conversation was on (below), and the path both belong to — so a directory you serve from two machines remembers a conversation on each. If it cannot be read or written the panel says so in the conversation and carries on — a restart then opens the most recent conversation, which is the old behaviour and a working panel either way.

**chats** lists the stored conversations for this directory, and each row says when it was last touched, to the minute. That is deliberate rather than decorative: `/clear` leaves two sessions sharing one name, and the protocol carries no fact that says which of them replaced the other, so the time is what tells you the row you mean. Picking one loads it — and makes it the conversation you come back to.

## Which model the header names

Under the conversation's title, the header names the model — because a turn's cost and character depend on it and nothing else on screen says.

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

**The box never locks, and what you type while a turn is running goes to the agent immediately.** It does not wait for the turn to finish — it lands *in* the turn, so an agent halfway through the wrong thing can be redirected while it is still doing it. "not that file, the other one" is worth saying at the moment you notice, and that moment is almost never the moment the agent stops.

The button says **send** the whole time, because that is what it does the whole time. Cancel sits beside it rather than replacing it: sending and stopping are two things you can want at the same moment, and while a turn runs they are usually the two you are choosing between.

**Cancel stops the agent, and only that.** There is nothing else for it to do — every message you have typed already went. This is a change worth knowing about if you used olai before: a message sent mid-turn used to be held until the turn ended, and cancelling threw away everything that was waiting. Those words were nowhere else. They are not held anywhere now, so there is nothing to throw away.

**If a message cannot be delivered, it stays on screen.** It keeps its own bubble, exactly as you typed it, outlined and marked *not sent*, with **send again** underneath. Nothing retries on its own and nothing disappears; whether to try again is yours.

There are four ways to see it, and the last one is the one you are most likely to cause on purpose: an agent that cannot take a message mid-turn at all (the agent olai ships with can), one that has died between your pressing Enter and the message reaching it, one that has gone quiet and not answered within half a minute — and **cancelling while a message is still on its way**. That last one is a fair thing to do: you say the next thing, then decide the whole turn was wrong. The cancel wins, and your message waits on its row rather than quietly starting the turn back up.

The third of those is a guess rather than a certainty, and worth knowing about because of what it means for pressing the button: an agent that took your message and *then* went silent looks exactly like one that never took it. So a *not sent* mark is olai's best reading, not a promise — which is why nothing here re-sends anything for you. Press it when the conversation shows no sign your words arrived.

## What it can touch

**Olai hands the agent no filesystem.** What olai itself gives it is a closed list of tools that can only name nodes — search, read a subtree, create an outline, add, mark, retitle, note, schedule, move, archive, place a mirror, retire one, and wire what a node waits on, plus the two that do several of those as ONE write (`update` for several fields of one node, `apply` for a list of ops over many) — so the edits it can ask *olai* for are the edits the format can be, and a malformed outline is not something that path can produce. When a write is refused, the validator's own rows come back, pinned to the lines they are about; when a write lands but is worth a second look, the answer says so — advice about something that happened, never a refusal.

**What the agent brings with it is its own.** The default agent is a coding assistant, and a coding assistant edits files: ask it to fix a typo in a `.md` and it will, with its own tools, on its own authority — the same authority it has in a terminal, over the directory it was started in. Olai neither grants that nor pretends it away; what it does is SHOW it, which is the section below. The one thing worth knowing is that an agent editing a `.olai` by hand is writing the format without the validator in front of it — the outlines are plain text and nothing stops that — so if you want an outline changed, ask for the change rather than for the edit, and it goes through the tools.

It can ask you back: when it needs to know which of two things you meant, the question arrives as a form in the conversation, and nothing times out. Dismissing one is an answer too — the agent is told you would not say, never handed a choice you did not make.

## Asking about one node

A row's `•••` menu offers **Ask agent**, and choosing it opens the panel with that node in the box — a chip above what you type, which you can take off again before you send. The turn is then about THAT node rather than about whatever your sentence re-describes: "why is this waiting?" needs no title in it, and two nodes with the same title are not a thing you have to disambiguate in prose.

What the agent is handed is the node's **id**, with its title, its `file:line` and the titles it hangs under, as one line under your message — the same arrangement an attached file gets, and for the same reason: the id is the handle every one of olai's tools takes, so the agent can read the node, mark it, note it or move it through the same gate as always. What it is NOT handed is a copy of the node's contents: a subtree pasted into a prompt stops being true the moment anything writes, and the agent has `read_node` for the live one.

The chip says the title, but the title is not what is sent. Rename the node between arming and sending and the agent gets the name it has now; **delete** it and the send is refused, in the same words a tool call gets for an id nothing declares — because a question about a node is not one to ask without it.

**Archiving it is not that.** What was put away keeps its id and stays askable — the Trash's own rows offer **Ask agent** like any other, and the `@` list will complete one for a query that says `is:archived` — because "why did we put this away?" is a fair question and refusing it would be olai deciding which of your own rows you may ask about. What the agent is told is that it *was* put away, as a word on the same line (`; archived`): no tool refuses a write into an archive, so a row arriving as ordinary work would be ticked off as ordinary work.

## Naming a file, or a node

**Type `@` and the directory comes up**, filtered as you type — its **files** first and its **nodes** under them, in one list of eight. Taking a file writes the whole path into your sentence (`read @notes/cabinets.md `); taking a node writes its id (`look at @hinges `) and puts the node on the message, as a chip above the box. It is the gesture a terminal agent already has, and it is here for the same reason — a vault spells its folders however it spells them, and a path half-remembered reaches the agent as a file that is not there. A row half-remembered was worse: there was no way to name one at all.

What the file half offers is **the files this directory serves** — every outline, every document, every saved page, which is the set the sidebar draws — because they are already on this tab's subscription. Nothing is walked to answer an `@`, nothing is asked of the server, and a vault with a thousand files costs the same as one with ten. The archives are in it, unlike in the sidebar, which hides them behind Trash: what a message may NAME is a file the agent will open, an archive is a file, and "what did we put away last month" is a fair thing to ask.

A file row reads the file's **name**, with its folder beside it, and writes the **path**: a `Daily/` vault is a column of identical dates otherwise. `@notes/` works too — a folder is the start of a path like any other prefix.

**The node half is the search you already know.** The word is read by olai's own query grammar and matched by its own matcher, so `@cab` here selects what `cab` selects in the filter bar, in the `⌘K` palette and in an agent's `search_nodes` — title, id, tag and note, ranked the same way, with a finished node losing ties ([search.md](search.md)). Whatever fits in one word works: `@is:blocked` names something that is waiting, `@#home` names by tag, `@date:today` names something scheduled. What needs a space does not — a quoted phrase, an `OR` — because the word ends where you would expect a word to end, and a completion that swallowed the rest of your sentence on the chance the next word was for it would be worse than one you have to finish elsewhere. `@` **names** one node; the palette **searches**.

That has one honest consequence: an operator with no word in it scores every match the same, so `@is:blocked` gives you the first eight in the directory's order rather than the eight most relevant. There is nothing to be relevant to.

**What was put away is not offered, and `@is:archived` is how you ask** — the ruling that what is archived is drawn on the Trash and nowhere else, arriving here without being restated ([search.md](search.md)'s one-page rule). It is the opposite of the file half of the very same list, deliberately: a path names bytes an agent will read, where a node names a row of a reading. The third list over this set, the `#tag` completion in a row's editor, goes the archived-out way for its own reason — it ranks the vocabulary of the page you are looking at.

A node row reads its **title**, and beside it the **id it writes** and where it sits — the nearest ancestor first, or the file for a node at the top of one. Two rows with one title are what that is for; a vault gets a pair by copy-paste, and picking blind between them is the thing this feature exists to stop. A row that is there for something in the node's **note** says so, because otherwise it is a row whose every word is unfamiliar.

**Why the id, and not the title.** The sentence has to name something that stays true. A title is prose — not unique, edited by anybody, with no end inside a sentence — so a message carrying one would be a copy going stale between typing it and reading it back next month. The id is the handle every one of olai's tools takes, and it does not change. You never have to read it: the chip above the box says the node's title, live, and the message you send carries the same chip.

**And the chip is not decoration.** Taking a node arms it, exactly as **Ask agent** on a row does — so the agent gets one line under your message naming the node's id, title, `file:line` and the titles it hangs under, resolved by the server against the set as it is at the moment you send. The word says *where in the sentence* you meant it (`compare @a with @b` is unsayable by two chips); the line says *what it is*. Neither is a copy of the other.

**The words are the last word.** What a message is about is the nodes you took off the list that the message still names — so deleting `@hinges`, or pressing ⌘Z over the completion that wrote it, takes the chip away too, and typing the word back brings it back. The `×` on a chip works the same way from the other end: it takes the word out of the sentence. There is nothing to remember and nothing to keep in step. (An **Ask agent** chip is not read back that way — that gesture put a node there *instead* of a sentence, so there are no words for it to be contradicted by.)

**What it writes is a word, not an attachment.** The `+` button copies a file into a temporary directory and hands the agent the copy's path (see below), which is right for a screenshot on the clipboard and wrong for a file that is already in the directory the agent is working in: the copy stops being true the moment anything writes it. So a completed path goes in as text, the message reads the way you typed it, and the agent opens the file where it lives.

**It never fights an `@` you meant as a person.** `@` is a tag sigil in olai's own format — `@alice` in a row's title is a tag, and the title editor completes those — but none of that vocabulary exists in this box: a message is prose on its way to an agent. Four things follow, and they are what keep the two apart:

- an `@` **inside a word** opens nothing, so `srid@example.com` is an address;
- an `@` whose word matches **no file and no node** draws nothing at all, so `@alice` types straight through and Enter sends;
- if one *does* match something you did not mean, **Escape** puts the list away and leaves the word alone — nothing is ever rewritten that you did not choose;
- and typing a word that happens to be an id **arms nothing**. Only a row you took off the list puts a node on your message; the panel reads back its own words and never yours.

While the list is up the keys are the list's: ↑/↓ walk it — through both blocks, one cursor — Enter or Tab take the row, Escape closes it. A click does the same for a hand already on the mouse. It is the same box the `/` commands use, because it is the same gesture.

## Pointing back at a node

Ids in the panel are pressable, and pressing one shows you that node: the row scrolls into view and says it is the one being talked about. If it is not on the page you are reading — another outline, a branch you have collapsed — you go to its own page instead.

Three things in the conversation are ids, and none of them is a syntax anybody had to invent:

- the **chips on your own message**, which are the nodes you asked about;
- **what a write changed** — every edit the agent makes through olai's tools draws a line naming the node, and that name is the node;
- **an id the agent wrote in backticks**, which is how it spells one anyway, because that is how every one of these tools describes its own arguments. A backticked word becomes pressable exactly when the outlines you have loaded declare it: `notes.md` and `--commit=off` stay what they are. An id that names a MIRROR shows you the node it is a placement of — the same place a `see` to that mirror lands, and the only one there is: a mirror is drawn wherever its target is, and it is the target a row stands for.

## What it shows when it changes something

A tool call is one folded line, and what the call CHANGED is not folded away — the arguments are what was asked for, and this is what happened to your files. There are two kinds of change and the panel draws them differently, because they are different things.

**A file the agent rewrote** — a `.md`, a source file, anything that is not a node — shows its diff, right there in the conversation: the path, how many lines came and went, and the change itself, with the unchanged stretches between two edits collapsed so what you read first is what moved. A long line wraps inside the change — the line number and the +/- stay in their column — so the conversation never grows a horizontal scrollbar. It is TRIMMED to a few lines, and a click opens the rest where it stands. That is the one thing the transcript is for here: an edit like this appears in no outline, so before it was drawn, the only way to see what an agent had done to a file was a terminal.

**One edit can show up as several of those boxes**, and it is not a bug when it does: the agent reports what its patch actually did, one block per place the change landed, so an edit that touched three parts of a file is three boxes under the one name — each with its own lines and its own counts, each trimmed and expanded on its own. They are three things that happened to that file, and running them together would be the panel deciding they were one.

**An outline never gets a text diff**, and that is deliberate: an outline is one line per node, so a text diff of one would be a single enormous line with everything on it changing at once. What shows instead is what changed about the NODE, in the same words the Commit panel uses for the same edit — *marked done*, *note rewritten*, *moved* — with the outline it lives in and, when the rollup has something to say, its remark underneath. The tree in front of you has already moved anyway; this is the sentence that says which write did it.

That holds for the file rather than for the tool: an agent that edits a `.olai` with its own tools gets the same node-level rows, read out of the two versions of the file, and never lines. If one of those versions does not parse — which is how hand-editing an outline goes wrong — the panel says so and still draws no diff, and the file's own page shows you the validator's rows where they belong.

## When the agent sends other agents

An agent can spawn agents of its own — one to search, one to read, several at once — and their work comes back to olai on the same wire as everything else the turn does. So it is drawn as what it is: a call a subagent made sits **indented behind a rail**, under the call that spawned it, and the ordinary column is the main agent's own.

Where a stretch of one agent's work begins, the lane says whose it is — the description the agent was sent with, *explore the outline*, *review the notes* — and then stops repeating itself: a subagent that reads ten files gets one name and ten rows, not ten names. That name comes back whenever the thread is picked up again, which is what makes two agents running at once readable: their calls interleave, and each stretch says which of them it was.

None of this is anything you turn on, and there is nothing to fold: a turn that spawned nobody looks exactly as it always did. What it replaces is a panel where three agents grepping at once and one agent grepping three times were the same five lines — which was the only thing in this conversation that was not true.

### An agent that has not reported back yet

**A rail drops out of the call that sent an agent out, at the moment it sends one**, and it says the agent is working — which is already true before it has done anything you can see:

```
· read every note                        ↳ Explore
│ ● working…
```

That is the fix for the thing everything above missed. A lane is drawn out of work a subagent has ALREADY done, and a subagent's first act is to read its instructions, which produces nothing to draw — so for the whole of the stretch you actually watch a fan-out through, the panel had a pending dot with an ordinary title on it and nothing anywhere saying an agent had been started. Three agents out looked exactly like one slow `Read`.

Three things are on that row and every one of them comes off the wire:

- **who it is** — the kind of agent, on the right of the row, in the words of whoever defined it: *Explore*, *general-purpose*, a name out of your own agents. A spawn that named no kind says the bare word **agent**, which is the honest thing to say about an agent nobody labelled — never rounded to whichever kind looks closest.
- **what it was asked** — the row's own title, which is the short description the call was made with. The whole prompt is one click away, in the fold, where a call's arguments always are.
- **that it is running** — the rail, which says *working…* and **goes away the moment the call stops**. One word, and it was briefly two: a *starting…* that became *working…* at the agent's first heartbeat. That read as more precise and was less true — every tool call is announced *pending* whether or not it has got going, the subagent is dispatched at once, and a heartbeat can be half a minute away, so a subagent whose work was already listed in the lane below went on being described as starting while you watched it. A face that outlived the agent would say a fan-out was running after the turn was over, which is the same lie in the other direction — so it also goes when the CONVERSATION stops, which is what covers the way this actually goes wrong: an agent that died between sending somebody out and reporting on it leaves a row that will never say it finished, and the rows a dead agent left are deliberately still on screen to read.

Then the calls arrive in the lane that is already open under it, and when the agent reports back the row completes and its answer is in the fold. Nothing about the rest of the drawing changes — the same rail, the same names, in the same places.

**What is deliberately not drawn is the subagent's own prose.** The agent olai ships with does not send it: a spawned agent's text and thinking are stripped from the feed unless a client asks for a nested transcript, and olai does not ask. So a running subagent is its calls and its status here, and the one place its own words appear is the report it hands back at the end. That is a floor rather than a preference — but it also means the main agent's voice in this panel is only ever the main agent's, which is worth having.

## Attachments

You can paste a file into the box — a screenshot, a photo of a whiteboard — or drag one onto the panel, or pick one with the **+** button, which is the way in on a phone. All three take the same kinds:

- **pictures**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`
- **documents**: `.pdf`, `.txt`, `.md`, `.csv`, `.json`

The bytes go into a temporary directory belonging to that conversation, never under the directory being served, and the agent is handed the PATH: it reads the file itself, so nothing rides the prompt into the stored session, and nothing attached here can end up committed with your outlines. The files go away when you start a new conversation or stop the server.

A picture shows itself in the strip above the box. Anything else shows its name and how big it is, because a PDF has no thumbnail worth drawing and a broken image icon is a lie about a file that arrived perfectly.

Dropping is aimed at the whole panel rather than at the box: while you are dragging over it the panel says so, and what lights up is what will take the file. Several files in one drop attach in the order you dropped them, and they reach the agent in that order. Anything olai will not take is named where it was dropped — an SVG (a document that can script, whatever the drag calls it), a `.zip`, a file over the 50 MB cap — so a drop never disappears quietly, and whatever it can take in the same drop still attaches.

## kolu

If the machine is running [kolu](https://kolu.dev) — terminals for coding agents — the panel's agent gets kolu's terminals too, and there is nothing to set up: every new conversation looks for the padi daemon this host answers on, and hands the session `kolu mcp` when one is there. It is looked for rather than assumed: olai starts the `kolu` it found and asks it to read something only a running daemon can answer, because a `kolu` on a PATH is not always the one this host is running, and a wrong build will start perfectly well and know nothing.

## When a tool server does not arrive

**A server that fails to attach is on screen, not in a log.** If there is a `kolu` on this host's PATH and it would not answer, the panel says so under the header — the name, and the reason the probe or the server itself gave:

```
● kolu is missing from this conversation
  it refused to read the daemon's identity: surface-mcp: padi transport down
  /nix/store/…/bin/kolu
```

The reason is the point. Every way of failing looks the same from the outside — the agent simply has fewer tools — and they want different things done about them: a padi that is not running is one thing, a `kolu` that is an older build missing half its verbs is another, a file on PATH that will not run at all is a third, and one that reads and never answers is a fourth. (There is a fifth sentence, `talking to it failed: …`, and seeing it means something unusual: the reason a broken pipe reached you before the reason the file would not run.) The path is there for the same reason: a padi-spawned terminal prepends its own bundled copy of kolu, so *which* one answered is the question this usually turns out to be — and the one failure with no path to name says so instead.

**`PADI_SOCKET` counts as somebody saying kolu should be here.** If the variable is set — a kolu terminal sets it for what it starts, and a person who set it by hand meant it — and there is no `kolu` on the PATH this server was started with, that is a miss and the panel says so. It is worth knowing because *olai's* PATH is not your shell's: run as a systemd user service (the home-manager unit), it inherits neither, so a kolu you can run in a terminal is not necessarily one this process can see. That was the original mystery from the other side.

It is per conversation, because the detection is: start a padi and the next conversation has the terminals, with nothing to restart and nothing left on screen saying otherwise.

**A machine that is simply not running kolu sees none of this**, and that is deliberate — nothing failed. What the panel reports is a tool server that was here and would not work, or one something said would be; never the absence of one that was never installed.

What olai cannot report is a server it handed over that the *agent* then failed to connect to: ACP answers `session/new` with a session id and says nothing per server, so that is not a fact this end is ever told. The failures shown are the ones olai found itself.
