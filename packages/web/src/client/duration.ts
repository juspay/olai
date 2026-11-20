import type { Accessor } from "solid-js"

import { spanOf } from "@olai/format"

import { createTwoSpeed, HOUR, SECOND } from "@olai/web/client/clock.ts"

export const wordsOf = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export const exactOf = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const parts: Array<string> = []
  const minutes = Math.floor(s / 60)
  const hours = Math.floor(minutes / 60)
  if (hours >= 24) parts.push(`${Math.floor(hours / 24)}d`)
  if (hours % 24 !== 0) parts.push(`${hours % 24}h`)
  if (minutes % 60 !== 0 || hours === 0) parts.push(`${minutes % 60}m`)
  if (s % 60 !== 0 || minutes === 0) parts.push(`${s % 60}s`)
  return parts.join(" ")
}

export const tickingOf = (elapsedMs: number): string => {
  const elapsed = Math.max(0, elapsedMs)
  if (elapsed < HOUR) {
    const seconds = Math.floor(elapsed / SECOND)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  }
  return wordsOf(elapsed / SECOND)
}

export const liveOf = (
  bankedSeconds: number | undefined,
  startedAt: number,
  now: number,
): number => (bankedSeconds ?? 0) * SECOND + Math.max(0, now - startedAt)

export const createNow = (
  started: Accessor<string | number | undefined | null>,
): Accessor<number> => createTwoSpeed(started, HOUR)

export const liveStoryOf = (
  bankedSeconds: number | undefined,
  started: string,
  now: number,
): ReadonlyArray<string> => {
  const banked = bankedSeconds ?? 0
  const round = spanOf(started, new Date(now).toISOString())
  if (round === undefined || banked <= 0) return [`round 1, under way since ${started}`]
  return [
    `${exactOf(banked)} already banked over the rounds before this one`,
    `this round under way again since ${started} — ${exactOf(round)} so far`,
    `${exactOf(banked + round)} worked in all — the pauses between the rounds never counted`,
  ]
}

export interface WindowedRound {
  readonly started: string
  readonly settled: string
  readonly span: number
}

export const roundOf = (
  started: string | undefined,
  settled: string | true | undefined,
): WindowedRound | undefined => {
  if (started === undefined || typeof settled !== "string") return undefined
  const span = spanOf(started, settled)
  return span === undefined ? undefined : { started, settled, span }
}

export const settledStoryOf = (args: {
  readonly took: number
  readonly banked: number | undefined
  readonly round: WindowedRound | undefined
}): ReadonlyArray<string> => {
  const { took, banked, round } = args
  if (banked === undefined) {
    return round === undefined
      ? [`took ${exactOf(took)}`]
      : [`took ${exactOf(took)} — round 1: ${round.started} → ${round.settled}`]
  }
  if (round === undefined) {
    if (banked <= 0) return [`took ${exactOf(took)}`]
    return [
      `took ${exactOf(took)} — rounds banked where each closed, the pauses between them never counted`,
    ]
  }
  const lump = Math.max(0, banked - round.span)
  if (lump === 0) {
    return [`took ${exactOf(took)} — the one round: ${round.started} → ${round.settled}`]
  }
  return [
    `took ${exactOf(took)} — the pauses between the rounds never counted`,
    `the rounds before the last banked ${exactOf(lump)} of it`,
    `the last ran ${exactOf(round.span)}: ${round.started} → ${round.settled}`,
  ]
}
