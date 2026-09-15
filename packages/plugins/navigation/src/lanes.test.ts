import { expect, test } from "bun:test"

import { adopted, DEAD_LANE, forgotten, type LaneRows, pushedAt, seek } from "./lanes.ts"

const rows = (...owners: ReadonlyArray<string | null>): LaneRows =>
  new Map(owners.map((owner, at) => [at, owner] as const))

test("the lane's own entry applies", () => {
  expect(seek(rows("a", "b", "a"), 2, 0, "a")).toBe("apply")
})

test("with no lane in force every entry applies, known or not", () => {
  expect(seek(rows("a", "b"), 1, 0, null)).toBe("apply")
  expect(seek(new Map(), 4, 3, null)).toBe("apply")
})

test("going back past another lane's entry seeks when one of ours lies behind it", () => {
  expect(seek(rows("a", "b", "a"), 2, 1, "a")).toBe("seek")
})

test("going forward past another lane's entry seeks when one of ours lies ahead", () => {
  expect(seek(rows("a", "b", "a"), 0, 1, "a")).toBe("seek")
})

test("at the back edge of the lane it bounces", () => {
  expect(seek(rows("b", "a"), 1, 0, "a")).toBe("bounce")
})

test("at the forward edge of the lane it bounces", () => {
  expect(seek(rows("a", "b", "b"), 0, 1, "a")).toBe("bounce")
  expect(seek(rows("a", "b", "b"), 0, 2, "a")).toBe("bounce")
})

test("a forgotten lane's entries are skipped", () => {
  const closed = forgotten(rows("a", "b", "b", "a"), "b")
  expect(closed.get(1)).toBe(DEAD_LANE)
  expect(seek(closed, 3, 2, "a")).toBe("seek")
  expect(seek(closed, 3, 0, "a")).toBe("apply")
})

test("positions the table never saw are dead while a lane is in force", () => {
  const afterReload: LaneRows = new Map([[5, "a"]])
  expect(seek(afterReload, 5, 4, "a")).toBe("bounce")
  expect(seek(new Map([[3, "a"], [5, "a"]]), 5, 4, "a")).toBe("seek")
})

test("a push discards the entries beyond it", () => {
  const pushed = pushedAt(rows("a", "a", "b", "b"), 2, "a")
  expect([...pushed]).toEqual([[0, "a"], [1, "a"], [2, "a"]])
})

test("a lane taken over entries that belonged to no tab adopts them, and nothing else", () => {
  const taken = adopted(new Map([[0, null], [1, "b"], [2, DEAD_LANE], [3, null]]), "a")
  expect([...taken]).toEqual([[0, "a"], [1, "b"], [2, DEAD_LANE], [3, "a"]])
})
