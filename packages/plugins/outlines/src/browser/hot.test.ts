import { expect, test } from "bun:test"

import { hotOf } from "./hot.ts"

const PR = "https://github.com/juspay/olai/pull/208"

test("a branch with tasks under it says how far they have got", () => {
  expect(hotOf({}, { done: 3, total: 5 }, undefined)).toEqual({
    kind: "progress",
    progress: { done: 3, total: 5 },
  })
})

test("the rollup wins over the property — a branch is a branch", () => {
  expect(hotOf({ custom: { pr: PR } }, { done: 1, total: 2 }, "done")).toEqual({
    kind: "progress",
    progress: { done: 1, total: 2 },
  })
})

test("shipped work shows its pr, by the number the address ends in", () => {
  expect(hotOf({ custom: { pr: PR } }, undefined, "done")).toEqual({
    kind: "prop",
    key: "pr",
    text: "208",
    full: PR,
  })
})

test("a pr on work that has not shipped is a plan, and waits for the open state", () => {
  expect(hotOf({ custom: { pr: PR } }, undefined, "doing")).toBeUndefined()
  expect(hotOf({ custom: { pr: PR } }, undefined, "todo")).toBeUndefined()
  expect(hotOf({ custom: { pr: PR } }, undefined, undefined)).toBeUndefined()
})

test("no other property is promoted — one key, named, and nothing else", () => {
  expect(hotOf({ custom: { agent: "claude-opus" } }, undefined, "done")).toBeUndefined()
})

test("a value that is not an address is drawn whole", () => {
  expect(hotOf({ custom: { pr: "#208" } }, undefined, "done")).toEqual({
    kind: "prop",
    key: "pr",
    text: "#208",
  })
})

test("a key holding a LIST is not one fact", () => {
  expect(hotOf({ custom: { pr: [PR, "#209"] } }, undefined, "done")).toBeUndefined()
})

test("a bare host has no segment to stand for it, so it is drawn whole", () => {
  expect(hotOf({ custom: { pr: "https://example.com" } }, undefined, "done")).toEqual({
    kind: "prop",
    key: "pr",
    text: "https://example.com",
  })
})

test("most rows say nothing at all", () => {
  expect(hotOf({}, undefined, "todo")).toBeUndefined()
  expect(hotOf(undefined, undefined, undefined)).toBeUndefined()
})
