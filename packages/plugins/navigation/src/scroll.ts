import { onCleanup } from "solid-js"

export const SETTLE_MS = 1_000

export const CEILING_MS = 30_000

const TAKEOVER = ["wheel", "touchstart", "keydown", "pointerdown"] as const

export interface ScrollMemory {
  readonly leave: () => void
  readonly toTop: () => void
  readonly restore: (key: string) => void
}

export const createScrollMemory = (
  keyHere: () => string | undefined,
  ceilingMs = CEILING_MS,
): ScrollMemory => {
  history.scrollRestoration = "manual"

  const left = new Map<string, number>()

  /** The `scrollY` we last assigned. Chromium dispatches `scroll` at a
   *  rendering update rather than inside `scrollTo`, so a flag around the
   *  write is already false when the handler runs; an event matching this
   *  value is our own restore. Cleared when the restore ends. */
  let assignedTop = Number.NaN
  let assigning = false

  const record = (): void => {
    if (assigning) return
    if (Number.isFinite(assignedTop) && Math.abs(scrollY - assignedTop) < 1) return
    const key = keyHere()
    if (key !== undefined) left.set(key, scrollY)
  }
  addEventListener("scroll", record, { passive: true })
  onCleanup(() => removeEventListener("scroll", record))

  const go = (top: number): void => {
    assigning = true
    scrollTo({ top, behavior: "instant" })
    assignedTop = scrollY
    assigning = false
  }

  let giveUp: (() => void) | undefined
  onCleanup(() => giveUp?.())

  const keepAsking = (top: number): void => {
    giveUp?.()
    let frame = 0
    let hang: ReturnType<typeof setTimeout> | undefined
    let ceiling: ReturnType<typeof setTimeout> | undefined
    let seenDip = false
    let lastHeight = document.documentElement.scrollHeight
    const growing = new ResizeObserver(() => {
      const height = document.documentElement.scrollHeight
      if (height < lastHeight) {
        lastHeight = height
        seenDip = true
        return
      }
      if (height <= lastHeight) return
      lastHeight = height
      if (!seenDip) return
      clearTimeout(hang)
      hang = setTimeout(stop, SETTLE_MS)
    })
    const stop = (): void => {
      cancelAnimationFrame(frame)
      clearTimeout(hang)
      clearTimeout(ceiling)
      growing.disconnect()
      for (const gesture of TAKEOVER) removeEventListener(gesture, stop)
      assignedTop = Number.NaN
      giveUp = undefined
    }
    const again = (): void => {
      go(top)
      if (scrollY >= top) return stop()
      frame = requestAnimationFrame(again)
    }
    giveUp = stop
    for (const gesture of TAKEOVER) {
      addEventListener(gesture, stop, { passive: true })
    }
    growing.observe(document.documentElement)
    ceiling = setTimeout(stop, ceilingMs)
    frame = requestAnimationFrame(again)
  }

  return {
    leave: () => { record(); giveUp?.() },
    toTop: () => {
      giveUp?.()
      go(0)
      requestAnimationFrame(() => {
        assignedTop = Number.NaN
      })
    },
    restore: (key) => {
      const top = left.get(key) ?? 0
      giveUp?.()
      go(top)
      if (scrollY < top) keepAsking(top)
      else {
        requestAnimationFrame(() => {
          assignedTop = Number.NaN
        })
      }
    },
  }
}
