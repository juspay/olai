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
 * One constant: the server reads it to find which lanes to probe, and the
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
 * declared that key a `path` (`@olai/server`'s `lanes.ts`).
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

/** How a run's nodes have come out so far — the `8/10 ok` half of the chip,
 *  counted where the nodes are so every face counts the same way. */
export const RunTally = Schema.Struct({
  /** Every node the run holds. */
  total: Schema.Int,
  /** ...of which this many reached a terminal status of any colour. */
  settled: Schema.Int,
  /** ...of which this many are `ok`. */
  ok: Schema.Int,
  /** ...and this many are RED by odu's own table — `failed` or `errored`,
   *  never a deliberate cancel. */
  red: Schema.Int,
})
export type RunTally = typeof RunTally.Type

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
  /** `Date.now()` the run published as its start; `null` before it publishes
   *  a header. The elapsed figure every face shows counts from this ONE value
   *  rather than each deriving its own. */
  startedAt: Schema.NullOr(Schema.Number),
  /** When olai saw the socket go, `Date.now()` — `null` while the run is
   *  live. What lets a face say how stale a settled verdict is without olai
   *  claiming to know when the coordinator itself finished. */
  wentAt: Schema.NullOr(Schema.Number),
  /** Node ids in the run's own scheduling order — the row order a matrix
   *  paints, so olai never invents one. */
  order: Schema.Array(Schema.String),
  /** The nodes themselves, IN `order`. */
  cells: Schema.Array(RunCell),
  tally: RunTally,
  /**
   * WHAT THE RUN CAME TO, or `null` for one that has not.
   *
   * `red` where any node is red by odu's table, `ok` where every node settled
   * and none is, and `null` while nodes are still owed — including for a live
   * run, whose chip is a progress readout rather than a verdict. It is a WORD
   * rather than a boolean because the day a third outcome matters (odu's
   * `cancelled` is already a distinct status) a boolean has no room for it.
   */
  verdict: Schema.NullOr(Schema.String),
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

/** Two readings that say the same thing about the CI runs — the cell's
 *  `equals`, so a coordinator re-publishing a frame that moved nothing
 *  publishes nothing here.
 *
 *  Written out rather than derived, for `sameKolu`'s reason: it is a small
 *  fixed shape and a structural walk over an encoded frame would be a second,
 *  slower answer to a question four `===` chains settle. The nodes compare by
 *  the fields a face DRAWS — a `startedAt` that moved is a real change, and a
 *  `ms` that arrived is the one that ends a tick. */
export const sameCi = (a: CiRuns, b: CiRuns): boolean =>
  a.runs.length === b.runs.length &&
  a.runs.every((run, at) => sameRun(run, b.runs[at] as CiRun))

const sameRun = (a: CiRun, b: CiRun): boolean =>
  a.id === b.id && a.at === b.at && a.live === b.live && a.name === b.name &&
  a.sha7 === b.sha7 && a.dirty === b.dirty && a.seq === b.seq &&
  a.phase === b.phase && a.startedAt === b.startedAt && a.wentAt === b.wentAt &&
  a.verdict === b.verdict &&
  a.tally.total === b.tally.total && a.tally.settled === b.tally.settled &&
  a.tally.ok === b.tally.ok && a.tally.red === b.tally.red &&
  sameWords(a.lanes, b.lanes) && sameWords(a.order, b.order) &&
  a.cells.length === b.cells.length &&
  a.cells.every((cell, at) => sameCell(cell, b.cells[at] as RunCell))

const sameCell = (a: RunCell, b: RunCell): boolean =>
  a.id === b.id && a.status === b.status && a.startedAt === b.startedAt &&
  a.ms === b.ms

const sameWords = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean =>
  a.length === b.length && a.every((word, at) => word === b[at])

// ── The member ────────────────────────────────────────────────────────────

/**
 * THE ONE MEMBER, as `@olai/surface` spreads it.
 *
 * A CELL and not a collection, which is where this slice deliberately differs
 * from the kolu one beside it. `fleet` is a collection because a busy machine
 * holds tens of terminals and a tab wants deltas over them; the set of LIVE CI
 * RUNS is bounded by the lanes a board is running at once — a handful — and
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
     * lanes' own `worktree` properties, probed for `.ci/odu.sock`. There is no
     * odu registry and odu changed nothing to make this work — which is the
     * property the whole arrangement was chosen for.
     *
     * `arrayKey: "id"` reaches BOTH arrays at both depths — the runs and the
     * nodes inside each — because every element of both carries an `id`. A
     * frame that merely repeats what a tab holds then notifies nothing
     * (juspay/kolu#2190), which matters here more than on most members: a
     * coordinator republishes its whole pipeline on every node transition, and
     * a ten-node run would otherwise wake every row of a lanes outline ten
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
