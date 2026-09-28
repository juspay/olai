import { expect, test } from "bun:test"
import { rowVerbs } from "./verbs.tsx"
import type { Roster } from "./agents/answered.tsx"
import type { AgentChoice, NodeAgentRow } from "../wire.ts"
import type { RowAction } from "olai-plugin-outlines/slots"
import { freshStartQuestion } from "./agents/fresh-start.ts"

const engines: ReadonlyArray<AgentChoice> = [{ id: "claude", name: "Claude", standing: "here" }, { id: "codex", name: "Codex", standing: "here" }]
const roster = (bound?: NodeAgentRow, installed = engines): Roster => ({
  at: () => bound, engines: () => installed, rows: () => bound ? [bound] : [],
  standings: () => installed,
  only: () => installed.length === 1 ? installed[0]! : null,
  missing: () => null,
  chats: () => null, unreachable: () => [], chatsRefusal: () => null, askChats: () => {},
})
const node: NodeAgentRow = { id: "one", title: "One", file: "house.olai", engine: "claude", session: null, memory: 0, standing: "unbound", waiting: 0, said: null }

/** What a menu draws of the answer: each entry's words, and a choice's options. */
const drawn = (actions: ReadonlyArray<RowAction>) => actions.map(action => "choices" in action
  ? { id: action.id, label: action.label, choices: action.choices.map(({ id, label }) => ({ id, label })) }
  : { id: action.id, label: action.label })
const verbsOf = (actions: ReadonlyArray<RowAction>) => actions.flatMap(action => "choices" in action ? action.choices : [action])

test("a bare row offers one start choice of every startable engine", () => {
  expect(drawn(rowVerbs("one", roster()))).toEqual([{ id: "start-agent", label: "Start an agent", choices: [
    { id: "start-agent-claude", label: "Claude" },
    { id: "start-agent-codex", label: "Codex" },
  ] }])
  // A choice of one, or of none, is still handed whole: outlines' menu is what
  // collapses it (`olai-plugin-outlines/slots`'s `RowChoice`).
  expect(drawn(rowVerbs("one", roster(node)))).toEqual([
    { id: "start-agent", label: "Start an agent", choices: [{ id: "start-agent-claude", label: "Claude" }] },
  ])
  expect(drawn(rowVerbs("one", roster(undefined, [])))).toEqual([{ id: "start-agent", label: "Start an agent", choices: [] }])
  expect(rowVerbs("one", roster()).every(action => action.writes)).toBe(true)
})

test("a node talking through a conversation offers fresh start, its own engine first, then close", () => {
  const bound: NodeAgentRow = { ...node, engine: "codex", session: "existing" }
  expect(drawn(rowVerbs("one", roster(bound)))).toEqual([
    { id: "fresh-start", label: "Fresh start", choices: [
      { id: "fresh-start-codex", label: "Codex" },
      { id: "fresh-start-claude", label: "Claude" },
    ] },
    { id: "close-agent", label: "Close the agent" },
  ])
})

test("only fresh-start choices ask first", () => {
  for (const verb of verbsOf(rowVerbs("one", roster({ ...node, session: "existing" })))) {
    expect(verb.confirm).toBe(verb.id.startsWith("fresh-start-") ? freshStartQuestion("One") : undefined)
  }
  for (const verb of verbsOf(rowVerbs("one", roster()))) expect(verb.confirm).toBeUndefined()
})
