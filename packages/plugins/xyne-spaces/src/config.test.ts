/**
 * The vault half: `xyne-channel` on a node agent, joined to `agent-session`.
 */

import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { AGENT_PROP, bindOf, CHANNEL_PROP, DEFAULT_TRIM, spacesConfigIn } from "./config.ts"

const rec = (id: string, title: string, fields: Record<string, string>): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)},"custom":${
    JSON.stringify(fields)
  }}`

const reading = (files: Record<string, string>) =>
  spacesConfigIn(readingOf(setOf(files)).derived)

test("a node agent with xyne-channel and a session is bound", () => {
  const got = reading({
    "board.olai": rec("orch", "orchestrator", {
      [AGENT_PROP]: "claude:s-1",
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
      [AGENT_PROP]: "claude",
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
    "board.olai": rec("orch", "orchestrator", { [AGENT_PROP]: "claude:s-1" }),
  })
  expect(got.binds).toEqual([])
  expect(bindOf(got, "claude", "s-1")).toBeUndefined()
})

test("the first node wins where two name one session", () => {
  const got = reading({
    "board.olai": [
      rec("a", "first", { [AGENT_PROP]: "claude:s-1", [CHANNEL_PROP]: "ch-a" }),
      rec("b", "second", { [AGENT_PROP]: "claude:s-1", [CHANNEL_PROP]: "ch-b" }),
    ].join("\n"),
  })
  expect(got.binds.map((bind) => bind.channel)).toEqual(["ch-a"])
})
