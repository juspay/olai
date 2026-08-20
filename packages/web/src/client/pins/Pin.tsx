/**
 * ONE PIN, drawn: a door, what it is called right now, what it is narrowed by,
 * and the way to take it off the shelf.
 *
 * The row is a `<Link>` like every other entry in this column, so a click is a
 * navigation and a ⌘-click is the split this app already offers — the pin does
 * not reimplement either. What it adds is the press that TRAVELS, which the
 * shelf turns into a reorder (`./Shelf.tsx`); the click that follows one is
 * swallowed on the way down, exactly as a bullet swallows the click after a
 * drag (`../drag/Handle.tsx`), because by the time it bubbled the browser
 * would already be following the link a reader used as a handle.
 *
 * WHAT IT IS CALLED IS NOT STORED ANYWHERE: a pin holds an address, and the
 * name is what the SERVER says that address is called on the frame this is
 * drawn (`./answered.tsx`, `./pins.ts`). That is the whole of "a node renamed
 * elsewhere updates on the shelf" — there is no second copy to update, on
 * either side of the wire.
 *
 * ONE NAME, read three times here — the face, the row's tooltip and the unpin's
 * label — and resolved once, in `./pins.ts`. It used to arrive as a prop beside
 * the pin, computed by the shelf, with a comment promising it matched what the
 * face would draw.
 */

import { Show } from "solid-js"

import { Face } from "../address/Face.tsx"
import { ENTRY_SHAPE, ROW_GAP } from "../layout/entry.ts"
import { LAYER } from "../layer.ts"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { hrefOf } from "../routes.ts"
import { CONTROL } from "../touch.ts"
import type { Pin } from "./pins.ts"

/**
 * The row's own box, and the two faces it wears — the SAME shape and gap every
 * other entry in this column wears (`../layout/entry.ts`), because a pin is one
 * more way to a page and not a different kind of thing. What it adds is what
 * this row has and the tree's rows do not: a positioned box, because it carries
 * a control over its right edge.
 */
const ROW = `group/pin relative ${ENTRY_SHAPE} ${ROW_GAP} w-full`

export function Pin(props: {
  readonly pin: Pin
  readonly current: boolean
  /** True while this row is the one being carried. */
  readonly lifted: boolean
  /** Begin a press on this row: the shelf decides whether it becomes a drag. */
  readonly onGrab: (event: PointerEvent) => void
  /** True once the press that is still down has travelled far enough to be a
   *  drag — which is when the click that follows must be swallowed. */
  readonly dragged: () => boolean
  readonly onRemove: () => void
}) {
  return (
    <li
      class="relative mb-0.5"
      data-testid={TESTID.pin}
      data-pin={props.pin.id}
      data-at={hrefOf(props.pin.route)}
      data-lifted={props.lifted ? "true" : undefined}
      classList={{ "opacity-40": props.lifted }}
      // THE WHOLE ROW IS THE HANDLE, which is what a shelf of five doors wants
      // and what a tree of a thousand rows could not have (there the handle is
      // the bullet, because the row is text somebody selects). The press is
      // taken here and the SHELF decides whether it becomes a drag, since only
      // it knows where the other rows are.
      onPointerDown={(event) => props.onGrab(event)}
      // The row is a LINK, and Chromium's own link-drag would claim the
      // gesture the moment the pointer travelled — the pointermoves stop
      // arriving and the reorder never happens. Turned off here for the reason
      // `../drag/Handle.tsx` turns it off on the bullet: this app measures its
      // own boxes, so the platform's drag has nothing to offer it and
      // everything to take.
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      // CAPTURE, so the link inside never sees the click at all: by the time
      // one bubbled the browser would already be navigating to the page whose
      // row the reader used as a handle. The same escape hatch, for the same
      // reason, as `../drag/Handle.tsx`'s.
      on:click={{
        capture: true,
        handleEvent: (event: MouseEvent) => {
          if (!props.dragged()) return
          event.preventDefault()
          event.stopPropagation()
        },
      }}
    >
      <Link
        route={props.pin.route}
        class={ROW}
        testid={TESTID.pinLink}
        current={props.current}
        title={props.pin.name}
      >
        {/* The address, drawn as the page it names — the SAME face an outline
            row draws when its title is one (`../address/Face.tsx`). The shelf
            resolving its rows while the file's own page drew the raw address
            was one title with two answers (maintainer, 2026-08-18). */}
        <Face route={props.pin.route} name={props.pin.name} />
      </Link>
      {/* OUTSIDE the link, because a control inside an anchor is a control
          whose activation is also a navigation. It sits on top of the row's
          right edge and appears on hover or focus, the way the tree's own
          reveal-on-hover controls do (`../touch.ts`). */}
      <button
        type="button"
        class={`absolute right-1 top-1/2 -translate-y-1/2 ${LAYER.row} ${CONTROL} ` +
          "cursor-pointer rounded border-0 bg-transparent p-0 text-xs leading-none " +
          "text-paper/55 opacity-0 transition-opacity hover:text-alarm " +
          "focus-visible:opacity-100 group-hover/pin:opacity-100"}
        data-testid={TESTID.pinRemove}
        aria-label={`unpin ${props.pin.name}`}
        title="unpin"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          props.onRemove()
        }}
      >
        {/* The CHARACTER, as every other `×` in this app is drawn
            (`../edges/DropRef.tsx`): a path of its own would be a second
            drawing of a mark the type already has. */}
        ×
      </button>
    </li>
  )
}
