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
 * session — is a `dressings` line on a third plugin's manifest and ZERO new
 * mechanism, in this file or in any other of this app's.
 *
 * ## THE SEAM IMPORTS NO DRESSING, and now it cannot
 *
 * This file is a table, a lay-out and three interfaces, and it reaches no face
 * at all. That rule is unchanged and the way it is KEPT has got stronger: the
 * two dressings this app installs are not folders beside this one any more, they
 * are packages (`@olai/plugin-kolu`, `@olai/plugin-odu`), and this package may
 * not name one — `packages/plugins/src/fence.test.ts` holds that as an equality
 * per package rather than as a habit. So the direction is physics here rather
 * than discipline.
 *
 * `./dressings.ts` is still the ONE module that names them all, imported for its
 * effect by the drawer, and it names them the way a general package is allowed
 * to: by WALKING THE REGISTRY. Its own header argues the reversal from the two
 * side-effect imports it replaced, and what that buys.
 *
 * One folder does remain beside this file, and it is the one that registers
 * NOTHING: `./duration/`, the ⏱ chip. It is a live face by every other measure
 * (an instant that crossed the wire once, ticked by the reader's own clock) and
 * it has no property key to hang off — a span is DERIVED from a record's own
 * fields, so there is no entry for `dressingFor` to look up and the row draws it
 * instead. Its own header argues that, and what moving it onto this table would
 * take. Its ladders are also what the app hands a plugin's live face across
 * (`../plugins/furniture.tsx`), so one register serves both sides of the wall.
 *
 * ## Keyed on the declared KIND, which the page ANSWERS for
 *
 * The table's key is the WORD a plugin taught the vault — `terminal`,
 * `worktree` — and never the property key a value happens to sit under. That is
 * what the server has always followed: `@olai/plugin-odu`'s `worktrees.ts`
 * probes only the keys a vault declared its own `worktree` KIND, where the
 * licence used to settle for the format's `path` and could therefore not tell
 * `brief` from a checkout. So the promise a dressing rests on is one the vault
 * made rather than one a component assumed.
 *
 * IT USED TO BE THE PROPERTY KEY, and that was a real defect rather than a
 * simplification. A BROWSER CANNOT KEY ON A DECLARED TYPE — a vault's
 * declarations deliberately do not travel (juspay/olai#395 — the tab receives
 * ANSWERS, and `@olai/format`'s `meaning.ts` argues why the question is settled
 * where the set is) — so this table settled for the one thing a tab had, and
 * the two halves agreed only while a vault named its key after the kind. A
 * vault declaring `terminal` on a key called `pty` was walked, probed and gated
 * on the server and drew NOTHING here.
 *
 * What closed it is not a declaration on the wire and not a wire member: the
 * page's own consult mints an ANSWER PER DRAWN VALUE — `from`, `prop`, `value` →
 * the word, when a running plugin's kind claims it — and it rides beside the
 * doors table it is a twin of (`@olai/format`'s `Licence`, `../licences.ts`).
 * The tab still receives answers and still cannot re-derive a rule; #395 is
 * untouched. What changed is only which question the answer is to.
 *
 * SO THERE ARE TWO LICENCES AND THEY ASK DIFFERENT THINGS, both spent in
 * {@link dressingFor}. The page's says THIS VALUE is claimed by that word, which
 * is a fact about the vault. The roster's ({@link Running}) says THIS SERVE is
 * running the plugin that owns the face, which is a fact about the process. They
 * agree in every ordinary case — both fall out of `--plugins` — and they arrive
 * on different frames, so the second is what keeps a face off the page in the
 * instant before a roster lands.
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

import type { Entry } from "../props/drawer.ts"

/**
 * What a face is handed.
 *
 * The ENTRY and one verb, deliberately: a face that needed the node, the page
 * or the wire would be a face the drawer has to know something about, and the
 * point of the seam is that it does not. Everything else a face needs it reads
 * from a context of its own — which is what `@olai/kolu-ui`'s `fleet.tsx` and
 * `@olai/plugin-odu`'s `runs.tsx` already are.
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
const DRESSINGS = new Map<string, { readonly dressing: Dressing; readonly plugin: string }>()

/** Dress a contributed KIND. Called once per dressing, at module load, from the
 *  module that owns the app's table (`./dressings.ts`) — never from the
 *  component itself: a self-registrant would put an appliance in charge of the
 *  app's table, and the import direction would be a lie told by an `import "…"`
 *  with no binding.
 *
 *  THE WORD IS THE PLUGIN'S OWN CONSTANT, arriving on its manifest — the same
 *  one its `kinds` table declares and its server walk follows, which is the
 *  whole of the fix: one spelling, one authority. It was the property KEY for
 *  one PR window, because a tab had nothing else, and the two halves silently
 *  disagreed for any vault that named a key something other than the kind.
 *  Before that it was re-exported from here, as `TERMINAL_KEY` and
 *  `WORKTREE_KEY` off `@olai/surface`, so a registration could read in one line;
 *  that re-export is gone with the registrations, and the reason is the
 *  direction rather than tidiness — this package may not name a plugin, and a
 *  general seam holding two tenants' words was the last place core spelled
 *  one. */
export const registerLive = (word: string, dressing: Dressing, plugin: string): void => {
  DRESSINGS.set(word, { dressing, plugin })
}

/**
 * IS THE PLUGIN THAT OWNS THIS FACE ACTUALLY RUNNING — asked at DRAW, not at
 * registration, and the difference is the whole of what `--plugins` means in a
 * browser.
 *
 * A tab registers what the BUILD has, because that is all it can know at import
 * time: the enabled set is a fact about the SERVE, and it arrives on a cell
 * after the wire is up (`../wire.ts` argues why the browser does not wait for
 * it). So registration is the build's and the LICENCE is the serve's, and this
 * is where the second one is spent.
 *
 * Without it a disabled plugin's face still draws — in its own "nothing here"
 * arm, which is a row that says there is no daemon rather than the plain chip
 * an undressed property has always drawn. That is not the absent state; it is a
 * complaint about a tool the operator deliberately turned off, and it took a
 * screenshot of a serve with `--plugins=` to see it.
 */
export type Running = (plugin: string) => boolean

/** What a page with no roster yet answers: everything the build has. It is the
 *  same answer the built-in default gives, so a tab that has not yet heard from
 *  the server draws what it will keep drawing in the ordinary case rather than
 *  flashing every face off and on. */
export const ALL_RUNNING: Running = () => true

/**
 * WHAT WORD CLAIMS A VALUE ON THIS PAGE — the page's own answer, narrowed to the
 * one file this run is drawn from.
 *
 * The full table is keyed by the TRIPLE (`../licences.ts`), because the file a
 * value was written in is part of its identity. A run is all from one file, so
 * what the drawer hands down is that lookup with its `from` already spent —
 * which keeps this module from having to know that a page has files in it at
 * all.
 */
export type Licensed = (key: string, value: string) => string | undefined

/** What a run with no answers draws: nothing wears a face. The state a page
 *  whose reading has not arrived is in, and the state every value in a vault
 *  that declares nothing stays in. */
export const NOTHING_CLAIMED: Licensed = () => undefined

/**
 * The dressing for one entry, or `undefined` where it draws as a plain chip.
 *
 * FOUR RULES, here rather than in the drawer so every future dressing gets them
 * without restating them: the three the header lists, plus the licence — which
 * is really two questions of two authorities, and the header says why both.
 */
export const dressingFor = (
  entry: Entry,
  running: Running,
  licensed: Licensed,
): Dressing | undefined => {
  if (entry.system) return undefined
  // The single value is read out here rather than asked for twice: it is the
  // rule ("one value, or the run of text it always was") and it is also what the
  // licence is looked up by, and those had better be the same value.
  const [value, ...rest] = entry.values
  if (value === undefined || rest.length > 0) return undefined
  const word = licensed(entry.key, value)
  if (word === undefined) return undefined
  const held = DRESSINGS.get(word)
  if (held === undefined) return undefined
  return running(held.plugin) ? held.dressing : undefined
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
  editing: string | undefined,
  running: Running,
  licensed: Licensed,
): Laid => {
  const run: Laid["run"][number][] = []
  const blocks: { entry: Entry; block: PropBlock }[] = []
  for (const entry of entries) {
    const dressing = entry.key === editing
      ? undefined
      : dressingFor(entry, running, licensed)
    if (dressing?.Block !== undefined) blocks.push({ entry, block: dressing.Block })
    else run.push({ entry, chip: dressing?.Chip, pane: dressing?.Pane })
  }
  return { run, blocks }
}
