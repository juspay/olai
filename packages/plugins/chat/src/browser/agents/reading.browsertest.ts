import type { Chat } from "../chat/state.ts"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import type { Roster } from "./answered.tsx"
import { createAgentReadings } from "./reading.ts"

test("palette ancestor metadata shares the conversation's UI, not its pending node UI", () => {
  createRoot(dispose => {
    try {
      // No roster query is needed to acquire a draft owner.
      const reading = createAgentReadings({} as Roster)
      const ancestor = { node: "install", file: "house.olai", agent: "claude", session: "stored" }
      const conversation = reading.ui({ agent: ancestor.agent, session: ancestor.session })
      expect(reading.ui(ancestor)).toBe(conversation)
      expect(reading.ui({ node: ancestor.node })).not.toBe(conversation)
      expect(reading.ui({ node: "another" })).not.toBe(reading.ui({ node: ancestor.node }))
    } finally { dispose() }
  })
})


test("the last reader releases empty UI and a pending send releases after completion", () => {
  const owner = createRoot(dispose => ({ dispose, reading: createAgentReadings({} as Roster) }))
  const pair = { agent: "claude", session: "session" }
  const ui = owner.reading.ui(pair)
  const first = createRoot(dispose => {
    owner.reading.join("node", { ui } as Chat, () => true)
    return dispose
  })
  const second = createRoot(dispose => {
    owner.reading.join("node", { ui } as Chat, () => true)
    return dispose
  })
  first()
  expect(owner.reading.ui(pair)).toBe(ui)
  ui.pendingSends[1](1)
  second()
  expect(owner.reading.ui(pair)).toBe(ui)
  ui.pendingSends[1](0)
  expect(owner.reading.ui(pair)).not.toBe(ui)
  owner.dispose()
})
