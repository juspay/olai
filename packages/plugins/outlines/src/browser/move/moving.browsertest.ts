/** Drive the page gesture without mounting a picker: its lifetime is the subject. */
import { expect, test } from "bun:test"
import { createEffect, createRoot, createSignal, type Accessor } from "solid-js"
import { Effect, Result } from "effect"
import type { MovingRequest, Row } from "@olai/format"
import type { Applied } from "@olai/surface"
import { NO_EDITS } from "@olai/plugin-api"
import { holdClient, type Client } from "../../client.ts"
import { createUndo, holdUndo } from "../edit/undoing.ts"
import { holdEdits } from "../writes.ts"
import { row } from "../frame.testlib.ts"
import { createMoving } from "./gesture.ts"
import { moveMemory } from "./memory.ts"

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const bench = async (use: (at: {
  moving: ReturnType<typeof createMoving>, memory: ReturnType<typeof moveMemory>,
  rows: (value: ReadonlyArray<Row>) => void,
  release: () => void, requests: Array<MovingRequest | null>,
}) => Promise<void>) => {
  let stop!: () => void
  let release!: () => void
  const reply = new Promise<Applied>(resolve => { release = () => resolve({ id: "child", title: "child", file: "house.olai", nudge: "Reopened destination" }) })
  const requests: Array<MovingRequest | null> = []
  const releaseClient = holdClient(() => ({ streams: { moving: { use: (request: Accessor<MovingRequest | null>) => {
    createEffect(() => requests.push(request()))
    return () => undefined
  } } } } as unknown as Client))
  const releaseWrites = holdEdits({ ...NO_EDITS, write: () => Effect.promise(() => reply) })
  const releaseUndo = holdUndo(createUndo(async () => Result.succeed(await reply)))
  try {
    const at = createRoot(dispose => {
      stop = dispose
      const [rows, setRows] = createSignal<ReadonlyArray<Row>>([row("/child", "child", "child"), row("/destination", "destination", "destination")])
      const memory = moveMemory()
      const moving = createMoving({ rows, collapsed: () => new Set() }, () => {}, memory)
      return { moving, memory, rows: setRows, release, requests }
    })
    at.moving.open({ record: "child", place: "/child" })
    await tick()
    await use(at)
  } finally { release(); await tick(); stop(); releaseUndo(); releaseWrites(); releaseClient() }
}

test("a revision before the write reply preserves the move and places its nudge under the destination", () => bench(async ({ moving, memory, rows, release }) => {
  moving.aim(() => ["destination"])
  moving.write({ verb: "under", id: "child", parent: "destination" })
  rows([row("/destination", "destination", "destination")])
  await tick()
  expect(memory.standing[0]()).toMatchObject({ kind: "picking", record: "child" })
  expect(memory.sending[0]()).toBe(true)
  release()
  await tick()
  expect(memory.standing[0]()).toEqual({ kind: "landed", record: "child", place: "/destination", under: "destination" })
  expect(moving.showing("/destination")).toBe(true)
}))

test("a shortlist unmount during a write cannot reopen the move subscription with empty destinations", () => bench(async ({ moving, requests, release }) => {
  const [hits, setHits] = createSignal<ReadonlyArray<string>>(["destination"])
  moving.aim(hits)
  await tick()
  const before = requests.length
  moving.write({ verb: "under", id: "child", parent: "destination" })
  setHits([])
  await tick()
  expect(requests.length).toBe(before)
  expect(requests.at(-1)).toEqual({ record: "child", to: ["destination"] })
  release()
  await tick()
  expect(requests.at(-1)).toEqual({ record: "child", to: ["destination"] })
}))
