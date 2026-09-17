import { expect, test } from "bun:test"
import { createLandings, scopedLandings, type Receiver } from "@olai/plugin-api/carry"
import { carrySession } from "./carry.ts"
test("aiming leaves on exit and cancellation; withdrawn receivers cannot receive a release", async () => {
  const table = createLandings(), scope = scopedLandings(table)
  let leaves = 0, drops = 0, offset = 0
  const receiver: Receiver = {
    lift: () => ({ left: offset, top: 0, right: offset + 10, bottom: 10 }),
    aim: () => {}, leave: () => { leaves++ }, drop: async () => { drops++; return null },
  }
  const release = scope.register(receiver)
  const session = carrySession({ kind: "test" }, table)
  expect(session.aim(2, 2)).toBe(true)
  offset = 20
  expect(session.aim(2, 2)).toBe(false)
  expect(leaves).toBe(1)
  expect(session.aim(22, 2)).toBe(true)
  await session.end(false)
  expect(drops).toBe(0)
  session.aim(22, 2)
  release()
  scope.register(receiver)
  await session.end(true)
  expect(drops).toBe(0)
  const fresh = carrySession({ kind: "test" }, table)
  fresh.aim(22, 2)
  await fresh.end(true)
  expect(drops).toBe(1)
  scope.dispose()
})

test("drop captures the indicated target before leave, without retaining it during the write", async () => {
  const table = createLandings()
  let indicated: string | null = null
  const captured: Array<string | null> = []
  let finish!: (why: string | null) => void
  table.register({
    lift: () => ({ left: 0, top: 0, right: 10, bottom: 10 }),
    aim: () => { indicated = "original anchor" },
    leave: () => { indicated = null },
    drop: () => {
      captured.push(indicated)
      return new Promise(resolve => { finish = resolve })
    },
  })
  const session = carrySession({ kind: "test" }, table)
  session.aim(2, 2)
  const pending = session.end(true)
  expect(captured).toEqual(["original anchor"])
  expect(indicated).toBeNull()
  finish("the anchor was deleted")
  expect(await pending).toBe("the anchor was deleted")
})

test("a synchronous delivery failure still clears the receiver", async () => {
  const table = createLandings()
  let left = false
  table.register({
    lift: () => ({ left: 0, top: 0, right: 10, bottom: 10 }),
    aim: () => {}, leave: () => { left = true },
    drop: () => { throw new Error("failed delivery") },
  })
  const session = carrySession({ kind: "test" }, table)
  session.aim(2, 2)
  await expect(session.end(true)).rejects.toThrow("failed delivery")
  expect(left).toBe(true)
})
