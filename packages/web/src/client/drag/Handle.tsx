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
 * ONE HANDLE, THREE DEVICES. A mouse and a pen start the drag by travelling; a
 * finger starts it by being HELD, because the gesture it would otherwise take
 * is the page scrolling and no reader can be asked to give that up
 * (`./dragging.ts` and `../longPress.ts` have both halves of the argument).
 * What the finger costs is that this cell is no longer a second door to the
 * row's `•••` menu — a phone opens that by holding the row anywhere else, which
 * is nearly all of it (`../menu/door.ts`), and a handle has only itself to be
 * held by. The row's own door is told to stand down here rather than guessing:
 * {@link HANDLE} is what it looks for.
 */

import type { Row } from "@olai/format"
import type { JSX } from "solid-js"

import { TESTID } from "../testids.ts"
import { useDragging } from "./dragging.ts"

/**
 * The attribute this cell wears so the row's `•••` door can tell a press that
 * is already spoken for.
 *
 * A `data-` attribute rather than the testid beside it: a testid is a contract
 * with the browser tests and reading one back as behaviour would make a rename
 * a silent change of what the app does. Rather than a `stopPropagation`, too —
 * that would be one gesture reaching into another's plumbing, and it would rest
 * on the order Solid happens to walk delegated handlers in.
 */
export const HANDLE = "data-handle"

export function Handle(props: {
  readonly row: Row
  readonly children: JSX.Element
}) {
  const dragging = useDragging()
  return (
    <span
      class="inline-flex items-center md:cursor-grab"
      data-testid={TESTID.dragHandle}
      data-handle=""
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
      onPointerDown={(event) => dragging.grab(event, props.row)}
      // The platform's own long press, for the one that raises it as an event:
      // prevented while this cell is holding a finger, so the text-selection
      // callout does not come up over a row that is about to lift. A right-click
      // with a mouse still gets the browser's menu (`../longPress.ts`).
      onContextMenu={dragging.heldMenu}
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
