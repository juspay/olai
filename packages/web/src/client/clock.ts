import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

import { isoDate } from "@olai/format"

export const isoDayOf = (at: Date): string =>
  isoDate(at.getFullYear(), at.getMonth() + 1, at.getDate())

export const untilMidnight = (at: Date): number => {
  const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1)
  return midnight.getTime() - at.getTime() + 1
}

export const createToday = (): Accessor<string> => {
  const [today, setToday] = createSignal(isoDayOf(new Date()))

  let timer: ReturnType<typeof setTimeout> | undefined

  const reread = (): void => {
    const now = new Date()
    setToday(isoDayOf(now))
    clearTimeout(timer)
    timer = setTimeout(reread, untilMidnight(now))
  }

  reread()

  const woke = (): void => {
    if (document.visibilityState === "visible") reread()
  }
  document.addEventListener("visibilitychange", woke)

  onCleanup(() => {
    clearTimeout(timer)
    document.removeEventListener("visibilitychange", woke)
  })

  return today
}

const ALWAYS: Accessor<boolean> = () => true

export const createTicking = (
  every: number,
  when: Accessor<boolean> = ALWAYS,
): Accessor<number> => {
  const [now, setNow] = createSignal(Date.now())
  createEffect(() => {
    if (!when()) return
    const read = (): void => {
      setNow(Date.now())
    }
    read()
    const timer = setInterval(read, every)
    const woke = (): void => {
      if (document.visibilityState === "visible") read()
    }
    document.addEventListener("visibilitychange", woke)
    onCleanup(() => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", woke)
    })
  })
  return now
}

export const createTwoSpeed = (
  started: Accessor<string | number | undefined | null>,
  coarsenAfter: number,
): Accessor<number> => {
  const [coarse, setCoarse] = createSignal(false)
  const armed = (): boolean => instantOf(started()) !== null
  createEffect(() => {
    const then = instantOf(started())
    if (then === null) {
      setCoarse(false)
      return
    }
    const wait = coarsenAfter - Math.max(0, Date.now() - then)
    if (wait <= 0) {
      setCoarse(true)
      return
    }
    setCoarse(false)
    const handoff = setTimeout(() => setCoarse(true), wait)
    onCleanup(() => clearTimeout(handoff))
  })
  const fast = createTicking(SECOND, () => armed() && !coarse())
  const slow = createTicking(MINUTE, () => armed() && coarse())
  return () => (coarse() ? slow() : fast())
}

export const instantOf = (
  at: string | number | null | undefined,
): number | null => {
  if (at === null || at === undefined) return null
  if (typeof at === "number") return Number.isFinite(at) ? at : null
  const then = Date.parse(at)
  return Number.isNaN(then) ? null : then
}

export const SECOND = 1_000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
