# CI on the board

[odu](https://github.com/juspay/odu) runs a repository's checks. If a lane's worktree has a run going in it, olai shows you — so a node that records *where* some work is happening also shows you how its CI is *going*, and lets you read the whole matrix without leaving the page. Nothing to configure and nothing for odu to publish: olai looks in the worktrees your own board already names.

**This is read-only.** olai launches nothing, cancels nothing, reruns nothing and writes nothing to the board. Starting a run, classifying what came out of one, and letting a merge gate read the verdict are later phases; this page describes only what is here.

## Live properties

A property whose value is a decision-shaped name — a terminal id, a worktree path — can be given a face that **updates on its own**. The board goes on storing the name; the display goes and finds out what that name currently is. A plugin contributes a KIND, the vault declares a key that kind, and the face follows the DECLARATION rather than the key's name. There are two such kinds today:

| the property | what it wears |
| --- | --- |
| `terminal` | kolu's own Dock row, and the live pane it opens — [kolu.md](kolu.md) |
| `worktree` | a CI chip while a run is going, and the run matrix it opens — this page |

The rows name the KINDS, and the key a vault hangs each on is the vault's own — a column called `checkout` declared `worktree` is probed, and a column called `worktree` in a vault that declares nothing is not.

They are the same mechanism wearing different clothes, and a third kind of living thing later is a third set of clothes rather than a third mechanism.

The two are shaped differently on purpose. A `terminal` OWNS ITS ROW, because a terminal somebody named is worth a row whether or not anything is happening in it. A `worktree` does not: it is a path on a lane row, quiet by default, and its CI face is a **chip beside the value** that appears only while there is something to say. A board with no CI running looks exactly as it did.

## The chip

Give a lane a `worktree` property, and declare that key a `worktree` (see [below](#what-turns-it-on)). While a run is going in that checkout, the property's line gains a chip:

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

**Nothing in the matrix is a button.** Reading a node's log, rerunning it and cancelling it are all later phases; a readout that quietly grew a verb would be the one thing this integration must not do.

## When the run ends

odu's socket belongs to a **run**, not to a daemon: it appears when the run starts and is gone the moment it settles. So a checkout with no socket is the ordinary state of every checkout on your machine, and olai treats it as one — no error, no warning, no hollow chip.

When a run you were watching settles, its chip stays and says what it came to: `ci · ok · 10/10 ok`, or `ci · red · 8/10 ok`, in the verdict's ink. What that verdict is made of is **the last reading olai took** — not a read of odu's own on-disk ledger, which is odu's file and odu's layout. Two consequences worth knowing:

- a run that finished while olai was not running leaves no chip, because olai never saw it — **that** is the only silence, and it is the same silence a checkout with no run at all draws;
- a run whose coordinator died mid-way says `ended` rather than `red`, because it did not decide anything and reporting an infrastructure death as a test failure is exactly the mistake odu keeps a separate status for. A run killed while its first node was still going says `ended` too, with the count it had reached: a chip that was on screen a second ago does not vanish because the thing it was watching stopped.

## What turns it on

Two facts, both on the board:

1. **the key is declared a `worktree`** — one row in `_olai/Properties.olai`:

   ```jsonl
   {"id":"prop-worktree","ord":"aC","title":"worktree","custom":{"type":"worktree"}}
   ```

   A vault that declares nothing is not probed at all, and that is the rule rather than an accident: this hands a path to a socket dial in somebody's checkout, and only the vault can say which of its keys is one.

   **It used to be `path`, and `path` was not enough.** `brief` is a `path` too, on the very same rows, so the licence had to be joined to the key NAME `worktree` to mean anything — which gave a door to any vault that happened to use the word and none to a board whose column is called `checkout`. `worktree` is a kind `@olai/plugin-odu` contributes ([format.md](format.md)), and the walk finds its keys by that declaration. A board that declared `path` gets no chip now; the repair is the word in that one row.

2. **the lane says which repository it is in.** A `worktree` value like `.worktrees/live-properties` is relative and does not name its repo — the same six characters are a directory under three of them. So the repository comes from the lane's own `pr-url` (`https://github.com/juspay/odu/pull/94` → `odu`), and the checkout is `<repos root>/<repo>`, where the repos root is **the directory your served vault sits in** — your board and the repositories it boards are checkouts side by side. A machine laid out otherwise says so once, in `OLAI_REPOS_DIR`.

   **An absolute `worktree` skips all of that** and is used as written, which is the way out of the guessing if you would rather not rely on it.

A lane the rule cannot place — a relative path and no PR URL — is simply not probed. And a lane it places WRONGLY costs nothing: there is no socket under a wrong path, so the chip does not appear. The socket is the proof; the arithmetic above is only a way of finding something to ask.

## What it costs

One `connect(2)` every few seconds per lane that is not already being watched, against a path that usually does not exist. A lane whose run IS live costs nothing on that timer at all — it is held open and the coordinator pushes.

Twelve tabs on a lanes outline are twelve subscribers to **one** reading: the server sweeps, and every browser reads the answer. No tab dials anything, exactly as no tab dials padi.
