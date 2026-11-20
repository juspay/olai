import { onCleanup } from "solid-js"

export const SETTLE_MS = 1_000

export const CEILING_MS = 30_000

const TAKEOVER = ["wheel", "touchstart", "keydown", "pointerdown"] as const

interface ArrivalWatch {
  readonly stop: () => void
}

const whenArrivalSettles = (settled: () => void): ArrivalWatch => {
  let height = document.documentElement.scrollHeight
  let standingPageLeft = false
  let quiet: ReturnType<typeof setTimeout> | undefined
  const sizing = new ResizeObserver(() => {
    const next = document.documentElement.scrollHeight
    if (next < height) {
      height = next
      standingPageLeft = true
      return
    }
    if (next <= height) return
    height = next
    if (!standingPageLeft) return
    clearTimeout(quiet)
    quiet = setTimeout(settled, SETTLE_MS)
  })
  sizing.observe(document.documentElement)
  return {
    stop: () => {
      clearTimeout(quiet)
      sizing.disconnect()
    },
  }
}

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

  let ourTop = Number.NaN

  /** Chromium dispatches `scroll` at a rendering update, not inside `scrollTo`. */
  const releaseAfterTheEvent = (): void => {
    requestAnimationFrame(() => {
      ourTop = Number.NaN
    })
  }

  const record = (): void => {
    if (Number.isFinite(ourTop) && Math.abs(scrollY - ourTop) < 1) return
    const key = keyHere()
    if (key !== undefined) left.set(key, scrollY)
  }
  addEventListener("scroll", record, { passive: true })
  onCleanup(() => removeEventListener("scroll", record))

  const go = (top: number): void => {
    scrollTo({ top, behavior: "instant" })
    ourTop = scrollY
  }

  let giveUp: (() => void) | undefined
  onCleanup(() => giveUp?.())

  const keepAsking = (top: number): void => {
    giveUp?.()
    let frame = 0
    let stuck: ReturnType<typeof setTimeout> | undefined
    let arrival: ArrivalWatch | undefined
    const stop = (): void => {
      cancelAnimationFrame(frame)
      arrival?.stop()
      clearTimeout(stuck)
      for (const gesture of TAKEOVER) removeEventListener(gesture, stop)
      ourTop = Number.NaN
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
    arrival = whenArrivalSettles(stop)
    stuck = setTimeout(stop, ceilingMs)
    frame = requestAnimationFrame(again)
  }

  return {
    leave: () => { record(); giveUp?.() },
    toTop: () => {
      giveUp?.()
      go(0)
      releaseAfterTheEvent()
    },
    restore: (key) => {
      const top = left.get(key) ?? 0
      giveUp?.()
      go(top)
      if (scrollY < top) keepAsking(top)
      else releaseAfterTheEvent()
    },
  }
}
