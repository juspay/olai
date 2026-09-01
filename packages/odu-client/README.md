# @olai/odu-client — how olai reaches odu

One package holds the sweep, the dial, the hold over a live run, and the projection into olai's own vocabulary. What leaves is [`@olai/surface`](../surface/README.md)'s shapes — a `CiRun`, a `RunCell` — so a change to odu's contract is a change **here** and stops.

**Olai watches CI and never runs it.** [odu](https://github.com/juspay/odu) is the harness; what olai does is *read* the run a checkout is living through and put it where the fact already is — beside the `worktree` property that named the checkout. This package is the whole of that reading, and this phase is read-only in every direction: no launch, no rerun, no cancel, no classification, and no write to the vault.

## What it is for, today

The live-properties seam's second tenant (`brainstorming/odu-in-olai.md`, phase 2 of four). A node carries `worktree: <path>`, so that property wears a quiet chip while there is a run in that checkout, and the chip opens the run matrix — no route, no page, and no registry for odu to keep.

- **`resolve.ts`** — WHERE a `worktree` value actually is. A relative value does not name its repository, so the rule is three lines: an absolute value as written; a relative one joined onto `<repos root>/<repo>`, where the repo is parsed out of the node's own `pr-url`; and the repos root is the served directory's parent unless `$OLAI_REPOS_DIR` says otherwise. A value the rule cannot place resolves to nothing and is not probed. Nothing here touches the filesystem — it says where to look, and the dial finds out.
- **`runs.ts`** — the SWEEP and the hold. Nothing tells olai that a run has started (`.ci/odu.sock` appears in a worktree the server may not even be serving), so the only way to learn is to ask: every three seconds, one `connect(2)` per un-held worktree. A dial that lands is held open by its own fiber until the socket dies, following two cells at once — the pipeline and the header, which odu publishes twice per run — and ringing `rang` on the two transitions a conversation is owed: first-red once per hold, and settle when the socket goes.
- **`logs.ts`** — WHERE one node's log lives on disk. `durableLogPath` is odu's own `logPathFor` (`@odu/run-client/nodeId`) joined onto the checkout the run lived in, named for a sentence, never opened: a run odu never stamped has no honest path.
- **`project.ts`** — odu's record to olai's row, and the one place the two vocabularies meet.
- **`wire/index.ts`** — the `ci` cell and the vocabulary under it, which [`@olai/surface`](../surface/README.md) spreads into its own spec and re-exports. Also the two folds a face spends (`tallyOf`, `verdictOf`) and the cell's `equals`.
- **`index.ts`** — `oduHalf`, which is what a server composes: one cell handler and the vault hook that re-reads which nodes name a worktree.

## Absence is the steady state, and that is the difference from padi

This is where the package departs from [`@olai/kolu-client`](../kolu-client/README.md) next door, and the departure is odu's rather than ours. **padi's socket belongs to a per-host daemon** that is meant to be up, so a dial that finds nothing is *news* — worth a three-armed cell, a hollow chip, and a header readout that says where olai looked. **odu's socket belongs to a RUN**: it appears at `odu run` and is gone the moment the run settles. For any given checkout, sock-absent is the ordinary answer and the great majority of the time.

So `@odu/run-client`'s `dialRun` answers `null` rather than rejecting, and this package spends that distinction rather than flattening it:

- `null` is **silence** — no row, no chip, no log at anything but debug. A face polling on a timer gets it on nearly every tick, and that is the design rather than a degraded mode.
- anything that **raises** is a live problem (EACCES on a socket somebody is serving, a path a broken checkout left behind) — one warning, and then treated as silence too. Nothing a dial can do may be fatal: the handler reads the **cause**, because a dial can throw a defect, and caught only on the error channel it would kill the connector's fiber and fault the whole surface runtime — a stale `.ci/odu.sock` in one worktree taking olai's server down. That scar is `@olai/kolu-client`'s, inherited on purpose.
- a socket that **goes while held** is not an error either: it is what a settling run does. The row stays, with `live: false` and whatever verdict its last frame supports.

The last verdict is **what olai watched** — never a read of odu's on-disk ledger. That file is odu's and its layout is the ledger's (`@odu/run-client`'s README names `runRecord.ts` as something that stayed behind), so parsing it here would be olai spelling odu's disk format a second time in the one direction the package boundary exists to prevent. The honest limit is stated where a reader meets it ([the odu page](../plugins/olai-plugin-odu/docs.md), served at `docs/plugins/odu.md`): a run that finished while olai was not running leaves no chip, because olai never saw it.

## The folds run where their input is

odu owns one table saying what a status MEANS — `STATUS_META`: the glyph, the semantic hue, whether it counts as red — shared by its TUI, its GitHub poster and its `--progress json`. That table **cannot travel**, so the fold runs here and its answers ride beside the status word: a `RunCell` carries `hue`, `glyph` and `red`, and no face keeps a second table. `runPhase` is the same kind of thing one cell over.

olai's own folds are **not** here, and the difference is where their input is. The tally and the verdict fold over the `cells`, which travel whole — so running them here and shipping the answers would put a question and its answer on one wire with nothing holding them together. They live in `wire/index.ts`, the module both sides import, and whoever holds the cells does the counting.

**No closed set of odu's vocabulary is declared on the wire, ever.** `status`, `hue` and `phase` are closed sets upstream and plain strings here: the closed set has one home, and a copy would drift silently — odu adding a status is a `satisfies never` failure in odu, so a new word would land here as a literal this spec had never heard of. A face that meets one prints it rather than folding it onto a neighbour.

## Why it is a package

Because the wall makes the dependency direction **physics** — [`@olai/kolu-client`](../kolu-client/README.md)'s argument, and every word of it transfers. What is worth adding is the sentence specific to *this* appliance: odu's client half is **browser-safe**. `@odu/run-client/surface` imports nothing native, so a component that wanted `STATUS_META`'s glyph table could reach for it and compile. `packages/plugin-api/src/fence.test.ts`'s derived tenancy claim is what stops that, and the reason it must is padi's: the moment a component imports odu, every skew in odu's contract is a skew in olai's browser bundle and this package has stopped being the only thing that knows odu exists.

The manifest is **`effect`** and nothing else. It names no olai package at all — the wire vocabulary this package produces lives *in* it, which `@olai/surface` spreads — so the direction is a DAG the manifests enforce. `@olai/format` is deliberately absent for `@olai/kolu-client`'s reason: which nodes name a worktree, and whether the vault declared that key a `path`, is a reading of outline records, so it belongs to whoever holds the vault ([`olai-plugin-odu`](../plugins/olai-plugin-odu/README.md)'s `worktrees.ts`) and is **injected** (`OduDeps.worktrees`). What crosses is four strings per node.

## How the dependency is consumed

`@odu/run-client` is **hydrated as raw TypeScript from a Nix pin**, exactly as the `@kolu/*` sources are (`bunfig.toml` has the argument, `nix/odu.nix` has the pin). Hydration is per-package: a consumer copies a package *directory* and satisfies that directory's declared dependencies from its own manifest, so what you pay is the transitive closure of the **manifests** rather than the modules your code happens to reach. That is why odu extracted the package at all — `odu` itself declares an MCP server, a TUI renderer and a terminal emulator, none of which is needed to read a `nodes` cell.

Three things make it work, and two of them are the whole tree's rather than this package's:

| | where |
| --- | --- |
| the **copier** | kolu's `hydrate-kolu-packages.sh`, which takes `(src, dest)` pairs and knows nothing about which repo a source came from — so odu needed no second script |
| `effect`, at odu's pinned version | the root `package.json`, because the isolated linker puts only the root package's direct dependencies where a hydrated source resolves from. A *differing* version there is two copies of `effect`, which is worse than none |
| `@kolu/surface`, hydrated | already there for kolu's own sake; `@odu/run-client`'s wire link imports it |

`scripts/check-hydrated-deps.sh` asserts the version half and `packages/plugin-api/src/fence.test.ts` the confinement half, rather than trusting this table: the root manifest agrees with what the pinned package declares, `@odu/*` is imported nowhere but here, and `src/wire` stays schemas-and-types so odu's dial — which reaches `node:net` — never lands in the browser bundle.

## What is deliberately not here

**Writing**, of any kind. Launching a run, rerunning a node, cancelling one, and classifying what came out of a settled run are phases 3 and 4 of the plan; the wire says so rather than a comment, because the `ci` cell declares `verbs: ["get"]`.

**A node's log.** `@odu/run-client` exposes `nodeLog` and this package does not carry it: nothing draws it, and a field that crosses for nobody is a wire shape with no reader. The day a matrix cell somebody presses opens one, it arrives as a per-node **stream** — a subscription costing a person *looking* at something — rather than as a field on a cell every outline already holds.

**Posting health.** Same rule, one member over: odu tracks which GitHub contexts are still owed a confirmed post, and no olai face reports on it.
