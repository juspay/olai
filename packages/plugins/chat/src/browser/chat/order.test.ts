import { expect, test } from "bun:test"
import type { ChatEntry } from "olai-plugin-chat/wire"
import { type Ordered, TRANSCRIPT_ORDER } from "./order.ts"

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

const call = (id: string, seq: number, parent?: string): ChatEntry => ({
  id,
  seq,
  since: "2026-08-21T12:00:00.000Z",
  kind: "tool",
  text: id,
  status: "pending",
  ...(parent === undefined ? {} : { parent }),
})

const asked = (id: string, seq: number, parent?: string): ChatEntry => ({
  id,
  seq,
  since: "2026-08-21T12:00:00.000Z",
  kind: "ask",
  text: id,
  ask: { fields: [], link: null, outcome: null },
  ...(parent === undefined ? {} : { parent }),
})

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
  const held = seeded(["a", 1])
  expect(stepped(held, [], ["gone"])).toBe(held)
})

test("an emptied conversation is an empty list, not a stale one", () => {
  const held = seeded(["a", 1], ["b", 2])
  expect(stepped(held, [], ["a", "b"]).keys).toEqual([])
})

test("rows sharing a `seq` keep the order they were first seen in", () => {
  const held = seeded(["first", 1], ["second", 1])
  expect(held.keys).toEqual(["first", "second"])
  expect(stepped(held, [["third", 1]]).keys).toEqual(["first", "second", "third"])
})

test("a call a subagent made is not in the column, and is in that agent's lane", () => {
  const held = opened(
    row("agent:1", 1),
    call("tool:agent-1", 2),
    call("tool:call-1", 3, "tool:agent-1"),
  )
  expect(held.keys).toEqual(["agent:1", "tool:agent-1"])
  expect(laned(held)).toEqual([["tool:agent-1", ["tool:call-1"]]])
})

test("a row that learns whose it is on a later frame leaves the column", () => {
  const held = opened(call("tool:agent-1", 1), call("tool:call-1", 2))
  expect(held.keys).toEqual(["tool:agent-1", "tool:call-1"])
  const next = frame(held, [call("tool:call-1", 2, "tool:agent-1")])
  expect(next.keys).toEqual(["tool:agent-1"])
  expect(laned(next)).toEqual([["tool:agent-1", ["tool:call-1"]]])
})

test("a call whose `Agent` frame the panel never got stays in the column", () => {
  const held = opened(row("agent:1", 1), call("tool:call-1", 2, "tool:gone"))
  expect(held.keys).toEqual(["agent:1", "tool:call-1"])
  expect(laned(held)).toEqual([])
})

test("... and joins the lane the moment that frame arrives", () => {
  const held = opened(row("agent:1", 1), call("tool:call-1", 3, "tool:gone"))
  const next = frame(held, [call("tool:gone", 2)])
  expect(next.keys).toEqual(["agent:1", "tool:gone"])
  expect(laned(next)).toEqual([["tool:gone", ["tool:call-1"]]])
})

test("a removed row goes out of the lane it was filed in", () => {
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
  const held = opened(call("tool:agent-1", 1), call("tool:call-1", 2, "tool:agent-1"))
  expect(frame(held, [], ["gone"])).toBe(held)
})

test("a frame that moves nothing hands back the very lanes it was holding", () => {
  const held = opened(call("tool:agent-1", 1), call("tool:call-1", 2, "tool:agent-1"))
  const next = frame(held, [call("tool:call-1", 2, "tool:agent-1")])
  expect(next).toBe(held)
  expect(next.lanes).toBe(held.lanes)
})

test("a conversation with no lanes hands back the very same empty map every rebuild", () => {
  const held = opened(row("agent:1", 1))
  const next = frame(held, [row("agent:2", 2)])
  expect(next.keys).not.toBe(held.keys)
  expect(next.lanes).toBe(held.lanes)
  expect(laned(next)).toEqual([])
})

test("a subagent's question stays in the column beside the agent that asked it", () => {
  const held = opened(
    call("tool:agent-1", 1),
    call("tool:call-1", 2, "tool:agent-1"),
    asked("ask:1", 3, "tool:agent-1"),
  )
  expect(held.keys).toEqual(["tool:agent-1", "ask:1"])
  expect(laned(held)).toEqual([["tool:agent-1", ["tool:call-1"]]])
})

const asksInForm = (id: string, seq: number, parent?: string): ChatEntry => ({
  id,
  seq,
  since: "2026-08-21T12:00:00.000Z",
  kind: "tool",
  text: id,
  status: "pending",
  asksThroughForm: true,
  ...(parent === undefined ? {} : { parent }),
})

test("a call that asks through a form is in neither the column nor a lane", () => {
  const held = opened(
    call("tool:agent-1", 1),
    asksInForm("tool:form-1", 2),
    asksInForm("tool:form-2", 3, "tool:agent-1"),
    asked("ask:1", 4),
  )
  expect(held.keys).toEqual(["tool:agent-1", "ask:1"])
  expect(laned(held)).toEqual([])
})

test("a call that says so on a later frame leaves the list it was already in", () => {
  const held = frame(opened(call("tool:form-1", 1)), [asksInForm("tool:form-1", 1)])
  expect(held.keys).toEqual([])
  expect(laned(held)).toEqual([])
})

test("... and out of the lane it had been filed in", () => {
  const held = frame(
    opened(call("tool:agent-1", 1), call("tool:form-1", 2, "tool:agent-1")),
    [asksInForm("tool:form-1", 2, "tool:agent-1")],
  )
  expect(held.keys).toEqual(["tool:agent-1"])
  expect(laned(held)).toEqual([])
})
