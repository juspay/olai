# CI on the board

[odu](https://github.com/juspay/odu) runs a repository's checks. Name an odu run on a row and the row wears a live chip of that run, opens a matrix of its nodes, and can wake a conversation when the run moves. olai reads; every verb is odu's.

## What has to be running

olai is a client of odu's per-user service and never starts it. Start it yourself with `odu web --background`. olai dials the origin `ODU_WEB_ORIGIN` names, by default `http://127.0.0.1:18440`, and keys everything on odu's run ids: where a run ran is the service's fact, not the board's.

A packaged olai carries odu's own binary and puts it first on the server's `PATH`, which is how an agent's `odu mcp` finds one.

| Environment variable | What it says |
| --- | --- |
| `ODU_WEB_ORIGIN` | The odu service origin this olai dials. Unset means `http://127.0.0.1:18440`. |
| `OLAI_ODU_BIN` | The directory placed first on `PATH` for odu. The packaged build sets it. |

## Name a run on a row

Give a row an `odu-run` property whose value is a run id exactly as a receipt spelled it: a lowercase alphanumeric pair joined by one hyphen. Each value gets its own chip.

```jsonl
{"id":"lane","ord":"a0","title":"the seam","custom":{"odu-run":"m1kb0e11-2c8d"}}
```

`odu-run` is a kind this plugin contributes, so it needs no declaration. To keep run ids under a column of your own name, say which column is this kind with one row in `_olai/Properties.olai`:

```jsonl
{"id":"prop-run","ord":"a0","title":"run","custom":{"type":"odu-run"}}
```

Your vault's declaration always wins, so declaring `odu-run` as `text` takes the chip away. The chip is one of olai's [live properties](../live-properties.md): the value is a name, and the face goes and finds out what that name stands for now.

An orchestrator agent replaces the row's `odu-run` with each new run's id after an accepted `run_start` or a relaunched `run_retry`.

## What the chip says

The chip reads `ci · <what> · <count>`, such as `ci · e2e 2:10 · 8/10 ok`. The count is how many nodes came out green over how many there are, and it is dropped while the run has no nodes. A running node under an hour reads `m:ss` and past it `2h 34m`.

| What the chip wears | When |
| --- | --- |
| a node's name and how long it has been going | a node is running |
| `provisioning` | the run is still claiming a machine |
| `passed`, `failed` or `incomplete` | the run has settled, in odu's own three words |
| `owner lost` | odu reports the run's owner lost |
| `unknown run` | the service does not know that id |

A run that finished while olai was not running still draws its verdict, because the service remembers it. Hover the chip for the run id and the checkout the service reports. Press it and the run matrix opens on the frame, one row per node, with the attempt number beside a rerun node. Nothing in the matrix is a button: the chip and the matrix launch nothing, cancel nothing and write nothing to your files.

## What the header readout means

One row of the header's health-dot popover is this link's readout. A refused build turns the health dot red; no odu at all leaves it alone.

| Row | What it means |
| --- | --- |
| `odu` | The service is speaking. The tip reads `Connected to <origin>`. |
| `No odu` | Nothing answered. The tip names the origin and `odu web --background`. |
| `odu: update needed` | A service answered and refused this build, in odu's own sentence. |

With no origin to name at all the tip reads `odu isn't set up`. olai reads one of odu's rows, the runs, and says so when it dials. A service whose other rows moved a major version is still an ordinary connected service.

## Wake a conversation when a run moves

A conversation's strip carries `wake on CI runs` and a picker over your outlines. Scope a conversation to one outline file and olai rings it about the runs that file's un-done rows name. The claimed set is the `odu-run` values on those rows, mirrors followed, subtrees descended, first writer wins. The join is run id to run id, with no fallback, and `done` or `cancelled` ends the claim.

Two wakes reach the conversation:

- First-red, once per subscription, on the first frame carrying a red node. A live run first seen already red rings; a settled run first seen red does not.
- Settle, once per settlement this subscription observes, when the run leaves `provisioning` or `running`. A run that never passes through `running` still rings. A run first seen already settled rings nothing, so a restart does not ring every finished run again. What a restart misses as a wake is on the chip.

A settle naming failed recipes carries each one's `logKey` and the command that reads it, `odu logs --run <id> <node>`. Messages coalesce per kind per run, so a burst that piles up while a turn runs arrives whole. The claiming row's id is in the message's head and is clickable, so a wake links back to the row it came from.

A run no scoped file claims rings nobody, and olai does not report what it decided not to ring about. A boarded id the service does not know sends nothing either, and a run the board drops mid-flight rings nothing, not even the settle.

There is no heartbeat here. Two fault sentences carry the silence instead, said once each on the strip: `This file is gone. Choose another.` when the file was renamed, moved or deleted, and `This file can't be watched. Choose another.` when it holds no rows a claim can be read from. `Clear` beside the picker stops everything.

## What an agent gets

Every new conversation on a host with odu is handed `odu mcp`, odu's own agent face, which bootstraps the service on first contact. A run is addressed globally by `runId`.

| Tool | What it takes |
| --- | --- |
| `run_start` | `checkout` |
| `run_retry` | `runId` |
| `run_cancel` | `runId` |
| `run_wait` | `runId` |
| `venue_hold` | `checkout` |
| `venue_release` | `checkout` |

odu's own further tools come with them. olai probes for `odu` on the server's `PATH` at each conversation, so an odu installed after the server started is picked up by the next one. A probe that finds nothing says so under the conversation's tool roster, naming the command and the build's promise to carry one.

## Switching it off

This plugin reads no settings of its own. Set `on: no` on the `odu` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)); the choice survives a restart. The chips, the matrix, the readout row, the wake control and `odu mcp` leave with the row and return when it does.

While it is on it costs one websocket to the service. The subscription is filtered to the boarded ids rather than the whole catalog, and a boarded run holds one node subscription until its frame says it is done. Nothing polls a filesystem.
