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
 * WHAT IT IS CALLED IS NOT STORED ANYWHERE (`./name.ts`): a pin holds an
 * address, and the name is read off the set on the frame it is drawn. That is
 * the whole of "a node renamed elsewhere updates on the shelf" — there is no
 * second copy to update.
 */

import { Show } from "solid-js"

import { LAYER } from "../layer.ts"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { hrefOf } from "../routes.ts"
import { CONTROL, TARGET } from "../touch.ts"
import type { Pin } from "./pins.ts"

/** The row's own box, and the two faces it wears — the same hover and
 *  current-page wash the file tree's entries wear (`../Sidebar.tsx`'s
 *  `ENTRY_SHAPE`), because a pin is one more way to a page and not a different
 *  kind of thing. Spelled here rather than imported for the one reason that
 *  file's own comment gives: the ink is the row's business, and this row has a
 *  control on it that the tree's rows do not. */
const ROW = `group/pin relative flex ${TARGET} w-full items-center gap-1.5 rounded-md px-2 py-0.5 ` +
  "text-[0.8125rem] leading-snug text-ink no-underline hover:bg-rule/50 " +
  "aria-[current=page]:bg-accent/15 aria-[current=page]:text-accent " +
  "aria-[current=page]:font-semibold md:min-h-0"

export function Pin(props: {
  readonly pin: Pin
  /** What this pin is CALLED — read off the set by the shelf, which already
   *  holds the indexes, rather than re-read per row. */
  readonly name: string
  /** The query the pinned page is narrowed by, or `""`. */
  readonly narrowing: string
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
        title={props.name}
      >
        <PinGlyph />
        <span class="min-w-0 flex-1 truncate">{props.name}</span>
        <Show when={props.narrowing !== ""}>
          {/* The filter, as its own chip: a pinned page keeps the query it was
              pinned with, and a row that drew only the page's name would be a
              door promising something it does not open. Mono, because it is a
              query rather than prose. */}
          <span
            class="shrink-0 rounded bg-rule/60 px-1 font-mono text-[0.65rem] text-muted"
            data-testid={TESTID.pinFilter}
          >
            {props.narrowing}
          </span>
        </Show>
      </Link>
      {/* OUTSIDE the link, because a control inside an anchor is a control
          whose activation is also a navigation. It sits on top of the row's
          right edge and appears on hover or focus, the way the tree's own
          reveal-on-hover controls do (`../touch.ts`). */}
      <button
        type="button"
        class={`absolute right-1 top-1/2 -translate-y-1/2 ${LAYER.row} ${CONTROL} ` +
          "rounded text-muted opacity-0 transition-opacity hover:text-ink " +
          "focus-visible:opacity-100 group-hover/pin:opacity-100"}
        data-testid={TESTID.pinRemove}
        aria-label={`unpin ${props.name}`}
        title="unpin"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          props.onRemove()
        }}
      >
        <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true" fill="currentColor">
          <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22z" />
        </svg>
      </button>
    </li>
  )
}

/** The mark a pinned row wears — a pin, which is the one drawing in this
 *  column that is about the SHELF rather than about a kind of file, so it is
 *  here rather than in `../file/icons.tsx`'s table of directory kinds. Ours,
 *  drawn to that table's metrics (a 16-box, `currentColor`, the row's own ink)
 *  so the two columns read as one. */
function PinGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      class="size-3.5 shrink-0"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.53 1.47a.75.75 0 0 0-1.28.53v.94L4.9 6.16a2.75 2.75 0 0 0-2.2.78.75.75 0 0 0 0 1.06l2.3 2.3-3.28 3.28a.75.75 0 1 0 1.06 1.06l3.28-3.28 2.3 2.3a.75.75 0 0 0 1.06 0 2.75 2.75 0 0 0 .78-2.2l3.22-3.35h.94a.75.75 0 0 0 .53-1.28l-5.46-5.46z" />
    </svg>
  )
}
