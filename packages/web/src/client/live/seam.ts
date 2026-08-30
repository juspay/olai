/**
 * LIVE PROPERTIES — the seam a property whose FACE MOVES ON ITS OWN hangs off.
 *
 * A run of chips is the right drawing for the thing a property almost always
 * is: a short fact, inline, several to a line. It is the wrong drawing for a
 * property whose value stands for something with a life of its own — a
 * terminal somebody is typing in, a CI run that is halfway through — where the
 * stored value is a decision-shaped NAME (`c56b6183`,
 * `.worktrees/live-properties`) and the useful drawing is whatever that name
 * currently is.
 *
 * So the drawer stops asking "is this the terminal key?" and asks the general
 * question instead: DOES THIS PROPERTY HAVE A DRESSING? One lookup, three
 * optional faces, and a property with no dressing draws as the chip it always
 * did.
 *
 * ## The three faces, and each keeps its honest name
 *
 * This module was `props/blocks.ts` and had ONE face, because the one consumer
 * owned a row. The second tenant does not, and the difference is what the seam
 * actually was:
 *
 *   - a **CHIP** draws IN the run, immediately after the property's own chip.
 *     BESIDE and not INSTEAD OF, which is the load-bearing word: the stored
 *     value is still a fact somebody greps by and edits, and a face that ate
 *     it would have had to grow the door lookup, the fold, the clamp and the
 *     text box the drawer's own chip already has. So the property keeps its
 *     chip and wears a second one when — and only when — the thing it names is
 *     alive. A `worktree` with no run draws `null` here and the line is
 *     exactly what it was; a `worktree` whose checkout is mid-run gains
 *     `ci · e2e 2m10s · 8/10 ok`. The pomodoro `⏱` beside a doing row is the
 *     same idea pointed inward (`./duration/`) — a readout that ticks off
 *     an instant that crossed the wire, drawn beside the thing it is about.
 *   - a **PANE** draws BELOW the run, when the chip's press opens it. A chip
 *     is an inline box in a wrapping line and cannot carry a screenful of
 *     monospace; the drawer already hangs things under the run for exactly
 *     this reason, and one open pane per run is the same arrangement the
 *     editor keeps for one open chip.
 *   - a **BLOCK** draws BELOW the run and owns a row, always. The terminal
 *     door is this: kolu's own Dock row, drawn where the property is, plus the
 *     live pane it opens — a face that is never quiet, because a terminal
 *     somebody named is a terminal worth a row.
 *
 * Nothing here is named for one dressing, which is the property the whole
 * design was chosen for: a third living thing later — a deploy, a saatchi
 * session — is a folder beside this file and a line in `./dressings.ts`, and
 * zero new mechanism.
 *
 * ## THE SEAM IMPORTS NO DRESSING, and the directory says which are which
 *
 * This file is a table, a lay-out and three interfaces. Beside it is one
 * FOLDER PER DRESSING, each named for what it IS and each registering itself
 * (the human's ruling on #433):
 *
 *   - `./kolu-terminal/` — the terminal door. One line, because the component
 *     is `@olai/kolu-ui`'s: that one stays behind a package wall since it
 *     renders kolu's own row and mounts kolu's emulator.
 *   - `./odu-ci/` — the CI chip and the run matrix, with their words, their
 *     per-node ink and the one subscription a tab holds. A folder rather than
 *     a package because it imports nothing of odu: a wall there would confine
 *     nothing.
 *   - `./duration/` — the ⏱ chip, and the one that registers NOTHING. It is a
 *     live face by every other measure (an instant that crossed the wire once,
 *     ticked by the reader's own clock) and it has no property key to hang
 *     off: a span is DERIVED from a record's own fields, so there is no entry
 *     for `dressingFor` to look up and the row draws it instead. Its own
 *     header argues that, and what moving it onto this table would take.
 *
 * So the directory has three folders and the table has two tenants, and that
 * is the honest shape rather than a table stretched to make three. What keeps
 * the direction clean is that nothing here imports any of them — `./dressings.ts`
 * is the one module that names them, imported for its effect by the drawer.
 *
 * ## Keyed on the KEY, and this is now an ANSWER rather than a promise
 *
 * The old header said this table would key on the declared KIND "the day typed
 * properties land". Typed properties landed, and the honest answer turned out
 * to be different, so it is written here rather than left as a debt somebody
 * would keep re-reading.
 *
 * A BROWSER CANNOT KEY ON A DECLARED TYPE, because a vault's declarations
 * deliberately do not travel (juspay/olai#395 — the tab receives ANSWERS, and
 * `@olai/format`'s `meaning.ts` argues why the question is settled where the
 * set is). Keying this table on a type would mean shipping the declarations to
 * every tab, which is the one decision that design made and did not want back.
 *
 * And keying on the type would be the wrong question anyway. `brief` and
 * `worktree` are both declared `path`, and only one of them names a checkout
 * to probe for a run — a face selected by type alone would dress both.
 *
 * So the seam is split along the line the architecture already draws. THE KEY
 * SELECTS the face, here, in the browser. THE DECLARED TYPE LICENCES it, on
 * the server, where the declarations are: `@olai/server`'s `worktrees.ts` probes a
 * `worktree` only in a vault that has declared that key a `path`, so the
 * promise a dressing rests on is one the vault made rather than one a
 * component assumed. A vault that declares nothing gets no CI cell, the chip
 * has nothing to say, and it draws as the path it always was.
 *
 * ## Three rules a dressing must satisfy, and they are the chip's own
 *
 * A dressing draws only where a chip would have drawn the same fact:
 *
 *   - **not a SYSTEM entry.** Those are fields with verbs of their own, and
 *     they are excluded everywhere else for that reason.
 *   - **one value.** A key holding three values is three facts, and a face
 *     that reports on one of them cannot report on three; the run of text it
 *     always was is the honest drawing (`../props/door.ts`'s wrong-door rule, one
 *     module over).
 *   - **not being EDITED.** A dressing is the READ face of a property and the
 *     chip is the WRITE face: while a value is open in an editor it draws as
 *     an ordinary chip, in the run, with the same box every other property is
 *     typed in. That is what stops every future dressing from having to grow
 *     its own text box, and it is why {@link layOut} takes `editing`.
 *
 * ## Where a face sits
 *
 * A CHIP sits immediately after its property's own chip, in the run, in the
 * file's own key order. A BLOCK and a PANE sit BELOW the run, in the file's
 * own key order among the other blocks. Not
 * interleaved: a run is one wrapping line and a block is a row, so
 * interleaving would cut the line into fragments whose `+` affordance and
 * add-chip have no single end to sit at.
 */

import type { JSX } from "solid-js"

import { TERMINAL_KEY, WORKTREE_KEY } from "@olai/surface"

import type { Entry } from "../props/drawer.ts"

/**
 * What a face is handed.
 *
 * The ENTRY and one verb, deliberately: a face that needed the node, the page
 * or the wire would be a face the drawer has to know something about, and the
 * point of the seam is that it does not. Everything else a face needs it reads
 * from a context of its own — which is what `@olai/kolu-ui`'s `fleet.tsx` and
 * `./odu-ci/runs.tsx` already are.
 */
export interface BlockContext {
  readonly entry: Entry
  /** Open this property's editor — `undefined` where the run is read-only, and
   *  then no half of the face is a button. */
  readonly onOpen?: () => void
  /**
   * THE RUN'S OWN CONTRACT, handed to the face rather than spelled by it.
   *
   * A face must wear the fact line every property wears —
   * `[data-testid="prop"][data-key=…]` with the drawer's handle on it — and
   * faces live in other packages now (`@olai/kolu-ui`'s terminal door is the
   * first). A face that spelled `"prop"` itself would be a second spelling of
   * this drawer's contract, free to drift the day the drawer changed it, with
   * the drawer's own suite still green because the face it broke is somewhere
   * else. So the drawer hands its furniture across and there is one spelling.
   */
  readonly chrome: BlockChrome
}

/** What a face is handed to wear the run's contract — see {@link BlockContext}. */
export interface BlockChrome {
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  readonly factId: string
  readonly valueId: string
}

/**
 * What a CHIP face is handed — {@link BlockContext} plus the one thing a chip
 * has that a block does not: whether its pane is open, and the verb that
 * toggles it.
 *
 * The state is the DRAWER'S rather than the chip's, and that is the same
 * arrangement the editor keeps one signal over: opening a second pane closes
 * the first, which is what a person means by clicking somewhere else. A chip
 * holding its own `open` could not know that. The verb is absent for a
 * dressing that registered no {@link Dressing.Pane} — then the chip is a
 * readout and not a button, and nothing anywhere has to remember that.
 */
export interface ChipContext extends BlockContext {
  readonly opened: boolean
  readonly onToggle?: () => void
}

/** A face that draws in the run, immediately after the property's own chip —
 *  and draws NOTHING (`null`) whenever the thing it is about is not alive,
 *  which is most of the time and is not a special case. */
export type PropChip = (context: ChipContext) => JSX.Element
/** ...what its press opens, below the run. */
export type PropPane = (context: BlockContext) => JSX.Element
/** ...and a face that owns a row whether or not anything is happening. */
export type PropBlock = (context: BlockContext) => JSX.Element

/** ONE LIVE PROPERTY'S DRESSING — see the header on the three faces. Every
 *  field is optional and a dressing with none of them is a property that draws
 *  exactly as it always did, which is the useful degenerate case rather than a
 *  mistake to guard against. */
export interface Dressing {
  readonly Chip?: PropChip
  readonly Pane?: PropPane
  readonly Block?: PropBlock
}

/**
 * WHICH PROPERTIES ARE LIVE.
 *
 * Registered rather than imported by the drawer, so adding one is this line
 * and a component — the drawer is closed to modification and open to
 * extension, which is the whole of what a dressing table buys.
 */
const DRESSINGS = new Map<string, Dressing>()

/** Dress a property key. Called once per dressing, at module load, from the
 *  module that owns the app's table — never from the component itself: a
 *  self-registrant would put an appliance in charge of the app's table, and
 *  the import direction would be a lie told by an `import "…"` with no
 *  binding. */
export const registerLive = (key: string, dressing: Dressing): void => {
  DRESSINGS.set(key, dressing)
}

/** The two keys the app dresses, re-exported so a registration reads in one
 *  line and each constant still has one home — `@olai/surface`, composed out
 *  of the appliance slice that owns it. Never the strings `"terminal"` and
 *  `"worktree"` here: a literal would be a second spelling waiting to drift
 *  from the one the server probes by. */
export { TERMINAL_KEY, WORKTREE_KEY }

/** The dressing for one entry, or `undefined` where it draws as a plain chip.
 *  The three rules are here rather than in the drawer so every future dressing
 *  gets them without restating them. */
export const dressingFor = (entry: Entry): Dressing | undefined => {
  if (entry.system) return undefined
  if (entry.values.length !== 1) return undefined
  return DRESSINGS.get(entry.key)
}

/** One entry, ready to draw: the entry and whatever it wears. */
export interface Laid {
  /** What draws inline, in the file's own key order — the chip run, each entry
   *  with the CHIP face that draws beside it (and the PANE that face's press
   *  opens), or `undefined` for the ordinary drawing. */
  readonly run: ReadonlyArray<{
    readonly entry: Entry
    readonly chip?: PropChip
    readonly pane?: PropPane
  }>
  /** What owns a row, in the file's own key order, below the run. */
  readonly blocks: ReadonlyArray<{ readonly entry: Entry; readonly block: PropBlock }>
}

/**
 * The entries, cut into what draws inline and what owns a row.
 *
 * `editing` is the key currently open in an editor, and it draws as a PLAIN
 * chip wherever it would otherwise wear anything — the read/write split the
 * header states, spelled in the one place that decides which is which.
 *
 * A dressing with a `Chip` stays IN the run: its face draws beside the
 * property's own, so moving the entry would be the seam re-laying a line out
 * because a component got more interesting. A dressing with a `Block` leaves
 * it, and a
 * BLOCK WINS where a dressing declares both — one property is one place on the
 * page, and a face that owns a row has already said which place that is.
 * Nothing registers both today; the rule is here so the answer is decided
 * where the lay-out is rather than discovered in a screenshot.
 */
export const layOut = (
  entries: ReadonlyArray<Entry>,
  editing?: string,
): Laid => {
  const run: Laid["run"][number][] = []
  const blocks: { entry: Entry; block: PropBlock }[] = []
  for (const entry of entries) {
    const dressing = entry.key === editing ? undefined : dressingFor(entry)
    if (dressing?.Block !== undefined) blocks.push({ entry, block: dressing.Block })
    else run.push({ entry, chip: dressing?.Chip, pane: dressing?.Pane })
  }
  return { run, blocks }
}
