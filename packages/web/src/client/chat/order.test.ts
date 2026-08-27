/**
 * The transcript's order, as a fold over frames.
 *
 * The two claims worth pinning are the two the panel rests on: the list is in
 * `seq` order whatever order the frames arrived in, and a frame that moves no
 * key hands back THE SAME ARRAY — which is what stops `<For>` and the lane map
 * above it re-running on every token an agent streams. The second one is an
 * identity assertion for that reason, not a taste.
 *
 * ... AND THE SECOND LIST, which the same walk cuts: the rows that are NOT the
 * column's, filed under the agent that made them ({@link ./lanes.ts}'s
 * `filedUnder`). The claim worth pinning hardest is the one the `seq` fast path
 * would skip — a call is announced, drawn, and only THEN stamped with the
 * `Agent` frame it was made inside, so a row can learn whose it is on a later
 * frame without its number ever moving. A fold that watched `seq` alone would
 * leave that call in the column until something else happened to move the
 * order, which for the last call of a fan-out is never.
 */

import { expect, test } from "bun:test"
import type { ChatEntry } from "@olai/surface"

import { type Ordered, TRANSCRIPT_ORDER } from "./order.ts"

/** A row, reduced to the one field this fold reads. The rest of a `ChatEntry`
 *  is the row's own business and never reaches the accumulator. */
const row = (id: string, seq: number): ChatEntry => ({
  id,
  seq,
  since: "2026-08-21T12:00:00.000Z",
  kind: "agent",
  text: `said ${seq}`,
})

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

/** A TOOL row — the only kind that can leave the column — and `parent`, the
 *  one field that takes it out. Absent rather than `null` for a call the main
 *  agent made itself, which is how the wire spells it. */
const call = (id: string, seq: number, parent?: string): ChatEntry => ({
  id,
  seq,
  since: "2026-08-21T12:00:00.000Z",
  kind: "tool",
  text: id,
  status: "pending",
  ...(parent === undefined ? {} : { parent }),
})

/** ... and a QUESTION, which carries a `parent` and stays in the column anyway. */
const asked = (id: string, seq: number, parent?: string): ChatEntry => ({
  id,
  seq,
  since: "2026-08-21T12:00:00.000Z",
  kind: "ask",
  text: id,
  ask: { fields: [], outcome: null },
  ...(parent === undefined ? {} : { parent }),
})

/** The two helpers again over WHOLE rows, because the claims below are about
 *  what a row SAYS rather than about the number it arrived with — and each row
 *  is its own key, the way the transcript keys them. */
const opened = (...entries: ReadonlyArray<ChatEntry>): Ordered =>
  TRANSCRIPT_ORDER.init(entries.map((entry) => [entry.id, entry] as const))

const frame = (
  held: Ordered,
  upserts: ReadonlyArray<ChatEntry>,
  removes: ReadonlyArray<string> = [],
): Ordered =>
  TRANSCRIPT_ORDER.step(held, {
    kind: "delta",
    upserts: upserts.map((entry) => [entry.id, entry] as const),
    removes: [...removes],
  })

/** The lanes as a comparable value — a map is not one, and what a test means
 *  by "no lanes" is that nothing is filed anywhere. */
const laned = (held: Ordered): ReadonlyArray<readonly [string, ReadonlyArray<string>]> =>
  [...held.lanes]

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

test("a call a subagent made is not in the column, and is in that agent's lane", () => {
  // The two lists are ONE decision, cut in one walk: a key is the column's or
  // it is an agent's. Asked twice, the two answers are free to disagree about a
  // row — which draws a call nowhere at all, or draws it twice.
  const held = opened(
    row("agent:1", 1),
    call("tool:agent-1", 2),
    call("tool:call-1", 3, "tool:agent-1"),
  )
  expect(held.keys).toEqual(["agent:1", "tool:agent-1"])
  expect(laned(held)).toEqual([["tool:agent-1", ["tool:call-1"]]])
})

test("a row that learns whose it is on a later frame leaves the column", () => {
  // THE ONE THE `seq` FAST PATH WOULD SKIP, and the reason the step asks a
  // second question. A call reaches this fold across several frames — announced,
  // drawn, then stamped with the `Agent` frame it was made inside — and the
  // frame that says whose it is moves no number at all. Watching `seq` alone,
  // that call sits in the column until something else happens to move the order,
  // which for the last call of a fan-out never happens: a subagent's work
  // silently never reaches the shelf.
  const held = opened(call("tool:agent-1", 1), call("tool:call-1", 2))
  expect(held.keys).toEqual(["tool:agent-1", "tool:call-1"])
  const next = frame(held, [call("tool:call-1", 2, "tool:agent-1")])
  expect(next.keys).toEqual(["tool:agent-1"])
  expect(laned(next)).toEqual([["tool:agent-1", ["tool:call-1"]]])
})

test("a call whose `Agent` frame the panel never got stays in the column", () => {
  // A lane is reachable only through the frame it hangs off — the strip while
  // the agent is out, that row's own door afterwards — so filing this row would
  // file it where nothing can open it, which is a record destroyed rather than
  // moved. In the column it is what it always was: a row behind a rail, named
  // *a subagent* (`./lanes.ts`).
  const held = opened(row("agent:1", 1), call("tool:call-1", 2, "tool:gone"))
  expect(held.keys).toEqual(["agent:1", "tool:call-1"])
  expect(laned(held)).toEqual([])
})

test("... and joins the lane the moment that frame arrives", () => {
  // Which is the same transient from the other end: a replay, or a frame still
  // in flight when the panel opened.
  const held = opened(row("agent:1", 1), call("tool:call-1", 3, "tool:gone"))
  const next = frame(held, [call("tool:gone", 2)])
  expect(next.keys).toEqual(["agent:1", "tool:gone"])
  expect(laned(next)).toEqual([["tool:gone", ["tool:call-1"]]])
})

test("a removed row goes out of the lane it was filed in", () => {
  // A lane that kept a removed key would hand the shelf's own `<For>` a key
  // whose value is gone, and it would draw a hole — the one thing this fold
  // promises about membership.
  const held = opened(
    call("tool:agent-1", 1),
    call("tool:call-1", 2, "tool:agent-1"),
    call("tool:call-2", 3, "tool:agent-1"),
  )
  expect(laned(held)).toEqual([["tool:agent-1", ["tool:call-1", "tool:call-2"]]])
  const next = frame(held, [], ["tool:call-1"])
  expect(next.keys).toEqual(["tool:agent-1"])
  expect(laned(next)).toEqual([["tool:agent-1", ["tool:call-2"]]])
})

test("a remove of a key this fold never saw rebuilds no lane either", () => {
  // The socket's requirement, asked of the second map: the server's tick
  // coalescer resolves an upsert-then-remove inside one producer tick to a bare
  // remove, so a row born and dead within one tick arrives as a remove with no
  // upsert before it. A conversation that HAS lanes is the case worth naming —
  // rebuilding there would mint a new lane map, and every shelf on screen would
  // diff its list because of a key nothing here has ever held.
  const held = opened(call("tool:agent-1", 1), call("tool:call-1", 2, "tool:agent-1"))
  expect(frame(held, [], ["gone"])).toBe(held)
})

test("a frame that moves nothing hands back the very lanes it was holding", () => {
  // The identity guarantee covers BOTH lists or it covers neither: the shelf's
  // `<For>` diffs this map, and a live turn is mostly frames that merely grow a
  // row — a subagent's call revising its progress, ten times a second.
  const held = opened(call("tool:agent-1", 1), call("tool:call-1", 2, "tool:agent-1"))
  const next = frame(held, [call("tool:call-1", 2, "tool:agent-1")])
  expect(next).toBe(held)
  expect(next.lanes).toBe(held.lanes)
})

test("a conversation with no lanes hands back the very same empty map every rebuild", () => {
  // Nearly every conversation. The keys move — a row arrived — so the lists are
  // rebuilt, and a fresh empty map per rebuild would wake a memo over it on
  // every row of every turn in a panel that has never spawned anything.
  const held = opened(row("agent:1", 1))
  const next = frame(held, [row("agent:2", 2)])
  expect(next.keys).not.toBe(held.keys)
  expect(next.lanes).toBe(held.lanes)
  expect(laned(next)).toEqual([])
})

test("a subagent's question stays in the column beside the agent that asked it", () => {
  // A form blocks the turn and hangs until somebody presses something, so
  // filing one into a shelf would put it behind a click — and a form behind a
  // click is a turn that hangs forever (`./lanes.ts`). The call beside it goes;
  // the question does not.
  const held = opened(
    call("tool:agent-1", 1),
    call("tool:call-1", 2, "tool:agent-1"),
    asked("ask:1", 3, "tool:agent-1"),
  )
  expect(held.keys).toEqual(["tool:agent-1", "ask:1"])
  expect(laned(held)).toEqual([["tool:agent-1", ["tool:call-1"]]])
})
