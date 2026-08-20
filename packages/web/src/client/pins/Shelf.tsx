/**
 * THE PINNED SHELF: the doors a reader keeps, at the top of the directory
 * column.
 *
 * Above everything else in the column on purpose. What is under it — the
 * agenda, the month, the file tree — is the DIRECTORY, answered afresh every
 * time it is drawn; this is the reader's own short list, and a short list that
 * has to be scrolled past a corpus to reach is a list nobody keeps.
 *
 * AN EMPTY SHELF DRAWS NOTHING — not an empty box, not a heading, not a hint.
 * A directory with no pins is the ordinary state of every directory olai has
 * ever served, and a permanent affordance for a feature nobody has used yet is
 * chrome charged to everyone. Its presence is therefore the fact a scenario
 * asserts.
 *
 * WHAT IT DRAWS IS THE DIRECTORY, never a local list — the server's own
 * reading of `Pins.olai`, re-answered on every revision that changes it
 * (`./answered.tsx`, `./pins.ts`). So a pin an AGENT wrote — into `Pins.olai`,
 * with `add_node`, from a terminal — is on the shelf on the frame the store
 * publishes it, exactly like a row appearing in an outline, and a pinned node
 * RENAMED anywhere says its new name on that same frame. Nothing here is
 * optimistic and nothing is echoed: a pin, an unpin and a reorder each go to
 * the write gate and the shelf redraws when the file says so, which is the rule
 * the whole editor is built on.
 *
 * ## The reorder
 *
 * The gesture is `../pointer.ts`'s — the shared one, which owns the window
 * listeners, the teardown, the text-selection guard and the travel that tells a
 * drag from a click on a row that is also a link. The arithmetic is
 * `./reorder.ts`'s, pure and unit-tested. What is left here is the middle: the
 * measurement taken once when the drag lifts, the gap the pointer is over, and
 * the one `place` a release sends.
 *
 * The rows are measured ONCE, at the lift, for the tree drag's reason exactly:
 * nothing on screen moves while a row is carried — the shelf redraws when the
 * file says so, which is after the drop — so a re-measure per frame would be a
 * forced layout for an answer that cannot have changed.
 */

import { createMemo, createSelector, createSignal, For, Show } from "solid-js"

import { useUndo } from "../edit/undoing.ts"
import { REGION, REGION_LABEL } from "../layout/entry.ts"
import { createDrags, TRAVEL_PX } from "../pointer.ts"
import { useRouter } from "../router.tsx"
import { hrefOf } from "../routes.ts"
import { selector, TESTID } from "../testids.ts"
import { applying } from "../writes.ts"
import { usePins } from "./answered.tsx"
import { Pin } from "./Pin.tsx"
import { sayPin } from "./pinning.ts"
import { type Pin as Pinned, pinsOf } from "./pins.ts"
import { gapAt, placing } from "./reorder.ts"

/** Where each drawn row SITS, taken once when a drag lifts — both numbers as
 *  offsets INSIDE the list, which is the one space neither the window's scroll
 *  nor the sidebar's can move (see {@link Shelf}'s `measure`): the midpoint
 *  that decides which gap the pointer is over, and the offset the drop line is
 *  drawn at. */
interface Measured {
  readonly middles: ReadonlyArray<number>
  readonly gaps: ReadonlyArray<number>
}

/**
 * A PIN IN THE AIR — one value, and that is the point of it being one.
 *
 * These three facts were three places for one revision, and the shape was the
 * flat product a state review hunts for: `gap` means nothing without the row
 * that was picked up, `rows` is a measurement of a moment that only exists
 * while something is being carried, and "nothing is being dragged" was three
 * separate `undefined`s that nothing stopped from disagreeing. Read as a
 * product, "carrying row 2 over gap 4 against rows measured for a shelf that
 * has since been redrawn" is spellable; read as one value it is not — there is
 * no drag without a measurement, and no gap that is not this drag's.
 */
interface Carrying {
  /** Which row was picked up, as its index in the shelf as drawn. */
  readonly from: number
  /** Where the rows were at the LIFT, in the list's own coordinates. Nothing
   *  on screen moves while a row is carried — the shelf redraws when the file
   *  says so, which is after the drop — and a scroll moves the list and its
   *  rows together, so this is measured once rather than per frame. */
  readonly rows: Measured
  /** Which gap the pointer is over now — the only one of the three that
   *  changes per move. */
  readonly gap: number
}

export function Shelf() {
  const shelf = usePins()
  const router = useRouter()
  const undo = useUndo()
  const drags = createDrags()

  // A MEMO over the answer, so the titles are read when the SHELF moves rather
  // than whenever this column redraws — and so the drag's arithmetic is over
  // one list rather than a fresh one per frame.
  const pins = createMemo(() => pinsOf(shelf()))

  const [carrying, setCarrying] = createSignal<Carrying | undefined>(undefined)
  /**
   * Has the press that is still down TRAVELLED far enough to be a drag?
   *
   * Not part of {@link Carrying}, and the difference is a lifetime rather than
   * a nicety: this has to stay true through the click that arrives AFTER the
   * release, which is the click a row's link would otherwise follow
   * (`./Pin.tsx` swallows it). A drag in the air is over at `onEnd`; the click
   * it must not become arrives a moment later.
   */
  let travelled = false
  let list: HTMLUListElement | undefined

  /**
   * Where the rows sit, IN THE LIST'S OWN COORDINATES — measured at the lift,
   * and the whole of what this gesture is answered in.
   *
   * ASKED OF THE DOM rather than of a list of refs this component kept: the
   * rows are already in the document, already carry the testid that identifies
   * them, and already sit in the order the shelf draws — so an array of
   * elements filled by a `ref` per row was a second copy of the list, kept in
   * step by machinery, for a question the container answers in one call.
   *
   * LIST-RELATIVE, and that is the fix rather than a tidy-up (found in review,
   * 2026-08-18). The tree's drag measures in DOCUMENT coordinates and asks
   * `../pointer.ts` for the page-scrolling `onPage`, which is right there: its
   * rows live in the scrolling document, so a row's document position is
   * invariant and the page moving under the pointer is part of the gesture.
   * The shelf is the other shape — a STICKY column with a scroll region of its
   * own — so a pin's document position moves every time the window scrolls
   * while the row itself has not moved at all. Measured that way, a page that
   * scrolled mid-drag left every midpoint answering for a place the rows had
   * left, and the `place` that fired could name a gap the pointer was never
   * over.
   *
   * Offsets INSIDE the list are the one space nothing can move: the window
   * scrolling does not change them, and the sidebar's own scroll region moves
   * the list and its rows together. So the measurement stays a measurement of
   * one moment ({@link Carrying}), and what is read fresh per move is the ONE
   * number that converts the pointer into it — the list's own top.
   */
  const measure = (): Measured => {
    const top = listTop()
    const at = [...(list?.querySelectorAll(selector(TESTID.pin)) ?? [])]
      .map((row) => row.getBoundingClientRect())
    return {
      middles: at.map((row) => row.top + row.height / 2 - top),
      // One more than there are rows: a gap above the first and one below the
      // last, which is what `./reorder.ts` counts over — and the same numbers
      // the drop line is drawn at, since it is positioned against this list.
      gaps: [...at.map((row) => row.top - top), (at.at(-1)?.bottom ?? top) - top],
    }
  }

  /** Where the list is on screen right now — the one number a move needs, and
   *  the reason a move needs no re-measurement of the rows. */
  const listTop = (): number => list?.getBoundingClientRect().top ?? 0

  const grab = (at: number, event: PointerEvent) => {
    travelled = false
    drags.start(event, {
      threshold: TRAVEL_PX,
      onStart: () => {
        travelled = true
        setCarrying({ from: at, rows: measure(), gap: at })
      },
      // `onMove` and not `onPage`: the page-following half of that primitive
      // scrolls the WINDOW, which is the right help for a drag over the
      // outline and the wrong one over a column that does not move with the
      // page. The pointer arrives in viewport coordinates and is converted
      // into the list's own by the one number that can have changed.
      onMove: (event) =>
        setCarrying((held) =>
          held === undefined
            ? undefined
            : { ...held, gap: gapAt(held.rows.middles, event.clientY - listTop()) }
        ),
      onEnd: (ended) => {
        const held = carrying()
        setCarrying(undefined)
        // A CANCELLED gesture is not a drop — the pointer was taken away
        // rather than released — so nothing is written, which is the
        // distinction `../pointer.ts` hands over and the one a caller must not
        // read past.
        if (ended === null || held === undefined) return
        const edit = placing(pins(), held.from, held.gap)
        if (edit === undefined) return
        void applying(edit, undo.record).then(sayPin)
      },
    })
  }

  const unpin = (pin: Pinned) => {
    // The set's own removal, and the only one it has: the pin's row goes to the
    // Trash keeping its id, so an unpin is undoable with ⌘Z and reversible from
    // the Trash's own `Put back`. A second verb that erased it would be a
    // removal only this face knew (`@olai/surface`'s `edit.ts`).
    void applying({ verb: "trash", id: pin.id }, undo.record).then(sayPin)
  }

  // `createSelector` rather than comparing in each row, which is the sidebar's
  // own reason one line down (`../Sidebar.tsx`): that form subscribes every
  // pin to the open page, and this notifies exactly the row that lit and the
  // one that went out. Through the BIJECTION rather than `samePage`, because a
  // pinned filtered page and the same page unfiltered are two different doors.
  const isHere = createSelector(() => hrefOf(router.route()))

  return (
    <Show when={pins().length > 0}>
      <section class={`relative ${REGION}`} data-testid={TESTID.pinShelf}>
        {/* What this list IS, in the words and the treatment every other
            grouped list in this app uses (`../layout/entry.ts`). A pin glyph
            says what one ROW is; over a column of a dozen entries it cannot say
            where one list ends and the next begins, which is what a reader
            looking at the whole column actually needs (human, 2026-08-19). */}
        <h2 class={REGION_LABEL}>Pinned</h2>
        <ul class="m-0 list-none p-0" ref={list}>
          <For each={pins()}>
            {(pin, at) => (
              <Pin
                pin={pin}
                current={isHere(hrefOf(pin.route))}
                lifted={carrying()?.from === at()}
                onGrab={(event) => grab(at(), event)}
                dragged={() => travelled}
                onRemove={() => unpin(pin)}
              />
            )}
          </For>
          {/* Where it would land: drawn only while something is carried,
              positioned against the LIST rather than the page (so it does not
              have to know where in the column the shelf sits), and read off
              the carried value alone — which is what makes the gap ABOVE the
              first pin drawable at all, since as a loose number that gap is
              zero and a `Show` reads zero as absent. */}
          <Show when={carrying()}>
            {(held) => (
              <li
                class="pointer-events-none absolute inset-x-1 h-0.5 rounded bg-accent"
                data-testid={TESTID.pinDropLine}
                data-gap={String(held().gap)}
                aria-hidden="true"
                style={{ top: `${held().rows.gaps[held().gap] ?? 0}px` }}
              />
            )}
          </Show>
        </ul>
      </section>
    </Show>
  )
}
