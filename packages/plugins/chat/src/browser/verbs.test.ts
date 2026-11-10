import { expect, test } from "bun:test"
import { chatVerbs, rowVerbs } from "./verbs.tsx"
import type { Roster } from "./agents/answered.tsx"
import type { AgentChoice } from "../wire.ts"
import type { Row } from "./agents/roster.ts"
import type { RowAction } from "olai-plugin-outlines/slots"
import { freshStartQuestion } from "./agents/fresh-start.ts"

const engines: ReadonlyArray<AgentChoice> = [{ id: "claude", name: "Claude", standing: "here" }, { id: "codex", name: "Codex", standing: "here" }]
const roster = (bound?: Row, installed = engines): Roster => ({
  at: () => bound, engines: () => installed, rows: () => bound ? [bound] : [],
  standings: () => installed,
  only: () => installed.length === 1 ? installed[0]! : null,
  missing: () => null,
  chats: () => null, unreachable: () => [], chatsRefusal: () => null, askChats: () => {},
})
const node: Row = { id: "one", title: "One", file: "house.olai", engine: "claude", session: null, memory: 0, standing: "unbound", waiting: 0, said: null, seen: null, unread: false, sleeps: false, sleep: null }

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

test("a node talking through a conversation offers fresh start, its own engine first, then the sleeps and close", () => {
  const bound: Row = { ...node, engine: "codex", session: "existing" }
  expect(drawn(rowVerbs("one", roster(bound)))).toEqual([
    { id: "fresh-start", label: "Fresh start", choices: [
      { id: "fresh-start-codex", label: "Codex" },
      { id: "fresh-start-claude", label: "Claude" },
    ] },
    // THE OPT-IN FIRST, because it is the answer that lets the loop do anything
    // at all — and its LABEL is the indicator, read off the row.
    { id: "sleep-when-idle", label: "Sleep when idle" },
    // ...THEN THE PASS BY HAND, on the rows that have a conversation and above
    // the release: tidying a node's memory is not being done with its agent,
    // and `Close the agent` is the one that takes the binding away. The seat's
    // own verb is absent here because this row is asleep — `unbound` standing
    // with a session is the shape a roster frame has before anything is live.
    { id: "tidy-memory", label: "Tidy memory" },
    { id: "close-agent", label: "Close the agent" },
  ])
})

test("put to sleep is drawn wherever a seat is held, including a stopped agent", () => {
  const offered = (standing: Row["standing"]) =>
    drawn(rowVerbs("one", roster({ ...node, session: "existing", standing })))
      .some(verb => verb.id === "put-to-sleep")
  // A SEAT IS WHAT THE VERB HANDS BACK, so the question is which standings
  // HOLD one. `gone` is the sharp one, and it goes the other way from how it
  // reads: the server says `gone` only for a node the scheduler still has a
  // live slot for, so a stopped agent is holding one of the eight and nothing
  // reaps it on its own. Asleep and unbound never had one.
  for (const standing of ["needs-you", "working", "waking", "idle", "gone"] as const) {
    expect([standing, offered(standing)]).toEqual([standing, true])
  }
  for (const standing of ["asleep", "unbound"] as const) {
    expect([standing, offered(standing)]).toEqual([standing, false])
  }
  // ...and it reads, rather than writes: nothing of the vault moves when a
  // chat goes to sleep, which is what keeps it out of the menu's write half.
  const awakeRow = rowVerbs("one", roster({ ...node, session: "existing", standing: "idle" }))
  expect(verbsOf(awakeRow).find(verb => verb.id === "put-to-sleep")?.writes).toBe(false)
})

test("the sidebar's menu and the outline row's menu draw the same chat verbs", () => {
  // ONE CATALOG, TWO FACES. The `•••` in Chats hangs `chatVerbs` directly
  // (`./agents/ChatRowMenu.tsx`); the outline row's menu hangs the same
  // objects after its start/fresh-start half. A copy in the sidebar is how one
  // of them ends up offering a verb the other does not.
  const row: Row = { ...node, session: "existing", standing: "working" }
  const inMenu = drawn(rowVerbs("one", roster(row))).map(verb => verb.id)
  expect(drawn(chatVerbs(row)).map(verb => verb.id)).toEqual(["put-to-sleep", "tidy-memory", "close-agent"])
  expect(inMenu.slice(-3)).toEqual(["put-to-sleep", "tidy-memory", "close-agent"])
})

test("the opt-in's label is the mark itself, in both directions", () => {
  // ONE ROW, TWO SENTENCES, and nothing else on screen changes: a person reads
  // which way the press will go off the menu they are standing in.
  const marked: Row = { ...node, session: "existing", sleeps: true }
  const label = (row: Row) =>
    drawn(rowVerbs("one", roster(row))).find(verb => verb.id === "sleep-when-idle")?.label
  expect(label(marked)).toBe("Stop sleeping when idle")
  expect(label({ ...node, session: "existing" })).toBe("Sleep when idle")
  // ...AND A BARE ROW HAS NO SUCH ROW AT ALL: there is no conversation to tidy.
  expect(drawn(rowVerbs("one", roster()))).not.toContainEqual(expect.objectContaining({ id: "sleep-when-idle" }))
})

test("a node with a bound ancestor above offers the door, on a bare row and a talking one", () => {
  const above = (id: string) => id === "one" ? node : undefined
  expect(drawn(rowVerbs("one", roster(undefined, []), above))).toEqual([
    { id: "start-agent", label: "Start an agent", choices: [] },
    { id: "open-agent-above", label: "Open the agent above" },
  ])
  const bound = verbsOf(rowVerbs("one", roster({ ...node, session: "existing" }), above))
  expect(bound[0]).toMatchObject({ id: "open-agent-above", label: "Open the agent above", writes: false })
  // ...and nothing above is nothing to offer, on either kind of row.
  for (const actions of [rowVerbs("one", roster(), () => undefined), rowVerbs("one", roster({ ...node, session: "existing" }), () => undefined)]) {
    expect(drawn(actions)).not.toContainEqual(expect.objectContaining({ id: "open-agent-above" }))
  }
})

test("only fresh-start choices ask first", () => {
  for (const verb of verbsOf(rowVerbs("one", roster({ ...node, session: "existing" })))) {
    expect(verb.confirm).toBe(verb.id.startsWith("fresh-start-") ? freshStartQuestion("One") : undefined)
  }
  for (const verb of verbsOf(rowVerbs("one", roster()))) expect(verb.confirm).toBeUndefined()
})
