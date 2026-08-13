/**
 * A panel that hangs off a control in the chrome: whether it is open, where it
 * goes, and the ways it shuts.
 *
 * There are two of them — the Commit panel and the preferences — and they had
 * the same forty lines each, which is how the two drifted: one grew Escape and
 * a returned focus (the theme popover's, inherited by `settings/`) and the
 * other never had them, and one of the two got its click-away WRONG in a way
 * nothing could see. That is this file's argument for existing; the pure half
 * of the geometry was already shared (`./anchor.ts`), and this is the stateful
 * half catching up.
 *
 * TWO ROOTS, and that is the bug worth naming. A panel here is PORTALLED out of
 * whatever the trigger sits in, so the trigger is not its ancestor and neither
 * of them can speak for the other: a click-away that knew only the panel shut
 * on every press of the trigger — and since the trigger's own click then
 * reopened it, pressing it a second time did nothing at all. Both are consulted
 * here, so the trigger toggles and a press inside the panel is a press inside
 * the panel.
 *
 * FOCUS goes back to the trigger when the dismissal came from a key, and is
 * left where the pointer put it otherwise. Somebody who opened a panel, tabbed
 * into it and pressed Escape would land on `<body>`, which is nowhere.
 *
 * What this does NOT own is the panel's markup or its width — only whether it
 * is up, and the box `./anchor.ts` says it goes in.
 */

import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

import { type Anchor, anchoredTo } from "./anchor.ts"

export interface Popover {
  readonly open: Accessor<boolean>
  /** Where the panel goes, in viewport pixels — `null` until the trigger has
   *  been measured, which is to say until it has been opened once. */
  readonly at: Accessor<Anchor | null>
  readonly toggle: () => void
  /** `ref` on the control that opens it. */
  readonly setTrigger: (el: HTMLElement | undefined) => void
  /** `ref` on the panel itself — see the two roots above. */
  readonly setPanel: (el: HTMLElement | undefined) => void
}

/** Whether two placements would draw the same box. */
const sameBox = (a: Anchor | null, b: Anchor | null): boolean =>
  a === b ||
  (a !== null && b !== null && a.left === b.left && a.width === b.width &&
    a.maxHeight === b.maxHeight && a.side === b.side && a.offset === b.offset)

export const createPopover = (): Popover => {
  const [open, setOpen] = createSignal(false)
  // Compared by VALUE, because `measure` mints a fresh box every time it runs
  // and it runs on every scroll event in the document: by identity, a scroll
  // that moved the trigger nowhere would still rebuild the panel's five style
  // strings for Solid to diff and discard.
  const [at, setAt] = createSignal<Anchor | null>(null, { equals: sameBox })

  let trigger: HTMLElement | undefined
  let panel: HTMLElement | undefined

  const close = (restoreFocus = false): void => {
    setOpen(false)
    if (restoreFocus) trigger?.focus()
  }

  /** Re-read where the trigger is. Cheap, and it has to happen again whenever
   *  the window or the column under it moves: an anchored popover that goes
   *  stale on a scroll is worse than one that never moved at all. */
  const measure = (): void => {
    if (trigger === undefined) return
    setAt(anchoredTo(trigger.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    }))
  }

  // Scoped to the open state, so a shut panel is not four document listeners
  // for nothing; disposed with the effect when it closes or the owner unmounts.
  createEffect(() => {
    if (!open()) return
    measure()
    const onPointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (trigger?.contains(target) || panel?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      close(true)
    }
    // Capture, so a press that also navigates still shuts this first — and so
    // the trigger's own click can toggle without racing a bubble-phase
    // listener.
    document.addEventListener("pointerdown", onPointer, true)
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", measure)
    // Capture for `scroll` as well: what moves under a panel may be a column
    // rather than the document, and a scroll event does not bubble.
    document.addEventListener("scroll", measure, true)
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointer, true)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", measure)
      document.removeEventListener("scroll", measure, true)
    })
  })

  return {
    open,
    at,
    // A press of the trigger while it is up is a keyboard-reachable dismissal
    // like Escape, so the focus goes back the same way.
    toggle: () => (open() ? close(true) : setOpen(true)),
    setTrigger: (el) => {
      trigger = el
    },
    setPanel: (el) => {
      panel = el
    },
  }
}
