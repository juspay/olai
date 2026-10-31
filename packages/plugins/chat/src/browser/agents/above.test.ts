/** The join's one decision: the CLIENTS nearest bound ancestor, not the
 *  outermost. `./above.ts` walks the page readings for the trail; this file
 *  hands it trails and holds the choice down. */
import { expect, test } from "bun:test"
import type { Roster } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { agentAbove } from "./above.ts"
import type { AgentChoice } from "../../wire.ts"

const row = (id: string): Row => ({
  id, title: id, file: "house.olai", engine: "claude", session: "session", memory: 0,
  standing: "idle", waiting: 0, said: null, seen: null, unread: false, sleeps: false, sleep: null,
})
const roster = (known: ReadonlyArray<string>): Roster => {
  const rows = known.map(row)
  const engines: ReadonlyArray<AgentChoice> = [{ id: "claude", name: "Claude", standing: "here" }]
  return {
    at: (id) => rows.find((one) => one.id === id),
    rows: () => rows,
    engines: () => engines,
    standings: () => engines,
    only: () => engines[0]!,
    missing: () => null,
    chats: () => null, unreachable: () => [], chatsRefusal: () => null, askChats: () => {},
  }
}

test("the nearest bound ancestor wins, however many are bound", () => {
  // kitchen › install › hinges: the crumb order is outermost first, so the
  // answer is the LAST one the roster knows.
  expect(agentAbove(["kitchen", "install"], roster(["kitchen", "install"]))?.id).toBe("install")
  // ...and an ancestor nothing knows is skipped rather than stopping the walk.
  expect(agentAbove(["kitchen", "install"], roster(["kitchen"]))?.id).toBe("kitchen")
})

test("nothing bound above is no answer", () => {
  expect(agentAbove([], roster(["kitchen"]))).toBeUndefined()
  expect(agentAbove(["kitchen", "install"], roster([]))).toBeUndefined()
})
