/**
 * Something that is open until you click somewhere else.
 *
 * The client has two of these and they are the same thing: a note expanded in
 * place under its row (Workflowy-style — click it again, or click away), and
 * the Commit panel over the chrome. What is volatile here is not notes and not
 * commits, it is HOW A TRANSIENT SURFACE IS DISMISSED, and that is one answer
 * this app should have once. It used to live in `note/expand.ts` under the name
 * of its only consumer, which is what made the second one reach for
 * `document.querySelector` instead.
 *
 * Component-local state, dying with whatever holds it. No stored preference:
 * something you have open right now is not a way you like to read (the agent
 * drawer is the other kind, and it is in `localStorage` for exactly that
 * reason).
 *
 * There is deliberately no Escape key here. Every transient surface in this
 * client is dismissed the same way — the chat drawer by its ×, these two by
 * clicking away — and a second gesture that only some of them answer to is a
 * thing a reader has to learn per surface.
 */

import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

export interface ClickAway {
  readonly open: Accessor<boolean>
  /** Toggle it — the control's own click. */
  readonly toggle: () => void
  /** Wire as `ref` on the root of everything that counts as INSIDE, the
   *  control included: a click on the toggle must not both close this and
   *  re-open it. */
  readonly setRoot: (el: HTMLElement | undefined) => void
}

export const createClickAway = (): ClickAway => {
  const [open, setOpen] = createSignal(false)
  let root: HTMLElement | undefined

  // While open, a pointerdown outside the root closes it. CAPTURE phase, so a
  // click that starts a navigation still closes this first, and so the root's
  // own click can toggle without racing a bubble-phase listener.
  createEffect(() => {
    if (!open()) return
    const onDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (root !== undefined && root.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onDown, true)
    onCleanup(() => document.removeEventListener("pointerdown", onDown, true))
  })

  return {
    open,
    toggle: () => setOpen((current) => !current),
    setRoot: (el) => {
      root = el
    },
  }
}
