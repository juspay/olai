# Kolu integration

[Kolu](https://kolu.dev) runs terminals for coding agents. Where this machine runs one, a row that names a terminal shows how that work is going, opens the terminal live, and can wake a conversation when a terminal stops and waits for a person. There is nothing to configure.

## What it talks to

One olai per directory, one padi per machine, one connection between them. The server holds that connection and every tab is a subscriber to it, so twelve tabs watching one terminal cost one dial.

| Environment variable | What it says |
| --- | --- |
| `PADI_SOCKET` | The padi daemon socket. Unset, olai uses the rendezvous path kolu derives from its state root. |

Both processes are on this machine, so the fleet on the page is this host's kolu. There is no cross-machine fleet. A machine with no kolu is the ordinary case, not a fault: olai says so in words and carries on.

## What the header readout says

One row of the header's health-dot popover is this link's readout.

| Row | What it means |
| --- | --- |
| `kolu` | A padi answered and the fleet is live. The tip says when the watcher last checked in. |
| `kolu · No check-in for 47m` | The mirror is connected and the watch has gone quiet. The health dot turns amber. |
| `No kolu` | Nothing is answering. The tip names where olai looked. |
| `kolu: update needed` | A padi answered that this build cannot speak to. The tip names both versions. |

The quiet reading starts once a check-in is older than twice the `heartbeat` setting below. A skew turns the health dot red; no padi at all leaves it alone. Starting kolu and reconciling two builds are different fixes, which is why the readout has four faces rather than two.

## Name a terminal on a row

Give a row a `kolu-terminal` property whose value is a kolu terminal's id, either the whole `uuid` or the eight-character prefix a board usually writes:

```jsonl
{"id":"step","ord":"a0","title":"implement","custom":{"kolu-terminal":"303dc985"}}
```

`kolu-terminal` is a kind this plugin contributes, and an enabled kolu claims the key of the same name, so nothing needs declaring and olai never writes to your files. The name carries `kolu-` on purpose: a column you call `terminal` stays yours.

To keep terminal ids under a column of your own name, say which column is this kind with one row in `_olai/Properties.olai`, and your declaration wins:

```jsonl
{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"kolu-terminal"}}
```

A column called `pty` works the same way, and declaring `kolu-terminal` as `text` takes the face away, because you have said what that column means. What decides is always the declaration, never the key's spelling. This is one of olai's [live properties](../live-properties.md): the value is a name, and the face goes and finds out what that name stands for now.

With a value in place the property draws kolu's own Dock row, the same component kolu draws. The pip, the status words, the annotation line, the recency, the repository stripe and the pull-request badge mean here exactly what they mean in kolu. The raw id stays on screen beside the row: the line on top is olai's record of which terminal this row names, and the row beneath is kolu's reading of it.

## The live pane

Press the row and a pane opens beneath it, on the terminal itself. Press it again to close.

It is a window rather than a photograph: it attaches to the terminal and follows the tail, and it says so twice, with a solid border and a `● live` tag. It wears the terminal's own theme and font, taken from the theme that terminal was created with.

The pane is read-only. You watch here and you type in kolu, because a keyboard here would be a second hand on a terminal an agent is working in.

Attaching is a write on a shared pty, and every kolu client sees the same size, so opening a pane sets the terminal's grid and another client attaching later moves it for both of you. The pane then takes the new size from padi's next frame rather than asserting its own back.

Closing drops the attach and disposes the emulator with it. Twelve lanes on a page are twelve rows and no attached terminals until somebody presses one, and closing forty panes leaves nothing running.

## Recent activity

Press the `kolu` readout and a panel opens: what recently wanted attention, as a log. olai watches the fleet it already holds and says when a terminal has been sitting in a state only a person can carry. Those states are `awaiting` your answer and `waiting` on input, each reported once it has been held past the moment it is worth saying so.

Every row is a frozen draw of the moment the event fired: which pip it wore, which label it had, and how long it had already been held. A terminal that found its answer ten minutes ago still shows the ask it was.

A re-telling carries its own count, read off the event as padi counted it, such as `still waiting for input for 38m — reminder 2 of 3`, and `… of 3, the last` on the one after which that terminal goes quiet until its state moves. The count survives an olai restart, because the daemon keeps it.

The watch is the server's: one watcher, one ring of the last two hundred or so events, and every browser reads it. The ring is attention only, with no heartbeats on it. Liveness lives on the header readout instead.

The feed draws the whole fleet for every reader of the page, and it has no silence control. The wake filter below decides which terminals wake one conversation and says nothing about this panel.

## Pacing the watch

The watch's knobs live on a `watch` child of the top-level `kolu` node in `_olai/Settings.olai`, in the grammar a `kolu watch` hand already types:

```jsonl
{"id":"kolu","ord":"a0","title":"kolu"}
{"id":"watch","parent":"kolu","ord":"a0","title":"watch","custom":{"held-for":"60s","nag":"10m/4","heartbeat":"30m"}}
```

| Setting | Default | What it does |
| --- | --- | --- |
| `held-for` | `60s` | How long a terminal waits in one state before it is reported. Zero is a legal instant report. |
| `nag` | `10m` | Time between reminders, optionally capped with `/count`. |
| `heartbeat` | `30m` | How long a quiet watch still counts as healthy, and the floor under the doorbell's silence. |

Units are `ms`, `s`, `m`, `h` and `d`, and an absent value takes its default. The file is yours rather than installed: without it the watch runs the three defaults above.

A count after the slash is the only count that can be spelled. `10m` repeats every ten minutes while the hold stands. `10m/4` says its piece four times past the first report, then goes quiet about that terminal until its state moves, and the daemon keeps that cap, so restarting the server does not restart it.

The feed's wrench opens kolu's controls in the plugins panel, with the watch's fields in the row's detail, descriptions in tips and a mark beside values set in the file. `Enter` or leaving the field writes a valid duration such as `90s`, and `Escape` reverts the draft. A bare number is refused before writing, with its message beside the input. The reset control removes the property.

The live watch follows the accepted revision. A knob edit makes padi re-report the standing set at once as a fresh first report, so the cap counts again.

The wrench works before a settings file exists: the first edit creates the `kolu` node and its `watch` child. A broken file opens frozen controls with the repair reason in their tips. **Saved in** opens the node for editing the outline by hand. With the plugin inspector switched off the wrench goes and the feed keeps working.

## Wake a conversation on the fleet

A conversation's strip carries `wake on terminal activity`, a picker over your outlines, and `Clear`. Scope a conversation to one outline file and olai rings it when a terminal that file claims stops and waits for a person. The picker offers outlines alone, because the claim lives on a row: it leaves out documents, the Trash, put-away files and olai's own `_olai` files.

Which terminals a scoped conversation hears about is exactly the `kolu-terminal` values on that file's un-done rows, with mirrors resolving to their targets. That makes a day board the natural filter, and a lane you finish stops ringing without anybody switching anything off. A second conversation may filter by a different file.

Un-done means unsettled: a `done` step and a `cancelled` step both end the wait, and either silences the node and everything under it. The value is read by the declared kind rather than by a key's spelling. A value that is a prefix of two live terminals claims neither.

A row nobody marked is judged by what is under it. A plain row with nothing beneath it claims nothing; a row with a live step under it is a live lane and rings.

### Wake, digest or silence

Three outcomes follow from the claim, and none of them is configured:

- the claiming step is `doing`, so somebody is on that lane and it has stopped: a wake, which starts a turn if the agent is idle and queues behind what you typed if it is not;
- the claiming step is `todo`, so the lane is open and nobody is on it: a digest, whose head says the terminal went quiet and that nothing under it is being worked, closing `A note, not a call.`;
- nothing claims the terminal: silence, and olai does not report what it decided not to ring about.

The two meanings differ in their words alone. There is one delivery path, and a digest reaches the agent exactly as a wake does. What the meaning decides is the sentence and the key it coalesces under. One key per meaning means a burst under one meaning collapses to its newest body, and both arrive whole when a turn ends.

### What a wake says

The message arrives in the conversation with a face of its own, never in your composer, and it opens by naming itself as olai's. The panel draws one sentence, such as `The fdo-residuals author is idle on <row>: it has finished, or it needs you.`

The account behind that line carries the terminal, who it is, the state it is held at, the step that claims it and the file the set was read off. The claiming row's id is in backticks and is clickable, so a wake links back to the row you would edit to stop it. The agent is handed the whole body, because it needs the ids to act.

When a reminder rides the event, the body carries one more line naming the account and the terminal it is about, such as *This is reminder 2 of 3 for `11111111`.* On the last one it says that this doorbell goes quiet about that terminal until its state changes. The strip counts what is waiting, such as `3 fleet events waiting`.

## The floor under the silence

If a scoped conversation hears nothing for a whole `heartbeat` window, olai puts one message in it saying the watch is running, with the readings that make the claim checkable:

```
The kolu watcher is alive: 30 minutes with nothing to say about the 4 terminals lanes.olai claims.

— the filter file: lanes.olai.
— terminals it claims right now: 4.
— last watcher event: 2026-08-31 14:01 UTC, 31 minutes ago.
— watching since 2026-08-30 19:03 UTC, 19 hours 29 minutes so far.
```

Four facts rather than *still here*, because a timer that still fires proves the interval is armed and nothing else. A count of zero all afternoon on a board with four live lanes is a conversation scoped to the wrong file. Every reading is taken at the moment the message goes in.

It is a floor and not a metronome: any wake or digest resets the window, so a busy day produces no heartbeat and a quiet one produces one per window. It rides the same delivery path as everything else. A heartbeat only ever means that the watch is running and had nothing to say.

> A scope olai cannot watch is not beaten for at all. The strip says which of two faults it is, once: `This file is gone. Choose another.` when the file was renamed, moved or deleted, and `This file can't be watched. Choose another.` when it is not an outline. `Clear` stops everything.

## Why a terminal is not in the set

Set `log-level: debug` on the `olai` node in `_olai/Settings.olai` and the doorbell keeps an account of itself, one line per moment, each `kolu doorbell <moment> key=value …`, so one moment is one `grep`:

```
kolu doorbell derived file=orchestrator/lanes.olai claims=9 ringing=11e565c0@task-notification-spill unmatched=none excluded=7cf67c42@no-file-delete-op:settled fleet=11
kolu doorbell classified terminal=11e565c0 file=orchestrator/lanes.olai agent=olai session=s-1 meaning=wake why=none
```

The moments are `event`, `derived`, `scopes`, `classified`, `delivering`, `said`, `delivered` and `dropped`, with the beat's own `beat`, `beating`, `beat-passed`, `beat-said` and `beat-dropped`. The `derived` line names three populations as `value@node:why`: what rings, what was `unmatched`, and what the walk excluded.

| `why=` | What it means |
| --- | --- |
| `settled` | The claiming row is `done` or `cancelled`, so the wait ended for it and for everything under it. |
| `not-live` | The row is open, and every step under it has settled. |
| `unmarked-leaf` | The row carries a terminal, has no mark and has nothing under it. |
| `unmatched` | A live claim names it and the join refused: an ambiguous prefix, a shut terminal, or a second row copying a property the first row won. |
| `unclaimed` | Nothing this walk reached names it, which is usually the doorbell working. |

`unmarked-leaf` is the one to know about, because it is a silence you can hit by accident: a lane filed as a plain row with only its `kolu-terminal`, before its steps land, claims nothing. The fix is on the board: give it a step, or mark the row.

`unclaimed` is narrow on purpose. The walk stops at a `done` or `cancelled` row without descending, so a claim under a settled ancestor reads as `unclaimed` while the ancestor sits in the `excluded` list saying so. The debug channel is where this lives, because a doorbell narrating every event at the default level would dress the one line that matters as the ones you have learnt to skip.

## What an agent gets

Where this host runs kolu, every new conversation's agent is handed `kolu mcp`, so it can drive terminals rather than only watch them. It is probed rather than assumed, because a `kolu` on a `PATH` is not always the one this host is running, and the tool roster carries the result:

```
olai ✓  kolu ✓  · plus the agent's own
```

A server that will not attach says so on screen with its reason, under the roster line. With `PADI_SOCKET` set and no `kolu` executable on the server's `PATH`, the sentence says exactly that. The probe runs per conversation, so a kolu installed after the server started is picked up by the next one.

## When there is nothing to see

Absence is said in words rather than drawn as a quiet board, because *we cannot see* must never look like *we looked and it is quiet*:

- `This terminal was closed.`
- `3 terminals match. Type more of the id.`
- `kolu isn't running. Looked at …/padi-a1b2c3/padi.sock.`
- `kolu isn't running at …/padi-a1b2c3/padi.sock (from $PADI_SOCKET).`
- `kolu isn't set up.`
- `kolu and olai versions don't match (padi 99.0, olai 12.0). Update one of them.`

## Switching it off

Set `on: no` on the `kolu` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)); the choice survives a restart. The Dock rows, the live panes, the feed, the readout row, the wake control and `kolu mcp` leave with the row and return when it does.
