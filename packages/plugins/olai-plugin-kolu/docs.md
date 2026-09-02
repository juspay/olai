# Kolu integration

[Kolu](https://kolu.dev) runs terminals for coding agents. If a machine is running one, olai on that machine can see its fleet — so a node that records where some work happened also shows you how that work is *going*, and lets you look at the screen without leaving the page. Nothing to configure: olai looks for the daemon this host answers on, and where there is none it says so and carries on.

**This is the first shipped slice of a larger feature.** The roadmap's Orchestrator family is phased — a read-only view first, then events landing on the board, then actions, gates and judgment ([the roadmap](https://github.com/juspay/oss.olai/tree/main/projects/olai/roadmap), `feat-orch`). What is here today is the read-only half: olai watches, and every verb is still kolu's. The rest is not built, and this page describes only what is.

## The connection

One olai per directory, one padi per machine, one connection between them. The BROWSER never dials padi — the server holds the one connection the fleet rides, and every tab is a subscriber to it. Twelve tabs watching one terminal are twelve attaches over that ONE connection: an attach is a write that carries the size the viewer wants, so panes cannot share one, and what the wall saves is the dial rather than the attach. Whose size wins is [below](#the-live-pane).

Which padi it dials is `$PADI_SOCKET` where that is set, and otherwise the rendezvous path kolu derives from its state root — so the two of them find each other with nothing written down. Both are on this machine, which makes the machine the thing worth naming: olai already titles itself after its host (`olai [machine]` — [running.md](../running.md)), so the fleet on the page is that host's kolu, and two boxes are two tabs you can tell apart. There is no cross-machine fleet, and this page is not a step towards one.

Beside the connection pill in the header is the readout for the link, and it has three states rather than two:

- `● kolu` in the done green — a padi answered and the fleet is live;
- `● no kolu`, dim — nothing is answering, and the tip names **where olai looked**, because *looked where?* is the first thing anybody asks;
- `● kolu skew` in the alarm colour — a padi answered but this build cannot speak to it, and the tip names **both** versions.

The third is why the readout is not a boolean. *Start kolu* and *these two builds disagree* have opposite fixes, and a skew reported as absent would send a reader to start a kolu that is already running.

## The `kolu-terminal` property is a door

This is one of olai's **live properties** — a property whose value is a name the board decided on, and whose face goes and finds out what that name currently is. It was the first, and [live-properties.md](../live-properties.md) is the seam itself — what turns one on, and its second tenant ([odu](odu.md): a checkout that has a CI run going in it). Nothing below is special to kolu except the clothes, and the clothes are the one thing worth reading twice: a terminal OWNS ITS ROW, because a terminal somebody wrote down is worth a row whether or not anything is happening in it.

**Give a node a `kolu-terminal` property whose value is a kolu terminal's id** — the whole uuid, or the eight-character prefix a board usually writes — and that is the whole of it. Nothing to declare, no file to edit, and olai never writes your vault:

```jsonl
{"id":"step","ord":"a0","title":"implement","custom":{"kolu-terminal":"303dc985"}}
```

`kolu-terminal` is a **kind** this plugin contributes ([format.md](../format.md)), and an enabled kolu claims the key of the same name. The name carries `kolu-` on purpose: a column *you* call `terminal` is yours, and turning a plugin on can never take it over.

**Want the short key?** One row in `_olai/Properties.org` says which of *your* columns is this kind, and a vault row always wins:

```jsonl
{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"kolu-terminal"}}
```

Your key, the plugin's kind, your file. A column called `pty` works the same way. And a row can take the door AWAY — declare `kolu-terminal` as `text` and it goes dark, because you said what that column means.

What decides is always the DECLARATION — the vault's row, or the plugin's claim where the vault said nothing — and never the key's spelling. It used to be the spelling; that was name-matching, and it could not tell two path-shaped keys apart when somebody needed it to.

With a value in place, the property draws **kolu's own Dock row**:

```
┌─ terminal  1a2b3c4d ─────────────────────────┐
│  ●   terminal-door                     4m    │
│      #405  implementing the fold             │
└──────────────────────────────────────────────┘
```

The pip and its glyph, the status words, the annotation line, the recency, the repo stripe, the PR badge, the recede on a sleeping terminal, the wash when an agent is blocked on you — all of it is the component kolu's own Dock draws, drawing this same fleet. **olai invents no visual language for it.** It used to: there was a face vocabulary here, a fold, a tone table and a stylesheet family, all restating in olai's words a state machine that is kolu's. That is deleted. One fleet with two visual vocabularies is two surfaces free to come to disagree about it, and the states mean here exactly what they mean in the Dock — which is the whole point of putting them here.

**The raw id stays on screen beside the row**, and the two lines are not saying the same thing. The line on top is olai's record — this node names *that* terminal — and the row beneath is kolu's reading of it. A block that drew only the row would hide the id an agent wrote, which is the value you would need to correct it.

## The live pane

Press the row and a pane opens beneath it, on the terminal itself. Press it again and the pane closes.

It is a **window, not a photograph**: it attaches to the terminal and follows the tail, so what is in the box is what is in the terminal, now. It says so twice — a solid border and a `● live` tag — because the pane that reads a still frame is a different promise and a reader should never have to remember which one they are looking at.

It wears **the terminal's own theme and font**, taken from the theme that terminal was created with, so a pane in olai and the same terminal in kolu are the same colours and the same type rather than two impressions of it.

**It is read-only, by design.** You monitor here and you type in kolu. That is the standing rule this whole integration is built on — watching something must not perturb it — and a keyboard in this pane would be a second hand on a terminal an agent is working in.

Attaching is a write on a shared pty, and kolu's semantic is that every client sees the same size — so opening a pane sets the terminal's grid, and another client attaching later moves it for both of you. When that happens the pane takes the new size from padi's next frame rather than asserting its own back, because two viewers each answering the other's resize is a war whose symptom on both screens is a garbled terminal.

Closing drops the attach. Twelve lanes on a page are twelve rows and **zero** attached terminals until somebody presses one.

## The events feed

Press the `● kolu` readout and a panel opens: **what recently wanted attention**, as a log. olai watches the fleet it already holds and says when a terminal has been sitting in a state only a person can carry — `awaiting` your answer, or `waiting` on input — past the moment it is worth saying so. While a pressed Terminal waits on a machine's other half somewhere, the watch itself stays the same economy as the fleet drawer it sits on: the one daemon, the one subscriber, the map the server already held.

Every row is a **frozen draw of the moment the event fired** — which pip it wore, which label it had, how long it had already held. The row is a fact about the past, not a current affairs teller: a terminal that found its answer ten minutes ago still shows the ask it was, and the headline age runs off the same clock as the pips.

The watch is the SERVER's — one watcher, one ring of the last roughly two hundred events, and every browser is a reader of it. The ring itself is **attention only** — heartbeats are nowhere on it; a feed of migrated rows would be the same distraction the usernames they fold back to would be.

The liveness lives on the PILL instead, which is where the feed's own bar already was: `watcher pulse 2m ago` in the hover while it is healthy (the fold's first register, `fresh`), and — crossed past **2 × the vault's `heartbeat` knob** — the pill's loud amber face: the chip's dot hollow, its border and ring warming, and its words naming it as `watcher quiet 47m` until the next beat. That double-cadence is the pill's own margin: the fold counts the beat's stamp against `everyMs` right beside the pulse's record, so a tab answering on its own clock need never guess the vault's cadence. A padi link flapping under olai fires nothing: a fleet emptied because the socket went is a fleet PAUSED, not a closing one — the holds keep their own clocks through it, and a `since` survives a reconnect the way padi's own daemon runs it.

**The watch's pacing lives in `_olai/Kolu.org`**, the file the drawer's wrench opens:

```
{"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"60s","nag":"10m","heartbeat":"30m"}}
```

The file is normal outline records. **Which file decides is a question about the name alone, the way the shelf's and the inbox's are**: the shallowest outline basenamed `kolu.org` (case folded, `_olai/Kolu.org` the chosen form) — a file that holds no `watch` node still decides, so a root `Kolu.org` of notes shadows one parked deeper, knobs defaulting until it moves. The watch node carries the knobs — `held-for` (the pause that holds a terminal's state out of the feed), `nag` (how often an unanswered one is said again) and `heartbeat` — written as `<n>s`, `<n>m` or `<n>h`; an absent value defaults, and a malformed one defaults **and is said on the server's console at warning level**, so a typing mistake is never silent. The grammar is padi's own: `held-for` may be `0` — the report the INSTANT a state lands, which padi's watch flags also allow — but the other two never are, because a nag every 0 ms is the spin padi's own schema refuses, and both cap at the ~24.8-day timer bound. Edits land live: the watch reads its knobs on every vault revision, so the file a person is *editing* is the file a person is **already being watched by**.

The file is yours, not installed: without it the watch runs its defaults (sixty seconds, ten minutes, half an hour).

**There is no mute list any more, and the feed has no silence control at all now.** The file used to carry a `mutes` node whose children named terminals the watch was to keep quiet about, and the drawer's foot named them back. Both went with the second doorbell, and what went with them was the only way there ever was to quiet THIS surface: the watch says everything it sees — every held terminal in the fleet, for every reader of the page — and `_olai/Kolu.org` decides the pacing and nothing else.

**What arrived is a control over a different surface**, which is why the two are a trade rather than a swap. The wake filter file a conversation is scoped to (below) decides which terminals wake THAT CONVERSATION; it says nothing about the events drawer, which goes on drawing the whole fleet. A mute was one machine-wide *never, for everybody* over a log a person chooses to open; a filter file is one person's answer, per conversation, over a message that arrives unasked. The second is the one worth having and the second is what the doorbell needed — but a reader who wanted the drawer itself quieter has nothing to reach for, and that is the cost, named here rather than left to be discovered.

**The drawer's foot is the door onto that file.** Under the events sits a wrench that lands on `_olai/Kolu.org` as an ordinary outline page. Naming the file is answered off the outline PATHS rather than off its records: a config that parses to nothing still draws the wrench, because the wrench is how a person would go and fix it. No file at all is no foot at all, because the defaults have no page to open.

## The second doorbell — a conversation woken by the fleet

A chat conversation can be **scoped to one `.org` file**, and then olai rings it when a terminal that file claims stops and waits for a person. The control is on the chat panel's strip: `wake on terminal activity · terminals from <a file> ▾`, with a picker over the outlines you keep and a clear beside it. **Outlines and nothing else**, because the claim kolu reads lives on a NODE: a document has none, so a conversation pointed at one would watch an empty set for ever while the heartbeat below went on saying the watch was running. The picker used to offer every served file, documents included; it asks each file's kind now, and leaves out the Trash, the leftover archives and olai's own `_olai/` files as well — see [the panel's own page](../chat.md#what-this-conversation-wakes-on) for that ruling. **Nothing is scoped by default** — a fresh conversation, or one you cleared, has the doorbell off until somebody picks a file, and there is no serve-wide setting that turns it on for you.

**The file is the FILTER, and the subject is the fleet.** Which terminals a scoped conversation hears about is exactly this: the `kolu-terminal` values on that file's **un-done** nodes, with mirrors resolving to their targets. That makes the day board (`lanes.org`) the natural filter — it already holds precisely the live lanes — and it means a lane you finish stops ringing without anybody switching anything off. A second conversation may filter by a different file and become its own seat.

**Un-done means UN-SETTLED**: a `done` step and a `cancelled` step both end the wait, and either one silences the node and everything under it. Nothing else does. The value is read by the **declared kind** and never by a key's spelling, so a board whose column is `pty` is heard and a column you have been calling `terminal` since before kolu is not. A value that is a prefix of two live terminals claims neither.

**A row nobody marked is judged by what is under it.** A plain bullet with nothing beneath it is a line somebody wrote rather than work somebody owes, and it claims nothing — but a bullet with a live step under it is a live lane, and it rings. That distinction is the whole of a bug this used to have (`doorbell-missing-claim`, 2026-09-01): a lane whose node had been **filed before its dispatch** — the terminal and the steps grafted onto a row that was already on the board, and the row itself never marked — was dropped from the set entirely. It drew no wake, no nag, and no place in the heartbeat's count for 26 minutes with its agent sitting `waiting`, while four lanes beside it on the same board rang. Nothing about that board said the lane was different. If you keep a board this way, you do not have to remember to mark the lane itself; its steps are enough — but it does need STEPS: a bullet given only its `kolu-terminal`, with nothing under it yet, still claims nothing, and the trace says `unmarked-leaf` when you ask it why.

**Two meanings, derived, never configured:**

- the terminal is claimed and the claiming step is **`doing`** — somebody is on that lane right now and it has stopped, so a report or a block is owed: **a wake**, which starts a turn if the agent is idle and queues behind whatever you typed if it is not;
- the terminal is claimed and the claiming step is **`todo`** — the lane is open but nobody is on it, so it is lawfully parked: **a digest**, whose head says the terminal went quiet and that nothing under it is being worked, and closes *A note, not a call*;
- the terminal is **unclaimed** — silence, and silence means no message at all. olai does not report what it decided not to ring about.

**The two meanings differ in their WORDS, and in nothing else.** There is one delivery path and there is no quieter arm on it: a digest reaches the agent exactly as a wake does — a turn of its own where the agent is idle, held to the turn boundary where a turn is running, held until somebody opens the conversation where nobody is in it. What the meaning decides is the sentence olai writes, and the key that sentence is coalesced under: one key per meaning, so a burst under one meaning collapses to its newest body and can never overwrite the other meaning's — and where both are waiting when a turn ends, they arrive together, each whole. This page used to promise a digest that did not wake the agent; no quieter arm was ever built and there is nowhere in the mechanics to put one. What a person who wants a parked lane to stay quiet changes is the filter file — by finishing that lane, or by pointing the conversation at a board it is not on.

**The message is olai's, and it says so.** It arrives as a message in the conversation with a face of its own — never in your composer, which is yours the whole time and is never typed into, focused or cleared. It opens by naming itself, because a conversation resumed from the agent's own store rebuilds its rows out of message chunks, and a sentence that did not say who was speaking would replay as words in your mouth.

**One line drawn, the rest a press away.** What the panel shows is a plain sentence — *kolu — the fdo-residuals author is idle: it has finished, or it needs you.* — and the account behind it carries the terminal, who it is, the state it is held at, the step that claims it and the file the whole set was read off. The fold is the discipline a tool row already keeps, and the split is between READERS rather than between messages: the agent is handed the whole body as the message text, because it needs the ids to act; you get the sentence, and the ids when you ask for them. The account names the claiming node's id in backticks, so it is **pressable** — a wake links back to the board row it was derived from, which is the row you would edit to stop it.

**Events that pile up while a turn runs arrive as one message.** Each body is a fresh derivation of what is standing — every claimed terminal held *right now* under that meaning — so the one that lands names everything the ones before it would have, and nothing is lost by combining them. The strip counts what is waiting (`3 fleet events waiting`) so it is never holding words out of sight.

**A floor under the silence.** The doorbell's last message is not about the fleet at all. If a scoped conversation hears nothing for a whole `heartbeat` window — the same knob in `_olai/Kolu.org` that paces the pill, and there is no second dial for this — olai puts one message in it saying the watch is running, with the readings that make that claim checkable:

```
The kolu watcher is alive: 30 minutes with nothing to say about the 4 terminals lanes.org claims.

… (the attribution line, and what a heartbeat is) …

— the filter file: lanes.org.
— terminals it claims right now: 4.
— last watcher event: 2026-08-31 14:01 UTC, 31 minutes ago.
— watching since 2026-08-30 19:03 UTC, 19 hours 29 minutes so far.
```

**Four facts rather than "still here",** because *still here* is exactly what a wedged watcher would go on saying: a timer that still fires proves the interval is armed and nothing else. These four are things you can disagree with. A count of 0 all afternoon on a board with four live lanes is a conversation scoped to the wrong file. A last event older than the uptime is a watcher seeing a fleet that never moves. A *watching since* that resets every window is a server somebody keeps restarting. Every one of them is read at the moment the message goes in, so a heartbeat that waited through a turn reports the board as it is when you read it.

**It is a floor and not a metronome.** Any wake or digest delivered to that conversation resets the window, so a busy day produces no heartbeat at all and a quiet one produces exactly one per window. It rides the same delivery path as everything else — a turn of its own where the agent is idle, held to the boundary where a turn is running — which is the whole point: a proof of life that only landed when the agent happened to be running would prove nothing about the hours it was not.

**A heartbeat is never a fault report.** It only ever means *the watch is running and had nothing to say*. A scope olai cannot watch is not beaten for at all — that case says so in words of its own, and there are two of them: the file you pointed at was renamed, moved or deleted, or it is not an outline and holds nothing that could ever claim a terminal (which can only be a pick made before the picker started filtering). Each is one message, once, and the strip goes on showing which. So the two can never be confused for each other, and clearing the file on the strip stops the heartbeats with everything else.

### What the doorbell says it did

A doorbell's failure mode is a call that does not happen, and that is byte-for-byte identical to its ordinary quiet operation. So the doorbell keeps an account of itself: one line per moment, on the debug channel, off until you ask for it.

```
OLAI_LOG_LEVEL=debug
```

Every line is `kolu doorbell <moment> key=value …`, so one moment is one `grep`:
```
kolu doorbell event kind=nag at=2026-09-01T21:52:52.107Z terminal=11e565c0 state=waiting
kolu doorbell derived file=orchestrator/lanes.org claims=9 ringing=11e565c0@task-notification-spill,4b5a3fb6@odu-doorbell unmatched=none excluded=7cf67c42@no-file-delete-op:settled fleet=11
kolu doorbell scopes terminal=11e565c0 scoped=1 files=orchestrator/lanes.org
kolu doorbell classified terminal=11e565c0 file=orchestrator/lanes.org agent=olai session=s-1 meaning=wake why=none
kolu doorbell delivering file=orchestrator/lanes.org meaning=wake agent=olai session=s-1 coalesce=kolu:wake
kolu doorbell said file=orchestrator/lanes.org meaning=wake standing=2 terminals=11e565c0,4b5a3fb6
kolu doorbell delivered file=orchestrator/lanes.org meaning=wake agent=olai session=s-1 said=true
```

The moments are `event` (a watcher `transition`, `nag` or beat reached the doorbell), `derived` (one file's ringing set — **named**, not counted, because the fact worth reading is usually an *absence* and an absence is only legible against a list), `scopes`, `classified` (including `meaning=none`, which is the silence), `delivering` / `said` / `delivered` / `dropped`, and the beat's own `beat`, `beating`, `beat-passed`, `beat-said` and `beat-dropped`. Every `dropped` carries a `why` — and it is one word rather than two, because a set that has nobody standing is the same fact whether the ring asked before handing the delivery over or the closure asked at the moment the words would have gone in.

### Why a terminal is not in the set

The `derived` line names three populations, not one: what **rings**, what was `unmatched` (a live claim whose value named no single fleet id — an ambiguous prefix, a terminal that has shut, or a second row copying a property the first row already won), and what was `excluded` by the walk, each as `value@node:why`. A `classified` line whose `meaning=none` carries the same answer for the terminal the event was about:

| `why=` | what it means |
|---|---|
| `settled` | the claiming row is `done` or `cancelled` — the wait ended, for it and for everything under it |
| `not-live` | the row is open, and every step under it has settled |
| `unmarked-leaf` | the row carries a terminal, has no mark and has nothing under it — a bullet somebody wrote |
| `unmatched` | a live claim names it, and the join refused (see above) |
| `unclaimed` | nothing this walk reached names it — usually a terminal nobody scoped this file for, which is the doorbell working |

**`unmarked-leaf` is the one to know about**, because it is a real silence you can hit by accident: a lane filed as a bullet and given only its `kolu-terminal`, before its steps land, claims nothing. A bullet with a live step under it *does* ring — that is the `doorbell-missing-claim` fix — but a bullet on its own is a line somebody wrote rather than work somebody owes, and olai will not wake you about it. If a lane is quiet and this is the reason, the fix is on the board: give it a step, or mark the row.

**`unclaimed` is narrow on purpose.** The walk stops at a `done` or `cancelled` row without descending, so a claim *underneath* a settled ancestor is never looked at and reads as `unclaimed` rather than by its own gate — the settled ancestor is in the `excluded` list saying so. That matters most on a day board, where the file holds a mirror and the lane's steps live in another file, so the descent is the only way in.

**Silence to the conversation is unchanged.** olai still never rings anybody about a terminal it decided not to ring about — that was ruled and is not reopened. What changed is that the decision is no longer invisible to *you*. The `derived` line above is the one that would have ended `doorbell-missing-claim` in a glance: the terminal was simply not in `ringing`.

**Debug and not info, on purpose.** A doorbell narrating every event at the default level would be a running commentary on a machine where nothing is wrong, and the one line that mattered would arrive dressed as the ones you have learned to skip. The owner's channel keeps what you must read without asking: a malformed knob, and a walk that threw.

## When there is nothing to see

A machine not running kolu is the ordinary case, not a fault. There is no row, and in its place a **sentence** — never a grey row, which would claim the terminal is sitting there doing nothing, and that is a different and wrong fact:

- `this terminal is no longer in the fleet — it has been closed or retired.`
- `this names 3 terminals — write more of the id to say which.` (a prefix too short to be one terminal)
- `no padi is running — olai looked at …/padi-a1b2c3/padi.sock.`
- `no padi is answering at …/padi-a1b2c3/padi.sock, which is where $PADI_SOCKET points.` (somebody SAID where it would be, and it is not there — a different fact from having looked in the default place)
- `olai is not watching a padi here.` (no socket at all: a run drawn outside the fleet, or a server in the first instant of its life. "olai looked at ." is not a sentence)
- `kolu at … speaks padi 99.0, and this olai speaks 12.0 — one of the two needs an upgrade.`

None of those are things kolu's row has a face for, because from kolu's side they do not happen. They are olai's to say, and they are words rather than a shape for the same reason the header readout has three states: *we cannot see* must never be drawn as *we looked and it is quiet*.

## The chat panel's kolu

The older half of the integration, and a separate one: where this host runs kolu, the [chat](../chat.md#kolu) panel's agent is handed `kolu mcp`, so the agent can drive terminals rather than only look at them. It is probed rather than assumed — a `kolu` on a PATH is not always the one this host is running — and a server that would not attach says so on screen with the reason, under the roster line:

```
olai ✓  kolu ✓  · plus the agent's own
```

The two halves share a host and a daemon and nothing else: one is a standing subscription to a fleet, the other a spawn-time probe for a tool server. [chat.md](../chat.md#kolu) has that one in full.
