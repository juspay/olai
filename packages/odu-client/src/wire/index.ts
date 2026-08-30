/**
 * ODU'S SLICE OF OLAI'S WIRE — what a reader is told about a live CI run.
 *
 * One cell, `ci`, and the vocabulary under it. `@olai/surface` imports
 * {@link oduMembers} from here and spreads it into its own `defineSurface`
 * call, exactly as it does `@olai/kolu-client`'s — the NAMED SPREAD, not a
 * generic slot, and that package's own header argues why (a plug-in system
 * with a population of one is speculative generality; a named spread is
 * legible where a registry would not be). This is the population's second
 * member, and it changed nothing about the mechanism, which is the whole
 * claim the live-properties seam makes.
 *
 * ## These are olai's shapes, not odu's, and that is the point
 *
 * Nothing here imports `@odu/run-client`. odu's `PipelineState` is the
 * coordinator's own record — a keyed map of nodes beside a scheduling order,
 * posting health, a lane roster on a second cell — and what a chip and a
 * matrix need is a flat projection of about a dozen fields. Re-exporting odu's
 * schema would put the coordinator's contract on olai's wire: every browser
 * decoding it, every skew in it a skew here, and `@olai/odu-client` would have
 * stopped being the only place that knows odu exists. So the projection is
 * declared in olai's own vocabulary and that package is the one thing that
 * maps between them.
 *
 * ## Why the FOLDS run on the server and the ANSWER is what travels
 *
 * `@olai/kolu-client`'s rule, applied. odu owns one table that says what a
 * status MEANS — `STATUS_META`: the glyph, the semantic hue, whether it counts
 * as red in a verdict — and it is the single home of that assignment across
 * odu's TUI, its GitHub poster and its `--progress json`. So the fold runs
 * ONCE, where the thin client is, and its answers travel: {@link RunCell}
 * carries `hue` and `glyph` and `red` beside the status word rather than a
 * table for the browser to keep. A second copy of that assignment in a
 * stylesheet is how two faces come to disagree about what `errored` looks
 * like.
 *
 * NO CLOSED SET OF ODU'S VOCABULARY IS DECLARED HERE, EVER. `status`, `hue`
 * and `phase` are all closed sets upstream and all `Schema.String` on this
 * wire, for the reason the kolu slice gives about `pip.variant` and
 * `agentState`: the closed set has ONE home, and a second copy would drift
 * silently — odu adding a status is a `satisfies never` failure in odu, so a
 * new word would land here as a literal this spec had simply never heard of.
 * A face that meets one draws it rather than normalising it onto a neighbour
 * (`@olai/web`'s `ci/hue.ts`), which is the same rule the Dock row keeps.
 *
 * ## THE ENTRY'S OWN FENCE, which is the cost of the inversion
 *
 * `@olai/surface` depends on this module, and every listener that reads the
 * surface pulls it in statically. So it may import `effect` and NOTHING ELSE
 * — no `@odu/*` (whose `./dial` reaches `node:net`, which would land in the
 * browser bundle), no `solid-js`, no `@olai/format`. Schemas and types only.
 * `scripts/check-odu-deps.sh` asserts it rather than trusting this paragraph.
 */

import { Schema } from "effect"

// ── The two keys ──────────────────────────────────────────────────────────

/**
 * THE PROPERTY KEY THE CI FACE HANGS OFF.
 *
 * One constant: the server reads it to find which nodes to probe, and the
 * browser reads it to decide which property wears the dressing. Here rather
 * than in either of them because it is the one fact both must agree on, and a
 * string typed in two places is a door that opens at one end only —
 * `TERMINAL_KEY`'s own argument, one appliance over.
 *
 * KEYED ON THE KEY, and the seam it registers into now says WHY rather than
 * promising to move (`@olai/web`'s `props/live.ts`). What a browser is told
 * about a property is a page's ANSWERS; a vault's declarations deliberately do
 * not travel (juspay/olai#395), so "which dressing does this property wear" is
 * a question no tab can settle from a declared type. What the DECLARATION does
 * here is licence the probe rather than select the face — the server, which
 * holds the declarations, probes a `worktree` only where the vault has
 * declared that key a `path` (`@olai/server`'s `worktrees.ts`).
 */
export const WORKTREE_KEY = "worktree"

/** ...and the key that says which REPOSITORY that worktree is in, which a
 *  relative path does not. `@olai/odu-client`'s `resolve.ts` argues the whole
 *  resolution; this is the name it reads it under. */
export const PR_URL_KEY = "pr-url"

// ── One node of a run ─────────────────────────────────────────────────────

/**
 * ONE UNIT OF WORK IN A RUN — a row of the matrix, projected flat.
 *
 * odu names a node `<namepath>@<platform>` and ships the two joined; they are
 * SPLIT here because the matrix draws them on two axes — a recipe down the
 * side, a platform across — and a face that had to re-split the id would be a
 * second copy of odu's own `splitFanId`. The joined form stays as `id`
 * because it is the identity, and identity is what a rerun would name.
 */
export const RunCell = Schema.Struct({
  /** odu's node id, verbatim: `<namepath>@<platform>`. The arrayKey of this
   *  whole member (see {@link oduMembers}), so a frame that repeats a node
   *  notifies nobody. */
  id: Schema.String,
  /** The namepath half — what the unit of work is called (`e2e`, `typecheck`). */
  name: Schema.String,
  /** The `@platform` half — which lane ran it. */
  platform: Schema.String,
  /** odu's status word, verbatim and unnarrowed (see the header): `pending`,
   *  `running`, `ok`, `failed`, `skipped`, `errored`, `cancelled` — or a word
   *  a later odu adds, which a face prints rather than guesses at. */
  status: Schema.String,
  /** What that status MEANS, as odu's own `STATUS_META` folds it — the
   *  semantic colour, named by meaning rather than by medium (`grey`, `amber`,
   *  `green`, `red`, `violet`). The fold ran where the table is. */
  hue: Schema.String,
  /** ...and the glyph beside it, from the same fold and the same table. */
  glyph: Schema.String,
  /** Whether this status counts as RED in a verdict — odu's answer, not a
   *  re-derivation from the word. `failed` and `errored` are; a deliberate
   *  `cancelled` is not, which is a distinction only that table holds. */
  red: Schema.Boolean,
  /** `Date.now()` when the node started running; `null` until then. The chip
   *  and the matrix TICK off this rather than off a duration the server
   *  computed, for `@olai/web`'s `TookChip` reason one subject over: a
   *  duration on the wire is stale the instant it is encoded. */
  startedAt: Schema.NullOr(Schema.Number),
  /** Wall-clock run time in ms once terminal; `null` while it is still the
   *  clock's to compute. */
  ms: Schema.NullOr(Schema.Number),
})
export type RunCell = typeof RunCell.Type

// ── The run ───────────────────────────────────────────────────────────────

/**
 * How a run's nodes have come out so far — the `8/10 ok` half of the chip.
 *
 * NOT A WIRE SHAPE, and it was one. It is a fold over {@link CiRun.cells},
 * which travels whole, so shipping it too put an answer on the wire beside its
 * own question and left "the tally agrees with the cells" as an invariant
 * nothing enforced. The fold lives HERE — the module both sides already import
 * — so there is one counting and whoever holds the cells does it.
 */
export interface RunTally {
  /** Every node the run holds. */
  readonly total: number
  /** ...of which this many reached a terminal status of any colour. */
  readonly settled: number
  /** ...of which this many are `ok`. */
  readonly ok: number
  /** ...and this many are RED by odu's own table — `failed` or `errored`,
   *  never a deliberate cancel. */
  readonly red: number
}

/** The tally, counted. */
export const tallyOf = (cells: ReadonlyArray<RunCell>): RunTally => {
  let settled = 0
  let ok = 0
  let red = 0
  for (const cell of cells) {
    // SETTLED is "not on its way there", which is every status but the two
    // that are — the complement rather than a list of terminal words, so a
    // status odu adds counts as settled by default and a chip does not stall
    // at `9/10` forever on a word this build has not heard of.
    if (cell.status !== "pending" && cell.status !== "running") settled += 1
    if (cell.status === "ok") ok += 1
    if (cell.red) red += 1
  }
  return { total: cells.length, settled, ok, red }
}

/**
 * WHAT THE RUN CAME TO, or `null` while it has not — the second fold, over
 * the first, and here for the first one's reason.
 *
 * RED WINS EARLY: a run with a red node is red before its remaining nodes
 * finish, because that is what a reader needs to know and what odu's own
 * verdict says. `ok` waits for every node, which is the asymmetry the words
 * carry honestly — a green claim about work that has not run is the one thing
 * a CI face must never make.
 *
 * A run with NO nodes has no verdict of any colour. A `provisioning` run that
 * has published a roster and nothing else would otherwise read `ok`, which is
 * the empty-set trap the counting form falls into and the reason this is a
 * branch rather than `red === 0 && settled === total`.
 *
 * A WORD rather than a boolean, because the day a third outcome matters
 * (odu's `cancelled` is already a distinct status) a boolean has no room for
 * it.
 */
export const verdictOf = (tally: RunTally): string | null => {
  if (tally.red > 0) return "red"
  if (tally.total === 0) return null
  return tally.settled === tally.total ? "ok" : null
}

/**
 * ONE LANE'S CI RUN, as olai holds it.
 *
 * THE KEY IS THE BOARD'S OWN WORD. `id` is the `worktree` property's value
 * exactly as somebody wrote it (`.worktrees/live-properties`), not the
 * absolute path it resolved to — because the join a chip performs is against
 * the value it is drawing, and a chip that had to resolve a path would be the
 * resolution rule spelled a second time, in a browser that cannot see a
 * filesystem. Where it RESOLVED to rides beside it as {@link CiRun.at}, for
 * the hollow state's own question: "looked where?".
 *
 * A ROW SURVIVES ITS RUN. When the socket goes — which is what a settling run
 * DOES, unlike padi's long-lived one — the row stays with `live: false` and
 * whatever verdict the last frame supported. That is the "last verdict"
 * `@olai/odu-client`'s header argues for, and its provenance is stated rather
 * than implied: it is what OLAI WATCHED, never a read of odu's on-disk ledger
 * (see that header on why the ledger is not this package's to parse).
 */
export const CiRun = Schema.Struct({
  /** The `worktree` value, verbatim as the board wrote it — the join key. */
  id: Schema.String,
  /** The absolute checkout that value resolved to (`@olai/odu-client`'s
   *  `resolve.ts`, which argues the rule). Carried on every arm because
   *  "nothing is there" is only actionable when a reader knows where olai
   *  looked — the `kolu` cell's own reasoning about its `socket` field. */
  at: Schema.String,
  /** Whether a coordinator is serving that checkout's socket RIGHT NOW.
   *  `false` is the ORDINARY state and never an error: odu's socket belongs to
   *  a run, so it appears at `odu run` and is gone the moment the run settles. */
  live: Schema.Boolean,
  /** The pipeline's name, as the run states it. */
  name: Schema.String,
  /** The run's commit, 7 hex chars — empty before the coordinator stamps one. */
  sha7: Schema.String,
  /** The run's tree had uncommitted changes: the verdict is about that tree
   *  rather than about the commit, which is what the `+dirty` label says. */
  dirty: Schema.Boolean,
  /** This run's ordinal among runs of the same commit in this checkout, so a
   *  verdict says WHICH run it describes. `null` where none was reserved. */
  seq: Schema.NullOr(Schema.Int),
  /** Where the run is in its lifecycle as far as the ENVIRONMENT is concerned
   *  — odu's `runPhase` fold over the lane roster, verbatim: `unstarted`,
   *  `provisioning`, `lanes`, `no_lanes`. A run claiming a machine has no
   *  nodes to show yet and says so with this rather than with an empty matrix. */
  phase: Schema.String,
  /** The lane roster as `platform=host` (or `platform=…pool` while a lease is
   *  still claiming) — what the matrix names its columns with. */
  lanes: Schema.Array(Schema.String),
  /** The nodes, in the run's OWN scheduling order — so olai never invents
   *  one. The order is the ARRAY's and not a second list beside it: the
   *  projection walks odu's `order` to build this, so shipping that list too
   *  would be the same sequence spelled twice with nothing holding the two
   *  spellings together. */
  cells: Schema.Array(RunCell),
})
export type CiRun = typeof CiRun.Type

/** Every run this server is watching, live or last-seen — the whole of what
 *  the `ci` cell carries. */
export const CiRuns = Schema.Struct({
  runs: Schema.Array(CiRun),
})
export type CiRuns = typeof CiRuns.Type

/** The seed every face starts at, odu or not: this server watches nothing
 *  yet, which is also the true and final answer for a face that has no odu
 *  half at all. Minted once, the way `KOLU_UNDIALED` is. */
export const NO_RUNS: CiRuns = { runs: [] }

/**
 * Two readings that say the same thing about the CI runs — the cell's
 * `equals`, so a coordinator re-publishing a frame that moved nothing
 * publishes nothing here.
 *
 * DERIVED FROM THE SCHEMA, which is what this repo already does wherever it
 * can (`@olai/format`'s `sameOwed`, `sameDated`, `samePageReading`). It was
 * twenty-five lines of hand-written `===` chains, and the argument in its
 * header — "`sameKolu`'s reason" — did not transfer: `sameKolu` is written out
 * because it deliberately EXCLUDES a field (`since` is what that predicate
 * decides, so comparing it would make every reading differ from every other),
 * and an exclusion is a thing a schema equivalence cannot express. This one
 * excludes nothing. It compared a subset of `RunCell` — id, status, startedAt,
 * ms — which is the same answer for every value this wire can hold, since the
 * five fields it skipped are functions of those two (`name` and `platform` off
 * the id, `hue`/`glyph`/`red` off the status, all in `../project.ts`). So the
 * hand-roll bought nothing and owned a copy of the shape it compares, free to
 * drift the next time a field lands.
 */
export const sameCi: (a: CiRuns, b: CiRuns) => boolean = Schema.toEquivalence(CiRuns)

// ── The member ────────────────────────────────────────────────────────────

/**
 * THE ONE MEMBER, as `@olai/surface` spreads it.
 *
 * A CELL and not a collection, which is where this slice deliberately differs
 * from the kolu one beside it. `fleet` is a collection because a busy machine
 * holds tens of terminals and a tab wants deltas over them; the set of LIVE CI
 * RUNS is bounded by the worktrees a vault names at once — a handful — and
 * every frame of it is small. What a cell buys for that population is the
 * thing a collection has nowhere to put: a `connect`, which is where the
 * watcher is forked ONCE when the surface binds, rather than when the first
 * browser subscribes. Same arrangement as the `kolu` cell, for the same
 * reason, and it is what makes "one probe per server, however many tabs" a
 * fact about where the fiber lives instead of a promise.
 *
 * WIRE-READ-ONLY, twice over. A browser cannot start, cancel or rerun anything
 * here: this phase is a READING (the odu-in-olai plan's phase 2), and launch is
 * phase 4's — where it is a procedure with a writer's argument, not a verb
 * smuggled onto a cell somebody was already watching.
 */
export const oduMembers = {
  cells: {
    /**
     * EVERY LANE'S CI RUN, live or last-seen — the live-properties seam's
     * second tenant.
     *
     * Board-driven discovery (ruled, 2026-08-29): the set of runs is the
     * nodes' own `worktree` properties, probed for `.ci/odu.sock`. There is no
     * odu registry and odu changed nothing to make this work — which is the
     * property the whole arrangement was chosen for.
     *
     * `arrayKey: "id"` reaches BOTH arrays at both depths — the runs and the
     * nodes inside each — because every element of both carries an `id`. A
     * frame that merely repeats what a tab holds then notifies nothing
     * (juspay/kolu#2190), which matters here more than on most members: a
     * coordinator republishes its whole pipeline on every node transition, and
     * a ten-node run would otherwise wake every row of such an outline ten
     * times a minute.
     */
    ci: {
      schema: CiRuns,
      default: NO_RUNS,
      verbs: ["get"],
      equals: sameCi,
      arrayKey: "id",
    },
  },
} as const
