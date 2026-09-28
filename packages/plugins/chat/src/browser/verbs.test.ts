import { expect, test } from "bun:test"
import { rowVerbs } from "./verbs.tsx"
import type { Roster } from "./agents/answered.tsx"
import type { RowAction, RowVerb } from "olai-plugin-outlines/slots"
import type { AgentChoice, NodeAgentRow } from "../wire.ts"

const engines: ReadonlyArray<AgentChoice> = [{ id: "claude", name: "Claude", standing: "here" }, { id: "codex", name: "Codex", standing: "here" }]
const roster = (bound?: NodeAgentRow, installed = engines): Roster => ({
  at: () => bound, engines: () => installed, rows: () => bound ? [bound] : [],
  standings: () => installed,
  only: () => installed.length === 1 ? installed[0]! : null,
  missing: () => null,
  chats: () => null, unreachable: () => [], chatsRefusal: () => null, askChats: () => {},
})
const node: NodeAgentRow = { id: "one", title: "One", file: "house.olai", engine: "claude", session: null, memory: 0, standing: "unbound", waiting: 0, said: null }

type Shape = { id: string; writes: boolean; label: string; choices?: ReadonlyArray<Shape> }
const shape = (verbs: ReadonlyArray<RowAction>): ReadonlyArray<Shape> => verbs.map(verb => ({
  id: verb.id, writes: verb.writes, label: verb.label,
  ...("choices" in verb ? { choices: shape(verb.choices) } : {}),
}))
/** Every runnable verb, the choices of a submenu included. */
const flat = (verbs: ReadonlyArray<RowAction>): ReadonlyArray<RowVerb> =>
  verbs.flatMap(verb => "choices" in verb ? verb.choices : [verb])

test("a bare row offers one Start an agent entry: a choice of agents when several can start", () => {
  expect(shape(rowVerbs("one", roster()))).toEqual([{
    id: "start-agent", writes: true, label: "Start an agent",
    choices: [
      { id: "start-agent-claude", writes: true, label: "Claude" },
      { id: "start-agent-codex", writes: true, label: "Codex" },
    ],
  }])
  // One agent: the verb itself, no submenu.
  expect(shape(rowVerbs("one", roster(undefined, engines.slice(1))))).toEqual([
    { id: "start-agent-codex", writes: true, label: "Start an agent" },
  ])
  // No agent available: nothing is offered.
  expect(rowVerbs("one", roster(undefined, []))).toEqual([])
  // A row naming an agent but with no chat: only that agent starts.
  expect(shape(rowVerbs("one", roster(node)))).toEqual([{ id: "start-agent-claude", writes: true, label: "Start an agent" }])
  expect(rowVerbs("one", roster(node, []))).toEqual([])
})

test("a row with an agent offers Fresh start (its own agent first) then Close the agent", () => {
  const bound: NodeAgentRow = { ...node, engine: "codex", session: "existing" }
  expect(shape(rowVerbs("one", roster(bound)))).toEqual([
    {
      id: "fresh-start", writes: true, label: "Fresh start",
      choices: [
        { id: "fresh-start-codex", writes: true, label: "Codex" },
        { id: "fresh-start-claude", writes: true, label: "Claude" },
      ],
    },
    { id: "close-agent", writes: true, label: "Close the agent" },
  ])
  expect(shape(rowVerbs("one", roster(bound, engines.slice(0, 1))))).toEqual([
    { id: "fresh-start-claude", writes: true, label: "Fresh start" },
    { id: "close-agent", writes: true, label: "Close the agent" },
  ])
  // No agent available: the agent can still be closed.
  expect(shape(rowVerbs("one", roster(bound, [])))).toEqual([
    { id: "close-agent", writes: true, label: "Close the agent" },
  ])
})

test("only fresh-start verbs ask first, for one agent or several", () => {
  for (const installed of [engines, engines.slice(0, 1)]) {
    const verbs = flat(rowVerbs("one", roster({ ...node, session: "existing" }, installed)))
    expect(verbs.some(verb => verb.id.startsWith("fresh-start-"))).toBe(true)
    for (const verb of verbs) {
      if (verb.id.startsWith("fresh-start-")) {
        expect(verb.confirm).toContain("The current chat moves to earlier chats.")
        expect(verb.confirm).toContain("“One”")
      } else expect(verb.confirm).toBeUndefined()
    }
    for (const verb of flat(rowVerbs("one", roster(undefined, installed)))) expect(verb.confirm).toBeUndefined()
  }
})
