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

// ── The dot's vocabulary ──────────────────────────────────────────────────

/**
 * THE FOUR FACES a `terminal` chip's dot can wear — the closed set, declared
 * HERE because both ends read it and neither owns it.
 *
 * The server folds padi's agent states into one of these
 * (`@olai/kolu-client`'s `face.ts`, the only module in olai that has ever seen
 * a padi record) and the browser paints it. Declaring it in the surface is what makes that a
 * contract rather than two hand-copied switches — the class of defect kolu's
 * own `agentProjection.ts` header spends a page on, one wire further out.
 *
 *   - `working` — an agent is thinking, running a tool, or working in the
 *     background. Green, steady.
 *   - `awaiting` — an agent is BLOCKED ON YOU. Amber, pulsing, because it is
 *     the one face that is a request rather than a report.
 *   - `parked` — nothing is being asked of you and nothing is moving: a
 *     dormant record, a plain shell, or an agent whose turn is over.
 *   - `gone` — the fleet does not hold this terminal. NOT a value {@link
 *     FleetTerminal} can carry (a row that exists is a terminal that does); it
 *     is what a LOOKUP answers, so it lives in the vocabulary and not in the
 *     row. A property naming a retired terminal is still a true record of
 *     where the work happened, and a gray dot would imply it is sitting there
 *     idle.
 *
 * PADI BEING ABSENT IS NOT ONE OF THESE. A face is a reading of a record; no
 * padi means no records to read, which is a fact about the LINK ({@link
 * KoluLink}). Folding it in here would make "we cannot see" indistinguishable
 * from "we looked and it is quiet", which is the one confusion a status dot
 * must not have.
 */
const FACE_KEYS: Record<"working" | "awaiting" | "parked" | "gone", null> = {
  working: null,
  awaiting: null,
  parked: null,
  gone: null,
}
export type DotFace = keyof typeof FACE_KEYS
/** The set as a value, so a renderer's tone table is a `Record<DotFace, …>`
 *  and a fifth face is a compile error there rather than a colour nobody
 *  wrote (kolu's `ATTENTION_CLASS_KEYS` is the pattern). */
export const DOT_FACES = Object.keys(FACE_KEYS) as ReadonlyArray<DotFace>

/** The three a fleet ROW can wear — every face but `gone`, which is what an
 *  absent row already says. Spelled once so the schema below and the fold that
 *  fills it cannot disagree about which three. */
export const LIVE_FACES = ["working", "awaiting", "parked"] as const satisfies
  readonly Exclude<DotFace, "gone">[]

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
 * ONE TERMINAL, as olai holds it.
 *
 * `face` is the fold (`@olai/kolu-client`'s `face.ts`) and not the raw
 * agent state, and that is the projection's main decision: what crosses is the
 * ANSWER a chip draws, computed once on the server against padi's own
 * vocabulary, rather than the state literals every consumer would then have to
 * fold for itself. The literals are exactly what churn — kolu adds an agent
 * state and every downstream switch is a hand-copy that silently routes to
 * idle. Sending the fold means a new state is a change in one file.
 *
 * `gone` is not a value this schema can carry: an absent row IS gone, and a
 * row that carried the word would be a row about a terminal that is not there.
 * The face vocabulary has four members and a fleet entry can wear three.
 */
export const FleetTerminal = Schema.Struct({
  /** padi's terminal id — the same string a `terminal` property holds, which is
   *  what makes the chip a lookup rather than a search. */
  id: Schema.String,
  /** `working` | `awaiting` | `parked`. Not `gone`: see above. */
  face: Schema.Literals(LIVE_FACES),
  /** padi's own record state, kept beside the fold because `parked` has two
   *  quite different causes (a dormant record, a live shell doing nothing) and
   *  a fleet row has room to say which. A chip does not draw it. */
  state: Schema.Literals(["active", "sleeping", "parked"]),
  /** The agent's short vendor name (`claude`, `grok`, `pi`), or `null` for a
   *  terminal with no agent in it. */
  agent: Schema.NullOr(Schema.String),
  /** Where it is working. `null` where padi's record does not carry one. */
  cwd: Schema.NullOr(Schema.String),
  repo: Schema.NullOr(Schema.String),
  branch: Schema.NullOr(Schema.String),
  worktree: Schema.NullOr(Schema.String),
  /** What the terminal was created FOR — kolu's own intent line. */
  intent: Schema.NullOr(Schema.String),
  /** Epoch millis of the last activity padi saw, or `null` for never. Epoch
   *  rather than ISO because it is padi's own number and a reformat here would
   *  be olai restating a fact it did not measure. */
  lastActivityAt: Schema.NullOr(Schema.Number),
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
