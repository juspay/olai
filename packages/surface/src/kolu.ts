/**
 * @olai/surface's KOLU HALF — what a reader is told about the padi link and
 * the fleet behind it.
 *
 * Three members, declared here because they are one subject and `./index.ts`
 * is already long: the LINK (a cell), the FLEET (a collection), and the
 * SNAPSHOT (a procedure). They are the wire half of
 * `docs/brainstorming/orchestrator.md`'s first row — padi mirrored into olai —
 * and phase 1a's whole visible payoff is one property chip drawing them.
 *
 * ## These are olai's shapes, not padi's, and that is the point
 *
 * Nothing here imports `@kolu/padi-client`. A `PadiTerminal` is a union of
 * three arms carrying a live PTY's whole record; what a chip and a lane row
 * need is a flat projection of about eight fields. Re-exporting padi's schema
 * would put the daemon's contract on olai's wire — every browser would decode
 * it, every skew in it would be a skew here, and `@olai/kolu-client` would have
 * stopped being the only place that knows padi exists. So the projection is
 * declared in olai's own vocabulary and that package is the one thing that maps
 * between them.
 *
 * The reverse pressure is real and worth naming: two schemas can drift. What
 * keeps them together is that the mapping is one function with a type error
 * waiting at each end of it, and that this projection deliberately holds only
 * fields whose MEANING is stable (an id, a face, a path, a branch) rather than
 * padi's own state machine.
 *
 * ## The five homes — the map, so a grep for `kolu` is not a reconstruction
 *
 * Five files in this repo carry kolu in their name or their imports, and they
 * are four independent concerns plus one twin. The list is kept in all five
 * headers on purpose (the fifth Löwy sitting, finding 4:
 * `docs/lowy-electricity/debate-2026-08-26.md`) — a reader who greps `kolu`
 * lands on whichever of them came first, and the map should be under that
 * reader's cursor rather than assembled out of the five files themselves.
 *
 *   - **`@olai/surface`'s `kolu.ts`** — THE WIRE SHAPES, and this file. What
 *     a browser is told about the link and the fleet, in olai's own
 *     vocabulary.
 *   - **`@olai/kolu-client`** — THE DIAL. The only package that speaks padi's
 *     wire: one socket per server, the standing mirror, the projection into
 *     those shapes.
 *   - **`@olai/server`'s join** — `runtime.ts`'s kolu half binds the three
 *     surface members to that dial; `claimants.ts` walks the vault for who
 *     OWNS a terminal.
 *   - **The web props** — `web/src/client/props/` reads both members as one
 *     subscription per tab and draws the chip; `web/src/client/padi/` is the
 *     header's link indicator, a second reader of the same cell.
 *   - **`@olai/chat`'s `kolu.ts`** — A TWIN, not a floor of that stack. A
 *     one-shot spawn-time probe (`@kolu/detect`, over MCP stdio) that tells
 *     the chat panel's agent this host runs a kolu. Shares no code with the
 *     four above, deliberately.
 *
 * What the map is FOR, from this file's position: nothing padi-shaped is
 * declared here, so a change to padi's contract cannot reach this file
 * without passing through the dial — which is the argument above, read from
 * the map's side rather than the wire's.
 */

import { PrInfoSchema } from "anyforge/schemas"
import { Schema } from "effect"

// ── The link ──────────────────────────────────────────────────────────────

/**
 * WHETHER THERE IS A PADI, and it is three states rather than a boolean.
 *
 *   - `connected` — dialed, the control-core handshake passed, the surface
 *     version is one this build speaks. The fleet below is live.
 *   - `absent` — nothing is serving that socket. The ORDINARY state on a
 *     machine that is not running kolu, which is why it is not an error: a
 *     vault opens, every page draws, and the terminal chips go hollow. A
 *     laptop with no kolu on it is not a broken olai.
 *   - `skew` — something IS serving that socket and this build cannot speak to
 *     it. Distinct from `absent` on purpose, because the two have opposite
 *     fixes: one is "start kolu", the other is "these two builds disagree, and
 *     here are the versions".
 *
 * The three are a `status` field rather than three schemas because every arm
 * carries the same four facts and a reader switches on one word.
 */
export const KoluStatus = Schema.Literals(["connected", "absent", "skew"])
export type KoluStatus = typeof KoluStatus.Type

export const KoluLink = Schema.Struct({
  status: KoluStatus,
  /**
   * The socket this reading is ABOUT — always present, on every arm, because
   * "nothing is there" is only actionable when a reader knows where olai
   * looked. It is also the one field that answers the question a hollow chip
   * provokes, which is "looked where?".
   */
  socket: Schema.String,
  /** Whether that path was TOLD to olai (`$PADI_SOCKET`) or derived from the
   *  rendezvous algebra — the difference between "your variable points
   *  nowhere" and "no padi is running at the default state root", which are
   *  two different things for a reader to go and fix. */
  told: Schema.Boolean,
  /** padi's own state root, from the control-core `hello`. `null` off the
   *  `connected` arm: an unreachable padi has no identity to report, and a
   *  fabricated one would be worse than a blank. */
  stateRoot: Schema.NullOr(Schema.String),
  /** The RUNNING padi's surface version — `null` when unreachable, and the
   *  whole point of the `skew` arm when it is not. */
  surfaceVersion: Schema.NullOr(Schema.String),
  /** What THIS build speaks, so a skew reads as a pair rather than as one
   *  number a reader has to look up. Always present — it is a build constant,
   *  known whether or not anything answered. */
  speaks: Schema.String,
  /** When this reading was taken, ISO. It moves when the STATUS moves and not
   *  on every re-read, so `since` means "has been like this since" rather than
   *  "was last polled at" — see the `equals` on the member. */
  since: Schema.String,
})
export type KoluLink = typeof KoluLink.Type

/**
 * The seed, and the honest one: a server that has not finished dialing has not
 * found padi absent — it has not looked yet.
 *
 * It is spelled `absent` anyway, and the reason is worth stating because the
 * alternative was a fourth arm. A fourth `unknown` state would reach every
 * renderer and every test for the sake of a window measured in milliseconds at
 * boot, and what a reader would see during it is the hollow chip they would see
 * a moment later if the answer really is absent. The COST of being wrong for
 * that window is zero (a chip that goes hollow and then lights up), where the
 * cost of a fourth arm is permanent. `since` tells the truth throughout.
 */
export const KOLU_UNDIALED: KoluLink = {
  status: "absent",
  socket: "",
  told: false,
  stateRoot: null,
  surfaceVersion: null,
  speaks: "",
  since: "",
}

/** Two readings that say the same thing about the link — the member's `equals`,
 *  so a re-dial that found exactly what it found last time publishes nothing
 *  and `since` does not creep. Everything but `since` is compared; `since` is
 *  what this predicate DECIDES, so comparing it would make every reading
 *  different from every other. */
export const sameKolu = (a: KoluLink, b: KoluLink): boolean =>
  a.status === b.status
  && a.socket === b.socket
  && a.told === b.told
  && a.stateRoot === b.stateRoot
  && a.surfaceVersion === b.surfaceVersion
  && a.speaks === b.speaks

/**
 * THE PROPERTY KEY the door hangs off.
 *
 * One constant: the server reads it to derive the ownership overlay, and the
 * browser reads it to decide which chip grows a dot. Here rather than in either
 * of them because it is the one fact both must agree on, and a string typed in
 * two places is a door that opens on one end only.
 *
 * KEYED ON THE KEY, not on a declared type. Keying off the declared type is
 * what this becomes the day typed properties land, and that is a rename-sized
 * migration deliberately not made a dependency of this phase (the roadmap's
 * `terminal-door` says so) — so it is one line, here, when somebody orders it.
 */
export const TERMINAL_KEY = "terminal"

// ── The fleet ─────────────────────────────────────────────────────────────

/**
 * WHO IN OLAI CLAIMS THIS TERMINAL — the overlay, and the half of a fleet row
 * that is not padi's.
 *
 * `node` is a node of this vault whose `terminal` property names this id: a
 * lane's implement step, today, and any node at all once somebody writes the
 * property somewhere else. It carries the id and the title because a fleet row
 * wants to be a link and a title read off a second lookup would be a second
 * reading of the same set.
 *
 * `unowned` is the honest majority — the human's own terminals, which olai has
 * no claim on and must not present as if it did.
 *
 * A DISCRIMINATED UNION rather than a nullable node, because the day the driver
 * lands there is a third arm (a terminal olai SPAWNED but no node names yet)
 * and a nullable field would have no room for it.
 */
export const FleetOwner = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("node"),
    id: Schema.String,
    title: Schema.String,
    /** Which outline declares it — so a row can open the file, and so two
     *  vaults' worth of nodes could never be confused for one. */
    file: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal("unowned") }),
])
export type FleetOwner = typeof FleetOwner.Type

/** The one `unowned` value, so a projection does not mint an object per row per
 *  revision for a fact that has no fields. */
export const UNOWNED: FleetOwner = { kind: "unowned" }

/**
 * ONE TERMINAL, as olai holds it — KOLU'S OWN ROW, projected flat.
 *
 * Every field but the last is an argument to `@kolu/solid-dockrow`'s
 * `DockRowProps`, and that is the whole design of this schema now: olai draws
 * kolu's Dock row rather than a row of its own, so what crosses the wire is
 * what that row's prop bag asks for and nothing else. `owner` is the one
 * addition, and it is here for `./fleet.ts`'s own law — a field crosses when
 * something draws it, and the owner is the half of a row that is olai's.
 *
 * ## Why the FOLDS run on the server and the ROW is what travels
 *
 * The row's pure folds (`bindStatePip`, `rowSubline`, `activePr`) read padi's
 * `TerminalMetadata` deeply — the active arm, the sleeping arm, the intent, the
 * PR. Running them in the BROWSER would mean shipping that record to every tab,
 * which is padi's contract on olai's wire: every browser decoding the daemon's
 * schema, every skew in it a skew here, and `@olai/kolu-client` no longer the
 * only place that knows padi exists. So they run once, where the mirror is, and
 * their ANSWERS travel.
 *
 * ## No closed set of kolu's vocabulary is declared here, ever
 *
 * `pip.variant`, `pip.glyph`, `pip.motion`, `bucket` and `agentState` are all
 * closed sets in kolu — and all of them are `Schema.String` on this wire. The
 * closed set has ONE home, the row package's own prop bag, which exports the
 * guards that narrow into it (`@kolu/solid-dockrow/rowValues`'s
 * `narrowAgentState`, `isDockRowBucket`, `isPipVariant` …). A second copy here
 * would drift silently: kolu's `satisfies never` fences fire in kolu, so a new
 * agent state would land as a literal this spec had simply never heard of.
 * `@olai/surface` also never imports `@kolu/terminal-vocab` for them — the
 * literals are not an array anywhere upstream (they compose per agent package),
 * so the import would compile the whole per-agent schema graph into an outline
 * wire spec. Ruled by the fifth Löwy sitting, 2026-08-26.
 *
 * `PrInfo` is the ONE kolu schema this file does import, and it is a different
 * kind of thing: `anyforge/schemas` is a wire vocabulary — a struct of forge
 * facts whose own header calls it "the wire vocabulary every forge adapter
 * speaks" — and its closure is `effect` and `ts-pattern`. Restating it here
 * would be a second spelling of a shape designed to travel, which is the drift
 * the paragraph above exists to prevent, reached from the other side.
 */
export const FleetTerminal = Schema.Struct({
  /** padi's terminal id — the same string a `terminal` property holds, which is
   *  what makes the chip a resolution rather than a search. */
  id: Schema.String,
  /**
   * THE BOUND PIP — `bindStatePip`'s answer, whole.
   *
   * Ten facts the row reads OFF this rather than from sibling props: the
   * paint (`variant`/`glyph`/`motion`), whether the terminal is effectively
   * active, whether an agent is blocked on YOU (`asking` — the one test every
   * kolu surface reads for that), the two liveness bits, the recede, and the
   * unread alert. They travel together because the row takes them together:
   * a row given them separately is a row whose wash and whose pip can
   * disagree.
   */
  pip: Schema.Struct({
    variant: Schema.String,
    glyph: Schema.String,
    motion: Schema.String,
    active: Schema.Boolean,
    asking: Schema.Boolean,
    bytesLive: Schema.Boolean,
    shellLive: Schema.Boolean,
    sleeping: Schema.Boolean,
    alert: Schema.Boolean,
    alertLabel: Schema.String,
  }),
  /** The row's ORDER/paint bucket, verbatim — narrowed browser-side by
   *  `isDockRowBucket`. */
  bucket: Schema.String,
  /** The agent's state as kolu spells it, or `null` for a terminal with no
   *  agent in it. A PLAIN STRING on purpose (see above): the browser narrows it
   *  through `narrowAgentState`, which keeps an unrecognised word rather than
   *  normalising it onto a neighbour — so a newer padi's state reaches the row
   *  as itself and the row paints it quiet, which is what kolu does. */
  agentState: Schema.NullOr(Schema.String),
  /** The annotation line, as markdown source: kolu's intent line 1, else the
   *  branch. The row renders it through the `renderLabel` a consumer injects. */
  label: Schema.String,
  /** The ink that line is drawn in — the per-branch hue. */
  labelColor: Schema.String,
  /** The status words on line 2, and whether they are an AGENT's words rather
   *  than a foreground process's title. */
  subline: Schema.Struct({ text: Schema.String, fromAgent: Schema.Boolean }),
  /** The row's pull request, or `null`. `anyforge`'s own schema — see above. */
  pr: Schema.NullOr(PrInfoSchema),
  /** Epoch millis of the last activity padi saw, or `null` for never. The row's
   *  recency RENDERING is computed from the pip (`recencyMode`) and the text is
   *  formatted against a clock, which is the app's: kolu's package deliberately
   *  does not own one, so what crosses is the instant and not a phrase that
   *  would be stale before it arrived. */
  recencyAt: Schema.NullOr(Schema.Number),
  /** The repository this terminal is in, or `null` — the key the repo tint is
   *  hashed from, and the one word a pane header falls back to. */
  repo: Schema.NullOr(Schema.String),
  owner: FleetOwner,
})
export type FleetTerminal = typeof FleetTerminal.Type

// ── The snapshot ──────────────────────────────────────────────────────────

/** What a click asks for: one terminal, and how much of its scrollback. */
export const SnapshotRequest = Schema.Struct({
  terminal: Schema.String,
  /**
   * How many lines from the END of the buffer. Optional; the server picks a
   * screenful when it is absent.
   *
   * A COUNT-BACK rather than padi's `startLine`/`endLine` window, and the
   * window is NOT what reaches padi — this end asks for the whole rendered
   * buffer and takes the tail beside the padi hop
   * (`@olai/kolu-client`'s `screen.ts`, which argues it in full).
   *
   * That is worth stating on the WIRE's own declaration rather than only where
   * the read happens, because the tempting edit is to "restore" the window and
   * pass this count through as `startLine`. padi's window is ABSOLUTE from the
   * start of scrollback, so that spelling returns the empty string for any
   * terminal shorter than `lines` — most of them — and the pane draws a
   * legitimate-looking empty snapshot. It is how this shipped once.
   */
  lines: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
})
export type SnapshotRequest = typeof SnapshotRequest.Type

export const Snapshot = Schema.Struct({
  /** The screen text, verbatim, newline-separated. Empty is a legitimate
   *  answer — a terminal that has printed nothing. */
  text: Schema.String,
  /** WHEN it was read, ISO — the pane's "snapshot · just now" is a rendering
   *  of this and not of the moment the frame arrived, so a slow read reads as
   *  slightly old rather than as fresh. */
  at: Schema.String,
})
export type Snapshot = typeof Snapshot.Type

/**
 * WHY A SNAPSHOT COULD NOT BE TAKEN — declared, because both arms are things a
 * reader is owed rather than faults.
 *
 * `no-padi` is the hollow state arriving at a button somebody pressed: the
 * link went down between the chip drawing and the click. `no-terminal` is the
 * id naming nothing the fleet holds — padi answering `TerminalNotFound` for a
 * dormant record, or a property naming a terminal that has been closed, which
 * is the expected answer for a lane that finished an hour ago.
 *
 * `ambiguous` is the third and it is a fact rather than a fault: the board
 * writes eight-character prefixes, and a prefix can name more than one
 * terminal. Its own arm because its FIX is its own — write more of the id —
 * where the other two are "start kolu" and "that one is gone".
 */
export class SnapshotRefused extends Schema.TaggedError<SnapshotRefused>(
  "@olai/surface/SnapshotRefused",
)("SnapshotRefused", {
  reason: Schema.Literals(["no-padi", "no-terminal", "ambiguous"]),
  /** The sentence a pane prints. Built where the refusal is, so the two faces
   *  that can show it cannot word it differently. */
  says: Schema.String,
}) {
  override get message(): string {
    return this.says
  }
}

// ── The live pane ─────────────────────────────────────────────────────────

/**
 * ONE FRAME OF A LIVE TERMINAL — what a pane that is ATTACHED receives.
 *
 * The snapshot pane took a photograph; this is the window. padi already serves
 * the shape (`streams.terminalAttach`) and olai relays it: the FIRST frame of
 * any attach is a `snapshot` — the serialized screen, escape sequences and all,
 * plus the absolute mirror line it starts at — and every frame after it is a
 * `delta`, the bytes the terminal emitted, verbatim and in order.
 *
 * A REFUSAL IS A FRAME, not a failed stream. The member has no error channel
 * by construction — a surface stream either yields its output type or ends —
 * and that is the right shape here rather than a limitation worked around: the
 * three reasons a window cannot open (no padi, no such terminal, a value naming
 * three of them) are things a reader ACTS on, so they are content, not
 * transport. A stream that merely ENDED would say "this terminal closed", which
 * is a fourth fact and not one of these.
 *
 * A DISCRIMINATED UNION rather than a string with an optional field, which is
 * padi's own decision one hop up and is right for the same reason here: a
 * consumer must not be able to write a snapshot's bytes into a terminal without
 * having reset it first, and a shape where the two are the same arm is a shape
 * where that mistake compiles. A re-attach after an overflow sends a fresh
 * `snapshot`, so the arm is also the instruction: START AGAIN FROM HERE.
 *
 * ## Why olai declares it rather than re-exporting padi's
 *
 * `@olai/surface` never imports `@kolu/padi-client` — the wire spec would then
 * carry the daemon's whole contract, which is the argument this file's header
 * makes about the fleet. So these are olai's own three fields, and the mapping
 * is one function in `@olai/kolu-client` with a type error waiting at each end.
 * They are also the whole of what crosses: padi's frame carries a reflow epoch
 * for a scrollback-backfill cursor olai does not have, and a field nothing
 * draws does not cross (`fleet.ts`'s law).
 */
export const TerminalFrame = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("refused"),
    /** Why there is no window — the same sentences the snapshot pane refuses
     *  with, because a pane that opened on a value naming three terminals wants
     *  the same words whichever rung it is on. */
    says: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("delta"),
    /** The bytes, verbatim — written straight into the terminal. */
    data: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("snapshot"),
    /** The serialized screen. A reader RESETS before writing it. */
    data: Schema.String,
    /** The absolute mirror line the screen starts at. Carried because it is
     *  what a scrollback read would be asked for, and because a snapshot
     *  without it is a screen a reader cannot place. */
    topLine: Schema.Number,
  }),
])
export type TerminalFrame = typeof TerminalFrame.Type

/** WHICH terminal a pane is attached to. Its own struct rather than a bare
 *  string for the reason every input here is: a member's input is a place
 *  fields get added, and a widened bare string is a breaking change. */
export const TerminalAttach = Schema.Struct({ terminal: Schema.String })
export type TerminalAttach = typeof TerminalAttach.Type
