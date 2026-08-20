/**
 * The transcript's order, as a fold over frames.
 *
 * The two claims worth pinning are the two the panel rests on: the list is in
 * `seq` order whatever order the frames arrived in, and a frame that moves no
 * key hands back THE SAME ARRAY — which is what stops `<For>` and the lane map
 * above it re-running on every token an agent streams. The second one is an
 * identity assertion for that reason, not a taste.
 */

import { expect, test } from "bun:test"
import type { ChatEntry } from "@olai/surface"

import { type Ordered, TRANSCRIPT_ORDER } from "./order.ts"

/** A row, reduced to the one field this fold reads. The rest of a `ChatEntry`
 *  is the row's own business and never reaches the accumulator. */
const row = (id: string, seq: number): ChatEntry =>
  ({ id, seq, kind: "agent", text: `said ${seq}` }) as ChatEntry

const seeded = (...rows: ReadonlyArray<readonly [string, number]>): Ordered =>
  TRANSCRIPT_ORDER.init(rows.map(([key, seq]) => [key, row(key, seq)] as const))

const stepped = (
  held: Ordered,
  upserts: ReadonlyArray<readonly [string, number]>,
  removes: ReadonlyArray<string> = [],
): Ordered =>
  TRANSCRIPT_ORDER.step(held, {
    kind: "delta",
    upserts: upserts.map(([key, seq]) => [key, row(key, seq)] as const),
    removes: [...removes],
  })

test("a snapshot is read in `seq` order, not in the order it arrived", () => {
  expect(seeded(["c", 3], ["a", 1], ["b", 2]).keys).toEqual(["a", "b", "c"])
})

test("a row arriving takes its place, wherever the number puts it", () => {
  const held = seeded(["a", 1], ["c", 3])
  expect(stepped(held, [["b", 2]]).keys).toEqual(["a", "b", "c"])
})

test("a frame that only grows a row hands back the very list it was holding", () => {
  // THE WHOLE POINT, and it is an identity check: the panel's `<For>` and the
  // memo that pairs each row with the one above it both diff this array, and a
  // live turn is mostly frames of exactly this shape — an agent's prose
  // accumulating, a tool call revising its progress.
  const held = seeded(["a", 1], ["b", 2])
  const next = stepped(held, [["a", 1]])
  expect(next.keys).toBe(held.keys)
  expect(next).toBe(held)
})

test("a row whose `seq` moves is re-placed rather than left where it was", () => {
  const held = seeded(["a", 1], ["b", 2])
  const next = stepped(held, [["a", 9]])
  expect(next.keys).toEqual(["b", "a"])
  expect(next.keys).not.toBe(held.keys)
})

test("a removed row goes, and the rest keep their order", () => {
  const held = seeded(["a", 1], ["b", 2], ["c", 3])
  expect(stepped(held, [], ["b"]).keys).toEqual(["a", "c"])
})

test("a remove of a key this fold never saw changes nothing, and says so by identity", () => {
  // The socket's own requirement: the server's tick coalescer resolves an
  // upsert-then-remove inside one producer tick to a BARE remove, so a row born
  // and dead within one tick reaches a fold as a remove it has no key for.
  const held = seeded(["a", 1])
  expect(stepped(held, [], ["gone"])).toBe(held)
})

test("an emptied conversation is an empty list, not a stale one", () => {
  // What `/clear` and a new session look like from here: every key removed in
  // one frame.
  const held = seeded(["a", 1], ["b", 2])
  expect(stepped(held, [], ["a", "b"]).keys).toEqual([])
})

test("rows sharing a `seq` keep the order they were first seen in", () => {
  // The tie the per-frame sort broke by arrival order, because it sorted the
  // collection's arrival-ordered key list with a stable sort. The fold breaks it
  // the same way — over its own map's insertion order — so a conversation does
  // not reshuffle itself the day two rows are published on one count.
  const held = seeded(["first", 1], ["second", 1])
  expect(held.keys).toEqual(["first", "second"])
  expect(stepped(held, [["third", 1]]).keys).toEqual(["first", "second", "third"])
})
