import { expect, test } from "bun:test"

import { wholeYet } from "./whole.ts"

const landed = (values: Record<string, string | undefined>) => (key: string) => values[key]

test("a conversation whose every row has landed has arrived", () => {
  expect(wholeYet(["a", "b"], landed({ a: "hello", b: "a question" }))).toBe(true)
})

test("a key whose value has not arrived is not a conversation that has", () => {
  expect(wholeYet(["a", "b"], landed({ a: "hello" }))).toBe(false)
})

test("the first key that has not landed is the last one read", () => {
  const read: Array<string> = []
  wholeYet(["a", "b", "c"], (key) => {
    read.push(key)
    return key === "a" ? "hello" : undefined
  })
  expect(read).toEqual(["a", "b"])
})

test("no rows at all is not a conversation that has arrived", () => {
  expect(wholeYet([], landed({}))).toBe(false)
})
