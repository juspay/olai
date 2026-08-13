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
 * ## And focus has to get IN, which a portal does not do by itself
 *
 * That is the price of the portal, and it was a regression rather than a
 * shortcoming: the theme popover this replaced was laid out INSIDE its trigger's
 * own box, so the chips were the next thing in document order and Tab reached
 * them. A panel appended to `<body>` is the last thing on the page, so a
 * keyboard leaving the trigger walked the sidebar, the tree and everything else
 * first — which is not "the control is keyboard reachable", it is the control
 * being at the end of a queue nobody finishes.
 *
 * Two halves put it back, and they are one rule: **the trigger and its panel are
 * one tab cycle**.
 *
 *   - Opening MOVES focus into the panel (its own box, which takes a
 *     `tabindex="-1"` for the purpose), so a person who opened it with the
 *     keyboard is standing in it rather than beside it. `queueMicrotask` for the
 *     same reason the command palette uses one: the element is not attached at
 *     the instant the signal flips.
 *   - While it is open, Tab and Shift+Tab WRAP inside that cycle — the trigger,
 *     then the panel's controls in order, then the trigger again. So Tab from
 *     the trigger is the first control, Shift+Tab from the first control is the
 *     trigger, and nothing reaches the page underneath while a panel is over it.
 *
 * The Tab handler lives here rather than in `./keys.ts` for the reason the
 * command palette's does (`palette/Palette.tsx`): the registry is the app's
 * global CHORDS and the row editor's bare keys, and a bare Tab that means one
 * thing only while a particular surface is on screen belongs to that surface.
 *
 * What this does NOT own is the panel's markup or its width — only whether it
 * is up, the box `./anchor.ts` says it goes in, and where the caret is while it
 * is there.
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
  /** `ref` on the panel itself — see the two roots above. It must carry a
   *  `tabindex="-1"`, because this is also what takes the focus when the panel
   *  opens. */
  readonly setPanel: (el: HTMLElement | undefined) => void
}

/**
 * What a Tab may land on inside a panel, in the order it lands.
 *
 * The ordinary list, and deliberately not a general one: these panels hold
 * buttons, boxes to type in and ticks, and a `[tabindex]` that is not `-1` is
 * how anything else would ask to be included. `:disabled` is excluded because
 * the Commit button spends most of its life that way and a cycle that stopped
 * on it would be a cycle with a dead end in it.
 */
const TABBABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), ' +
  'textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

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

  /** The one tab cycle the trigger and its panel make between them, in the
   *  order a Tab walks it. */
  const ring = (): ReadonlyArray<HTMLElement> => [
    ...(trigger === undefined ? [] : [trigger]),
    ...(panel === undefined
      ? []
      : [...panel.querySelectorAll<HTMLElement>(TABBABLE)]),
  ]

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
      if (event.key === "Escape") {
        event.preventDefault()
        close(true)
        return
      }
      if (event.key !== "Tab") return
      // The cycle, in tab order: the control that opened it, then what is
      // inside it. Read fresh on every press, because a panel's controls come
      // and go — the Commit panel grows a message box and a button the moment
      // there is anything to record.
      const cycle = ring()
      if (cycle.length === 0) return
      const active = document.activeElement
      // The panel's own box is where opening leaves the caret, and it stands
      // between the trigger and the first control: Tab goes on in, Shift+Tab
      // goes back out to the control that opened it.
      if (active === panel) {
        event.preventDefault()
        ;(event.shiftKey ? cycle[0] : cycle[1] ?? cycle[0])?.focus()
        return
      }
      const at = cycle.indexOf(active as HTMLElement)
      // Focus somewhere else entirely is left alone: the pointer can put it
      // there, and taking it back would be this panel deciding where somebody
      // else's click landed.
      if (at === -1) return
      event.preventDefault()
      const step = event.shiftKey ? -1 : 1
      cycle[(at + step + cycle.length) % cycle.length]?.focus()
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
      // As it ATTACHES, which is the moment it exists — a portal is appended to
      // the body, so nothing about opening carries a keyboard into it and the
      // signal flipping is one tick too early to ask. `queueMicrotask` for the
      // same reason the command palette uses one.
      if (el !== undefined) queueMicrotask(() => el.focus())
    },
  }
}
