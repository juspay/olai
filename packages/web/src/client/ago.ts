import type { Accessor } from "solid-js"

import { createTicking, DAY, HOUR, instantOf, MINUTE } from "./clock.ts"

export const agoOf = (at: string | number, now: number): string => {
  const then = instantOf(at)
  if (then === null) return ""
  const since = now - then
  if (since < MINUTE) return "just now"
  if (since < HOUR) return `${Math.floor(since / MINUTE)}m ago`
  if (since < DAY) return `${Math.floor(since / HOUR)}h ago`
  return `${Math.floor(since / DAY)}d ago`
}

const TICK = MINUTE

export const createNow = (): Accessor<number> => createTicking(TICK)
