import { expect, test } from "bun:test"
import { rowVerbs } from "./verbs.tsx"
import type { Roster } from "./agents/answered.tsx"
import type { AgentChoice, NodeAgentRow } from "../wire.ts"

const engines: ReadonlyArray<AgentChoice> = [{ id: "claude", name: "Claude" }, { id: "codex", name: "Codex" }]
const roster = (bound?: NodeAgentRow, installed = engines): Roster => ({
  at: () => bound, engines: () => installed, rows: () => bound ? [bound] : [],
  chats: () => null, unreachable: () => [], chatsRefusal: () => null, askChats: () => {},
})
const node: NodeAgentRow = { id: "one", title: "One", file: "house.olai", engine: "claude", session: null, memory: 0, standing: "unbound", waiting: 0, said: null }

test("rowVerbs offers only writing start entries, one per installed engine", () => {
  const verbs = rowVerbs("one", roster())
  expect(verbs.map(({ id, writes, label }) => ({ id, writes, label }))).toEqual([
    { id: "start-agent-claude", writes: true, label: "Start an agent session — Claude" },
    { id: "start-agent-codex", writes: true, label: "Start an agent session — Codex" },
  ])
  expect(rowVerbs("one", roster(undefined, []))).toEqual([])
  expect(rowVerbs("one", roster(node)).map(verb => verb.label)).toEqual(["Start an agent session"])
  expect(rowVerbs("one", roster({ ...node, session: "existing" }))).toEqual([])
  expect(rowVerbs("one", roster(node, []))).toEqual([])
})
