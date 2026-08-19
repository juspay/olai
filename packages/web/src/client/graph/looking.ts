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
 * ## Two units, and the conversion between them
 *
 * The library works in the element's own PIXELS — that is where a pointer is —
 * and the drawing works in the FRAME's units, the fixed 1000 × 560 both the
 * SVG's `viewBox` and the dots' percentages are in (`./layout.ts`). The scale
 * is the same number in either, being a ratio; the TRANSLATION is not, and a
 * transform handed over unconverted zooms about a point some way from the one
 * the reader put their pointer on.
 *
 * So the raw transform is what is held, and the camera the drawing reads is
 * that one converted by the box's own width. It is re-read per gesture rather
 * than watched: a resize between two gestures leaves the picture off by
 * whatever the box changed, and the next gesture — which is what a reader does
 * next — corrects it from the library's own pixel-true record.
 */

import { select } from "d3-selection"
import { zoom, type ZoomBehavior, zoomIdentity, type ZoomTransform } from "d3-zoom"
import { type Accessor, createMemo, createSignal, onCleanup } from "solid-js"

import { type Camera, FITTED, FURTHEST, NEAREST, STEP } from "./camera.ts"
import { type Placed, WIDTH } from "./layout.ts"

export interface Looking {
  /** The transform every position on the drawing is seen through. */
  readonly camera: Accessor<Camera>
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
  const [raw, setRaw] = createSignal<ZoomTransform>(FITTED)
  let box: HTMLElement | undefined

  /** Frame units per pixel — the one number the two spaces differ by, read off
   *  the box rather than assumed, and 1 before there is a box to ask. */
  const per = (): number => {
    const wide = box?.clientWidth ?? 0
    return wide === 0 ? 1 : WIDTH / wide
  }

  const camera = createMemo((): Camera => {
    const at = raw()
    const ratio = per()
    return zoomIdentity.translate(at.x * ratio, at.y * ratio).scale(at.k)
  })

  const behaviour: ZoomBehavior<HTMLElement, unknown> = zoom<HTMLElement, unknown>()
    .scaleExtent([FURTHEST, NEAREST])
    // A few pixels of slop: following a link should not need a perfectly still
    // hand, and a real drag still swallows the click it would have ended in.
    .clickDistance(4)
    .on("zoom", (event: { readonly transform: ZoomTransform }) => setRaw(event.transform))

  /** The bound element as a selection, or nothing before there is one — every
   *  verb below is a no-op until the drawing exists, which is the frame between
   *  a page rendering and its ref running. */
  const on = () => (box === undefined ? undefined : select<HTMLElement, unknown>(box))

  const watch = (element: HTMLElement): void => {
    box = element
    select<HTMLElement, unknown>(element).call(behaviour)
    onCleanup(() => {
      select<HTMLElement, unknown>(element).on(".zoom", null)
      if (box === element) box = undefined
    })
  }

  const scaleBy = (by: number, toward?: Placed) => {
    const at = on()
    if (at === undefined) return
    if (toward === undefined) behaviour.scaleBy(at, by)
    // The library's own units, which is what makes the point mean what it says.
    else behaviour.scaleBy(at, by, [toward.x / per(), toward.y / per()])
  }

  return {
    camera,
    watch,
    closer: (toward) => scaleBy(STEP, toward),
    further: (toward) => scaleBy(1 / STEP, toward),
    fit: () => {
      const at = on()
      // Through the BEHAVIOUR, so the element's own record of the transform
      // agrees with what is drawn: setting the signal alone would leave the
      // next wheel tick resuming from where the reader had been.
      if (at !== undefined) behaviour.transform(at, FITTED)
      else setRaw(FITTED)
    },
  }
}
