/**
 * THE SUPERSESSIONS OLAI ITSELF MADE, on the rows.
 *
 * The claim: a *fresh session* is a replacement nobody else records — no
 * `/clear` happened, so no adapter has anything to say about it — and without
 * this overlay the conversation it replaced comes back as a chat no node
 * claims. What the cases hold besides is the direction the two answers
 * outrank each other in: the agent read its own transcripts, olai read a file
 * it wrote, and where they disagree the agent wins.
 */

import { expect, test } from "bun:test"

import type { Listed, SessionInfo } from "@olai/surface"

import type { Overheard } from "./sessions.ts"
import { succeeded } from "./succession.ts"

const chat = (id: string, over: Partial<SessionInfo> = {}): SessionInfo => ({
  id,
  agent: "claude",
  title: id,
  updatedAt: "2026-08-01T17:30:00.000Z",
  messageCount: 3,
  supersededBy: null,
  ...over,
})

const listed = (...sessions: ReadonlyArray<SessionInfo>): Listed => ({
  sessions,
  unreachable: [],
})

test("a session olai replaced names the one that replaced it", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "old", superseded: "fresh" },
  ]
  const out = succeeded(listed(chat("fresh"), chat("old")), heard)
  expect(out.sessions.map((row) => row.supersededBy)).toEqual([null, "fresh"])
})

test("the agent's own answer wins where the two disagree", () => {
  // A `/clear` in a terminal after olai wrote its note: the adapter read the
  // transcripts, this end read a state file, and the closer answer stands.
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "old", superseded: "fresh" },
  ]
  const out = succeeded(listed(chat("old", { supersededBy: "cleared" })), heard)
  expect(out.sessions[0]?.supersededBy).toBe("cleared")
})

test("a note is worn only by the agent it was written against", () => {
  // A session id means nothing to the wrong agent, and the listing spans every
  // installed one.
  const heard: ReadonlyArray<Overheard> = [
    { agent: "opencode", session: "old", superseded: "fresh" },
  ]
  const out = succeeded(listed(chat("old")), heard)
  expect(out.sessions[0]?.supersededBy).toBeNull()
})

test("a machine that has never replaced a session is handed its own listing back", () => {
  // Which is every machine until somebody presses *fresh session*: the overlay
  // has nothing to say and costs nothing to ask.
  const answer = listed(chat("one"), chat("two"))
  expect(succeeded(answer, [])).toBe(answer)
  expect(succeeded(answer, [{ agent: "claude", session: "other", taught: true }])).toBe(answer)
})

test("what olai overheard about a conversation nobody stores changes nothing", () => {
  // The record outlives the agent's own list: a session deleted from disk is a
  // note about a row that is not there, and the answer is the rows there are.
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "gone", superseded: "fresh" },
  ]
  expect(succeeded(listed(chat("fresh")), heard).sessions.map((row) => row.id)).toEqual(["fresh"])
})
