import { expect, test } from "bun:test"
import type { LocalState } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { openMemory, type MemoryRecord, recordOf, valuesOf } from "./local.ts"

const RECORD: MemoryRecord = {
  refreshToken: "1//rt",
  address: "you@gmail.com",
  scope: "https://www.googleapis.com/auth/gmail.modify",
  connectedAt: "2026-09-15T10:00:00.000Z",
}

/** A door over one object held in this test, which is what `LocalState` is: the
 *  file behind it is core's business and its own test. */
const doorOver = (held: Record<string, unknown> | null): { door: LocalState; now: () => Record<string, unknown> | null } => {
  let current = held
  return {
    door: { load: Effect.succeed(held), save: (value) => Effect.sync(() => { current = value }) },
    now: () => current,
  }
}

test("a record round-trips through the door's own values", () => {
  expect(recordOf(valuesOf(RECORD))).toEqual(RECORD)
})

test("a record with no refresh token is not a record", () => {
  expect(recordOf(null)).toBeUndefined()
  expect(recordOf({})).toBeUndefined()
  expect(recordOf({ refreshToken: "   " })).toBeUndefined()
  expect(recordOf({ refreshToken: "1//rt" })).toEqual({ refreshToken: "1//rt", address: null, scope: null, connectedAt: "" })
})

test("a malformed record reads as no account and says so", () => {
  const lines: string[] = []
  const held = doorOver({ mirrors: "not a record olai wrote" })
  const memory = Effect.runSync(openMemory(held.door, (line) => lines.push(line)))
  expect(memory.current()).toBeUndefined()
  expect(lines).toHaveLength(1)
  expect(lines[0]).toContain("mail")
})

test("remember and forget move the held record and the door together", async () => {
  const held = doorOver(null)
  const memory = Effect.runSync(openMemory(held.door, () => {}))
  expect(memory.current()).toBeUndefined()
  await Effect.runPromise(memory.remember(RECORD))
  expect(memory.current()).toEqual(RECORD)
  expect(held.now()).toEqual(valuesOf(RECORD))
  await Effect.runPromise(memory.forget())
  expect(memory.current()).toBeUndefined()
  expect(held.now()).toEqual({})
})
