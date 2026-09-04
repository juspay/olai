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

import type { Listed, SessionInfo } from "olai-plugin-chat/wire"
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

test("olai's own link wins where the two disagree", () => {
  // A `/clear` in a terminal after olai re-pointed the node. Both facts are
  // true and they answer different questions: the adapter says what became of a
  // TRANSCRIPT, olai says what became of the AGENT — and the one reader of this
  // field is walking a node agent's own history.
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "old", superseded: "fresh" },
  ]
  const out = succeeded(listed(chat("old", { supersededBy: "cleared" })), heard)
  expect(out.sessions[0]?.supersededBy).toBe("fresh")
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

test("olai's own re-pointing wins over a `/clear` link the agent reported", () => {
  // THE BOOMERANG THIS RECORD EXISTS TO PREVENT. Assign a chat that was itself
  // a `/clear` remainder — the row already names the successor its agent
  // reported — and then give that node a fresh session. If the agent's link
  // stands, the walk back from the new session finds nothing, the conversation
  // the node just let go of comes back under Unassigned, and the one node that
  // would refuse it is the node it belonged to.
  //
  // The field's one consumer is the lineage of a NODE AGENT, and olai's link is
  // the only one that answers that question: `/clear` says what happened to a
  // transcript, and a re-pointing says what happened to the agent.
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "middle", superseded: "fresh" },
  ]
  const out = succeeded(
    listed(chat("fresh"), chat("middle", { supersededBy: "cleared" }), chat("cleared")),
    heard,
  )
  expect(out.sessions.find((row) => row.id === "middle")?.supersededBy).toBe("fresh")
})
