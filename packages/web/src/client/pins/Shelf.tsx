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
 * WHAT IT DRAWS IS THE DIRECTORY, never a local list. The pins come off the
 * same indexes every page is drawn from (`./pins.ts`), so a pin an AGENT wrote
 * — into `Pins.olai`, with `add_node`, from a terminal — is on the shelf on the
 * frame the store publishes it, exactly like a row appearing in an outline.
 * Nothing here is optimistic and nothing is echoed: a pin, an unpin and a
 * reorder each go to the write gate and the shelf redraws when the file says
 * so, which is the rule the whole editor is built on.
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

import { createMemo, createSignal, For, Show } from "solid-js"

import { useDerived } from "../derived.tsx"
import { useUndo } from "../edit/undoing.ts"
import { createDrags, TRAVEL_PX } from "../pointer.ts"
import { useRouter } from "../router.tsx"
import { filterOf, hrefOf } from "../routes.ts"
import { selector, TESTID } from "../testids.ts"
import { applying } from "../writes.ts"
import { shelfName } from "./name.ts"
import { Pin } from "./Pin.tsx"
import { sayPin } from "./pinning.ts"
import { type Pin as Pinned, pinsOf } from "./pins.ts"
import { gapAt, placing } from "./reorder.ts"

/** Where each drawn row SITS, taken once when a drag lifts: the midpoint that
 *  decides which gap the pointer is over (in page coordinates, so a scroll
 *  during the drag does not move the answer), and the offset the drop line is
 *  drawn at (inside the list, which is what it is positioned against). */
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
  /** Where the rows were at the LIFT. Nothing on screen moves while a row is
   *  carried — the shelf redraws when the file says so, which is after the
   *  drop — so this is measured once rather than per frame. */
  readonly rows: Measured
  /** Which gap the pointer is over now — the only one of the three that
   *  changes per move. */
  readonly gap: number
}

export function Shelf() {
  const derived = useDerived()
  const router = useRouter()
  const undo = useUndo()
  const drags = createDrags()

  const pins = createMemo(() => pinsOf(derived()))

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
   * The rows' places, read off the DOM at the moment the drag lifts.
   *
   * ASKED OF THE DOM rather than of a list of refs this component kept: the
   * rows are already in the document, already carry the testid that identifies
   * them, and already sit in the order the shelf draws — so an array of
   * elements filled by a `ref` per row, cleaned up per row, and read once per
   * gesture was a second copy of the list, kept in step by machinery, for a
   * question the container answers in one call.
   */
  const measure = (): Measured => {
    const box = list?.getBoundingClientRect()
    const at = [...(list?.querySelectorAll(selector(TESTID.pin)) ?? [])]
      .map((row) => row.getBoundingClientRect())
    return {
      middles: at.map((row) => row.top + row.height / 2 + window.scrollY),
      // One more than there are rows: a gap above the first and one below the
      // last, which is what `./reorder.ts` counts over.
      gaps: [
        ...at.map((row) => row.top - (box?.top ?? 0)),
        (at.at(-1)?.bottom ?? box?.top ?? 0) - (box?.top ?? 0),
      ],
    }
  }

  const grab = (at: number, event: PointerEvent) => {
    travelled = false
    drags.start(event, {
      threshold: TRAVEL_PX,
      onStart: () => {
        travelled = true
        setCarrying({ from: at, rows: measure(), gap: at })
      },
      onPage: (_x, y) =>
        setCarrying((held) =>
          held === undefined ? undefined : { ...held, gap: gapAt(held.rows.middles, y) }
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
    void applying({ verb: "archive", id: pin.id }, undo.record).then(sayPin)
  }

  const here = createMemo(() => hrefOf(router.route()))

  return (
    <Show when={pins().length > 0}>
      <section class="relative mb-3" data-testid={TESTID.pinShelf}>
        <ul class="m-0 list-none p-0" ref={list}>
          <For each={pins()}>
            {(pin, at) => (
              <Pin
                pin={pin}
                name={shelfName(pin, derived())}
                // What the page is NARROWED by, read off the route through the
                // one function that answers it (`../routes.ts`), so the shelf
                // cannot disagree with the filter bar about it.
                narrowing={filterOf(pin.route)}
                current={here() === hrefOf(pin.route)}
                lifted={carrying()?.from === at()}
                onGrab={(event) => grab(at(), event)}
                dragged={() => travelled}
                onRemove={() => unpin(pin)}
              />
            )}
          </For>
          {/* Where it would land. Drawn only while something is carried, and
              positioned against the LIST rather than the page, so it does not
              have to know where in the column the shelf sits. */}
          {/* Drawn from the carried value alone, which is what makes the gap
              ABOVE the first pin (zero, and the landing a reader is most
              likely to aim at) drawable at all: as three loose facts this was
              a `Show` over a number, and zero is falsy. */}
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
