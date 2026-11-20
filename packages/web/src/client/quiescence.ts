import { type Accessor, createSignal } from "solid-js"

export const KEYS_SETTLING = "data-keys-settling"

export interface Deferrals {
  readonly task: (go: () => void) => void
  readonly frames: (go: () => void) => void
}

export interface Quiescence {
  readonly count: Accessor<number>
  readonly began: () => void
  readonly underKey: () => boolean
  readonly holding: <T>(work: Promise<T>) => Promise<T>
  readonly held: () => (() => void) | undefined
}

export const createQuiescence = (after: Deferrals): Quiescence => {
  const [count, setCount] = createSignal(0)
  let keys = 0

  const take = (): (() => void) => {
    setCount((n) => n + 1)
    let dropped = false
    return () => {
      if (dropped) return
      dropped = true
      after.frames(() => setCount((n) => n - 1))
    }
  }

  return {
    count,
    began: () => {
      keys += 1
      const drop = take()
      after.task(() => {
        keys -= 1
        drop()
      })
    },
    underKey: () => keys > 0,
    holding: (work) => {
      const drop = keys > 0 ? take() : undefined
      return drop === undefined ? work : work.finally(drop)
    },
    held: () => (keys > 0 ? take() : undefined),
  }
}

export interface Painting {
  readonly hidden: () => boolean
  readonly frame: (go: () => void) => void
  readonly watch: (go: () => void) => () => void
  readonly task: (go: () => void) => void
}

export const framesOver = (view: Painting): Deferrals["frames"] => {
  const frame = (next: () => void): void => {
    if (view.hidden()) {
      view.task(next)
      return
    }
    let ran = false
    let stopWatching = (): void => {}
    const once = () => {
      if (ran) return
      ran = true
      stopWatching()
      next()
    }
    stopWatching = view.watch(() => {
      if (view.hidden()) once()
    })
    view.frame(once)
  }
  return (go) => frame(() => frame(go))
}

const inTheBrowser: Deferrals = {
  // A task, not a microtask: the HTML spec runs a microtask checkpoint between
  // two listeners on the same event, so one queued in the capture phase would
  // run before the app's own handler had been called at all.
  task: (go) => {
    setTimeout(go, 0)
  },
  frames: framesOver({
    hidden: () => document.visibilityState === "hidden",
    frame: (go) => {
      requestAnimationFrame(go)
    },
    watch: (go) => {
      document.addEventListener("visibilitychange", go)
      return () => document.removeEventListener("visibilitychange", go)
    },
    task: (go) => {
      setTimeout(go, 0)
    },
  }),
}

export const quiescence: Quiescence = createQuiescence(inTheBrowser)

export const followKeys = (): (()=>void) => {
  const began=()=>quiescence.began()
  window.addEventListener("keydown", began, true)
  return ()=>window.removeEventListener("keydown",began,true)
}
