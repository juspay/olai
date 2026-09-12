# CI on the board

[odu](https://github.com/juspay/odu) runs a repository's checks. A lane row names the run it is on by odu's run id, the way it names its terminal by `kolu-terminal`. olai is a client of odu's per-user service at `ODU_WEB_ORIGIN` (default `http://127.0.0.1:18440`), keyed by those ids. Where a run ran is the service's fact, not the board's.

**The board face is read-only; the verbs live in the conversation.** The chip and the matrix launch nothing, cancel nothing, rerun nothing and write nothing to the board. Verbs exist — odu's own, handed to chat conversations as odu's own MCP face — and a run can ring a conversation you scoped to it.

This is one of olai's **live properties** — a property whose value is a name the board decided on, and whose face goes and finds out what that name currently is ([live-properties.md](../live-properties.md)).

## The chip

Give a lane an `odu-run` property (or your own column, declared). Each value gets its own chip:

```
agent  claude-opus    brief  briefs/live-properties.md    run  m1kb0e11-2c8d    ci · e2e 2:10 · 8/10 ok
```

Live it ticks; settled it wears the verdict word in odu's own three (`passed`, `failed`, `incomplete`). `owner lost` is a state, drawn as itself. A value the service does not know reads `unknown run` in words, and the doorbell is silent about it.

Hover it for the run id and the checkout the service reports.

## The run matrix

Press the chip and the matrix opens on the frame, one row per node, with the attempt number beside a rerun node. Nothing in the matrix is a button.

## The header

The chrome carries the same three-state readout kolu has: **odu** while the service is speaking, **no odu** naming the origin and the fix (`odu web --background`), and **odu skew** naming both versions. Olai never starts the service. Absence is ordinary, said in words, never drawn as a quiet board.

A run that finished while olai was not running still draws its verdict: the catalog remembers it.

## What turns it on

The lane carries an `odu-run` — and on an enabled odu that is the whole of it:

```jsonl
{"id":"lane","ord":"a0","title":"the seam","custom":{"odu-run":"m1kb0e11-2c8d"}}
```

`odu-run` is a **kind** this plugin contributes. The value is a run id exactly as a receipt spelled it: a lowercase alphanumeric pair joined by one hyphen. Want the short key? One row in `_olai/Properties.olai` says which of *your* columns is this kind. Declaring `odu-run` as `text` takes the chip away.

The orchestrator replaces the row's `odu-run` with each new run's id after an accepted `run_start` or a relaunched `run_retry`.

## What it costs

One websocket to the service. The board subscription is filtered to the boarded ids (`runs.get` per id, not the whole catalog). A boarded run holds one `streams.nodes` subscription until its frame says `done`, including a run first seen already settled, so the matrix has cells. Nothing polls a filesystem.

## The CI doorbell

A chat conversation can be **scoped to one outline file**, and then olai rings it when a run that file's un-done rows name does something somebody should hear about. The claimed set is the `odu-run` values on those rows, mirrors followed, subtrees descended, first writer wins. The join is run id to run id. There is no fallback. `done` and `cancelled` both end the claim.

Two wakes:

- **First-red.** Once per subscription, on the first frame carrying a red node. A live run first seen already red rings. A settled run first seen red does not.
- **Settle.** Once per settlement observed by this subscription, when the run leaves the live states (`provisioning` / `running`). A run that never passes through `running` still rings. A run first seen already settled rings nothing — a settle is a past event, and with a catalog behind the board an olai restart would otherwise ring every finished run on every lane. What a restart misses as a wake is on the chip.

Failed recipes in a settle name their `logKey` and the command that reads it (`odu logs --run <id> <node>`). Coalescing keys on kind and run id.

A boarded id the service does not know sends nothing to chat.

**Silence is no message at all.** A run no scoped file claims rings nobody, and olai does not report what it decided not to ring about. A run the board dropped mid-flight rings nothing either — not even the settle.

**What arrives obeys the fleet doorbell's own discipline**, because a person may receive either: the message names itself and its stamp; the panel draws one line and the whole account is a press away; the claiming row's id is in the **head** and is **pressable**; events that pile up while a turn runs are held to the boundary and arrive whole, coalesced **per kind per run**. The *claim* is re-read when the words go in (a lane finished while its wake queued is a wake nobody owes).

**There is no heartbeat, by construction.** odu's watch is not a beat over absences — a boarded id with no catalog row is ordinary unknown, not evidence of life — so there is no timer saying *still here*. What underwrites the quiet: the two **fault messages** (`gone` / `unwatchable` — the file was renamed, moved or deleted; or it is served but holds no rows a claim can be read from — said once each, in this doorbell's own words, through [the seam core owns](../chat.md#what-this-conversation-wakes-on)), and the picker's `clear`, which stops everything.

A service upgrade that drops the websocket clears the chips for the redial gap rather than lingering as a last reading. A reconnect is a new first sight.

## The chat panel's odu

Every new conversation is handed `odu mcp` — odu's own agent face. The agent then holds `run_start`, `run_retry`, `run_cancel`, `run_wait`, `venue_hold`/`venue_release` and odu's own tools. A run is addressed globally by `runId`. `odu mcp` bootstraps the service on first contact, so a conversation holding odu's tools has already brought it up.
