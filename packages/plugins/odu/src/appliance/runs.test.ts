/**
 * THE CI BOARD at its bench — first-sight, settle, streams, reclaim.
 *
 * The fake service is a real websocket; the board `attach`s odu's own client
 * pointed at that origin. Nothing here needs a browser. The dial lives on the
 * service cell, not here.
 */

import { Effect, Fiber } from "effect"
import { expect, test } from "bun:test"

import { dialService } from "@odu/service-client/dial"

import { advanceSub, makeBoard, type RunNotice } from "./runs.ts"
import { startOduService } from "./testlib/odu.ts"
import { liveOf, ODU_UNDIALED, type CiRun } from "./wire/index.ts"

const BOARD = ["m1kb0e11-2c8d"] as const

const waitUntil = async (ok: () => boolean, why: string, ms = 8_000): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (ok()) return
    await Bun.sleep(20)
  }
  throw new Error(why)
}

const boardOf = (rang: Array<RunNotice> = []) =>
  makeBoard({
    publish: () => {},
    rang: (notice) => { rang.push(notice) },
    say: () => {},
  })

const bench = async (fleet: string) => {
  const odu = await startOduService(fleet)
  const rang: Array<RunNotice> = []
  const board = boardOf(rang)
  const fiber = Effect.runFork(Effect.scoped(Effect.gen(function*() {
    board.bind(yield* Effect.scope)
    const connection = yield* Effect.promise(() => dialService(odu.origin))
    yield* Effect.addFinalizer(() => Effect.promise(() => connection.dispose()))
    board.attach(connection)
    yield* Effect.never
  })))
  return {
    odu,
    rang,
    board,
    stop: async () => {
      await Effect.runPromise(Fiber.interrupt(fiber))
      odu.stop()
    },
  }
}

test("a boarded id with no service publishes nothing to the chip", () => {
  const board = boardOf()
  board.reclaim([...BOARD])
  expect(board.rows()).toEqual([])
  expect(ODU_UNDIALED.status).toBe("absent")
})

test("dropping a boarded id is idempotent", () => {
  const board = boardOf()
  board.reclaim([...BOARD])
  board.reclaim([])
  expect(board.rows()).toEqual([])
})

test("a live run first seen red rings first-red", async () => {
  const it = await bench("red")
  try {
    it.board.reclaim([...BOARD])
    await waitUntil(
      () => it.rang.some((one) => one.kind === "first-red"),
      "first-red to ring for a live run already red",
    )
    expect(it.rang.filter((one) => one.kind === "settled")).toEqual([])
    const row = it.board.rows().find((one) => one.id === "m1kb0e11-2c8d")
    expect(row !== undefined && liveOf(row.state)).toBe(true)
    expect(row?.cells.length ?? 0).toBeGreaterThan(0)
  } finally {
    await it.stop()
  }
})

test("a run first seen settled rings nothing and still has cells", async () => {
  const it = await bench("settled")
  try {
    it.board.reclaim([...BOARD])
    // Catalog `get` can publish the settled row before `nodes` has a frame.
    // The matrix's cells are the frame; wait for both, not the row alone.
    await waitUntil(
      () =>
        it.board.rows().some((one) =>
          one.id === "m1kb0e11-2c8d" && one.state === "settled" && one.cells.length > 0
        ),
      "the settled row with cells to land",
    )
    expect(it.rang).toEqual([])
  } finally {
    await it.stop()
  }
})

test("provisioning to settled without running still rings settle", () => {
  const row = (over: Partial<CiRun>): CiRun => ({
    id: "m1kb0e11-2c8d",
    repoRoot: "/tmp/a",
    name: "ci",
    sha7: "8f8fe56",
    dirty: false,
    seq: 1,
    state: "settled",
    outcome: "incomplete",
    phase: "",
    lanes: [],
    cells: [],
    ...over,
  })
  const first = advanceSub(undefined, row({ state: "provisioning" }))
  expect(first.notices).toEqual([])
  const next = advanceSub(first.sub, row({ state: "settled" }))
  expect(next.notices.map((one) => one.kind)).toEqual(["settled"])
})

test("a boarded id the catalog does not name is unknown and silent", async () => {
  const it = await bench("live")
  try {
    it.board.reclaim(["m1miss000-zzzz"])
    await waitUntil(
      () => it.board.rows().some((one) => one.id === "m1miss000-zzzz"),
      "the unknown row to land",
    )
    expect(it.board.rows().find((one) => one.id === "m1miss000-zzzz")?.state).toBe("unknown")
    expect(it.rang).toEqual([])
  } finally {
    await it.stop()
  }
})

test("reclaim while connected drops a boarded id and picks up another", async () => {
  const it = await bench("live")
  try {
    it.board.reclaim([...BOARD])
    await waitUntil(
      () => it.board.rows().some((one) => one.id === "m1kb0e11-2c8d" && liveOf(one.state)),
      "the boarded live row to land",
    )
    it.board.reclaim(["m1same00-bbbb"])
    await waitUntil(
      () =>
        !it.board.rows().some((one) => one.id === "m1kb0e11-2c8d")
        && it.board.rows().some((one) => one.id === "m1same00-bbbb"),
      "the reclaimed set to replace the first id",
    )
  } finally {
    await it.stop()
  }
})
