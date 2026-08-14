/**
 * The bullet, as something to pick a row up by.
 *
 * Workflowy's handle is the bullet itself, and so is olai's — but the bullet is
 * already a LINK to the node's own page (`../Bullet.tsx`), so this wraps it
 * rather than changing it: the press starts a gesture, and the click that
 * follows is swallowed only if that gesture turned out to be a drag. A press
 * that never travels is still the navigation it always was.
 *
 * It is a wrapper for a second reason worth stating: `Bullet` is drawn on a day
 * page too, where rows are a query rather than a tree and there is nothing to
 * reorder. Putting the pointer handler in the bullet would have made every
 * drawing of one draggable and then needed a prop to say when it is not.
 *
 * A MOUSE OR A PEN, and deliberately not a finger. A touch drag on a bullet
 * would have to claim the gesture that scrolls the page (`touch-action: none`),
 * and getting that wrong on a phone costs the reader the ability to scroll past
 * an outline. The `•••` menu is already a pointer-device affordance for the
 * same kind of reason (`../touch.ts`), and a touch gesture for reordering
 * belongs with whatever else a phone eventually gets — a long-press, most
 * likely, which is a decision rather than a line of code.
 */

import type { Row } from "@olai/format"
import type { JSX } from "solid-js"

import { TESTID } from "../testids.ts"
import { useDragging } from "./dragging.ts"

export function Handle(props: {
  readonly row: Row
  readonly children: JSX.Element
}) {
  const dragging = useDragging()
  return (
    <span
      class="inline-flex items-center md:cursor-grab"
      data-testid={TESTID.dragHandle}
      // THE NATIVE DRAG HAS TO BE TURNED OFF, and this is not belt and braces:
      // a bullet is an `<a href>`, and a browser makes every link draggable for
      // free. Pressing one and moving therefore starts the platform's own
      // link-drag — which fires `pointercancel` at the gesture underneath it,
      // so the drag ended one pointermove after it began and the indicator
      // never appeared. `draggable` says no on the way in; the handler is what
      // catches the inner anchor, whose own draggability is not this span's to
      // set.
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") return
        dragging.grab(event, props.row)
      }}
      // CAPTURE, so the link under it never sees the click at all: by the time
      // one bubbled, the browser would already be navigating to the node whose
      // bullet the reader used as a handle. Solid has no `onClickCapture`
      // prop — the capture phase is `on:click` with the option, which is its
      // own escape hatch to `addEventListener` and the only spelling that gets
      // a listener on the way DOWN.
      on:click={{
        capture: true,
        handleEvent: (event: MouseEvent) => {
          if (!dragging.dragged()) return
          event.preventDefault()
          event.stopPropagation()
        },
      }}
    >
      {props.children}
    </span>
  )
}
