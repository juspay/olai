import { expect, test } from "bun:test"

import { afterCommit, canRecord } from "./record.ts"

/** The op, mocked: the same push the panel's button runs. */
const callsOf = (run: (push: () => void) => void): number => {
  let calls = 0
  run(() => {
    calls += 1
  })
  return calls
}

test("a recorded commit with Auto-push on is followed by the same push", () => {
  expect(callsOf((push) => afterCommit(true, "Committed", push))).toBe(1)
})

test("Auto-push off leaves today's behaviour: a commit is not followed", () => {
  expect(callsOf((push) => afterCommit(false, "Committed", push))).toBe(0)
})

test("a commit that did not record is not pushed, even with Auto-push on", () => {
  for (const tag of ["Failed", "Blocked", "NothingToCommit", "Refused"]) {
    expect(callsOf((push) => afterCommit(true, tag, push))).toBe(0)
  }
})

test("a commit may not start while a push is in flight", () => {
  expect(canRecord(false, false)).toBe(true)
  expect(canRecord(true, false)).toBe(false)
  expect(canRecord(false, true)).toBe(false)
  expect(canRecord(true, true)).toBe(false)
})
