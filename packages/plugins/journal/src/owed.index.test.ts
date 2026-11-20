import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import { NO_KINDS, owedOf, type WriteRequest } from "@olai/format"
import { firstRowsOf, walkedAgenda, walkedDays } from "@olai/format/testlib"
import { codecFor, make, type Store } from "@olai/ops"
import { steady } from "@olai/ops/testlib"
import * as StoreModule from "@olai/store"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"

import { dated, owed } from "./readings.ts"

const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS })

const WORK = [
  `{"id":"deck","ord":"a0","title":"the deck"}`,
  `{"id":"posts","parent":"deck","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-03"}`,
  `{"id":"permit","parent":"deck","ord":"a1","title":"pull the permit","doing":true,"date":"2026-08-10"}`,
  `{"id":"delivery","parent":"deck","ord":"a2","title":"the timber arrives","date":"2026-08-04"}`,
  `{"id":"survey","ord":"a3","title":"the boundary survey","done":"2026-08-05T09:15:00-04:00","date":"2026-08-05"}`,
  `{"id":"bins","ord":"a4","title":"put the bins out","todo":true,"date":"2026-08-12","repeat":"every week on monday"}`,
  "",
].join("\n")

const LIFE = [
  `{"id":"trip","ord":"a0","title":"the coast trip"}`,
  `{"id":"ferry","parent":"trip","ord":"a0","title":"book the ferry","todo":true,"date":"2026-08-12"}`,
  `{"id":"pack","parent":"trip","ord":"a1","title":"pack the bags","todo":true,"date":"2026-08-14"}`,
  `{"id":"train","parent":"trip","ord":"a2","title":"the sleeper leaves","date":"2026-08-20T21:40"}`,
  "",
].join("\n")

const TRASH = [
  `{"id":"gate","ord":"a0","title":"the old gate","todo":true,"date":"2026-08-01"}`,
  "",
].join("\n")

const TODAYS = [
  "2026-07-31",
  "2026-08-01",
  "2026-08-03",
  "2026-08-04",
  "2026-08-05",
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-12T09:00:00-04:00",
  "2026-08-13",
  "2026-08-14",
  "2026-08-17",
  "2026-08-20",
  "2026-09-01",
] as const

const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2027-01"] as const

const CAPS = [0, 2, 5, 50] as const

const same = (store: Store): Effect.Effect<number> =>
  Effect.gen(function*() {
    const snapshot = yield* Effect.map(store.read("cheap"), (aged) => aged.snapshot)
    if (snapshot === null) throw new Error("the fixture directory never loaded")
    const derived = snapshot.value.derived
    let counted = 0
    for (const today of TODAYS) {
      const walked = walkedAgenda(derived, today)
      const counts = owedOf(walked)
      for (const cap of CAPS) {
        const indexed = owed(derived, { today, cap })
        expect([today, cap, indexed]).toEqual([today, cap, { ...counts, rows: firstRowsOf(walked, cap) }])
      }
      counted += counts.overdue + counts.today
    }
    for (const month of MONTHS) {
      expect([month, dated(derived, { month }).days])
        .toEqual([month, walkedDays(derived, month)])
    }
    return counted
  })

test("every write leaves the counted door answering what the corpus walk does", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-owed-")))
  const write = (file: string, contents: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  write("work.olai", WORK)
  write("life.olai", LIFE)
  write("_olai/Trash.olai", TRASH)

  const WRITES: ReadonlyArray<WriteRequest> = [
    { op: "date", id: "pack", date: "2026-08-11" },
    { op: "date", id: "pack", date: "2026-08-17" },
    { op: "date", id: "pack", date: "2026-08-03" },
    { op: "date", id: "pack", date: null },
    { op: "date", id: "pack", date: "2026-08-08" },
    { op: "todo", id: "delivery" },
    { op: "todo", id: "delivery", undo: true },
    { op: "done", id: "posts" },
    { op: "done", id: "posts", undo: true },
    { op: "doing", id: "posts" },
    { op: "trash", id: "permit" },
    { op: "untrash", id: "permit" },
    { op: "trash", id: "trip" },
    { op: "untrash", id: "trip" },
    { op: "done", id: "bins" },
    { op: "repeat", id: "bins", repeat: null },
    { op: "repeat", id: "bins", repeat: "every day" },
    { op: "add", parent: "deck", title: "the sander arrives", date: "2026-08-02" },
    { op: "create", file: "shed.olai", seed: { title: "the shed" } },
    { op: "add", parent: "deck", title: "sand the rails", date: "2026-08-02", mark: "todo" },
    { op: "move", id: "pack", parent: "ferry" },
    { op: "empty", file: "_olai/Trash.olai" },
  ]

  return Effect.gen(function*() {
    const store = yield* StoreModule.make({ root, codec, watch: false, settle: "10 millis" })
    const ops = make({claims: { current: TEST_CLAIMS }, format: "outline-olai",
      store,
      root,
      context: steady(),
    })

    let counted = yield* same(store)

    for (const request of WRITES) {
      yield* Effect.orDie(ops.run(request, "mcp"))
      counted += yield* same(store)
    }

    expect(counted).toBeGreaterThan(100)
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
})
