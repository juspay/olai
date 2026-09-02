import { expect, test } from "bun:test"

import { recordAll, recordOf, snapshotOf, snapshotsOf } from "./hold.ts"
import { laneOf, type HeldSnapshot } from "./mirror.ts"

const LANE = laneOf("claude", "s-1")

test("a missing record is a fresh map", () => {
  expect(snapshotOf(null)).toBeUndefined()
})

test("a record missing channel or lastLane is not a hold", () => {
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

test("a missing overflow count is zero rather than a refused hold", () => {
  const got = snapshotOf({
    channel: "ch-team",
    lastLane: LANE,
    threads: [],
    queue: [],
  })
  expect(got?.droppedTotal).toBe(0)
})

test("two channels survive as two snapshots, and the old one-channel shape is one", () => {
  const a: HeldSnapshot = {
    channel: "ch-a",
    lastLane: LANE,
    threads: [[LANE, { conversationId: "conv-a", ciMessageId: undefined }]],
    queue: [],
    droppedTotal: 0,
  }
  const b: HeldSnapshot = { ...a, channel: "ch-b", threads: [] }
  const all = snapshotsOf(recordAll(new Map([["ch-a", a], ["ch-b", b]])))
  expect(all.get("ch-a")?.channel).toBe("ch-a")
  expect(all.get("ch-b")?.channel).toBe("ch-b")
  expect(snapshotsOf(recordOf(a)).get("ch-a")?.channel).toBe("ch-a")
})

test("recordOf is what snapshotOf reads back", () => {
  const held = {
    channel: "ch-team",
    lastLane: LANE,
    threads: [[LANE, { conversationId: "conv-1", ciMessageId: undefined }]] as const,
    queue: [{ op: "post" as const, lane: LANE, kind: "dispatched" as const, text: "held" }],
    droppedTotal: 3,
  }
  expect(snapshotOf(recordOf(held))).toEqual({
    channel: "ch-team",
    lastLane: LANE,
    threads: [[LANE, { conversationId: "conv-1", ciMessageId: undefined }]],
    queue: [{ op: "post", lane: LANE, kind: "dispatched", text: "held" }],
    droppedTotal: 3,
  })
})
