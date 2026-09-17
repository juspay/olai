import { expect, test } from "bun:test"
import { Effect } from "effect"

import { openMemory, type MemoryRecord, recordOf, valuesOf } from "./local.ts"
import { doorOver } from "./local.testlib.ts"

const RECORD: MemoryRecord = { historyId: null,
  refreshToken: "1//rt",
  address: "you@gmail.com",
  scope: "https://www.googleapis.com/auth/gmail.modify",
  connectedAt: "2026-09-15T10:00:00.000Z",
}

test("a record round-trips through the door's own values", () => {
  expect(recordOf(valuesOf(RECORD))).toEqual(RECORD)
})

test("a record with no refresh token is not a record", () => {
  expect(recordOf(null)).toBeUndefined()
  expect(recordOf({})).toBeUndefined()
  expect(recordOf({ refreshToken: "   " })).toBeUndefined()
  expect(recordOf({ refreshToken: "1//rt" })).toEqual({ refreshToken: "1//rt", address: null, scope: null, historyId: null, connectedAt: "" })
})

test("a record that is somebody else's says so", () => {
  const lines: string[] = []
  const held = doorOver({ mirrors: "not a record olai wrote" })
  const memory = Effect.runSync(openMemory(held.door, (line) => lines.push(line)))
  expect(memory.current()).toBeUndefined()
  expect(lines).toHaveLength(1)
  expect(lines[0]).toContain("mail")
})

test("a fresh serve and a disconnected one are silent", () => {
  // The two ordinary states: no file at all (`load` answers `null`), and a
  // record a Disconnect emptied — core writes `{}` back as `{cwd}`. A warning
  // on either would be noise on every boot of every serve, which is the only
  // way the real one gets missed.
  for (const raw of [null, { cwd: "/srv/vault" }]) {
    const lines: string[] = []
    const held = doorOver(raw)
    const memory = Effect.runSync(openMemory(held.door, (line) => lines.push(line)))
    expect(memory.current()).toBeUndefined()
    expect(lines, JSON.stringify(raw)).toEqual([])
  }
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

test("token refresh cannot overwrite the watcher cursor, and an old watcher cannot write a new connection", async () => {
  const held = doorOver(valuesOf(RECORD))
  const memory = Effect.runSync(openMemory(held.door, () => {}))
  const stale = memory.current()!
  await Effect.runPromise(memory.advance(RECORD.connectedAt, "120"))
  await Effect.runPromise(memory.remember({ ...stale, refreshToken: "rotated" }))
  expect(memory.current()?.historyId).toBe("120")
  await Effect.runPromise(memory.remember({ ...RECORD, connectedAt: "new connection" }))
  await Effect.runPromise(memory.advance(RECORD.connectedAt, "999"))
  expect(memory.current()?.historyId).toBeNull()
})
