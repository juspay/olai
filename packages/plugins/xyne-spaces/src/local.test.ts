import { expect, test } from "bun:test"
import type { LocalState } from "@olai/plugin-api/services"
import { Effect, Result } from "effect"

import { openLocalState, recordOf, snapshotOf, snapshotsOf } from "./local.ts"
import { laneOf, type MirrorSnapshot } from "./mirror.ts"

const LANE = laneOf("claude", "s-1")
const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

test("a missing record is a fresh map", () => {
  expect(snapshotOf(null)).toBeUndefined()
})

test("a record missing channel or lastLane is not a snapshot", () => {
  expect(snapshotOf({ lastLane: LANE, threads: [], queue: [] })).toBeUndefined()
  expect(snapshotOf({ channel: "ch-team", threads: [], queue: [] })).toBeUndefined()
})

test("a malformed thread or queue row is skipped, not the file", () => {
  const got = snapshotOf({
    channel: "ch-team",
    lastLane: LANE,
    threads: [
      "not-a-pair",
      [LANE, { conversationId: "conv-1", ciMessageId: undefined }],
      ["bad", { conversationId: 1 }],
      [2, { conversationId: "conv-2" }],
    ],
    queue: [
      { op: "post", lane: LANE, kind: "dispatched", text: "held" },
      { op: "post", lane: LANE },
      { op: "update", messageId: "m-1", text: "no lane" },
      "nope",
    ],
    droppedTotal: 4,
  })
  expect(got).toEqual({
    channel: "ch-team",
    lastLane: LANE,
    threads: [[LANE, { conversationId: "conv-1", ciMessageId: undefined }]],
    queue: [{ op: "post", lane: LANE, kind: "dispatched", text: "held" }],
    droppedTotal: 4,
  })
})

test("a missing overflow count is zero rather than a refused snapshot", () => {
  const got = snapshotOf({
    channel: "ch-team",
    lastLane: LANE,
    threads: [],
    queue: [],
  })
  expect(got?.droppedTotal).toBe(0)
})

test("two channels survive as two snapshots, and the old one-channel shape is one", () => {
  const a: MirrorSnapshot = {
    channel: "ch-a",
    lastLane: LANE,
    threads: [[LANE, { conversationId: "conv-a", ciMessageId: undefined }]],
    queue: [],
    droppedTotal: 0,
  }
  const b: MirrorSnapshot = { ...a, channel: "ch-b", threads: [] }
  const all = snapshotsOf({ mirrors: [recordOf(a), recordOf(b)] })
  expect(all.get("ch-a")?.channel).toBe("ch-a")
  expect(all.get("ch-b")?.channel).toBe("ch-b")
  expect(snapshotsOf(recordOf(a)).get("ch-a")?.channel).toBe("ch-a")
})

test("recordOf is what snapshotOf reads back", () => {
  const snapshot = {
    channel: "ch-team",
    lastLane: LANE,
    threads: [[LANE, { conversationId: "conv-1", ciMessageId: undefined }]] as const,
    queue: [{ op: "post" as const, lane: LANE, kind: "dispatched" as const, text: "held" }],
    droppedTotal: 3,
  }
  expect(snapshotOf(recordOf(snapshot))).toEqual({
    channel: "ch-team",
    lastLane: LANE,
    threads: [[LANE, { conversationId: "conv-1", ciMessageId: undefined }]],
    queue: [{ op: "post", lane: LANE, kind: "dispatched", text: "held" }],
    droppedTotal: 3,
  })
})

test("simultaneous channel writes share one lane", async () => {
  let record: Record<string, unknown> = {}
  const door: LocalState = {
    load: Effect.succeed(null),
    save: (next) => Effect.gen(function*() {
      yield* Effect.yieldNow
      record = next
    }),
  }
  const local = await run(openLocalState(door))
  const a: MirrorSnapshot = {
    channel: "ch-a",
    lastLane: LANE,
    threads: [],
    queue: [],
    droppedTotal: 0,
  }
  const b: MirrorSnapshot = { ...a, channel: "ch-b" }

  await Promise.all([run(local.save(a)), run(local.save(b))])

  expect([...snapshotsOf(record).keys()].sort()).toEqual(["ch-a", "ch-b"])
})

test("a refused write leaves the last landed snapshot in memory", async () => {
  const before: MirrorSnapshot = {
    channel: "ch-team",
    lastLane: LANE,
    threads: [],
    queue: [],
    droppedTotal: 0,
  }
  const door: LocalState = {
    load: Effect.succeed(recordOf(before)),
    save: () => Effect.fail({ _tag: "StateFailure", reason: "the state home is read-only" }),
  }
  const local = await run(openLocalState(door))
  const after = { ...before, droppedTotal: 1 }

  const answer = await Effect.runPromise(Effect.result(local.save(after)))

  expect(Result.isFailure(answer)).toBe(true)
  expect(local.load("ch-team")).toEqual(before)
})
