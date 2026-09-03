/**
 * @olai/surface's KOLU HALF — what a reader is told about the padi link and
 * the fleet behind it.
 *
 * Four members held here, in one file, because they are ONE subject and
 * `./index.ts` is already long: the LINK (a cell), the FLEET (a collection),
 * the EVENTS (a second collection — the watcher's ring: not a snap of any
 * fleet row, a line-keeping of the MOMENTS that demanded one), and the
 * SNAPSHOT (a procedure). They are the wire half of
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/orchestrator.md`'s first row — padi mirrored into olai —
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
 * ## The two packages — the map, so a grep for `kolu` is not a reconstruction
 *
 * It was FIVE homes, and the list lived in five headers because a reader who
 * grepped `kolu` landed on whichever came first and had to assemble the rest.
 * The sixth Löwy sitting ended that arrangement rather than documenting it
 * better (`https://github.com/juspay/oss.olai/blob/main/projects/olai/lowy-electricity/debate-2026-08-27.md`), on the human's ruling:
 * *"all of Kolu stuff should be encapsulated out, as a package or more
 * packages, so the non-kolu packages part of Olai doesn't contain Kolu
 * implementation"* — and *"a directory wall can be broken easily by importing;
 * package walls cannot."*
 *
 *   - **`@olai/kolu-client`** — THE DIAL and the wire. The only package that
 *     speaks padi: one socket per server, the standing mirror, the projection
 *     into olai's own shapes. Four doors beside the root — `./wire` (the
 *     vocabulary and the four surface members, which `@olai/surface` spreads
 *     into its spec and re-exports), `./detect` (the spawn-time probe's
 *     surface), `./testlib` (the fake padi and its lifecycle) and `./drivers`
 *     (the two padi-dialing evidence scripts).
 *   - **`olai-plugin-kolu`'s `src/appliance/`** — EVERYTHING BROWSER. The Dock row on a
 *     `terminal` property, the live pane, the re-attach policy, the fleet the
 *     tab holds once, and the words the header readout says. Its socket is
 *     `KoluUi` — the app hands over its composed client and a clock, and
 *     nothing else crosses. It was a package of its own (`@olai/kolu-ui`) until
 *     the appliance fold folded it into the tenant beside the judgement.
 *
 * What is left outside them is not kolu implementation but olai's own
 * judgement ABOUT kolu, and it has a package of its own now:
 * `olai-plugin-kolu`. It walks the vault for who OWNS a terminal
 * (`claimants.ts` — outline records, injected into the dial rather than known
 * by it) and for what `_olai/Kolu.olai` says (`config.ts`); it decides what an
 * absent kolu MEANS, in five English sentences, over the probe it reaches
 * through `@olai/kolu-client/detect` (`probe.ts`, which was `@olai/chat`'s
 * until the plugin wall went up); and it owns the padi pill and the feed its
 * press opens. Every one of those used to sit in a general package under a
 * kolu-shaped filename, and none of them names a `@kolu/*` package —
 * everything reaches kolu through this one and `olai-plugin-kolu`, which is what
 * `packages/bundle/src/fence.test.ts` holds as a fact rather than a habit —
 * it absorbed the assertion `scripts/check-kolu-deps.sh` used to make, and the
 * script that kept the name asks about manifests now, not imports. It holds it
 * by DERIVING the tenant from the registry, so the fold that moved kolu's faces
 * into the plugin package moved the wall with them and nothing was edited here.
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

/**
 * WHERE THE WATCHER'S HEART IS, at last count — the pill's only liveness
 * fact.
 *
 * The AT is the beat's own timestamp — ISO, like every `KoluEvent` row's.
 * The `everyMs` is the CADENCE: the vault's `heartbeat:` knob, in
 * milliseconds, as the watcher is currently configured. The pill doesn't
 * know the knob, so the cadence rides beside the stamp: the fold's answer
 * to "has the pulse gone quiet" is arithmetic the header can do itself
 * without a second reader (the fold — `padiSaid`'s — eats
 * `age > everyMs * 2`).
 */
export const WatchPulse = Schema.Struct({
  /** The beat — and the entry's only wall-clock truth about liveness. */
  at: Schema.String,
  /** The vault's `heartbeat:` knob at this beat's reading, in
   *  milliseconds — the cadence the stamp answers to. */
  everyMs: Schema.Number,
})

export type WatchPulse = typeof WatchPulse.Type

/** No beat has been read yet — the pill before the watcher exposed its
 *  cadence. The door answers `kolu` on its own, the quiet face of the
 *  fold: no recency value answers, so the header can't compute an age. */
export const KOLU_UNPULSED: WatchPulse | null = null

/**
 * THE DRAWER'S FOOT — WHICH FILE DECIDES THE WATCH, and nothing else.
 *
 * The drawer's last line is not an event: it is the door onto the outline
 * the watcher reads its knobs from. `file` is which served outline the
 * convention named — read off the served OUTLINE PATHS rather than the
 * nodes (`olai-plugin-kolu`'s `koluFileIn` — shallowest, ties by path),
 * so a config that parses to nothing keeps the door that opens it, and
 * the drawer's navigation is a plain open of a page that exists rather
 * than a second spelling of the convention in a browser that holds only
 * paths. `null` is the watcher on its DEFAULTS: no file decided anything,
 * so there is no config page to open and the drawer draws no foot at all.
 *
 * IT USED TO CARRY A MUTE LIST TOO — `{file, names}`, the titles of the
 * terminals `_olai/Kolu.olai`'s `mutes` node silenced, narrowed to the
 * ones the watcher's fold could actually say. The mutes went with the
 * second doorbell (2026-08-31), and the cell was RENAMED rather than
 * dropped: the wake FILTER FILE a person picks per conversation is the
 * silence control now, and two silence mechanisms aimed at one fleet is
 * one too many — a terminal no scoped file claims wakes nobody, which is
 * the whole of what a mute was for. What could not go with them is the
 * WRENCH: its door has no other source on this wire, and the duration
 * knobs it opens survive whole.
 *
 * SO IT IS ONE FIELD AND STAYS A STRUCT. A bare `NullOr(String)` cell
 * would say the same thing today and would have to be re-SHAPED the day a
 * second standing fact about the config joins it; a struct makes that an
 * added key rather than a changed member, which is the difference between
 * a decode a stale tab survives and one it does not.
 */
export const KoluKnobs = Schema.Struct({
  /** Which file decided the config — see above. */
  file: Schema.NullOr(Schema.String),
})
export type KoluKnobs = typeof KoluKnobs.Type

/** The watcher-on-defaults reading: no file decided anything. Minted once,
 *  the way `KOLU_UNDIALED` is: before any revision lands, and on every face
 *  whose vault walk is not wired. */
export const NO_KNOBS: KoluKnobs = { file: null }

/** Two readings that say the same thing about the config — the cell's
 *  `equals`: the vault walk re-derives on every keystroke, and a revision
 *  that did not move the deciding file must publish nothing. */
export const sameKnobs = (a: KoluKnobs, b: KoluKnobs): boolean => a.file === b.file

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
 * THE PROPERTY KEY THE BROWSER'S DRESSING HANGS OFF.
 *
 * NOT THE LICENCE ANY MORE, and that is what changed under this constant. The
 * SERVER follows a declared KIND now — `olai-plugin-kolu`'s `terminal`, read
 * off `_olai/Properties.olai`, which is what decides whose fleet row a node
 * owns and which values the gate holds to a padi id. What is left here is the
 * word a TAB keys its dressing table on, and it is left because a tab has
 * nothing else: a vault's declarations deliberately do not travel
 * (juspay/olai#395), so "which face does this property wear" is a question no
 * browser can settle from a declared type until a wire member carries the
 * licence per drawn value.
 *
 * So the two halves may now disagree in one knowable way: a vault that declares
 * the KIND on a key called something else is walked and probed and draws no
 * chip. That is the gap, named where somebody grepping this constant will meet
 * it, rather than a promise to move.
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
 * `pip.variant`, `pip.glyph`, `bucket` and `agentState` are all
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
/**
 * THE BOUND PIP, as the wire carries it — `bindStatePip`'s answer, whole.
 *
 * Factored out of {@link FleetTerminal} because a SECOND carrier wants the same
 * bag: a watcher's frozen event row ({@link KoluEvent}) holds the pip exactly
 * as it was the moment the event fired, spelled the same way it is spelled when
 * live. Two spellings of the bag would be two answers to what a pip is, free to
 * drift — the rule the bag's own block below argues is why the audit did not
 * tolerate two `FleetTerminal`s.
 */
export const FleetPip = Schema.Struct({
  variant: Schema.String,
  glyph: Schema.String,
  active: Schema.Boolean,
  asking: Schema.Boolean,
  bytesLive: Schema.Boolean,
  hasAgent: Schema.Boolean,
  sleeping: Schema.Boolean,
  alert: Schema.Boolean,
  alertLabel: Schema.String,
})
export type FleetPip = typeof FleetPip.Type

export const FleetTerminal = Schema.Struct({
  /** padi's terminal id — the same string a `terminal` property holds, which is
   *  what makes the chip a resolution rather than a search. */
  id: Schema.String,
  /**
   * THE BOUND PIP — `bindStatePip`'s answer, whole.
   *
   * The facts the row reads OFF this rather than from sibling props: the paint
   * identity (`variant`/`glyph`), whether the terminal is effectively active,
   * whether an agent is blocked on YOU (`asking` — the one test every kolu
   * surface reads for that), whether an agent is driving it at all
   * (`hasAgent`), live PTY bytes, the recede, and the unread alert. They travel
   * together because the row takes them together: a row given them separately
   * is a row whose wash and whose pip can disagree.
   *
   * ## A DERIVED FIELD IS NOT A WIRE FACT — the rule, not a list of exceptions
   *
   * Two of the bag's members are FOLDS of others, and neither crosses: `motion`
   * is a total function of `variant` and `active`, and `shellLive` of
   * `variant`, `bytesLive` and `hasAgent`. What is on the wire is the INPUTS a
   * fold cannot recover, and `hasAgent` is here for exactly that reason — it is
   * the one thing `shellLive`'s fold needs that the rest of the bag does not
   * already say.
   *
   * The argument is one argument, and it is worth stating once rather than
   * re-reaching twice. A bag that carried a fold alongside its inputs can spell
   * a combination no producer generates — a `spin` beside `active: false`, a
   * `{ variant: "working", shellLive: true }` — and each of those is three
   * fields honest alone and lying jointly. Transporting one is also the wrong
   * answer on the merits, because a fold has to agree with the variant THIS
   * build will paint, which after narrowing may not be the one the wire named.
   * So a fold is recomputed, always, and the illegal combination is unspellable
   * rather than merely unlikely.
   *
   * THE TEST FOR THE NEXT FIELD that tempts somebody, so it is decided rather
   * than re-argued: can the row compute it from what the bag already carries?
   * Then it does not cross, and if the fold needs one input the bag lacks, that
   * INPUT crosses instead. Both of these arrived as kolu removals — `motion` in
   * kolu#2219, `shellLive` in the lens pass on #2219's head — and both times
   * olai had been transporting a field nothing read, which `fleet.ts`'s own law
   * already forbade.
   */
  pip: FleetPip,
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
  /**
   * WHICH KOLU THEME this terminal was created with, or `null`.
   *
   * A field that crosses because something DRAWS it (`./fleet.ts`'s law): the
   * live pane paints with kolu's own catalog (`terminal-themes`), so a terminal
   * looks in olai exactly as it looks in kolu rather than in xterm's washed-out
   * default — the human's ruling on the first live look. `null` is a terminal
   * padi has no theme recorded for, and the catalog's own fallback answers it.
   */
  themeName: Schema.NullOr(Schema.String),
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

// ── The events feed ───────────────────────────────────────────────────────

/**
 * THE THREE THINGS THE WATCHER CAN SAY — the kinds a `KoluEvent` carries.
 *
 * The first two spell the same word padi's own state watch does
 * (`@kolu/padi-client`'s `PadiStateEvent`), and that is deliberate rather than
 * theft: olai's watcher computes over the mirror it already holds the events
 * the orchestrator today gets from a hand-armed `kolu watch`, and the soak
 * that proves the ladder runs the two in parallel — one jargon, two channels,
 * and nothing for a reader to translate.
 *
 *   - `transition` — a terminal entered `awaiting` or `waiting` and HELD it
 *     for `held-for`. The debounce says this: a turn that ends and is handed
 *     more work inside the window was never said at all.
 *   - `nag` — it is STILL holding, one `nag` interval after it was last said.
 *     The level-trigger: an ignored terminal comes back instead of vanishing
 *     after one line.
 *   - `heartbeat` — the watcher is alive and watching. It names NO terminal:
 *     a reader who has seen nothing for half an hour needs to be able to tell
 *     "nothing matched" from "nothing is running". The kind survives as the
 *     spelling; the RING eats attention events only — boot and liveness sit
 *     on the `pulse` cell instead ({ ./index.ts}'s `pulse` member).
 */
export const KOLU_EVENT_KINDS = ["transition", "nag", "heartbeat"] as const

/**
 * ONE WATCHER EVENT — what the recent-events feed is made of.
 *
 * The kinds are padi's spellings (see {@link KOLU_EVENT_KINDS}); the shape is
 * olai's own, and deliberately NOT padi's event: where padi hands the watcher
 * a terminal id and lets the recipient read the screen for itself, THIS event
 * freezes enough of the FleetTerminal row at the instant it fired to be drawn
 * on its own. A log row is a fact at a time: the event that said a terminal
 * held `awaiting` for three hours still says it after the terminal is back at
 * work, and its row does not repaint to the way the fleet now sees it. That is
 * also what frees the UI from the fleet a dead terminal has left.
 *
 * `row` is `null` on `heartbeat` and ONLY then: a heartbeat names no terminal
 * because nobody is blocked and nothing is held.
 */
export const KoluEvent = Schema.Struct({
  /** ONE EMISSION's own id. `ev-<seq>` on a per-server monotonic counter, which
   *  is also the collection's key: a fresh subscriber is snapshotted from the
   *  ring with it, and nags and transitions on one terminal are _rows_ not
   *  patches. */
  id: Schema.String,
  kind: Schema.Literals(KOLU_EVENT_KINDS),
  /** WHEN it fired, ISO. */
  at: Schema.String,
  /** WHOSE event it is — the row frozen as it was the moment it fired, so that
   *  a feed drawn on a fleet the terminal has since left (or after a link flap
   *  that emptied the fleet) still shows what the watcher saw. `null` on
   *  `heartbeat`. */
  row: Schema.NullOr(Schema.Struct({
    terminal: Schema.String,
    /** The held bucket, as kolu spells it — `awaiting` or `waiting`
     *  (`@kolu/terminal-vocab`'s `agentBucket`). What the watcher matched on and
     *  what the feed's wording keys off. */
    state: Schema.String,
    /** The agent state VERBATIM as the row spelled it at the time
     *  (`awaiting_user`, `waiting`). The subline's words come from this. */
    agentState: Schema.String,
    /** The bound pip, frozen, with one edit: `active` and `bytesLive` are
     *  stamped `false`, because they are LIVE facts and a log row must not
     *  flash motion for something that might have been quiet for hours. The
     *  rest is verbatim from the same `FleetPip` bag the fleet carries — one
     *  spelling, two carriers. */
    pip: FleetPip,
    /** The order/paint bucket, frozen. */
    bucket: Schema.String,
    /** The annotation line (intent, else branch) and its ink, frozen. */
    label: Schema.String,
    labelColor: Schema.String,
    /** THE REPOSITORY, frozen — the row's only DISAMBIGUATOR: three
     *  terminals' labels can all read `master` (the human's drawer
     *  screenshot, on the first real free-for-all watch). The fold that
     *  names it is `repo·label` — kolu's own `repo·branch` spelling the
     *  Dock's grouping answers — and a terminal with no repo carries a
     *  `null`, so the row shows what the Dock's own group shows in that
     *  case: the label alone. */
    repo: Schema.NullOr(Schema.String),
    /** WHEN this server first saw the terminal holding this state, ISO. It is
     *  an OBSERVATION-lifetime clock: olai's restart re-dates every standing
     *  hold — the difference is an ordinary restart, not a lie. A LINK flap
     *  does not: the hold's clock is the watcher's own, not the record's —
     *  padi's daemon keeps `since` through a client reconnect, and this
     *  clock follows that (`@olai/kolu-client`'s `A link drop is not a
     *  closing fleet`). */
    since: Schema.String,
  })),
})
export type KoluEvent = typeof KoluEvent.Type

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
    /**
     * THE COLS × ROWS THIS SCREEN WAS SERIALIZED AT, or `null` from a padi too
     * old to say.
     *
     * The field an observe-only pane cannot work without, and the reason this
     * lane asked kolu for it (5.5, additive): a monitor passes no `resizeTo`,
     * so it never learned what size it received and sized its renderer by
     * guess — and a mismatched box wraps the bytes into garbage. The frame is
     * self-describing now, so the pane ADOPTS the grid rather than asserting
     * one.
     *
     * `null` rather than absent on olai's wire, for this schema's standing
     * reason: absent and empty would be two spellings of one fact, and every
     * reader would ask the question twice. A pane that gets `null` keeps the
     * size it has — the honest move, since guessing is what the field exists to
     * stop.
     */
    grid: Schema.NullOr(Schema.Struct({ cols: Schema.Number, rows: Schema.Number })),
    /** The absolute mirror line the screen starts at. Carried because it is
     *  what a scrollback read would be asked for, and because a snapshot
     *  without it is a screen a reader cannot place. */
    topLine: Schema.Number,
  }),
])
export type TerminalFrame = typeof TerminalFrame.Type

export const TerminalAttach = Schema.Struct({
  terminal: Schema.String,
  /**
   * THE GRID THE PANE IS ASKING AT — and asking is the point.
   *
   * An attach that carries one is a WRITE: padi resizes the terminal to it
   * before serializing, last-attach-wins on a shared pty. This lane spent a
   * round treating that as damage and going observe-only, and the human
   * overruled it — ATTACH MEANS THE SAME SIZE ON EVERY CLIENT, which is what
   * kolu's own client has always done and what makes a pane show the terminal
   * rather than a rendering of it. Opening a pane resizes the pty; that is the
   * semantic, not a defect in it.
   *
   * BOTH OR NEITHER, padi's own rule one wire up: a grid is a cols AND a rows,
   * so half a grid must not be representable. Optional because a pane that has
   * not measured yet has none to ask at.
   */
  grid: Schema.optional(Schema.Struct({ cols: Schema.Number, rows: Schema.Number })),
})
export type TerminalAttach = typeof TerminalAttach.Type
