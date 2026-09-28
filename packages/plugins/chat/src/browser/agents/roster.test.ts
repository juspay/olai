/** The browser owns only the presentation of server-authored standings. */
import { expect, test } from "bun:test"

import type { AgentStanding } from "olai-plugin-chat/wire"
import { LOOK } from "./roster.ts"

test("every standing the server can send has words and a visible mark", () => {
  const standings: ReadonlyArray<AgentStanding> = [
    "needs-you",
    "working",
    "waking",
    "idle",
    "gone",
    "asleep",
    "unbound",
  ]
  expect(standings.map((standing) => LOOK[standing].label)).toEqual([
    "Needs you",
    "Working…",
    "Starting…",
    "Idle",
    "Not running",
    "Asleep",
    "No agent",
  ])
  expect(standings.every((standing) => LOOK[standing].dot.length > 0)).toBe(true)
})
