# Watching kolu terminals from olai

[Kolu](https://kolu.dev) runs terminals for coding agents. Name one on a row of an outline to watch it live, and to wake a conversation when that terminal stops.[^setup]

## Name a terminal on a row

Give a row, one line of an outline, a `kolu-terminal` property whose value is a terminal's id:[^kind][^id]

```jsonl
{"id":"step","ord":"a0","title":"implement","custom":{"kolu-terminal":"303dc985"}}
```

The row then shows kolu's own Dock line for that terminal.[^dock]

## Watch a terminal live

Click the row to open a pane under it showing the terminal; click again to close.[^pane] You can watch but not type: you type in kolu.[^size]

## See which terminals want attention

Click the health dot in olai's header: its popover has a `kolu` line, with four readings.[^readout] Click the `kolu` line and a panel lists terminals that recently wanted attention.[^feed] One watcher serves every browser tab.[^ring] Three settings decide how often it reports.[^watch]

## Wake a conversation when a terminal stops

A conversation carries `wake on terminal activity`, a picker of your outlines, and `Clear`.[^picker] Point a conversation at one outline file, and olai messages it when a terminal named on an unfinished row of that file[^undone] stops and waits for a person.[^claim] What arrives depends on the row's mark:

| The row naming the terminal | What the conversation gets |
| --- | --- |
| marked **Doing** | a message that starts a reply if the agent is idle, or waits its turn if it is busy |
| marked **To do** | a note saying the terminal stopped and nobody is working under that row |
| no row names the terminal | nothing |

If a `heartbeat` window passes with nothing to report, the conversation gets a message saying the watch still runs.[^beat]

## Switching it off

Set `on: no` on the `kolu` node in `_olai/Settings.olai`, or use its switch on the **Plugins** panel ([settings](../settings.md)).[^off]

[^setup]: There is nothing to set up. One olai per directory, one kolu daemon (called padi) per machine, and one connection between them: the olai server holds that connection and every browser tab reads from it, so twelve tabs watching one terminal still cost one connection.

    Both programs run on this machine, so the terminals you see are this machine's; there is no way to watch another machine's. A machine with no kolu on it is the ordinary case rather than a fault: olai says so in words and carries on.

[^kind]: `kolu-terminal` is a property kind this plugin adds, and while kolu is switched on it claims the property key of the same name, so you declare nothing and olai never writes to your files. The name starts with `kolu-` on purpose, so that a column you call `terminal` stays yours.

    It is one of olai's [live properties](../live-properties.md): you write a name, and olai goes and finds out what that name stands for at the moment you look. The closed block below shows how to keep terminal ids under a column name of your own.

[^id]: The id you write is either a terminal's whole `uuid` or the eight-character prefix a board usually writes.

[^dock]: The Dock line is the same piece of screen kolu itself draws. The coloured dot, the status words, the annotation line, how long ago it was active, the repository stripe and the pull-request badge all mean what they mean in kolu.

    The id you typed stays on screen above it: the top line is olai's record of which terminal this row names, and the line under it is kolu's report on that terminal.

[^pane]: The pane is live rather than a snapshot: it attaches to the terminal and follows new output, and it says so twice, with a solid border and a `● live` tag. It uses the terminal's own colours and font, taken from the theme that terminal was created with. Twelve rows on a page are twelve rows and no attached terminals until you click one.

[^size]: Typing is not offered in the pane, because an agent is already working in that terminal. Attaching also changes things for others: every kolu client sees the same terminal size, so opening a pane sets the terminal's width and height, and another client attaching later changes it for both of you.

    The pane then takes the new size from the next frame kolu sends rather than insisting on its own. Closing the pane drops the attachment and throws the terminal emulator away with it, so closing forty panes leaves nothing running.

[^readout]: The `kolu` line has four readings rather than two, because starting kolu and matching up two mismatched versions are different repairs. The quiet reading starts once the watcher's last check-in is older than twice the `heartbeat` setting. A version mismatch turns the health dot red; no kolu at all leaves the dot alone.

[^feed]: olai watches the terminals it already has a connection to. The panel names terminals that have been sitting in a state only a person can move on from: `awaiting` your answer, and `waiting` for input, each reported once it has sat there long enough to be worth saying.

    Every line in the panel is frozen at the moment the event happened: which coloured dot the terminal wore, what its label said, and how long it had been waiting. A terminal that got its answer ten minutes ago still appears as the question it was then.

[^ring]: The watcher belongs to the olai server: one watcher, one buffer of roughly the last two hundred events, and every browser reads the same buffer. The buffer holds attention events only, with no check-ins in it; whether kolu is alive is what the header line says instead.

    The panel shows every terminal on the machine, to every reader of the page, and has no setting for quietening it. Which terminals wake a conversation is decided separately, and says nothing about this panel.

[^watch]: A repeat report carries its own count, taken from the event as kolu counted it, such as `still waiting for input for 38m — reminder 2 of 3`, and `… of 3, the last` on the final one, after which that terminal stays quiet until its state changes. The count survives an olai restart, because the kolu daemon keeps it. The closed block below holds the three settings, where they are written, and the panel that edits them.

[^picker]: The picker offers outlines only, because a terminal is named on a row: it leaves out documents, the Trash, put-away files and olai's own `_olai` files.

    If olai cannot watch the file you picked, it watches nothing and the strip says which of two faults it is, once: `This file is gone. Choose another.` when the file was renamed, moved or deleted, and `This file can't be watched. Choose another.` when it is not an outline. `Clear` stops everything.

[^undone]: Unfinished means still open. A row marked **Done** and a row marked **Cancelled** both end the wait, and either one silences that row and every row under it. olai reads the value by the property kind rather than by how the key is spelled. A value that is the start of two live terminals' ids matches neither.

    A row with no mark is judged by what is under it. A plain row with nothing beneath it names no terminal olai reports on, and a row with an unfinished step under it is live work and does get reported.

[^claim]: The terminals a conversation hears about are exactly the `kolu-terminal` values on the unfinished rows of the file you picked, with a mirror, a row that stands in for another, counting as the row it points at. That makes a day's board the natural filter: finish a row and it stops reporting, without switching anything off. A second conversation can watch a different file.

[^beat]: The heartbeat is a longest-silence rule rather than a regular tick: any other message resets the window, so a busy day produces no heartbeat and a quiet one produces one per window. It arrives the same way every other message does, and it only ever means that the watch is running and had nothing to say. Its exact wording, and the four facts in it, are in the closed block below.

[^off]: The choice survives a restart. Switching kolu off takes away the Dock lines, the live panes, the attention panel, the header line, the wake control and the `kolu mcp` tools an agent gets, and switching it on brings them back.

<details>
<summary>What the header line says</summary>

| Line | What it means |
| --- | --- |
| `kolu` | kolu answered, and its terminals are live. The tip says when the watcher last checked in. |
| `kolu · No check-in for 47m` | kolu is connected and the watch has gone quiet. The health dot turns amber. |
| `No kolu` | Nothing answered. The tip names where olai looked. |
| `kolu: update needed` | A kolu answered that this build of olai cannot talk to. The tip names both versions. |

</details>

<details>
<summary>Keep terminal ids under a column of your own name</summary>

Say which column holds terminal ids with one row in `_olai/Properties.olai`, and what you say wins:

```jsonl
{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"kolu-terminal"}}
```

A column called `pty` works the same way, and declaring `kolu-terminal` as `text` takes the live Dock line away, because you have said what that column means. The declaration always decides, never the spelling of the key.

</details>

<details>
<summary>Pacing the watch</summary>

The watch's settings live on a `watch` child of the top-level `kolu` node in `_olai/Settings.olai`, written the way a `kolu watch` command already writes them:

```jsonl
{"id":"kolu","ord":"a0","title":"kolu"}
{"id":"watch","parent":"kolu","ord":"a0","title":"watch","custom":{"held-for":"60s","nag":"10m/4","heartbeat":"30m"}}
```

| Setting | Default | What it does |
| --- | --- | --- |
| `held-for` | `60s` | How long a terminal sits in one state before it is reported. Zero is allowed, and reports at once. |
| `nag` | `10m` | Time between repeat reports, optionally capped with `/count`. |
| `heartbeat` | `30m` | How long a quiet watch still counts as healthy, and the shortest gap between heartbeat messages. |

Units are `ms`, `s`, `m`, `h` and `d`, and a setting you leave out takes its default. The file is yours to write rather than something olai installs: without it the watch runs the three defaults above.

The count after the slash is the only count you can set. `10m` repeats every ten minutes for as long as the terminal sits there. `10m/4` repeats four times after the first report, then stays quiet about that terminal until its state changes, and the kolu daemon keeps that count, so restarting the olai server does not restart it.

The wrench on the attention panel opens kolu's controls in the plugins panel, with the watch's fields in the row's detail, a description in each tip, and a mark beside any value set in the file. `Enter`, or clicking away from the field, writes a valid duration such as `90s`, and `Escape` throws the edit away. A bare number is refused before anything is written, with the reason beside the input. The reset control removes the setting.

The running watch follows the last accepted version of the file. Changing a setting makes kolu report the terminals it is already holding again, as fresh first reports, so any cap starts counting again.

The wrench works before a settings file exists: the first edit creates the `kolu` node and its `watch` child. A file olai cannot read opens the controls frozen, with the reason in their tips. **Saved in** opens the node so you can edit the outline by hand. With the plugin inspector switched off the wrench goes away and the panel keeps working.

</details>

<details>
<summary>What each message to a conversation says</summary>

A terminal named on a row marked **Doing** means somebody is on that work and it has stopped. A row marked **To do** means the work is open and nobody is on it. When no row names the terminal, nothing is sent, and olai does not report what it decided not to send.

The two meanings differ only in their words. There is one delivery path, and both reach the agent the same way. What the meaning decides is the sentence, and which key the message is grouped under. One key per meaning means a burst of messages with the same meaning collapses into the newest one, and a message of each meaning arrives whole when a reply ends.

The **To do** message opens by saying the terminal went quiet and that nobody is working under that row, and closes `A note, not a call.`

The message arrives in the conversation with a look of its own, never in the box you type in, and it opens by saying it comes from olai. The panel draws one sentence, such as `The fdo-residuals author is idle on <row>: it has finished, or it needs you.`

Behind that sentence sit the terminal, who it is, the state it is held in, the row that names it and the file the terminals were read from. The row's id is in backticks and is clickable, so the message links back to the row you would edit to stop it. The agent is handed the whole body, because it needs the ids to act.

When a repeat report rides along, the body carries one more line naming the terminal it is about, such as *This is reminder 2 of 3 for `11111111`.* On the last one it says that olai will stay quiet about that terminal until its state changes. The strip counts what is waiting, such as `3 fleet events waiting`.

A heartbeat reads:

```
The kolu watcher is alive: 30 minutes with nothing to say about the 4 terminals lanes.olai claims.

— the filter file: lanes.olai.
— terminals it claims right now: 4.
— last watcher event: 2026-08-31 14:01 UTC, 31 minutes ago.
— watching since 2026-08-30 19:03 UTC, 19 hours 29 minutes so far.
```

It carries four facts rather than *still here*, because a timer that still fires proves only that the timer is set. A count of zero all afternoon, on a board with four terminals being worked in, means the conversation is watching the wrong file. Every figure is read at the moment the message is sent.

</details>

<details>
<summary>Why a terminal is not reported</summary>

Set `log-level: debug` on the `olai` node in `_olai/Settings.olai` and olai writes down every step it took, one line per step, each starting `kolu doorbell <step> key=value …`, so one step is one `grep`:

```
kolu doorbell derived file=orchestrator/lanes.olai claims=9 ringing=11e565c0@task-notification-spill unmatched=none excluded=7cf67c42@no-file-delete-op:settled fleet=11
kolu doorbell classified terminal=11e565c0 file=orchestrator/lanes.olai agent=olai session=s-1 meaning=wake why=none
```

The steps are `event`, `derived`, `scopes`, `classified`, `delivering`, `said`, `delivered` and `dropped`, with the heartbeat's own `beat`, `beating`, `beat-passed`, `beat-said` and `beat-dropped`. The `derived` line names three groups as `value@node:why`: what is being reported, what was `unmatched`, and what the walk over the rows left out.

| `why=` | What it means |
| --- | --- |
| `settled` | The row naming it is marked **Done** or **Cancelled**, so the wait ended for it and for every row under it. |
| `not-live` | The row is open, and every step under it is finished. |
| `unmarked-leaf` | The row names a terminal, has no mark and has nothing under it. |
| `unmatched` | An open row names it and the match failed: an id that is the start of two terminals' ids, a terminal that has closed, or a second row copying a property the first row won. |
| `unclaimed` | No row this walk reached names it, which is usually everything working correctly. |

`unmarked-leaf` is the one to know about, because it is a silence you can cause by accident: a row filed with only its `kolu-terminal` property, before any steps are written under it, names nothing olai reports on. The fix is on the board: give it a step, or mark the row.

`unclaimed` is narrow on purpose. The walk stops at a row marked **Done** or **Cancelled** and does not go further down, so a terminal named under a finished row reads as `unclaimed`, while that finished row sits in the `excluded` list saying so. This lives on the debug channel, because narrating every event at the ordinary level would make the one line that matters look like the ones you have learnt to skip.

</details>

<details>
<summary>What an agent gets, and what olai says when kolu is absent</summary>

Where this machine runs kolu, every new conversation's agent is given `kolu mcp`, so it can drive terminals rather than only watch them. The check is real rather than assumed, because a `kolu` on a `PATH` is not always the one this machine is running. The list of tools carries the result:

```
olai ✓  kolu ✓  · plus the agent's own
```

A server that will not connect says so on screen, with its reason, under that list. With `PADI_SOCKET` set and no `kolu` program on the server's `PATH`, the sentence says exactly that. The check runs once per conversation, so a kolu installed after the server started is picked up by the next conversation.

| Environment variable | What it says |
| --- | --- |
| `PADI_SOCKET` | Where the kolu daemon listens. Unset, olai uses the path kolu works out from its own state directory. |

olai says absence in words rather than drawing an empty board, because *we cannot see* must never look like *we looked and it is quiet*:

- `This terminal was closed.`
- `3 terminals match. Type more of the id.`
- `kolu isn't running. Looked at …/padi-a1b2c3/padi.sock.`
- `kolu isn't running at …/padi-a1b2c3/padi.sock (from $PADI_SOCKET).`
- `kolu isn't set up.`
- `kolu and olai versions don't match (padi 99.0, olai 12.0). Update one of them.`

</details>
