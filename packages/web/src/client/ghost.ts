/**
 * Chromium synthesises the ghost click within a frame or two of the lift (this
 * page declares a `width=device-width` viewport, so there is no 300ms tap delay
 * in front of it); the rest is slack for a busy main thread.
 */
export const GHOST_MS = 300

export const createGhost = (target: EventTarget, now: () => number = () => performance.now()) => {
  let active = true
  let ghostly = 0
  let listening = false
  const click = (event: Event) => {
    if (!active || ghostly === 0 || now() > ghostly) return
    ghostly = 0
    event.preventDefault()
    event.stopPropagation()
  }
  return {
    swallow: () => {
      if (!active) return
      ghostly = now() + GHOST_MS
      if (listening) return
      listening = true
      target.addEventListener("click", click, true)
    },
    dispose: () => {
      active = false
      ghostly = 0
      if (listening) target.removeEventListener("click", click, true)
      listening = false
    },
  }
}
export type Ghosts = ReturnType<typeof createGhost>
