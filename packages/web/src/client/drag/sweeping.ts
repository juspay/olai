/**
 * DRAG-ACROSS: Workflowy's fifth picking gesture, and the one that had to
 * settle an argument with the browser before it could exist.
 *
 * ## Text, or rows — and how the two stop competing
 *
 * A tree of prose has a gesture already: press and pull selects TEXT, and that
 * is the browser's, older than this app and the thing a person does when they
 * want to quote a line. A marquee is the same two motions meaning something
 * else, so shipping one is deciding which of them a given pull is — and PR #159
 * left the gesture out rather than decide it by accident.
 *
 * **WHERE THE PULL BEGINS DECIDES, and nothing else does.** A press that lands
 * ON something — a title, a note, a badge, any control — is about that thing,
 * and the browser keeps it: text selects exactly as it always did, including a
 * selection that runs from one row's title down through three more. A press
 * that lands on the outline's own SCAFFOLDING — the indent rails beside a
 * branch, the strip left of a note, the gaps between rows, the page below the
 * last one — is about the rows as things, because there is nothing else there
 * for it to be about. One sentence, no modifier to hold, and no state: the same
 * press means the same thing every time it lands in the same place.
 *
 * The scaffolding says so itself ({@link SWEEP}) rather than being inferred
 * from what a press is NOT. An allowlist is the honest direction for this
 * question: a control added to a row tomorrow inherits "the browser keeps it",
 * which is the safe answer, where a blocklist would quietly turn that control
 * into empty space until somebody noticed.
 *
 * Nothing is `preventDefault`ed to win the argument, and that is worth saying
 * because it is the obvious way to write this and it is wrong: preventing the
 * press also prevents the FOCUS it carries, so a row being typed in would keep
 * its caret through a gesture that has just cleared the pick — and a draft that
 * never blurred is a draft that never committed. What suppresses the text
 * selection instead is the guard the shared gesture primitive already puts up
 * for the panel edges (`../pointer.ts` sets `user-select: none` for the life of
 * a press), so the browser declines to start one and everything else about the
 * press behaves exactly as it does today.
 *
 * ## A finger is not doing this
 *
 * `pointerType === "touch"` is left alone, deliberately and permanently: a
 * finger on the empty part of a page is scrolling it, which is the one gesture
 * a reader cannot be asked to give up (`../longPress.ts` is the whole argument,
 * and `on_a_phone.feature`'s scroll fence is where it is held). A phone reaches
 * every pick this gesture makes through the four that came before it.
 *
 * ## What it is not
 *
 * The band picks a RUN, replacing whatever was picked before — it does not add
 * to a pick the way ⌘-click does. A modifier that unioned a sweep with the
 * standing selection is a real gesture and a further one; it is left out rather
 * than half-built, and the four other pickers already reach any set it would.
 */

import { type Accessor, createSignal } from "solid-js"

import { createDrags, TRAVEL_PX } from "../pointer.ts"
import { type Line, measureLines } from "./lines.ts"
import { planSweep, type Run, type Sweep } from "./sweep.ts"

/**
 * The attribute the outline's own scaffolding wears, saying a press that lands
 * on it is a sweep rather than a text selection.
 *
 * On the elements that hold rows and never words: the two `<ul>`s, the `<li>`,
 * and the box the page draws them in (`../Tree.tsx`, `../edit/Editable.tsx`).
 * Written as a literal at those sites rather than spread from this constant,
 * and that is a performance rule rather than a style one — a JSX spread moves
 * EVERY attribute of an element onto Solid's runtime spread path, where the
 * `data-` facts a row carries would be diffed key by key on every frame the
 * store publishes (`../longPress.ts` says the same about the two handlers it
 * hands out). `claims.test.ts` is what keeps the literals and this name from
 * drifting: exactly three files may spell it.
 */
export const SWEEP = "data-sweep"

export interface Sweeping {
  /** The live band, or `null` when nothing is being swept. */
  readonly band: Accessor<Sweep | null>
  /** A press on the page. Answers for it only when it landed on the
   *  scaffolding; every other press goes past untouched. */
  readonly begin: (event: PointerEvent) => void
}

/** The whole of what a sweep asks of the pick: what is held, this run with its
 *  two ends, and putting it away. */
interface Picked {
  readonly keys: Accessor<ReadonlySet<string>>
  readonly across: (keys: Iterable<string>, from: string, to: string) => void
  readonly clear: () => void
}

export const createSweeping = (selection: Picked): Sweeping => {
  const [band, setBand] = createSignal<Sweep | null>(null)
  /** This page's gestures: one at a time, and whatever is in flight is ended
   *  with the page that made it (`../pointer.ts`). */
  const drags = createDrags()

  const begin = (event: PointerEvent): void => {
    // The secondary button opens a context menu, and a finger is scrolling.
    if (event.button !== 0 || event.pointerType === "touch") return
    const on = event.target
    if (!(on instanceof Element) || !on.hasAttribute(SWEEP)) return
    // A press on the page puts the pick away, whether or not it becomes a
    // sweep — which is what pressing outside a selection means everywhere, and
    // the same statement the drag makes when it starts on an unpicked row.
    //
    // ...and only when there IS one. A press on the page is the most ordinary
    // thing that happens on it, and clearing an empty pick still writes a fresh
    // set into the signal every row of the tree reads — the tree flattened and
    // re-keyed, per background click, to reach the state it was already in.
    if (selection.keys().size > 0) selection.clear()

    /** Where the pull began, in the page's own coordinates — fixed while the
     *  page scrolls under it, which is what makes an auto-scrolled sweep keep
     *  growing rather than sliding. */
    const from = event.pageY
    let rows: ReadonlyArray<Line> = []
    /** What the pick was last told. The band is re-planned on every frame the
     *  page moves, and nearly all of those cross the same rows as the one
     *  before — writing the pick anyway would re-key every row of the tree per
     *  frame for an answer that has not changed. */
    let told: Run | null = null

    const plan = (y: number): void => {
      const next = planSweep(rows, from, y)
      setBand(next)
      const run = next?.run ?? null
      if (run?.from === told?.from && run?.to === told?.to) return
      told = run
      if (run === null) selection.clear()
      else selection.across(run.keys, run.from, run.to)
    }
    drags.start(event, {
      threshold: TRAVEL_PX,
      // Measured when it BECOMES a sweep rather than at the press: a press that
      // turns out to be a click must not have walked the tree on its way past.
      //
      // EVERY drawn line, with none of the drag's exclusions: a drop has places
      // it cannot go and a PICK has none — a run of rows from two files is a
      // legal thing to have picked, and the bulk verbs refuse what they must by
      // name on the bar (`../select/SelectionBar.tsx`) rather than by the
      // gesture pretending those rows are not on screen.
      onStart: () => {
        rows = measureLines()
      },
      // Y only, and ON THE PAGE — which moves under a pointer held near an edge
      // of the window, so a sweep reaches past the fold (`../pointer.ts`).
      onPage: (_x, y) => plan(y),
      // A cancelled sweep keeps what it picked, and that is not the drop's
      // rule turned round: a drop is a WRITE and half of one is a shape nobody
      // asked for, while a pick is a reading — the rows are still on screen,
      // still toned, and Escape is right there.
      onEnd: () => setBand(null),
    })
  }

  return { band, begin }
}
