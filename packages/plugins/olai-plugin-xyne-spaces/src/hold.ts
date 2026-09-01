/**
 * THE MIRROR'S HOLD — lane threads and the outbound queue, in the state home.
 *
 * Not in the vault. `@olai/state` is the established home: `fileFor("mirror")`
 * keyed by the vault's canonical path, `writeHeld` staged and renamed so a
 * torn write is not a silently empty hold. A missing or unreadable hold is a
 * fresh map — the first serve's answer. A single malformed row is skipped,
 * not the whole file.
 */

import { Effect } from "effect"
import { readFileSync } from "node:fs"

import { canonical, fileFor, writeHeld, type StateFailure } from "@olai/state"

import type { HeldSnapshot, Outbound, Thread } from "./mirror.ts"

export type Held = HeldSnapshot

const isThread = (value: unknown): value is Thread => {
  if (value === null || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return typeof record.conversationId === "string"
    && (record.ciMessageId === undefined || typeof record.ciMessageId === "string")
}

const isOutbound = (value: unknown): value is Outbound => {
  if (value === null || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  if (record.op === "update") {
    return typeof record.lane === "string"
      && typeof record.messageId === "string"
      && typeof record.text === "string"
  }
  if (record.op === "post") {
    return typeof record.lane === "string"
      && typeof record.kind === "string"
      && typeof record.text === "string"
  }
  return false
}

export const holdFile = (served: string): { readonly at: string; readonly cwd: string } => {
  const cwd = canonical(served)
  return { cwd, at: fileFor("mirror", cwd) }
}

export type Load =
  | { readonly ok: Held }
  | { readonly missing: true }
  | { readonly error: string }

export const loadHold = (served: string): Load => {
  const { at, cwd } = holdFile(served)
  try {
    const raw: unknown = JSON.parse(readFileSync(at, "utf8"))
    if (raw === null || typeof raw !== "object") {
      return { error: `\`${at}\` is not a hold object` }
    }
    const record = raw as Record<string, unknown>
    if (record.cwd !== cwd) return { missing: true }
    if (typeof record.channel !== "string" || typeof record.lastLane !== "string") {
      return { error: `\`${at}\` is missing channel or lastLane` }
    }
    const threads: Array<readonly [string, Thread]> = []
    if (Array.isArray(record.threads)) {
      for (const row of record.threads) {
        if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" || !isThread(row[1])) {
          continue
        }
        threads.push([row[0], row[1]])
      }
    }
    const queue: Array<Outbound> = []
    if (Array.isArray(record.queue)) {
      for (const item of record.queue) {
        if (isOutbound(item)) queue.push(item)
      }
    }
    return { ok: { channel: record.channel, lastLane: record.lastLane, threads, queue } }
  } catch (cause) {
    if ((cause as { readonly code?: unknown }).code === "ENOENT") return { missing: true }
    return { error: `\`${at}\` could not be read: ${cause instanceof Error ? cause.message : String(cause)}` }
  }
}

export const saveHold = (
  served: string,
  held: Held,
): Effect.Effect<void, StateFailure> => {
  const { at, cwd } = holdFile(served)
  return writeHeld(at, { cwd, ...held })
}
