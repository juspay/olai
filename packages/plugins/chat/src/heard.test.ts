/**
 * THE LAST THING THE AGENT SAID, as one line.
 *
 * Every case here is about a row kind that must NOT become a door's line —
 * which is the whole of the module, since taking the last row would have been
 * one expression.
 */

import { expect, test } from "bun:test"

import type { ChatEntry } from "olai-plugin-chat/wire"
import { KEPT, lastSaid } from "./heard.ts"

let seq = 0
const rows = (...entries: ReadonlyArray<Partial<ChatEntry> & { kind: ChatEntry["kind"] }>) => {
  const map = new Map<string, ChatEntry>()
  for (const entry of entries) {
    seq += 1
    map.set(`k${seq}`, { id: `k${seq}`, seq, since: `${seq}`, text: "", ...entry } as ChatEntry)
  }
  return map
}

/** The LINE alone, which is what most of these cases are about — the instant
 *  beside it has one case of its own below. */
const line = (
  ...entries: ReadonlyArray<Partial<ChatEntry> & { kind: ChatEntry["kind"] }>
): string | null => lastSaid(rows(...entries))?.text ?? null

test("the last agent row wins", () => {
  expect(line(
    { kind: "agent", text: "first" },
    { kind: "user", text: "and?" },
    { kind: "agent", text: "second" },
  )).toBe("second")
})

test("a conversation the agent has not spoken in yet has no line", () => {
  expect(line({ kind: "user", text: "hello" })).toBe(null)
  expect(lastSaid(new Map())).toBe(null)
})

test("a TOOL row is a call, not a sentence", () => {
  expect(line(
    { kind: "agent", text: "looking" },
    { kind: "tool", text: "Bash", status: "completed" },
  )).toBe("looking")
})

test("a NOTICE is olai's own words — including the teaching preamble", () => {
  // The one genuinely misleading thing this could say: olai's standing
  // instruction quoted back as the agent's latest message.
  expect(line(
    { kind: "agent", text: "rehydrated from my subtree" },
    { kind: "notice", text: "[olai] This conversation is the node agent for “Spaces”" },
  )).toBe("rehydrated from my subtree")
})

test("an ASK is what the STANDING already says, so it is not the line", () => {
  expect(line(
    { kind: "agent", text: "the mirror lane is in flight" },
    { kind: "ask", text: "which timezone?", ask: { fields: [], outcome: null } },
  )).toBe("the mirror lane is in flight")
})

test("the FIRST non-empty line of a paragraph, never the whole of it", () => {
  expect(line({ kind: "agent", text: "\n  \nthe headline\nthen the rest\n" }))
    .toBe("the headline")
})

test("a turn that drew a row and said nothing in it is no line at all", () => {
  expect(line({ kind: "agent", text: "   \n\n " })).toBe(null)
})

test("a long line is CLIPPED, and says so — a record holds a line, not a screenful", () => {
  const long = "x".repeat(KEPT + 50)
  const clipped = line({ kind: "agent", text: long })
  expect(clipped).toHaveLength(KEPT + 1)
  expect(clipped?.endsWith("…")).toBe(true)
})

test("a line that just fits is not given an ellipsis it did not earn", () => {
  const exact = "y".repeat(KEPT)
  expect(line({ kind: "agent", text: exact })).toBe(exact)
})

test("a blank LAST row keeps the line before it, which is the walk's own claim", () => {
  // Walking forward and keeping the last non-blank answers the same thing
  // walking backwards did — without copying the transcript to do it.
  expect(line(
    { kind: "agent", text: "the mirror lane is in flight" },
    { kind: "agent", text: "  \n " },
  )).toBe("the mirror lane is in flight")
})

test("the instant is the ROW'S, never the moment this was asked", () => {
  // The door draws *7m ago* off this, so it has to mean when the words were
  // said — and this is asked at every turn boundary, including turns that add
  // no prose of their own.
  expect(lastSaid(rows(
    { kind: "agent", text: "the mirror lane is in flight", since: "2026-09-01T16:41:00Z" },
    { kind: "user", text: "and the steer?" },
  ))).toEqual({ text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" })
})
