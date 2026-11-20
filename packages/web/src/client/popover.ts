import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

import { type Anchor, anchoredTo } from "./anchor.ts"
import { dismissOn } from "./dismiss.ts"

export interface HeldOpen {
  readonly open: Accessor<boolean>
  readonly setOpen: (up: boolean) => void
}

export interface Popover {
  readonly open: Accessor<boolean>
  readonly at: Accessor<Anchor | null>
  readonly toggle: () => void
  readonly close: () => void
  readonly setTrigger: (el: HTMLElement | undefined) => void
  readonly setPanel: (el: HTMLElement | undefined) => void
}

const TABBABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), ' +
  'textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'

const ownOpen = (): HeldOpen => {
  const [open, setOpen] = createSignal(false)
  return { open, setOpen }
}

const sameBox = (a: Anchor | null, b: Anchor | null): boolean =>
  a === b ||
  (a !== null && b !== null && a.left === b.left && a.width === b.width &&
    a.maxHeight === b.maxHeight && a.side === b.side && a.offset === b.offset)

export const createPopover = (options: {
  readonly held?: HeldOpen
} = {}): Popover => {
  const { open, setOpen } = options.held ?? ownOpen()
  const [at, setAt] = createSignal<Anchor | null>(null, { equals: sameBox })

  let trigger: HTMLElement | undefined
  let panel: HTMLElement | undefined

  const close = (): void => {
    setOpen(false)
  }

  const ring = (): ReadonlyArray<HTMLElement> => [
    ...(trigger === undefined ? [] : [trigger]),
    ...(panel === undefined
      ? []
      : [...panel.querySelectorAll<HTMLElement>(TABBABLE)].filter(el => el.getClientRects().length > 0)),
  ]

  const measure = (): void => {
    if (trigger === undefined) return
    setAt(anchoredTo(trigger.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    }))
  }

  dismissOn({ open, root: () => panel, trigger: () => trigger, dismiss: close })

  createEffect(() => {
    if (!open()) return
    measure()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const cycle = ring()
      if (cycle.length === 0) return
      const active = document.activeElement
      if (active === panel) {
        event.preventDefault()
        ;(event.shiftKey ? cycle[0] : cycle[1] ?? cycle[0])?.focus()
        return
      }
      const at = cycle.indexOf(active as HTMLElement)
      if (at === -1) return
      event.preventDefault()
      const step = event.shiftKey ? -1 : 1
      cycle[(at + step + cycle.length) % cycle.length]?.focus()
    }
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", measure)
    document.addEventListener("scroll", measure, true)
    onCleanup(() => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", measure)
      document.removeEventListener("scroll", measure, true)
    })
  })

  return {
    open,
    at,
    close,
    toggle: () => {
      if (!open()) return setOpen(true)
      close()
      trigger?.focus()
    },
    setTrigger: (el) => {
      trigger = el
    },
    setPanel: (el) => {
      panel = el
      if (el !== undefined) queueMicrotask(() => el.focus())
    },
  }
}
