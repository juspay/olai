# olai-plugin-odu/appliance — how olai reaches odu

One package holds the link to odu's per-user service, the board and stream holds, and the projection into olai's own vocabulary. What leaves is [`@olai/surface`](../../../../surface/README.md)'s shapes — a `CiRun`, a `RunCell`, an `OduLink` — so a change to odu's contract is a change **here** and stops.

**Olai watches CI and never runs it.** [odu](https://github.com/juspay/odu) is the harness; what olai does is *read* the run a lane named by `odu-run` and put it beside that value. This package is the whole of that reading, and this phase is read-only in every direction: no launch, no rerun, no cancel, no classification, and no write to the vault.

## What it is for, today

The live-properties seam's second tenant. A node carries `odu-run: <id>`, so that property wears a quiet chip while the service knows that run, and the chip opens the run matrix — no route, no page, and no registry for odu to keep.

- **`link.ts`** — one websocket to `ODU_WEB_ORIGIN` (default `http://127.0.0.1:18440`). Olai never starts the service. A skew (major unequal, or a service older than our minor) and a dial that failed for a reason other than nothing-listening are warnings.
- **`runs.ts`** — the watch. Discovery is board-driven: each boarded id holds `runs.get` for that key, and a boarded run holds `streams.nodes` until `done` so a settled-at-boot matrix still has cells. `rang` on first-red (a live run already red rings; a settled one does not) and on `live` going false.
- **`project.ts`** — odu's record to olai's row, and the one place the two vocabularies meet.
- **`wire/index.ts`** — the `ci` and `service` cells and the vocabulary under them, which [`@olai/surface`](../../../../surface/README.md) spreads into its own spec and re-exports. Also the two folds a face spends (`tallyOf`, `verdictOf`) and the cell's `equals`.
- **`index.ts`** — `oduHalf`, which is what a server composes: the cell handlers and the vault hook that re-reads which nodes name a run id.

## Absence is the steady state, and that is the difference from padi

This is where the package departs from [`olai-plugin-kolu/appliance`](../../../kolu/src/client/README.md) next door, and the departure is odu's rather than ours. **padi's socket belongs to a per-host daemon** that is meant to be up, so a dial that finds nothing is *news* — worth a three-armed cell, a hollow chip, and a header readout that says where olai looked. **odu's socket belongs to a RUN**: it appears at `odu run` and ends with the coordinator — which, on a `--linger` run, outlives the settle on purpose so a node can be re-run. For any given checkout, sock-absent is the ordinary answer and the great majority of the time.

So `@odu/run-client`'s `dialRun` answers `null` rather than rejecting, and this package spends that distinction rather than flattening it:

- `null` is **silence** — no row, no chip, no log at anything but debug. A face polling on a timer gets it on nearly every tick, and that is the design rather than a degraded mode.
- anything that **raises** is a live problem (a service that is up but refuses us, a protocol skew) — one warning, and then treated as absence too. Nothing a dial can do may be fatal: the handler reads the **cause**, because a dial can throw a defect, and caught only on the error channel it would kill the connector's fiber and fault the whole surface runtime. That scar is kolu's, inherited on purpose. The dial itself is interruptible: a plugin unload must not wait out the client's first-open deadline.
- a socket that **goes while held** is not an error either: it is the coordinator ending, which every settled run does at once — unless the run was launched with `--linger`, where the coordinator keeps serving PAST the settle so a node can be re-run, and the socket's later end means the coordinator went, not that the run settled (the frames already said that). The row stays, with `live: false` and whatever verdict its last frame supports.

The last verdict is **what olai watched** — never a read of odu's on-disk ledger. That file is odu's and its layout is the ledger's (`@odu/run-client`'s README names `runRecord.ts` as something that stayed behind), so parsing it here would be olai spelling odu's disk format a second time in the one direction the package boundary exists to prevent. The honest limit is stated where a reader meets it ([the odu page](../../docs.md), served at `docs/plugins/odu.md`): a run that finished while olai was not running leaves no chip, because olai never saw it.

## The folds run where their input is

odu owns one table saying what a status MEANS — `STATUS_META`: the glyph, the semantic hue, whether it counts as red — shared by its TUI, its GitHub poster and its `--progress json`. That table **cannot travel**, so the fold runs here and its answers ride beside the status word: a `RunCell` carries `hue`, `glyph` and `red`, and no face keeps a second table. `runPhase` is the same kind of thing one cell over.

olai's own folds are **not** here, and the difference is where their input is. The tally and the verdict fold over the `cells`, which travel whole — so running them here and shipping the answers would put a question and its answer on one wire with nothing holding them together. They live in `wire/index.ts`, the module both sides import, and whoever holds the cells does the counting.

**No closed set of odu's vocabulary is declared on the wire, ever.** `status`, `hue` and `phase` are closed sets upstream and plain strings here: the closed set has one home, and a copy would drift silently — odu adding a status is a `satisfies never` failure in odu, so a new word would land here as a literal this spec had never heard of. A face that meets one prints it rather than folding it onto a neighbour.

## Why it is a package

Because the wall makes the dependency direction **physics** — [`olai-plugin-kolu/appliance`](../../../kolu/src/client/README.md)'s argument, and every word of it transfers. What is worth adding is the sentence specific to *this* appliance: odu's client half is **browser-safe**. `@odu/run-client/surface` imports nothing native, so a component that wanted `STATUS_META`'s glyph table could reach for it and compile. `packages/bundle/src/fence.test.ts`'s derived tenancy claim is what stops that, and the reason it must is padi's: the moment a component imports odu, every skew in odu's contract is a skew in olai's browser bundle and this package has stopped being the only thing that knows odu exists.

The manifest is **`effect`** and nothing else. It names no olai package at all — the wire vocabulary this package produces lives *in* it, which `@olai/surface` spreads — so the direction is a DAG the manifests enforce. `@olai/format` is deliberately absent for `@olai/kolu-client`'s reason: which nodes name a run id, and whether the vault declared that key this kind, is a reading of outline records, so it belongs to whoever holds the vault ([`olai-plugin-odu`](../../README.md)'s `boarded.ts`) and is **injected** (`OduDeps.boarded`). What crosses is the run id strings per node.

## How the dependency is consumed

`@odu/run-client` is **hydrated as raw TypeScript from a Nix pin**, exactly as the `@kolu/*` sources are (`bunfig.toml` has the argument, `nix/odu.nix` has the pin). Hydration is per-package: a consumer copies a package *directory* and satisfies that directory's declared dependencies from its own manifest, so what you pay is the transitive closure of the **manifests** rather than the modules your code happens to reach. That is why odu extracted the package at all — `odu` itself declares an MCP server, a TUI renderer and a terminal emulator, none of which is needed to read a `nodes` cell.

Three things make it work, and two of them are the whole tree's rather than this package's:

| | where |
| --- | --- |
| the **copier** | kolu's `hydrate-kolu-packages.sh`, which takes `(src, dest)` pairs and knows nothing about which repo a source came from — so odu needed no second script |
| `effect`, at odu's pinned version | the root `package.json`, because the isolated linker puts only the root package's direct dependencies where a hydrated source resolves from. A *differing* version there is two copies of `effect`, which is worse than none |
| `@kolu/surface`, hydrated | already there for kolu's own sake; `@odu/run-client`'s wire link imports it |

`scripts/check-hydrated-deps.sh` asserts the version half and `packages/bundle/src/fence.test.ts` the confinement half, rather than trusting this table: the root manifest agrees with what the pinned package declares, `@odu/*` is imported nowhere but here, and `src/wire` stays schemas-and-types so odu's dial — which reaches `node:net` — never lands in the browser bundle.

## What is deliberately not here

**Writing**, of any kind. Launching a run, rerunning a node, cancelling one, and classifying what came out of a settled run are phases 3 and 4 of the plan; the wire says so rather than a comment, because the `ci` cell declares `verbs: ["get"]`.

**A node's log.** `@odu/run-client` exposes `nodeLog` and this package does not carry it: nothing draws it, and a field that crosses for nobody is a wire shape with no reader. The day a matrix cell somebody presses opens one, it arrives as a per-node **stream** — a subscription costing a person *looking* at something — rather than as a field on a cell every outline already holds.

**Posting health.** Same rule, one member over: odu tracks which GitHub contexts are still owed a confirmed post, and no olai face reports on it.
