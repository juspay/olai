import { expect, test } from "bun:test"
import type { Roster } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { agentAbove } from "./above.ts"
import type { AgentChoice } from "../../wire.ts"

const row = (id: string): Row => ({
  id, title: id, kind: "node", beside: false, file: "house.olai", engine: "claude", session: "session", memory: 0,
  standing: "idle", waiting: 0, said: null, seen: null, unread: false, sleeps: false, sleep: null,
})
const roster = (known: ReadonlyArray<string>): Roster => {
  const rows = known.map(row)
  const engines: ReadonlyArray<AgentChoice> = [{ id: "claude", name: "Claude", standing: "here" }]
  return {
    at: (key) => rows.find((one) => one.id === key),
    chatOf: (item) => item.kind === "node" ? rows.find((one) => one.id === item.id) : undefined,
    named: (one) => ({ name: one.title }),
    rows: () => rows,
    engines: () => engines,
    standings: () => engines,
    only: () => engines[0]!,
    missing: () => null,
    chats: () => null, askChats: () => {},
  }
}

test("the nearest bound ancestor wins, however many are bound", () => {
  expect(agentAbove(["kitchen", "install"], roster(["kitchen", "install"]))?.id).toBe("install")
  expect(agentAbove(["kitchen", "install"], roster(["kitchen"]))?.id).toBe("kitchen")
})

test("nothing bound above is no answer", () => {
  expect(agentAbove([], roster(["kitchen"]))).toBeUndefined()
  expect(agentAbove(["kitchen", "install"], roster([]))).toBeUndefined()
})
