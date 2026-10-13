/**
 * THE STRIP'S OPT-IN, as the two pure questions behind it: which roster row a
 * conversation is, and what the switch beside it says.
 *
 * What the DRAWING adds is covered where a browser is real — the scenarios press
 * the switch and read `aria-checked` back — and a test that rendered it here
 * would be asserting a first frame under SolidJS's server build and calling it
 * reactivity (`justfile` says so where the browser tests are counted).
 */

import { expect, test } from "bun:test"
import type { NodeAgentRow } from "../../wire.ts"

import { nodeAgentOf, sleepWords } from "./sleeping.ts"

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
