/**
 * THE MIRROR'S HOLD — lane threads and the outbound queue, beside the bind.
 *
 * `_olai/Spaces.olai` is the person's file and olai never writes it. This
 * sidecar is olai's, next to that file, so a restart opens the same Spaces
 * thread per conversation and the queued digests are still there to post.
 * A missing or unreadable hold is a fresh map — the first serve's answer.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { HeldSnapshot, Outbound, Thread } from "./mirror.ts"

export type Held = HeldSnapshot

export const HOLD_BASENAME = "spaces-mirror.json"

export const holdPath = (served: string): string => join(served, "_olai", HOLD_BASENAME)

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

export const loadHold = (path: string): Held | undefined => {
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (raw === null || typeof raw !== "object") return undefined
    const record = raw as Record<string, unknown>
    if (typeof record.channel !== "string" || typeof record.lastLane !== "string") return undefined
    if (!Array.isArray(record.threads) || !Array.isArray(record.queue)) return undefined
    const threads: Array<readonly [string, Thread]> = []
    for (const row of record.threads) {
      if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" || !isThread(row[1])) {
        return undefined
      }
      threads.push([row[0], row[1]])
    }
    const queue: Array<Outbound> = []
    for (const item of record.queue) {
      if (!isOutbound(item)) return undefined
      queue.push(item)
    }
    return { channel: record.channel, lastLane: record.lastLane, threads, queue }
  } catch {
    return undefined
  }
}

export const saveHold = (path: string, held: Held): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(held)}\n`)
}
