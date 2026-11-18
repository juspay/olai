# odu: CI runs shown on your rows

[odu](https://github.com/juspay/odu) runs a repository's checks. Name one of its runs on a row and the row shows a chip with the run's progress.

A row is one line of an outline. olai only reads odu; every action is odu's.

## What has to be running

Start odu's service yourself with `odu web --background`; olai never starts it.[^origin] A packaged olai carries odu's own binary and puts it first on the server's `PATH`.[^bin]

## Name a run on a row

Give the row a property called `odu-run`, holding a run id exactly as odu's receipt spelled it.[^id] Each value gets a chip.

```jsonl
{"id":"lane","ord":"a0","title":"the seam","custom":{"odu-run":"m1kb0e11-2c8d"}}
```

`odu-run` is a kind this plugin contributes and needs no declaration.[^kind] The chip is one of olai's [live properties](../live-properties.md): you store a name, and olai asks odu what it means now.[^orch]

## What the chip says

The chip reads `ci · <what> · <count>`, such as `ci · e2e 2:10 · 8/10 ok`.[^count] Click it for the run matrix, one line per node;[^matrix] point at it for the run id and the checkout odu reports.[^verdict]

## Wake a conversation when a run moves

A conversation is one chat with one agent. Its strip, the line above the messages, carries `wake on CI runs` and a picker over your outlines. Point a conversation at one outline file and olai wakes it about the runs named on that file's unfinished rows.[^claim]

Two things wake it: the first failure[^red] and the run settling.[^settle] A wake about failed recipes carries the command that reads the logs.[^messages] A run no chosen file names wakes nobody.[^silent] `Clear` beside the picker stops all of it.[^faults]

## What an agent gets

Every new conversation on a machine with odu is handed `odu mcp`, odu's own tools for agents.[^probe] Runs are addressed by `runId`.

[^origin]: odu's service runs for one user, and olai is only a client of it. olai connects to the address `ODU_WEB_ORIGIN` names, which is `http://127.0.0.1:18440` when it is not set. Everything is keyed on odu's run ids: where a run ran is odu's business, not olai's.

[^bin]: `OLAI_ODU_BIN` names the directory put first on `PATH` when olai looks for odu, and the packaged build sets it. That is how an agent's `odu mcp` finds a copy.

[^id]: A property is a key and a value on a row. A run id is two groups of lowercase letters and digits joined by one hyphen.

[^kind]: To keep run ids in a column you name yourself, say which column holds this kind of property with one row in `_olai/Properties.olai`, as in the closed block at the foot of this page. A declaration in your own directory always wins, so declaring `odu-run` as `text` takes the chip away.

[^orch]: An agent that starts runs for you replaces the row's `odu-run` value with the new run's id after a `run_start` odu accepted or a `run_retry` it relaunched.

[^count]: The count is how many nodes finished green out of how many nodes there are, and it is left out while the run has no nodes. A node that has been running for less than an hour reads `m:ss`, and a longer one reads `2h 34m`. What the chip shows in each state is in the closed block at the foot of this page.

[^matrix]: A node is odu's own word for one part of a run. The matrix opens in a pane under the row, with the attempt number beside a node that was rerun. Nothing in it is a button: the chip and the matrix start nothing, cancel nothing, and write nothing to your files.

[^verdict]: A run that finished while olai was not running still shows its result, because odu remembers it.

[^claim]: The runs a conversation hears about are the `odu-run` values on the rows of that file which are not done, with mirrors followed to the row they point at, and with rows below a row included. A mirror is a row that shows another row. If two rows name the same run, the first one wins. A run is matched by its id alone, with no fallback, and a row marked `done` or `cancelled` stops naming its run.

[^red]: The first-failure wake happens once for each conversation watching, on the first update that carries a failed node. A run that is still going and is already failed when olai first sees it wakes the conversation; a run that had already finished failed does not.

[^settle]: The settle wake happens once for each settling this conversation sees, when the run leaves `provisioning` or `running`. A run that never passes through `running` still wakes it. A run that had already settled when olai first saw it wakes nothing, so a restart does not wake you about every finished run again. Anything a restart misses as a wake is still on the chip.

[^messages]: A settle message that names failed recipes carries each failed recipe's `logKey` and the command that reads it, `odu logs --run <id> <node>`. Messages of the same kind about the same run are combined, so a burst that piles up while the agent is working arrives as one message. The id of the row that named the run is at the top of the message and is clickable, so a wake links back to the row it came from.

[^silent]: olai does not tell you what it decided not to wake you about. A run id olai cannot match to anything odu knows sends nothing either, and a run that leaves your file while it is still going wakes nothing, not even the settle.

[^faults]: Nothing here sends a heartbeat. Two sentences explain the silence instead, each said once on the strip: `This file is gone. Choose another.` when the file was renamed, moved or deleted, and `This file can't be watched. Choose another.` when it holds no rows a run id can be read from.

[^probe]: `odu mcp` starts odu's service the first time an agent uses it. olai looks for `odu` on the server's `PATH` each time a conversation starts, so an odu installed after the server started is found by the next conversation. A search that finds nothing says so under the conversation's list of tools, naming the command and the build's promise to carry one.

<details>
<summary>The two environment variables, and a column of your own</summary>

| Environment variable | What it says |
| --- | --- |
| `ODU_WEB_ORIGIN` | The odu service origin this olai dials. Unset means `http://127.0.0.1:18440`. |
| `OLAI_ODU_BIN` | The directory placed first on `PATH` for odu. The packaged build sets it. |

```jsonl
{"id":"prop-run","ord":"a0","title":"run","custom":{"type":"odu-run"}}
```

</details>

<details>
<summary>What the chip shows, and what the header readout means</summary>

| What the chip shows | When |
| --- | --- |
| a node's name and how long it has been going | a node is running |
| `provisioning` | the run is still claiming a machine |
| `passed`, `failed` or `incomplete` | the run has settled, in odu's own three words |
| `owner lost` | odu reports the run's owner lost |
| `unknown run` | odu does not know that id |

One row of the popover on the header's health dot is this plugin's readout. A build odu refuses turns the health dot red; no odu at all leaves it alone.

| Row | What it means |
| --- | --- |
| `odu` | The service is answering. The tip reads `Connected to <origin>`. |
| `No odu` | Nothing answered. The tip names the origin and `odu web --background`. |
| `odu: update needed` | A service answered and refused this build, in odu's own sentence. |

With no origin to name at all, the tip reads `odu isn't set up`. olai reads one kind of thing from odu, its runs, and says so when it connects. A service whose other parts have moved to a new major version is still an ordinary connected service.

</details>

<details>
<summary>The tools <code>odu mcp</code> brings, and switching the plugin off</summary>

| Tool | What it takes |
| --- | --- |
| `run_start` | `checkout` |
| `run_retry` | `runId` |
| `run_cancel` | `runId` |
| `run_wait` | `runId` |
| `venue_hold` | `checkout` |
| `venue_release` | `checkout` |

odu's own further tools come with them.

This plugin reads no settings of its own. Set `on: no` on the `odu` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)); the choice survives a restart. The chips, the matrix, the readout row, the wake control and `odu mcp` go away with the plugin and come back when it does.

While it is on, it costs one websocket to the service. The subscription asks about the run ids on your rows rather than the whole catalogue, and a named run holds one node subscription until its update says it is done. Nothing polls a filesystem.

</details>
