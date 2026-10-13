/**
 * THE STRIP'S OPT-IN, as two pure questions: which roster row a conversation is,
 * and what the switch beside it says.
 *
 * A PLAIN FUNCTION TEST rather than a drawn component, and that is not a
 * shortcut: `bun test` resolves SolidJS's SERVER build, where a memo never
 * re-runs (`justfile` says so where the browser tests are counted), so a test
 * that rendered the strip would be asserting a first frame and calling it
 * reactivity. What the drawing adds is covered where a browser is real — the
 * scenarios press the switch and read `aria-checked` back.
 */

import { expect, test } from "bun:test"
import type { NodeAgentRow } from "olai-plugin-chat/wire"

import { nodeAgentOf, sleepWords } from "./Wake.tsx"

/** One roster row, as the wire sends it. */
const row = (over: Partial<NodeAgentRow> = {}): NodeAgentRow => ({
  id: "install",
  file: "house.olai",
  title: "install the cabinets",
  engine: "claude",
  session: "sess-1",
  memory: 3,
  standing: "asleep",
  waiting: 0,
  said: null,
  sleeps: false,
  ...over,
})

test("a node agent's conversation finds its row, and a plain chat finds none", () => {
  // THE PAIR IS THE MATCH: a session id means nothing to the wrong engine, so a
  // row whose engine differs is a different agent's conversation.
  expect(nodeAgentOf([row()], { agent: "claude", session: "sess-1" })?.id).toBe("install")
  expect(nodeAgentOf([row()], { agent: "codex", session: "sess-1" })).toBeUndefined()
  expect(nodeAgentOf([row()], { agent: "claude", session: "sess-2" })).toBeUndefined()
  // ...AND A CONVERSATION NOBODY IS SEATED ON IS NOT A NODE AGENT'S AT ALL.
  expect(nodeAgentOf([row()], undefined)).toBeUndefined()
  expect(nodeAgentOf([], { agent: "claude", session: "sess-1" })).toBeUndefined()
})

test("the switch says which way the mark is, in the two words a person reads", () => {
  expect(sleepWords(nodeAgentOf([row()], { agent: "claude", session: "sess-1" })!.sleeps)).toBe("Off")
  expect(sleepWords(nodeAgentOf([row({ sleeps: true })], { agent: "claude", session: "sess-1" })!.sleeps)).toBe("On")
})
