/**
 * THE LAST THING THE AGENT SAID, as one line.
 *
 * Every case here is about a row kind that must NOT become a door's line —
 * which is the whole of the module, since taking the last row would have been
 * one expression.
 */

import { expect, test } from "bun:test"

import type { ChatEntry } from "@olai/surface"

import { KEPT, lastSaid } from "./heard.ts"

let seq = 0
const rows = (...entries: ReadonlyArray<Partial<ChatEntry> & { kind: ChatEntry["kind"] }>) => {
  const map = new Map<string, ChatEntry>()
  for (const entry of entries) {
    seq += 1
    map.set(`k${seq}`, { id: `k${seq}`, seq, text: "", ...entry } as ChatEntry)
  }
  return map
}

test("the last agent row wins", () => {
  expect(lastSaid(rows(
    { kind: "agent", text: "first" },
    { kind: "user", text: "and?" },
    { kind: "agent", text: "second" },
  ))).toBe("second")
})

test("a conversation the agent has not spoken in yet has no line", () => {
  expect(lastSaid(rows({ kind: "user", text: "hello" }))).toBe(null)
  expect(lastSaid(new Map())).toBe(null)
})

test("a TOOL row is a call, not a sentence", () => {
  expect(lastSaid(rows(
    { kind: "agent", text: "looking" },
    { kind: "tool", text: "Bash", status: "completed" },
  ))).toBe("looking")
})

test("a NOTICE is olai's own words — including the teaching preamble", () => {
  // The one genuinely misleading thing this could say: olai's standing
  // instruction quoted back as the agent's latest message.
  expect(lastSaid(rows(
    { kind: "agent", text: "rehydrated from my subtree" },
    { kind: "notice", text: "[olai] This conversation is the node agent for “Spaces”" },
  ))).toBe("rehydrated from my subtree")
})

test("an ASK is what the STANDING already says, so it is not the line", () => {
  expect(lastSaid(rows(
    { kind: "agent", text: "the mirror lane is in flight" },
    { kind: "ask", text: "which timezone?", ask: { fields: [], outcome: null } },
  ))).toBe("the mirror lane is in flight")
})

test("the FIRST non-empty line of a paragraph, never the whole of it", () => {
  expect(lastSaid(rows({ kind: "agent", text: "\n  \nthe headline\nthen the rest\n" })))
    .toBe("the headline")
})

test("a turn that drew a row and said nothing in it is no line at all", () => {
  expect(lastSaid(rows({ kind: "agent", text: "   \n\n " }))).toBe(null)
})

test("a long line is CLIPPED, and says so — a record holds a line, not a screenful", () => {
  const long = "x".repeat(KEPT + 50)
  const line = lastSaid(rows({ kind: "agent", text: long }))
  expect(line).toHaveLength(KEPT + 1)
  expect(line?.endsWith("…")).toBe(true)
})

test("a line that just fits is not given an ellipsis it did not earn", () => {
  const exact = "y".repeat(KEPT)
  expect(lastSaid(rows({ kind: "agent", text: exact }))).toBe(exact)
})

test("a blank LAST row keeps the line before it, which is the walk's own claim", () => {
  // Walking forward and keeping the last non-blank answers the same thing
  // walking backwards did — without copying the transcript to do it.
  expect(lastSaid(rows(
    { kind: "agent", text: "the mirror lane is in flight" },
    { kind: "agent", text: "  \n " },
  ))).toBe("the mirror lane is in flight")
})
