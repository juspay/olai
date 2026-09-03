# CI on the board

[odu](https://github.com/juspay/odu) runs a repository's checks. If a lane's worktree has a run going in it, olai shows you — so a node that records *where* some work is happening also shows you how its CI is *going*, and lets you read the whole matrix without leaving the page. Nothing to configure and nothing for odu to publish: olai looks in the worktrees your own board already names.

**The board face is read-only; the verbs live in the conversation.** The chip and the matrix launch nothing, cancel nothing, rerun nothing and write nothing to the board — a readout that quietly grew a verb is the one thing the board half of this integration must not do. Verbs exist — odu's own, handed to chat conversations as odu's own MCP face, never grown here — and a run can ring a conversation you scoped to it; both are below ([the CI doorbell](#the-ci-doorbell), [the chat panel's odu](#the-chat-panels-odu)). Merge gates reading a verdict stay with the branch protection that already exists; that is a later lane and not one this page covers.

This is one of olai's **live properties** — a property whose value is a name the board decided on, and whose face goes and finds out what that name currently is ([live-properties.md](../live-properties.md), which is the seam itself and names its other tenant, [kolu](kolu.md)). Nothing on this page is special to odu except the clothes, and the clothes are the one thing worth reading twice: a terminal OWNS ITS ROW, and a checkout does not. A checkout is a path on a lane row, quiet by default, and its CI face is a **chip beside the value** that appears only while there is something to say. A board with no CI running looks exactly as it did.

## The chip

Give a lane an `odu-worktree` property (or your own column, declared — see [below](#what-turns-it-on)). While a run is going in that checkout, the property's line gains a chip:

```
agent  claude-opus    brief  briefs/live-properties.md    worktree  .worktrees/live-properties    ci · e2e 2:10 · 8/10 ok
```

Three parts, always in this order:

- **what the run is doing** — the node that is running and how long it has been (`e2e 2:10`), ticking in your browser off the instant that crossed the wire, in the same register the ⏱ chip beside a doing row uses. Where nothing is running yet, odu's own word for what the run is waiting for (`provisioning`, while it is still claiming a machine).
- **how it is coming out** — `8/10 ok`, how many nodes came out green over how many there are. Dropped for a run that has no nodes yet, because `0/0 ok` is a sentence about nothing.
- **the ink** — the app's accent while the run is going, **red the moment any node is red** (before the run has finished deciding, because that is what you need to know), the done green for a run that came out green, and muted for one that stopped without deciding.

Hover it for the two facts the chip has no room for: **which run this is** (`ci 8f8fe56#2+dirty`, odu's own spelling, so a verdict always says which run it describes) and **where olai looked** — the absolute path, which is the first thing anybody asks when a chip is not where they expected one.

## The run matrix

Press the chip and the matrix opens beneath the property run — every node of the run in the run's own scheduling order:

```
ci 8f8fe56#2 · x86_64-linux=kolu-ci-9 aarch64-darwin=petit
✔  typecheck        x86_64-linux    ok         12s
✔  test             x86_64-linux    ok         1m
▶  e2e              x86_64-linux    running    2:10
◦  fmt-check        aarch64-darwin  pending    —
```

The glyph, the status word and the colour are **odu's**, folded once where olai speaks to odu and carried per node — so `errored` is not drawn as a failed test, `cancelled` is not drawn as red, and a status a newer odu invents prints its own name rather than being quietly folded onto a neighbour. What olai decides is only which ink a colour takes on a page.

Press again to close. One matrix at a time per node, and it is mounted only while it is open — so a page of twelve lanes with one live run has one clock ticking on it.

**Nothing in the matrix is a button.** Reading a node's log, rerunning it and cancelling it are verbs — odu's own — and they live in the conversation's tool face, not on the page: a readout that quietly grew a verb would be the one thing this surface must not do.

## When the run ends

odu's socket belongs to a **run**, not to a daemon: it appears when the run starts and ends with the coordinator — which is usually the moment the run settles, but may be later on purpose: a run started with odu's `--linger` keeps its coordinator serving *past* the settle, so one node can be re-run through it. So a checkout with no socket is the ordinary state of every checkout on your machine, and olai treats it as one — no error, no warning, no hollow chip.

When a run you were watching settles, its chip says what it came to at once: `ci · ok · 10/10 ok`, or `ci · red · 8/10 ok`, in the verdict's ink — the settle is read off the run itself, not off the socket, so a lingering coordinator's `ci · ok · 10/10 ok` does not wait for it. What that verdict is made of is **the last reading olai took** — not a read of odu's own on-disk ledger, which is odu's file and odu's layout. Two consequences worth knowing:

- a run that finished while olai was not running leaves no chip, because olai never saw it — **that** is the only silence, and it is the same silence a checkout with no run at all draws;
- a run whose coordinator died mid-way says `ended` rather than `red`, because it did not decide anything and reporting an infrastructure death as a test failure is exactly the mistake odu keeps a separate status for. A run killed while its first node was still going says `ended` too, with the count it had reached: a chip that was on screen a second ago does not vanish because the thing it was watching stopped.

## What turns it on

Two facts, both on the board:

1. **the lane carries an `odu-worktree`** — and on an enabled odu that is the whole of it. Nothing to declare, no file to edit, and olai never writes your vault:

   ```jsonl
   {"id":"lane","ord":"a0","title":"the seam","custom":{"odu-worktree":".worktrees/live-properties"}}
   ```

   `odu-worktree` is a **kind** this plugin contributes ([format.md](../format.md)), and an enabled odu claims the key of the same name. The name carries `odu-` on purpose: a column *you* call `worktree` is yours — and this one hands a path to a socket dial in somebody's checkout, so a plugin taking over a column by being switched on is exactly what must not happen.

   **Want the short key?** One row in `_olai/Properties.olai` says which of *your* columns is this kind, and a vault row always wins:

   ```jsonl
   {"id":"prop-worktree","ord":"aC","title":"worktree","custom":{"type":"odu-worktree"}}
   ```

   Your key, the plugin's kind, your file. A column called `checkout` works the same way, and declaring `odu-worktree` as `text` takes the chip away.

   **It used to be `path`, and `path` was not enough.** `brief` is a `path` too, on the very same rows, so the licence had to be joined to the key NAME `worktree` to mean anything — which gave a chip to any vault that happened to use the word and none to a board whose column is called `checkout`. What decides now is the DECLARATION — yours, or the plugin's claim where you said nothing — and never the spelling. **A board that declared its `worktree` column a plain `path` gets no chip**; that is a row saying what it means, and the repair is the kind in that one row.

2. **the lane says which repository it is in.** A `worktree` value like `.worktrees/live-properties` is relative and does not name its repo — the same six characters are a directory under three of them. So the repository comes from the lane's own `pr-url` (`https://github.com/juspay/odu/pull/94` → `odu`), and the checkout is `<repos root>/<repo>`, where the repos root is **the directory your served vault sits in** — your board and the repositories it boards are checkouts side by side. A machine laid out otherwise says so once, in `OLAI_REPOS_DIR`.

   **Where there is no PR URL yet**, the repository is the `projects/<repo>/` prefix of the row's own file — `projects/olai/roadmap/infra.olai` is `olai`. That is how a lane that runs CI before it opens a PR is still probed, and why a silent doorbell on a boarded checkout is not "the file was the wrong one": the chip and the wake read one placement. A relative value in a file that is not under `projects/<repo>/`, with no PR URL, still resolves to nothing.

   **An absolute `worktree` skips all of that** and is used as written, which is the way out of the guessing if you would rather not rely on it.

A lane the rule cannot place — a relative path, no PR URL, and no `projects/<repo>/` file — is simply not probed. And a lane it places WRONGLY costs nothing: there is no socket under a wrong path, so the chip does not appear. The socket is the proof; the arithmetic above is only a way of finding something to ask.

## What it costs

One `connect(2)` every few seconds per lane that is not already being watched, against a path that usually does not exist. A lane whose run IS live costs nothing on that timer at all — it is held open and the coordinator pushes.

## The CI doorbell

A chat conversation can be **scoped to one outline file**, and then olai rings it when a run in a checkout that file claims does something somebody should hear about. The control is the same strip the fleet's doorbell lives on — `wake on CI runs · runs from <a file> ▾` — per conversation, with a clear beside it, and **outlines and nothing else** for the claim's own reason: the values it reads live on nodes, and a `.md` has none ([chat.md](../chat.md#what-this-conversation-wakes-on) rules the picker's filter and the two fault sentences, which this doorbell says in its own words the same way). **Nothing is scoped by default** — a fresh conversation hears no run until somebody picks a file.

**The file is the FILTER, and the subject is the runs.** Which runs a scoped conversation hears about is exactly this: the `odu-worktree` values on that file's **un-done** nodes, mirrors resolving to their targets — the *same derivation the chip already licenses* ([above](#what-turns-it-on)), asked of one file instead of the whole vault: the DECLARATION is read by kind and never by a key's spelling, so a board whose column is `checkout` is heard where it declared the kind, and a plain `path` column somebody has been calling `worktree` for years is not. `done` and `cancelled` both end the claim, so a lane you finish stops ringing without anybody switching anything off.

**Two wakes, both ruled, and nothing else rings.** The watcher's own transitions become the deliveries — the plugin's server half already holds the run state the chip draws, and turning those transitions into messages is deliberately the *avoidance of a second reader*: a run's ink and a run's wake read one holding, frame by frame, so they cannot disagree.

- **First-red.** The moment any node of a live run goes red, the conversation is woken **once per hold** — the lane that claims it, the first red node in the run's own scheduling order, and the counts so far: `8/10 ok so far, 1 red`. Never once per red node, and never again for a rerun's second red spell while the hold lives. A run already red when olai first dialed it says so on the first frame — pre-existence is not a pardon, which is the acceptance the fleet watcher makes of a terminal held when olai booted. An olai restart mid-run re-dials the still-live socket, and an already-red run rings first-red again: once per hold is once per socket's life, and a new hold is a new watch.
- **Settle.** The moment the run itself settles — every node terminal, the same fold odu's coordinator runs over the very cell olai watches, and the same moment odu's ledger stamps `finishedAt` — one account lands, **within seconds of the last node**: the verdict in odu's own vocabulary (`green` / `red` / `ended` — the same fold the chip's last-reading draws, and `ended` is never `red`, because an infrastructure death is not a test failure), the final counts, and for a red verdict **each failed recipe with its log path**. The path is odu's own spelling, `.ci/<sha7>/<platform>/<name>.log`, exported as `logPathFor` from `@odu/run-client` and never re-spliced in olai — one function both halves derive, so the sentence names exactly the file the coordinator wrote. And where the run record itself says a node failed and then went green on a rerun, the wake names it as such — record truth, observed while it happened, never an inference run afterwards. The settle is never read off the socket's death: a run started with `--linger` keeps its coordinator serving *past* the settle so a node can be re-run, and that later end — a cancel, or the idle reap — rings **nothing** the second time. The socket's going keeps one meaning: a run that died before it could settle, whose account reads `ended`. The guarantee is once per settlement *per hold*: an olai restart inside the linger window re-dials the still-serving coordinator, its first frame already settles, and the account rings once more — first-red's own rule, a new hold is a new watch.

**Silence is no message at all.** A run no scoped file claims rings nobody, and olai does not report what it decided not to ring about. A run the board *dropped* mid-flight rings nothing either — not even the settle: both emission sites sit behind the same guard the chip's own rows do, so a lane the vault drops is quiet on every channel at once. A run that settled while olai was not running leaves no settle account, because olai never saw it — the same witness limit the chip already states ([above](#when-the-run-ends)). A claimed relative checkout the placement rule cannot look up is the same silence as a checkout with no run: no chip, no hold, no wake — if the chip is missing on a boarded lane, the doorbell is not watching it either, and the repair is a `pr-url`, a `projects/<repo>/` home, or an absolute `odu-worktree`.

**What arrives obeys the fleet doorbell's own discipline**, because a person may receive either: the message names itself and its stamp in an opening line a resumed conversation can still attribute; the panel draws one line and the whole account is a press away; the claiming row's id is in the **head** in backticks and is **pressable** — the collapsed line links back to the board row the wake was derived from, which is the row you edit to stop it; the face over the sentence is odu's own logo, through the same pin the rest of this plugin reads; and events that pile up while a turn runs are held to the boundary and arrive whole, coalesced **per kind per run** — two runs settling through one busy turn are two subjects, and one never swallows the other's account. What time can legitimately move is re-read when the words go in rather than served off the frame that fired: the *claim* (a lane finished while its wake queued is a wake nobody owes, and the delivery simply drops), and the first-red *counts* (a body that says *so far* says it of the conversation's moment). A settle's own numbers are the exception, frozen on purpose: the settling frame is the story it has to tell, and a lingering rerun's frames could only mix into it (each settlement rings its own account).

**There is no heartbeat, by construction.** The fleet's doorbell has one because the fleet watcher's own *beat* drives it, and a quiet fleet is a live thing watched. odu's sweep polls for absences — a checkout with no socket is the ordinary state of every checkout — so there is no beat to floor the silence with, and a timer saying *still here* would be the one dishonest kind of alive. What underwrites the quiet instead: the two **fault messages** (the file was renamed, moved or deleted; or it is served but holds no rows a claim can be read from — said once each, in this doorbell's own words, through [the seam core owns](../chat.md#what-this-conversation-wakes-on)), and the picker's `clear`, which stops everything.

## The chat panel's odu

The other half of the integration, attached the way kolu's is: every new conversation is handed `odu mcp` — odu's **own** agent face, and no verb invented for olai. The agent in a conversation then holds `run`, `node_rerun`, `node_cancel`, `wait_for_settle`, `lease`/`release` and odu's own tools and resources, and can start CI in a checkout itself. The binary is not the machine's business: **a packaged olai always has one.** The Nix build bakes the pinned `odu` — the same pin this plugin's logo, its vendored `@odu/run-client` and this page's whole integration are read from — onto the server's PATH, and every documented way of starting olai inherits it: `nix run`, the packaged binary, `just serve`, the home-manager unit.

**It is probed, never assumed — and the probe asks the one question only the right build can answer.** Per conversation, on the session-open path, olai resolves `odu` on the PATH the server itself was started with, starts it, and asks for its tool surface. The answer is evidence of the build, not the binary: an `odu` that will not start, that closes its pipes, or that answers but is older than checkout-targeting is a sentence on the strip under the roster, with the reason and the path — the same discipline `kolu`'s row keeps ([chat.md](../chat.md#when-a-tool-server-does-not-arrive)). **An *absent* `odu` is a sentence too, now** — the bake means one was expected, so a resolve that finds nothing draws the row with no path to name (nothing was resolved): the sentence names the command, says the server's PATH lacks it, and states the build's promise — it diagnoses nothing, because the off switch (`OLAI_ODU_BIN`, an emptied value means none) is how a serve from the build can draw it too. It used to say nothing on the strip at all, on the argument that nothing on a machine declares an odu expected — and that quiet is exactly how a deployed olai, started from a unit with no `odu` anywhere near its PATH, could never hand a conversation CI *and never showed why*.

**One server, many checkouts.** `odu mcp` binds to its cwd at spawn, while a conversation spans every lane on its board — the design question this half either had to route around or ask odu to settle, and odu settled it ([juspay/odu#97](https://github.com/juspay/odu/pull/97)): every verb takes a per-call `checkout` (the checkout root's absolute path), defaulting to the server's own directory. The agent aims per *call*; the server stays parked. odu's *resources* (`nodes`, the logs) stay bound to that home directory — they are subscriptions rather than calls, and another checkout's run-state arrives through the verbs and the log paths the settle wake already names.

**A run the agent starts outlives olai.** The coordinator a `run` call spawns is detached: an olai restart mid-run kills nothing, and the watching half re-finds the run by dialing its socket the same way it always has — the chip comes back, the doorbell's settle goes out when it lands, and nothing about the run ever needed olai to stay up.
