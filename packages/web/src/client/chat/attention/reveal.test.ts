import { expect, test } from "bun:test"

import { wholeYet } from "./reveal.ts"

/** A conversation whose rows have landed, as `chat.entry` answers them. */
const landed = (values: Record<string, string | undefined>) => (key: string) => values[key]

test("a conversation whose every row has landed has arrived", () => {
  expect(wholeYet(["a", "b"], landed({ a: "hello", b: "a question" }))).toBe(true)
})

test("a key whose value has not arrived is not a conversation that has", () => {
  // THE RACE. A press that finds no waiting form here would otherwise be spent
  // as a jump to the foot of a conversation whose question is further up —
  // rows are KEYS, and a key is in the list before its value is.
  expect(wholeYet(["a", "b"], landed({ a: "hello" }))).toBe(false)
})

test("the first key that has not landed is the last one read", () => {
  // Which is what makes this the right shape for a reactive caller: reading a
  // key subscribes to that row, so the press waits on exactly the row it is
  // waiting on and no more.
  const read: Array<string> = []
  wholeYet(["a", "b", "c"], (key) => {
    read.push(key)
    return key === "a" ? "hello" : undefined
  })
  expect(read).toEqual(["a", "b"])
})

test("no rows at all is not a conversation that has arrived", () => {
  // The first frame of a fresh subscription. Letting go here is the same bug
  // one step earlier.
  expect(wholeYet([], landed({}))).toBe(false)
})
