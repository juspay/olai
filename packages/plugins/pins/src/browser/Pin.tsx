import { Show } from "solid-js"
/**
 * ONE PIN, drawn: a door, what it is called right now, what it is narrowed by,
 * and the way to take it off the shelf.
 *
 * Page pins use `<Link>` for pane navigation. Layout pins ask navigation to
 * open the normalized workspace, including on modifier clicks. What it adds is the press that TRAVELS, which the
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
import { TESTID } from "olai-plugin-pins/testids"
import { CONTROL } from "@olai/ui-primitives/touch.ts"
import { Face } from "olai-plugin-navigation/address/Face.tsx"
import { LAYER } from "@olai/web/client/layer.ts"

import { ENTRY_SHAPE,ROW_GAP } from "olai-plugin-layout/entry"
import { followLayout } from "olai-plugin-navigation/layout-press"
import { useRouter } from "olai-plugin-navigation/routing"
import { Link } from "olai-plugin-navigation/routing"
import type { Pin } from "./pins.ts"

/**
 * The row's own box, and the two faces it wears — the SAME shape and gap every
 * other entry in this column wears (`../layout/entry.ts`), because a pin is one
 * more way to a page and not a different kind of thing. What it adds is what
 * this row has and the tree's rows do not: a positioned box, because it carries
 * controls over its right edge.
 *
 * The GROUP is not here, and that is a fix rather than a layout preference: the
 * controls are siblings of this link (a control inside an anchor is a control
 * whose activation is also a navigation), so a `group/pin` named on the link
 * has no descendant to reveal and `group-hover` never matched a thing. It sits
 * on the `<li>`, which is the one box that contains both.
 */
const ROW = `relative ${ENTRY_SHAPE} ${ROW_GAP} w-full`

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
  /** Ask what this door should be CALLED — the shelf raises the palette's
   *  question over this pin (`./naming.ts`). */
  readonly onRename: () => void
}) {
  const router = useRouter()
  const page = () => { const target = props.pin.target; return target.kind === "page" ? target.route : undefined }
  const href = () => { const target = props.pin.target; return target.kind === "page" ? router.routes.href(target.route) : router.routes.layoutHref(target.workspace) }
  return (
    <li
      class="group/pin relative mb-0.5"
      data-testid={TESTID.pin}
      data-pin={props.pin.id}
      data-at={href()}
      data-kind={props.pin.target.kind}
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
      <Show when={page()} fallback={
        <a href={href()} class={ROW} data-testid={TESTID.pinLink}
          aria-current={props.current ? "page" : undefined} title={props.pin.bare}
          onClick={(event) => {
            const target = props.pin.target
            if (target.kind === "layout") followLayout(router, target.workspace, event)
          }}>
          <Face target={props.pin.target} name={props.pin.name} />
        </a>
      }>{(route) =>
        <Link route={route()} class={ROW} testid={TESTID.pinLink}
          current={props.current} title={props.pin.name}>
          <Face target={props.pin.target} name={props.pin.name} />
        </Link>
      }</Show>
      {/* OUTSIDE the link, because a control inside an anchor is a control
          whose activation is also a navigation. They sit on top of the row's
          right edge and appear on hover or focus, the way the tree's own
          reveal-on-hover controls do (`../touch.ts`).
          TWO of them now, in one strip so the row's own layout decides where
          they sit rather than each of them holding its own offset. */}
      <span
        class={`absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1.5 ${LAYER.row} ` +
          // ITS OWN GROUND, because it is drawn OVER the row's own right edge —
          // where a pin that carries a query draws that query. Without one the
          // two are one another's noise for as long as the pointer is on the
          // row; with one the strip reads as what it is, a set of controls
          // covering the end of a line it is about. Ink is the column's ground
          // (`../styles.css`'s `.olai-frame`), at the strength that keeps the
          // current row's accent wash faintly visible under it rather than
          // punching a hole in it.
          "rounded-lg bg-ink/90 px-1.5 py-1 opacity-0 transition-opacity " +
          "focus-within:opacity-100 group-hover/pin:opacity-100"}
      >
        {/* WHAT IT IS CALLED, changed — the shelf's door onto the one question
            the palette asks (`./naming.ts`). It is here rather than on the row
            itself because pressing the row is the navigation it has always
            been: a shelf of five doors cannot spend its click on anything but
            going somewhere. */}
        <button
          type="button"
          class={`${CONTROL} cursor-pointer rounded border-0 bg-transparent p-0 ` +
            "text-xs leading-none text-paper/55 hover:text-accent"}
          data-testid={TESTID.pinRename}
          aria-label={`rename ${props.pin.name}`}
          title="rename"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            props.onRename()
          }}
        >
          {/* The CHARACTER, for the reason the `×` beside it is one. */}
          ✎
        </button>
        <button
          type="button"
          class={`${CONTROL} cursor-pointer rounded border-0 bg-transparent p-0 ` +
            "text-xs leading-none text-paper/55 hover:text-alarm"}
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
      </span>
    </li>
  )
}
