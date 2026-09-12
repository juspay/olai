/**
 * THE CI WATCH at its bench — first-sight, settle, streams, reclaim.
 *
 * The fake service is a real websocket; `dial` is odu's own client pointed
 * at that origin. Nothing here needs a browser.
 */

import { Effect, Fiber } from "effect"
import { expect, test } from "bun:test"

import { dialService } from "@odu/service-client/dial"

import { advanceSub, makeWatch, type RunNotice, type WatchDeps } from "./runs.ts"
import { startOduService } from "./testlib/odu.ts"
import { ODU_UNDIALED, type CiRun } from "./wire/index.ts"

const BOARD = [{ id: "m1kb0e11-2c8d", node: "lane-a", title: "the seam" }] as const

const waitUntil = async (ok: () => boolean, why: string, ms = 8_000): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (ok()) return
    await Bun.sleep(20)
  }
  throw new Error(why)
}

const bench = async (fleet: string) => {
  const odu = await startOduService(fleet)
  const rang: Array<RunNotice> = []
  const warned: Array<string> = []
  const deps: WatchDeps = {
    publish: () => {},
    service: () => {},
    rang: (notice) => { rang.push(notice) },
    say: () => {},
    warn: (line) => { warned.push(line) },
    env: { ODU_WEB_ORIGIN: odu.origin },
    now: () => "2026-09-12T00:00:00.000Z",
    dial: dialService,
  }
  const watch = makeWatch(deps)
  const fiber = Effect.runFork(watch.run)
  return {
    odu,
    rang,
    warned,
    watch,
    stop: async () => {
      await Effect.runPromise(Fiber.interrupt(fiber))
      odu.stop()
    },
  }
}

test("a boarded id with no service publishes nothing to the chip", () => {
  const watch = makeWatch({
    publish: () => {},
    service: () => {},
    rang: () => {},
    say: () => {},
    warn: () => {},
    env: {},
    now: () => "2026-09-12T00:00:00.000Z",
    dial: async () => {
      throw new Error("nothing serving")
    },
  })
  watch.reclaim([...BOARD])
  expect(watch.rows()).toEqual([])
  expect(ODU_UNDIALED.status).toBe("absent")
})

test("dropping a boarded id is idempotent", () => {
  const watch = makeWatch({
    publish: () => {},
    service: () => {},
    rang: () => {},
    say: () => {},
    warn: () => {},
    env: {},
    now: () => "2026-09-12T00:00:00.000Z",
    dial: async () => {
      throw new Error("nothing serving")
    },
  })
  watch.reclaim([...BOARD])
  watch.reclaim([])
  expect(watch.rows()).toEqual([])
})

test("a live run first seen red rings first-red", async () => {
  const it = await bench("red")
  try {
    it.watch.reclaim([...BOARD])
    await waitUntil(
      () => it.rang.some((one) => one.kind === "first-red"),
      "first-red to ring for a live run already red",
    )
    expect(it.rang.filter((one) => one.kind === "settled")).toEqual([])
    const row = it.watch.rows().find((one) => one.id === "m1kb0e11-2c8d")
    expect(row?.live).toBe(true)
    expect(row?.cells.length ?? 0).toBeGreaterThan(0)
  } finally {
    await it.stop()
  }
})

test("a run first seen settled rings nothing and still has cells", async () => {
  const it = await bench("settled")
  try {
    it.watch.reclaim([...BOARD])
    await waitUntil(
      () => it.watch.rows().some((one) => one.id === "m1kb0e11-2c8d" && one.state === "settled"),
      "the settled row to land",
    )
    expect(it.rang).toEqual([])
    expect(it.watch.rows().find((one) => one.id === "m1kb0e11-2c8d")?.cells.length ?? 0)
      .toBeGreaterThan(0)
  } finally {
    await it.stop()
  }
})

test("provisioning to settled without running still rings settle", () => {
  const row = (over: Partial<CiRun>): CiRun => ({
    id: "m1kb0e11-2c8d",
    repoRoot: "/tmp/a",
    live: false,
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
  const first = advanceSub(undefined, row({ live: true, state: "provisioning" }))
  expect(first.notices).toEqual([])
  const next = advanceSub(first.sub, row({ live: false, state: "settled" }))
  expect(next.notices.map((one) => one.kind)).toEqual(["settled"])
})

test("a boarded id the catalog does not name is unknown and silent", async () => {
  const it = await bench("live")
  try {
    it.watch.reclaim([{ id: "m1miss000-zzzz", node: "lane-unknown", title: "a boarded miss" }])
    await waitUntil(
      () => it.watch.rows().some((one) => one.id === "m1miss000-zzzz"),
      "the unknown row to land",
    )
    expect(it.watch.rows().find((one) => one.id === "m1miss000-zzzz")?.state).toBe("unknown")
    expect(it.rang).toEqual([])
  } finally {
    await it.stop()
  }
})

test("reclaim while connected drops a boarded id and picks up another", async () => {
  const it = await bench("live")
  try {
    it.watch.reclaim([...BOARD])
    await waitUntil(
      () => it.watch.rows().some((one) => one.id === "m1kb0e11-2c8d" && one.live),
      "the boarded live row to land",
    )
    it.watch.reclaim([{ id: "m1same00-bbbb", node: "lane-other", title: "another" }])
    await waitUntil(
      () =>
        !it.watch.rows().some((one) => one.id === "m1kb0e11-2c8d")
        && it.watch.rows().some((one) => one.id === "m1same00-bbbb"),
      "the reclaimed set to replace the first id",
    )
  } finally {
    await it.stop()
  }
})
