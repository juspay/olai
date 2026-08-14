/**
 * THE GHOST TAP: the click a lifted finger leaves behind, and how to eat one.
 *
 * A touchscreen has no click. The browser makes one up when a finger lifts —
 * so that pages written for a mouse work at all — and it decides WHERE to send
 * it by hit-testing the point at the moment it is dispatched, which is after
 * whatever the finger did has already happened. That is a ghost: an event
 * about a gesture that is over, aimed at whatever has since moved under it.
 *
 * Two things in this client are hit by it, and they are the same thing twice:
 *
 *   - **a long press** (`./longPress.ts`) opens a row's menu while the finger
 *     is still down. The lift then produces a click on the row — which opens
 *     the editor, or follows the bullet's link — or, where the panel was
 *     flipped over the press point, on an entry of the menu that just opened.
 *   - **an entry chosen with a thumb** (`./menu/NodeMenu.tsx`). Kobalte
 *     selects on the pointer-up and the panel is gone by the time the click is
 *     made up, so it lands on the ROW that was underneath the entry — which is
 *     how "Move to Trash" navigated into a mirror three rows down, and it is a
 *     bug this file exists to have exactly one answer to.
 *
 * Neither is a click anyone made. So the next one is eaten: on `window`, in
 * the CAPTURE phase — everything else in this client listens on the document
 * (Solid's delegation, Kobalte's dismissal), and there is no earlier place —
 * and once, because the ghost is the FIRST click after the gesture and
 * anything after that belongs to whoever it landed on.
 *
 * The window is short and it is a real cost, spelled out rather than hidden:
 * if the browser produced no ghost at all, a deliberate tap inside
 * {@link GHOST_MS} is eaten instead. That is the price of not being able to
 * tell the two apart — nothing marks a synthesised click as synthesised — and
 * the window is sized against it rather than against the ghost, which is why
 * it is a third of a second and not a whole one.
 */

/**
 * How long a ghost is waited for.
 *
 * Chromium makes one within a frame or two of the lift — this page declares a
 * `width=device-width` viewport, so there is no 300ms tap delay in front of it
 * — and the rest is slack for a busy main thread. It is also, and this is the
 * half that decides the number, how long a REAL tap would be eaten for if the
 * browser made no ghost at all: a third of a second after lifting a finger,
 * nobody has aimed at anything yet.
 */
export const GHOST_MS = 300

/**
 * Eat the next click, if one comes soon.
 *
 * Returns the way to call it off, for a caller that is disposed first.
 */
export const swallowGhost = (): (() => void) => {
  let give: ReturnType<typeof setTimeout> | undefined
  const swallow = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
    done()
  }
  const done = (): void => {
    clearTimeout(give)
    window.removeEventListener("click", swallow, true)
  }
  window.addEventListener("click", swallow, true)
  give = setTimeout(done, GHOST_MS)
  return done
}
