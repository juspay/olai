/**
 * WHERE THE READER IS LOOKING FROM — one owner for the camera, the gestures and
 * the box they are bound to.
 *
 * The three have to be one thing, and the reason is `d3-zoom`'s own shape
 * rather than tidiness. The behaviour keeps the current transform on the
 * ELEMENT (`__zoom`) and publishes changes through the listeners registered on
 * THAT behaviour instance — so a second `zoom()` minted to drive a button reads
 * the right transform, clamps it by its own (default, unbounded) scale extent,
 * and dispatches to nobody. A `+` that silently did nothing is exactly the bug
 * that shape produces, and it produces it only at runtime.
 *
 * So there is one behaviour, made here, bound by the drawing (`./Canvas.tsx`)
 * and driven by the controls (`./Controls.tsx`), with the transform it
 * publishes held in one signal that both the drawing and the caption read.
 *
 * The GESTURES themselves are the library's — wheel, pinch, drag, the clamping
 * and the momentum between them, and the rule that a press which MOVED does not
 * also click. That last one is what lets panning and following a link be the
 * same button, and hand-rolling it is exactly what HACKING.md's dependency rule
 * is about.
 *
 * PURE ARITHMETIC IS NOT HERE. Where a dot lands and which labels fit are
 * `./camera.ts`'s, so they can be tested without a browser; this file is the
 * seam that has to touch one.
 *
 * ## ONE unit, and the measurement that makes it one
 *
 * The library works in the element's own PIXELS — that is where a pointer is —
 * and so, now, does everything drawn: the SVG's `viewBox` is the box's measured
 * size and a dot's offset is a pixel offset (`./layout.ts`'s {@link Frame}).
 * There is no conversion between the gesture and the drawing, because there is
 * nothing to convert; a fixed frame with a locked aspect needed one, and got it
 * wrong often enough to be worth deleting rather than maintaining.
 *
 * THE SIZE IS WATCHED, not sampled, because it is what everything above is in:
 * a window resized or a sidebar dragged changes what the picture has room for,
 * so the frame is a signal and the layout re-settles off it.
 */

import { createElementSize } from "@solid-primitives/resize-observer"
import { select } from "d3-selection"
import { zoom, type ZoomBehavior, type ZoomTransform } from "d3-zoom"
import { type Accessor, createMemo, createSignal, onCleanup } from "solid-js"

import { type Camera, FITTED, FURTHEST, NEAREST, STEP } from "./camera.ts"
import { type Frame, type Placed, UNMEASURED } from "./layout.ts"

export interface Looking {
  /** The transform every position on the drawing is seen through. */
  readonly camera: Accessor<Camera>
  /** ...and the box it is seen THROUGH, measured — what the layout fits into
   *  and what "off the page" is measured against. */
  readonly frame: Accessor<Frame>
  /** Bind the gestures to the box the picture is drawn in. Called from that
   *  element's own `ref`, so the binding lives exactly as long as it does. */
  readonly watch: (box: HTMLElement) => void
  /**
   * Closer and further away — toward a point in the FRAME's units when the page
   * has one to be about, and toward the middle of the box when it has not.
   *
   * The centre of a focused reading is what a reader means by "closer": zooming
   * about the middle of the frame instead walks the node the page is about
   * straight off the edge, since nothing puts it there.
   */
  readonly closer: (toward?: Placed) => void
  readonly further: (toward?: Placed) => void
  /** Back to the whole graph — which is the camera doing NOTHING, because the
   *  layout already fitted the picture to the frame (`./layout.ts`). Also what
   *  a page calls when the picture under the camera changes. */
  readonly fit: () => void
}

export const createLooking = (): Looking => {
  const [camera, setCamera] = createSignal<Camera>(FITTED)
  const [box, setBox] = createSignal<HTMLElement | undefined>()

  const size = createElementSize(box)
  /** The box, as the one space everything here is in — and {@link UNMEASURED}
   *  for the tick before the observer has answered, so a first paint is a
   *  picture rather than nothing. */
  const frame = createMemo((): Frame =>
    size.width === null || size.height === null || size.width === 0
      ? UNMEASURED
      : { width: size.width, height: size.height }
  )

  const behaviour: ZoomBehavior<HTMLElement, unknown> = zoom<HTMLElement, unknown>()
    .scaleExtent([FURTHEST, NEAREST])
    // A few pixels of slop: following a link should not need a perfectly still
    // hand, and a real drag still swallows the click it would have ended in.
    .clickDistance(4)
    .on("zoom", (event: { readonly transform: ZoomTransform }) => setCamera(event.transform))

  /** The bound element as a selection, or nothing before there is one — every
   *  verb below is a no-op until the drawing exists, which is the frame between
   *  a page rendering and its ref running. */
  const on = () => {
    const at = box()
    return at === undefined ? undefined : select<HTMLElement, unknown>(at)
  }

  const watch = (element: HTMLElement): void => {
    setBox(element)
    select<HTMLElement, unknown>(element).call(behaviour)
    onCleanup(() => {
      select<HTMLElement, unknown>(element).on(".zoom", null)
      setBox((held) => (held === element ? undefined : held))
    })
  }

  const scaleBy = (by: number, toward?: Placed) => {
    const at = on()
    if (at === undefined) return
    // The point is already in the library's own units, there being only one.
    if (toward === undefined) behaviour.scaleBy(at, by)
    else behaviour.scaleBy(at, by, [toward.x, toward.y])
  }

  return {
    camera,
    frame,
    watch,
    closer: (toward) => scaleBy(STEP, toward),
    further: (toward) => scaleBy(1 / STEP, toward),
    fit: () => {
      const at = on()
      // Through the BEHAVIOUR, so the element's own record of the transform
      // agrees with what is drawn: setting the signal alone would leave the
      // next wheel tick resuming from where the reader had been.
      if (at !== undefined) behaviour.transform(at, FITTED)
      else setCamera(FITTED)
    },
  }
}
