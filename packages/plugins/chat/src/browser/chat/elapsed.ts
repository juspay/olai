import { type ChatEntry, outSince } from "olai-plugin-chat/wire"
import type { Accessor } from "solid-js"

import { createTicking, HOUR, instantOf, MINUTE, SECOND } from "@olai/web/client/clock.ts"
import { isRunning } from "./running.ts"

export const elapsedOf = (
  entry: ChatEntry,
  now: () => number,
): string | null => {
  if (!isRunning(entry)) return null
  const started = instantOf(outSince(entry))
  if (started === null) return null
  const running = now() - started
  if (running < QUIET_MS) return null
  return saidOf(running)
}

export const saidOf = (running: number): string => {
  if (running < MINUTE) return `${Math.floor(running / SECOND)}s`
  if (running < HOUR) {
    return `${Math.floor(running / MINUTE)}m ${Math.floor((running % MINUTE) / SECOND)}s`
  }
  return `${Math.floor(running / HOUR)}h ${Math.floor((running % HOUR) / MINUTE)}m`
}

export const outFor = (since: string, now: number): string | null => {
  const armed = instantOf(since)
  if (armed === null) return null
  return saidOf(Math.max(0, now - armed))
}

const QUIET_MS = 3 * SECOND

const TICK_MS = SECOND

export const createNow = (live: Accessor<boolean>): Accessor<number> =>
  createTicking(TICK_MS, live)
