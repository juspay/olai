# Kolu integration

[Kolu](https://kolu.dev) runs terminals for coding agents. If a machine is running one, olai on that machine can see its fleet — so a node that records where some work happened also shows you how that work is *going*, and lets you look at the screen without leaving the page. Nothing to configure: olai looks for the daemon this host answers on, and where there is none it says so and carries on.

**This is the first shipped slice of a larger feature.** The roadmap's Orchestrator family is phased — a read-only view first, then events landing on the board, then actions, gates and judgment ([roadmap.olai](roadmap.olai), `feat-orch`). What is here today is the read-only half: olai watches, and every verb is still kolu's. The rest is not built, and this page describes only what is.

## The connection

One olai per directory, one padi per machine, one connection between them. The BROWSER never dials padi — the server holds the one connection the fleet rides, and every tab is a subscriber to it. Twelve tabs watching one terminal are twelve attaches over that ONE connection: an attach is a write that carries the size the viewer wants, so panes cannot share one, and what the wall saves is the dial rather than the attach. Whose size wins is [below](#the-live-pane).

Which padi it dials is `$PADI_SOCKET` where that is set, and otherwise the rendezvous path kolu derives from its state root — so the two of them find each other with nothing written down. Both are on this machine, which makes the machine the thing worth naming: olai already titles itself after its host (`olai [machine]` — [running.md](running.md)), so the fleet on the page is that host's kolu, and two boxes are two tabs you can tell apart. There is no cross-machine fleet, and this page is not a step towards one.

Beside the connection pill in the header is the readout for the link, and it has three states rather than two:

- `● kolu` in the done green — a padi answered and the fleet is live;
- `● no kolu`, dim — nothing is answering, and the tip names **where olai looked**, because *looked where?* is the first thing anybody asks;
- `● kolu skew` in the alarm colour — a padi answered but this build cannot speak to it, and the tip names **both** versions.

The third is why the readout is not a boolean. *Start kolu* and *these two builds disagree* have opposite fixes, and a skew reported as absent would send a reader to start a kolu that is already running.

## The `terminal` property is a door

Give a node a `terminal` property whose value is a kolu terminal's id — the whole uuid, or the eight-character prefix a board usually writes — and the property draws **kolu's own Dock row**:

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

The watch is the SERVER's — one watcher, one ring of the last roughly two hundred events, and every browser is a reader of it. A quiet feed and a dead feed read alike from a distance, so the watcher also **pulses** — a heartbeat row every `heartbeat` — the line `the watcher is alive` proving the silence is peace, not a hang. A padi link flapping under olai fires nothing: a fleet emptied because the socket went is a fleet PAUSED, not a closing one — the holds keep their own clocks through it, and a `since` survives a reconnect the way padi's own daemon runs it.

Where a terminal asks is the only thing a held state cannot tell: you WANT it to ask somewhere. **Mute the fleet one at a time** in `_olai/Kolu.olai`, the same file the watch reads its cadence from:

```
{"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"60s"}}
{"id":"mutes","ord":"a1","title":"mutes"}
{"id":"one","parent":"mutes","ord":"a0","title":"a side shell nobody watches","custom":{"terminal":"5c5824d5"}}
```

The file is normal outline records. The watch node carries the knobs — `held-for` (the pause that holds a terminal's state out of the feed), `nag` (how often an unanswered one is said again) and `heartbeat` — written as `<n>s`, `<n>m` or `<n>h`; an absent value defaults, and a malformed one defaults **and is said on the server's console at warning level**, so a typing mistake is never silent. The grammar is padi's own: `held-for` may be `0` — the report the INSTANT a state lands, which padi's watch flags also allow — but the other two never are, because a nag every 0 ms is the spin padi's own schema refuses, and both cap at the ~24.8-day timer bound. The mutes are children of a `mutes` node holding one `terminal` property each — full id or a unique prefix of one. Edits land live: the watch reads its knobs on every vault revision, so the file a person is *editing* is the file a person is **already being watched by**.

An ambiguous prefix — one that names two open terminals — silences neither, and says so: write more of the id.

The file is yours, not installed: without it the watch runs its defaults (sixty seconds, ten minutes, half an hour).

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

The older half of the integration, and a separate one: where this host runs kolu, the [chat](chat.md#kolu) panel's agent is handed `kolu mcp`, so the agent can drive terminals rather than only look at them. It is probed rather than assumed — a `kolu` on a PATH is not always the one this host is running — and a server that would not attach says so on screen with the reason, under the roster line:

```
olai ✓  kolu ✓  · plus the agent's own
```

The two halves share a host and a daemon and nothing else: one is a standing subscription to a fleet, the other a spawn-time probe for a tool server. [chat.md](chat.md#kolu) has that one in full.
