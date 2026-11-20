import type { Accessor } from "solid-js"

import { createTwoSpeed, DAY, HOUR, instantOf, MINUTE, SECOND } from "./clock.ts"

export const upOf = (startedAt: string, now: number): string => {
  const then = instantOf(startedAt)
  if (then === null) return ""
  const since = Math.max(0, now - then)
  if (since < MINUTE) return `Running for ${Math.floor(since / SECOND)}s`
  if (since < HOUR) return `Running for ${Math.floor(since / MINUTE)}m`
  if (since < DAY) return `Running for ${Math.floor(since / HOUR)}h`
  return `Running for ${Math.floor(since / DAY)}d`
}

export const stillSeconds = (startedAt: string, now: number): boolean => {
  const then = instantOf(startedAt)
  if (then === null) return false
  return now - then < MINUTE
}

export const sinceOf = (startedAt: string): string => {
  if (instantOf(startedAt) === null) return ""
  return `Running since ${startedAt}`
}

export const createNow = (
  started: Accessor<string | undefined>,
): Accessor<number> => createTwoSpeed(started, MINUTE)
