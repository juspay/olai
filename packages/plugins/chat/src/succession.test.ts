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
    { agent: "claude", session: "old", superseded: { agent: "claude", session: "fresh" } },
  ]
  const out = succeeded(listed(chat("fresh"), chat("old")), heard)
  expect(out.sessions.map((row) => row.supersededBy)).toEqual([null, { agent: "claude", session: "fresh" }])
})

test("olai's own link wins where the two disagree", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "old", superseded: { agent: "claude", session: "fresh" } },
  ]
  const out = succeeded(listed(chat("old", { supersededBy: { agent: "claude", session: "cleared" } })), heard)
  expect(out.sessions[0]?.supersededBy).toEqual({ agent: "claude", session: "fresh" })
})

test("a note is worn only by the agent it was written against", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "opencode", session: "old", superseded: { agent: "opencode", session: "fresh" } },
  ]
  const out = succeeded(listed(chat("old")), heard)
  expect(out.sessions[0]?.supersededBy).toBeNull()
})

test("a machine that has never replaced a session is handed its own listing back", () => {
  const answer = listed(chat("one"), chat("two"))
  expect(succeeded(answer, [])).toBe(answer)
  expect(succeeded(answer, [{ agent: "claude", session: "other", taught: true }])).toBe(answer)
})

test("what olai overheard about a conversation nobody stores changes nothing", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "gone", superseded: { agent: "claude", session: "fresh" } },
  ]
  expect(succeeded(listed(chat("fresh")), heard).sessions.map((row) => row.id)).toEqual(["fresh"])
})

test("olai's own re-pointing wins over a `/clear` link the agent reported", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "middle", superseded: { agent: "claude", session: "fresh" } },
  ]
  const out = succeeded(
    listed(chat("fresh"), chat("middle", { supersededBy: { agent: "claude", session: "cleared" } }), chat("cleared")),
    heard,
  )
  expect(out.sessions.find((row) => row.id === "middle")?.supersededBy).toEqual({ agent: "claude", session: "fresh" })
})

test("unused intermediate sessions do not hide earlier stored history", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "old", superseded: { agent: "claude", session: "unused" } },
    { agent: "claude", session: "unused", superseded: { agent: "claude", session: "also-unused" } },
    { agent: "claude", session: "also-unused", superseded: { agent: "claude", session: "current" } },
  ]
  const out = succeeded(listed(chat("old")), heard)
  expect(out.sessions).toEqual([chat("old", { supersededBy: { agent: "claude", session: "current" } })])
})

test("a stored intermediate transcript remains a separate history row", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "old", superseded: { agent: "claude", session: "middle" } },
    { agent: "claude", session: "middle", superseded: { agent: "claude", session: "current" } },
  ]
  expect(succeeded(listed(chat("old"), chat("middle")), heard).sessions.map((row) => row.supersededBy))
    .toEqual([{ agent: "claude", session: "middle" }, { agent: "claude", session: "current" }])
})

test("missing-session traversal stays within its harness and terminates on corrupt cycles", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "old", superseded: { agent: "claude", session: "missing" } },
    { agent: "opencode", session: "missing", superseded: { agent: "opencode", session: "wrong" } },
  ]
  expect(succeeded(listed(chat("old")), heard).sessions[0]?.supersededBy).toEqual({ agent: "claude", session: "missing" })
  expect(succeeded(listed(chat("old")), [...heard,
    { agent: "claude", session: "missing", superseded: { agent: "claude", session: "loop" } },
    { agent: "claude", session: "loop", superseded: { agent: "claude", session: "missing" } },
  ]).sessions[0]?.supersededBy).toEqual({ agent: "claude", session: "missing" })
})

test("a fresh start that changed engine links the old row to the new engine's session", () => {
  const heard: ReadonlyArray<Overheard> = [
    { agent: "claude", session: "old", superseded: { agent: "codex", session: "codex-fresh" } },
  ]
  const out = succeeded(
    listed(chat("old"), chat("codex-fresh", { agent: "codex" })),
    heard,
  )
  expect(out.sessions.find((row) => row.id === "old")?.supersededBy)
    .toEqual({ agent: "codex", session: "codex-fresh" })
})
