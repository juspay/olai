/**
 * The vault half: `xyne-channel` on a node agent, joined to the binding.
 *
 * The records below carry the key chat's kind CLAIMS, which is what a vault
 * that has declared nothing at all carries — turning chat on is the whole of
 * putting that column there. A board carrying the older bare key, and the one
 * row that keeps it working, are `olai-plugin-chat`'s `server/agents.test.ts`:
 * the fold is the same one, and asserting it twice would be this package
 * reporting on a decision that is not its own.
 */

import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { bindOf, CHANNEL_PROP, DEFAULT_TRIM, spacesConfigIn } from "./config.ts"

import { SESSION_TYPE, seatingIn } from "./seating.testlib.ts"

const rec = (id: string, title: string, fields: Record<string, string>): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)},"custom":${
    JSON.stringify(fields)
  }}`

const reading = (files: Record<string, string>) => {
  const derived = readingOf(setOf(files)).derived
  return spacesConfigIn(derived, seatingIn(derived))
}

test("a node agent with xyne-channel and a session is bound", () => {
  const got = reading({
    "board.olai": rec("orch", "orchestrator", {
      [SESSION_TYPE]: "claude:s-1",
      [CHANNEL_PROP]: "ch-team",
    }),
  })
  expect(got.binds).toEqual([{
    node: "orch",
    file: "board.olai",
    title: "orchestrator",
    channel: "ch-team",
    engine: "claude",
    session: "s-1",
  }])
  expect(bindOf(got, "claude", "s-1")?.channel).toBe("ch-team")
  expect(bindOf(got, "claude", "other")).toBeUndefined()
  expect(got.trim).toBe(DEFAULT_TRIM)
})

test("a node agent with xyne-channel and no session is named, and posts nothing", () => {
  const got = reading({
    "board.olai": rec("orch", "orchestrator", {
      [SESSION_TYPE]: "claude",
      [CHANNEL_PROP]: "ch-team",
    }),
  })
  expect(got.named).toEqual([{ node: "orch", file: "board.olai" }])
  expect(got.binds).toEqual([])
})

test("xyne-channel on a node that is not a node agent is ignored", () => {
  const got = reading({
    "board.olai": rec("note", "a note", { [CHANNEL_PROP]: "ch-team" }),
  })
  expect(got.named).toEqual([])
  expect(got.binds).toEqual([])
})

test("a node agent without xyne-channel is not bound", () => {
  const got = reading({
    "board.olai": rec("orch", "orchestrator", { [SESSION_TYPE]: "claude:s-1" }),
  })
  expect(got.binds).toEqual([])
  expect(bindOf(got, "claude", "s-1")).toBeUndefined()
})

test("the first node wins where two name one session", () => {
  const got = reading({
    "board.olai": [
      rec("a", "first", { [SESSION_TYPE]: "claude:s-1", [CHANNEL_PROP]: "ch-a" }),
      rec("b", "second", { [SESSION_TYPE]: "claude:s-1", [CHANNEL_PROP]: "ch-b" }),
    ].join("\n"),
  })
  expect(got.binds.map((bind) => bind.channel)).toEqual(["ch-a"])
})
