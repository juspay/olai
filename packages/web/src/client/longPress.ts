/**
 * A LONG PRESS: the door a finger has, where a pointer has a control to aim at.
 *
 * One caller today — a row's `•••` menu, which is not drawn below 48rem because
 * a 390px screen has no room for a second always-on cell before the title
 * (`./touch.ts`), and which a phone could therefore not reach at all. The
 * gesture is the Workflowy-familiar one on a handset, and it is the only
 * affordance that costs no width: the row IS the target.
 *
 * ## What this is careful about, and why each half is here
 *
 * A finger on a row is already saying several other things, and a long press
 * must not answer for any of them:
 *
 *   - **the page scrolls.** So the press is WATCHED rather than claimed:
 *     nothing is `preventDefault`ed on the way down, the browser keeps the
 *     gesture, and a finger that moves past {@link SLOP_PX} — or one the
 *     browser takes away to scroll with, which is what `pointercancel` is —
 *     has the timer dropped under it. The drag-and-drop that claims mouse and
 *     pen and leaves touch to the page is the other side of the same rule.
 *   - **a tap already means something** — the title opens the editor, the
 *     bullet zooms, the triangle folds — and a finger lifting after a long
 *     press still produces that tap, aimed at whatever is under the point by
 *     then (which may be the panel that just opened, if it was flipped over
 *     the press). So the press that opened something eats the click its own
 *     lift leaves behind: `./ghost.ts`, which the menu needs for the same
 *     reason one field along.
 *   - **the browser has its own long press.** Android raises `contextmenu`
 *     mid-gesture and puts the text-selection callout up with it; iOS has the
 *     callout without the event. The event is answered here — prevented, but
 *     only for a press this module is actually holding, so a right-click with
 *     a mouse still gets the browser's own menu — and the callout is answered
 *     by a style on the row that carries this (`Tree.tsx`).
 *
 * `pointerType === "touch"` and not pen: a pen hovers, so it has the `•••`
 * already, and a drag that claims the pen must not find a menu opening under
 * it. Kobalte's `ContextMenu` — the ecosystem's own spelling of this gesture,
 * and the first thing to reach for under HACKING.md's SolidJS rule — could not
 * be the answer for a different reason: its long press is welded to a menu
 * ROOT, and one of those per row is exactly the cost `menu/NodeMenu.tsx`'s
 * lazy `Dots` exists to refuse (140 rows measured at 140
 * `IntersectionObserver`s and 33 MB of heap). So the gesture is ours and the
 * MENU is still the library's. What is taken from that implementation is its
 * rules: a timer armed on pointer-down, dropped on move, cancel and up.
 */

import { onCleanup } from "solid-js"

import { swallowGhost } from "./ghost.ts"

/**
 * How long a finger has to stay put.
 *
 * 500ms is what both mobile platforms use for their own long press, and
 * matching that number is worth more than picking a better one: Android fires
 * `contextmenu` at its own deadline, and a menu that opened later than the
 * callout it is suppressing would show a text selection first and a menu
 * afterwards.
 */
export const LONG_PRESS_MS = 500

/** How far the finger may drift and still be a press rather than a scroll.
 *  About Chromium's own touch slop; under it, a hand is holding still. */
const SLOP_PX = 10

/** What to put on the element the press is made on. Spread onto it: both are
 *  events Solid delegates, so this costs a row no listener of its own. */
export interface LongPress {
  readonly onPointerDown: (event: PointerEvent) => void
  readonly onContextMenu: (event: Event) => void
}

/**
 * Watch an element for a long press by a finger, and say when there is one.
 *
 * Call it in the owner that draws the element — a row — so a row that goes
 * away mid-press takes its timer and its transient listeners with it.
 */
export const longPressOn = (press: () => void): LongPress => {
  /** The timer, while a finger is down and has not moved. */
  let waiting: ReturnType<typeof setTimeout> | undefined
  /** Where it landed, to measure the drift from. */
  let landed: { readonly x: number; readonly y: number } | undefined
  /** Is a FINGER what is down? What tells the browser's own long press from a
   *  right-click with a mouse, since `contextmenu` itself cannot say. */
  let finger = false
  /** Has this press already fired? What the LIFT then has to answer for. */
  let fired = false
  /** Call off the ghost-eating listener, if one is out. */
  let stopSwallowing: (() => void) | undefined

  const move = (event: PointerEvent): void => {
    if (waiting === undefined || landed === undefined) return
    const drift = Math.hypot(event.clientX - landed.x, event.clientY - landed.y)
    if (drift > SLOP_PX) disarm()
  }

  /** Drop the timer, and nothing else: the finger is still down, and the lift
   *  is what ends the gesture. */
  const disarm = (): void => {
    clearTimeout(waiting)
    waiting = undefined
  }

  /** The finger is gone. Nothing is left armed or listened for. */
  const release = (): void => {
    disarm()
    landed = undefined
    finger = false
    fired = false
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", lifted)
    window.removeEventListener("pointercancel", release)
  }

  /**
   * The finger LIFTED, which is the one ending that leaves a click behind.
   *
   * A press that fired eats it (`./ghost.ts`) — and it is eaten here rather
   * than at the deadline because the two moments are not the same one: the
   * menu opens under a finger that is still down, and that finger may stay
   * down for as long as somebody is reading what appeared. A press the browser
   * CANCELLED (it took the gesture to scroll with) leaves nothing behind, so
   * that ending is `release` alone and eats nothing.
   */
  const lifted = (): void => {
    const opened = fired
    release()
    if (opened) stopSwallowing = swallowGhost()
  }

  /** Fire it, once, from whichever deadline arrived — ours or the platform's. */
  const fire = (): void => {
    disarm()
    fired = true
    press()
  }

  onCleanup(() => {
    release()
    stopSwallowing?.()
  })

  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        finger = false
        return
      }
      // A SECOND finger is a pinch or a two-finger scroll, and neither is a
      // press: the one in flight ends and nothing new is armed.
      if (finger) {
        release()
        return
      }
      release()
      finger = true
      landed = { x: event.clientX, y: event.clientY }
      // On `window` rather than on the element: a finger that slides off the
      // row it landed on is still the same gesture, and the row would stop
      // hearing about it. (Capturing the pointer would fix that and would take
      // the events away from the page that is trying to scroll with them.)
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", lifted)
      window.addEventListener("pointercancel", release)
      waiting = setTimeout(fire, LONG_PRESS_MS)
    },
    onContextMenu: (event: Event) => {
      // Only for a press this module is holding. A right-click with a mouse is
      // the browser's own, and taking its menu away would be this file
      // regressing a device it has nothing to say about.
      if (!finger) return
      // Prevented, so the text-selection callout Android raises with it goes
      // too — and the press is fired from here rather than waited out, since
      // the platform's deadline and ours are the same number and whichever
      // arrives first is the gesture.
      event.preventDefault()
      if (waiting !== undefined) fire()
    },
  }
}
