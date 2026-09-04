/**
 * THE MIRROR'S SNAPSHOT — threads, queue, overflow count.
 *
 * Core owns the file behind `LocalState`. This module is the parse: a
 * missing or unreadable record is a fresh map, a single malformed row is
 * skipped rather than the file.
 */

import type { MirrorSnapshot, Outbound, Thread } from "./mirror.ts"

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

export const snapshotOf = (
  raw: Record<string, unknown> | null,
): MirrorSnapshot | undefined => {
  if (raw === null) return undefined
  if (typeof raw.channel !== "string" || typeof raw.lastLane !== "string") return undefined
  const threads: Array<readonly [string, Thread]> = []
  if (Array.isArray(raw.threads)) {
    for (const row of raw.threads) {
      if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" || !isThread(row[1])) {
        continue
      }
      threads.push([row[0], row[1]])
    }
  }
  const queue: Array<Outbound> = []
  if (Array.isArray(raw.queue)) {
    for (const item of raw.queue) {
      if (isOutbound(item)) queue.push(item)
    }
  }
  const droppedTotal =
    typeof raw.droppedTotal === "number" && Number.isFinite(raw.droppedTotal) && raw.droppedTotal >= 0
      ? Math.floor(raw.droppedTotal)
      : 0
  return { channel: raw.channel, lastLane: raw.lastLane, threads, queue, droppedTotal }
}

export const recordOf = (snapshot: MirrorSnapshot): Record<string, unknown> => ({
  channel: snapshot.channel,
  lastLane: snapshot.lastLane,
  threads: snapshot.threads,
  queue: snapshot.queue,
  droppedTotal: snapshot.droppedTotal,
})

/** Every channel's snapshot, so two node agents naming two channels
 *  cannot clobber each other's threads. A record that is still the
 *  one-channel shape is one entry. */
export const snapshotsOf = (
  raw: Record<string, unknown> | null,
): Map<string, MirrorSnapshot> => {
  const map = new Map<string, MirrorSnapshot>()
  if (raw === null) return map
  if (Array.isArray(raw.mirrors)) {
    for (const row of raw.mirrors) {
      if (row === null || typeof row !== "object") continue
      const one = snapshotOf(row as Record<string, unknown>)
      if (one !== undefined) map.set(one.channel, one)
    }
    return map
  }
  const one = snapshotOf(raw)
  if (one !== undefined) map.set(one.channel, one)
  return map
}

export const recordAll = (snapshots: ReadonlyMap<string, MirrorSnapshot>): Record<string, unknown> => ({
  mirrors: [...snapshots.values()].map(recordOf),
})
