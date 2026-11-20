import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import { claims, type Claims, admits, bodyOf, implicatedBy, isMirror, isRegular, markdownIn, type OutlineError, type OutlineSet, NO_KINDS, outlinePaths, verdictOf, type OpFailure, type WriteRequest as Request, type WriteResult as Applied } from "@olai/format"
import { parseOutline } from "olai-plugin-outline-olai/format"
import { recordsOf } from "@olai/format/testlib"
import * as Store from "@olai/store"
import { replaceBehindTheStamps } from "@olai/store/testlib"
import { describe, expect, test } from "bun:test"
import { Deferred, Effect, Fiber, Result, SubscriptionRef } from "effect"

import { codecFor } from "./codec.ts"
import type { Store as OutlineStore } from "./deps.ts"
import type { SessionRule } from "./door.ts"
import { STAMP, STAMP_SHAPE, steady } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"

const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS })

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","doing":"2026-08-02"}`,
  "",
].join("\n")

const PROPPED = HOUSE.replace(
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets",` +
    `"custom":{"pr":"https://x/1"}}`,
)

interface Fixture {
  readonly ops: Ops.Ops
  readonly store: OutlineStore
  readonly root: string
  readonly read: (file: string) => string | null
  readonly write: (file: string, contents: string) => void
  readonly set: () => Effect.Effect<OutlineSet>
  readonly refusals: ReadonlyArray<string>
}

const withOps = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Effect.Effect<A, unknown>,
  options: {
    readonly claims?: { current: Claims }
    readonly realClock?: boolean
    readonly onRefusal?: Ops.Options["onRefusal"]
  } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-")))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  return Effect.gen(function*() {
    const store = yield* Store.make({ root, codec: options.claims === undefined ? codec : codecFor(NO_KINDS, options.claims), watch: false, settle: "10 millis" })
    const refusals: Array<string> = []
    const ops = Ops.make({claims: options.claims ?? { current: TEST_CLAIMS }, format: "outline-olai",
      store,
      root,
      ...(options.realClock === true ? {} : { context: steady() }),
      onRefusal: (request, failure, writer) =>
        Effect.andThen(Effect.sync(() => {
          refusals.push(`${request.op}: ${failure._tag}`)
        }), options.onRefusal?.(request, failure, writer) ?? Effect.void),
    })
    return yield* use({
      ops,
      store,
      root,
      write,
      refusals,
      read: (file) => {
        const at = path.join(root, file)
        return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null
      },
      set: () =>
        Effect.map(Effect.map(store.read("cheap"), (aged) => aged.snapshot), (snapshot) => {
          if (snapshot === null) throw new Error("the fixture directory never loaded")
          return snapshot.value.set
        }),
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
}

const run = (
  fixture: Fixture,
  request: Request,
): Effect.Effect<Applied> =>
  Effect.catch(fixture.ops.run(request, "mcp"), (failure) =>
    Effect.die(
      new Error(`\`${request.op}\` was refused: ${failure._tag} — ${failure.message}`),
    ))

test("the shown kinds join the set as paths; a `.md` brings its text", () =>
  withOps(
    {
      "house.olai": `${HOUSE}{"id":"quote","ord":"b0","title":"quote","desc":"[document](notes.md)"}\n`,
      "notes.md": "# cabinets\n",
      "report.html": "<h1>Cabinet quote</h1>\n",
      "sales.csv": "region,units\nnorth,12\n",
      "shot.png": "not really a picture, and nothing here reads it\n",
      "q3.pdf": "%PDF-1.4 not really a pdf either\n",
    },
    (fixture) =>
      Effect.gen(function*() {
        const set = yield* fixture.set()
        expect(set.documents.map((one) => [String(one.path), one.kind, bodyOf(one)]))
          .toEqual([
            ["house.olai", "outline-olai", null],
            ["notes.md", "markdown", "# cabinets\n"],
            ["q3.pdf", "pdf", null],
            ["report.html", "hypertext", null],
            ["sales.csv", "csv", null],
            ["shot.png", "image", null],
          ])
        expect(set.broken).toEqual([])
        expect(yield* Effect.orDie(fixture.store.body("report.html"))).toBe(
          "<h1>Cabinet quote</h1>\n",
        )
        expect(yield* Effect.orDie(fixture.store.body("sales.csv"))).toBe(
          "region,units\nnorth,12\n",
        )
      }),
  ))

test("PIN (idle): idle is already true when nothing is writing", () =>
  withOps({ "house.olai": HOUSE }, (fixture) => fixture.ops.idle))

test("a run carries its session rule through refusal reporting and write tracking", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const rule: SessionRule = { _tag: "closed" }
      const failure = yield* Effect.flip(
        fixture.ops.run({ op: "done", id: "order" }, "mcp", rule),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("conversation has been reaped")
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
      expect(fixture.read("house.olai")).toBe(HOUSE)
      yield* fixture.ops.idle
    })))

test("commit without a ledger refuses in words", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const done = yield* fixture.ops.commit({}, "mcp")
      expect(done._tag).toBe("Failed")
      if (done._tag === "Failed") {
        expect(done.said).toContain("nobody is recording writes here")
      }
      const pushed = yield* fixture.ops.push
      expect(pushed._tag).toBe("Failed")
      if (pushed._tag === "Failed") {
        expect(pushed.said).toContain("nobody is recording writes here")
      }
    })))

test("PIN (idle): idle does not complete while a run is in the gate", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-idle-")))
  fs.writeFileSync(path.join(root, "house.olai"), HOUSE)
  return Effect.gen(function*() {
    const store = yield* Store.make({
      root,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const hold = yield* Deferred.make<void>()
    const entered = yield* Deferred.make<void>()
    const gated: typeof store = {
      ...store,
      commit: (write) =>
        Effect.andThen(
          Deferred.succeed(entered, undefined),
          Effect.andThen(Deferred.await(hold), store.commit(write)),
        ),
    }
    const ops = Ops.make({claims: { current: TEST_CLAIMS }, format: "outline-olai",
      store: gated,
      root,
      context: steady(),
    })
    yield* ops.idle
    const writing = yield* Effect.forkChild(
      ops.run({ op: "done", id: "order" }, "web"),
      { startImmediately: true },
    )
    yield* Deferred.await(entered)
    const idling = yield* Effect.forkChild(ops.idle, { startImmediately: true })
    expect(idling.pollUnsafe()).toBeUndefined()
    yield* Deferred.succeed(hold, undefined)
    yield* Fiber.join(idling)
    const applied = yield* Fiber.join(writing)
    expect(applied).toMatchObject({ id: "order", file: "house.olai" })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
})

test("a mark lands on disk as bytes the parser reads back", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "done", id: "order" })
      expect(applied).toMatchObject({ id: "order", file: "house.olai", rev: 2 })

      const text = fixture.read("house.olai") ?? ""
      expect(text.endsWith("\n")).toBe(true)
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(4)

      const parsed = parseOutline("house.olai", text, TEST_CLAIMS)
      expect(Result.isSuccess(parsed)).toBe(true)

      const set = yield* fixture.set()
      const order = recordsOf(set).find((located) => located.node.id === "order")
      expect(order?.node).toMatchObject({ done: STAMP })
    })))

test("the marks on the other records come back as the bytes they were", () =>
  withOps({
    "house.olai": [
      `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
      `{"id":"old","parent":"kitchen","ord":"a0","title":"an old habit","done":true}`,
      `{"id":"quote","parent":"kitchen","ord":"a1","title":"get a quote","done":"2026-08-01"}`,
      `{"id":"order","parent":"kitchen","ord":"a2","title":"order the cabinets"}`,
      "",
    ].join("\n"),
  }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "done", id: "order" })

      const text = fixture.read("house.olai") ?? ""
      expect(text).toContain(`"done":true`)
      expect(text).toContain(`"done":"2026-08-01"`)
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
    })))

test("marking done with no clock handed in stamps the current instant", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const before = Math.floor(Date.now() / 1000) * 1000
      yield* run(fixture, { op: "done", id: "order" })

      const set = yield* fixture.set()
      const order = recordsOf(set).find((located) => located.node.id === "order")?.node
      const done = order === undefined || isMirror(order) ? undefined : order.done
      expect(done).toMatch(STAMP_SHAPE)

      const at = new Date(String(done)).getTime()
      expect(at).toBeGreaterThanOrEqual(before)
      expect(at).toBeLessThanOrEqual(Date.now())
    }), { realClock: true }))

test("creating an outline lands a new file the set and the disk both see", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, {
        op: "create",
        file: "notes/ideas.olai",
        seed: { title: "an idea" },
      })
      expect(applied).toMatchObject({
        file: "notes/ideas.olai",
        title: "an idea",
        summary: "capture: an idea",
      })

      const text = fixture.read("notes/ideas.olai") ?? ""
      expect(text).toContain(`"title":"an idea"`)
      expect(text.endsWith("\n")).toBe(true)

      const set = yield* fixture.set()
      expect([...outlinePaths(set)].sort()).toEqual(["house.olai", "notes/ideas.olai"])
      expect(recordsOf(set).some((located) => located.node.id === applied.id)).toBe(true)
    })))

test("a new outline arrives holding its whole tree, or does not arrive", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({
          op: "create",
          file: "shed.olai",
          seed: {
            title: "The shed",
            children: [{ title: "clear it out", children: [{ title: "x", id: "order" }] }],
          },
        }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(fixture.read("shed.olai")).toBeNull()
      expect(outlinePaths(yield* fixture.set())).toEqual(["house.olai"])
      expect(fixture.read("house.olai")).toBe(HOUSE)

      const applied = yield* run(fixture, {
        op: "create",
        file: "shed.olai",
        seed: {
          title: "The shed",
          children: [{ title: "clear it out", children: [{ title: "the paint tins" }] }],
        },
      })
      expect(applied.summary).toBe("capture: The shed (+2)")
      expect(applied.captured).toHaveLength(3)
      const text = fixture.read("shed.olai") ?? ""
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(3)
      expect(Result.isSuccess(parseOutline("shed.olai", text, TEST_CLAIMS))).toBe(true)
      expect(fixture.read("house.olai")).toBe(HOUSE)

      expect(applied.rev).toBe(2)
    })))

test("creating an empty outline is a zero-byte file the sidebar can list", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "create", file: "empty.olai" })
      expect(applied.summary).toBe("create: empty.olai")
      expect(fixture.read("empty.olai")).toBe("")
      expect(outlinePaths(yield* fixture.set())).toContain("empty.olai")
    })))

test("a created file sorting before an existing one is published in path order", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "create", file: "_olai/Trash.olai" })
      expect(outlinePaths(yield* fixture.set())).toEqual(["_olai/Trash.olai", "house.olai"])
      const set = yield* fixture.set()
      const records = recordsOf(set)
      expect(records.map((located) => located.file)).toEqual(
        [...records].sort((one, two) => one.file.localeCompare(two.file)).map((
          located,
        ) => located.file),
      )
    })))

test("archiving writes both files, and the set stays valid across them", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "trash", id: "order" })
      expect(applied.file).toBe("_olai/Trash.olai")

      expect(fixture.read("house.olai")).not.toContain(`"order"`)
      const archive = fixture.read("_olai/Trash.olai") ?? ""
      expect(archive).toContain(`"title":"Kitchen remodel"`)
      expect(archive).toContain(`"id":"order"`)

      expect(applied.rev).toBe(2)
      const set = yield* fixture.set()
      expect([...outlinePaths(set)].sort()).toEqual(["_olai/Trash.olai", "house.olai"])
    })))

test("a subtree captured in one call is one revision and one commit", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, {
        op: "add",
        parent: "kitchen",
        title: "the pantry",
        children: [
          { title: "shelves", children: [{ title: "measure", mark: "todo" }] },
          { title: "paint", mark: "done" },
        ],
      })

      expect(applied.summary).toBe("capture: the pantry (+3)")
      expect(applied.rev).toBe(2)
      expect(applied.captured?.map((node) => node.title)).toEqual([
        "the pantry",
        "shelves",
        "measure",
        "paint",
      ])

      const text = fixture.read("house.olai") ?? ""
      expect(Result.isSuccess(parseOutline("house.olai", text, TEST_CLAIMS))).toBe(true)
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(8)

      expect(text.split("\n").slice(0, 4)).toEqual(HOUSE.trimEnd().split("\n"))

      const set = yield* fixture.set()
      const byId = new Map(recordsOf(set).map((located) => [located.node.id, located.node]))
      for (const node of applied.captured ?? []) expect(byId.has(node.id)).toBe(true)
      expect(byId.get(applied.captured?.[3]?.id ?? "")).toMatchObject({ done: STAMP })
    })))

test("a refusal writes nothing and comes back with its structured detail", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "kitchen", undo: true }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(fixture.read("house.olai")).toBe(HOUSE)
      expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
    })))

test("refusal observers receive each request's writer without swallowing the failure", async () => {
  const heard: Array<{ readonly writer: string; readonly failure: OpFailure }> = []
  await withOps({ "house.olai": HOUSE }, (fixture) => Effect.gen(function*() {
    for (const writer of ["web", "chat-agent", "mcp"] as const) {
      const failure = yield* Effect.flip(fixture.ops.run({ op: "done", id: "nowhere" }, writer))
      expect(heard.at(-1)?.writer).toBe(writer)
      expect(heard.at(-1)?.failure).toBe(failure)
    }
    expect(heard).toHaveLength(3)
    expect(fixture.read("house.olai")).toBe(HOUSE)
  }), {
    onRefusal: (_request, failure, writer) => Effect.sync(() => {
      heard.push({ writer, failure })
    }),
  })
})

const PLAN_BEFORE =
  `{"id":"the-plan","ord":"a0","title":"The plan","custom":{"pr":"not-a-date"}}\n`
const PLAN_AFTER =
  `{"id":"the-plan","ord":"a0","title":"The plan","custom":{"pr":"2026-09-01"}}\n`
const PLAN_STILL_BAD =
  `{"id":"the-plan","ord":"a0","title":"The plan","custom":{"pr":"2026-99-99"}}\n`
const DECLARE_PR_DATE =
  `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"date"}}\n`
const DECLARE_PR_TEXT =
  `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"text"}}\n`

const watchingDrift = (fixture: Fixture): ReadonlyArray<ReadonlyArray<string>> => {
  const asked: Array<ReadonlyArray<string>> = []
  const original = fixture.store.drifted
  ;(fixture.store as { drifted: typeof original }).drifted = (paths) => {
    asked.push([...paths])
    return original(paths)
  }
  return asked
}

const STALE_JUDGE = verdictOf([{
  file: "plan.olai",
  line: 1,
  code: "bad-prop",
  message: "`pr` must be a day — the value here is not one",
  related: [{ file: "_olai/Properties.olai", line: 1, note: "declared here", broken: false }],
}])

const fakingCommit = (
  fixture: Fixture,
  answer: (attempt: number, write: Store.Write) => ReturnType<OutlineStore["commit"]> | undefined,
): (() => number) => {
  const committed = fixture.store.commit
  let attempts = 0
  ;(fixture.store as { commit: typeof committed }).commit = (write) => {
    attempts += 1
    return answer(attempts, write) ?? committed(write)
  }
  return () => attempts
}

const countingReads = (fixture: Fixture): (() => number) => {
  const read = fixture.store.read
  let reads = 0
  ;(fixture.store as { read: typeof read }).read = (freshness) => {
    reads += 1
    return read(freshness)
  }
  return () => reads
}

const watchingRefresh = (fixture: Fixture): ReadonlyArray<string> => {
  const opened: Array<string> = []
  const original = fixture.store.refresh
  ;(fixture.store as { refresh: typeof original }).refresh = (freshness) => {
    opened.push(freshness)
    return original(freshness)
  }
  return opened
}

test("the rebase shape: a write refused over a stale set heals, and lands", () =>
  withOps({ "plan.olai": PLAN_BEFORE }, (fixture) =>
    Effect.gen(function*() {
      fixture.write("_olai/Properties.olai", DECLARE_PR_DATE)
      replaceBehindTheStamps(fixture.root, "plan.olai", PLAN_AFTER)
      const served = yield* fixture.set()
      expect(
        recordsOf(served).find((located) => located.node.id === "the-plan")?.node,
      ).toMatchObject({ custom: { pr: "not-a-date" } })

      const asked = watchingDrift(fixture)
      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan", file: "plan.olai" })
      expect(asked).toEqual([])

      expect(fixture.refusals).toEqual([])
      const text = fixture.read("plan.olai") ?? ""
      expect(text).toContain(`"pr":"2026-09-01"`)
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
      const healed = yield* fixture.set()
      expect(
        recordsOf(healed).find((located) => located.node.id === "the-plan")?.node,
      ).toMatchObject({ custom: { pr: "2026-09-01" }, done: STAMP })
    })))

test("the planner arm's ask is every file the withheld rows were judged FROM", () =>
  withOps({
    "plan.olai": PLAN_BEFORE,
    "_olai/Properties.olai": DECLARE_PR_DATE,
  }, (fixture) =>
    Effect.gen(function*() {
      const served = yield* fixture.set()
      expect(served.broken.map((entry) => entry.file)).toEqual(["plan.olai"])
      replaceBehindTheStamps(fixture.root, "_olai/Properties.olai", DECLARE_PR_TEXT)

      const asked = watchingDrift(fixture)
      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan", file: "plan.olai" })
      expect(asked).toEqual([["_olai/Properties.olai", "plan.olai"]])
      expect(fixture.refusals).toEqual([])
      const text = fixture.read("plan.olai") ?? ""
      expect(text).toContain(`"pr":"not-a-date"`)
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
    })))

test("a repair that still refuses answers the FRESH refusal, once", () =>
  withOps({ "plan.olai": PLAN_BEFORE }, (fixture) =>
    Effect.gen(function*() {
      fixture.write("_olai/Properties.olai", DECLARE_PR_DATE)
      replaceBehindTheStamps(fixture.root, "plan.olai", PLAN_STILL_BAD)

      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "the-plan" }, "mcp")),
      )
      if (failure._tag !== "NotFoundFailure") {
        throw new Error(`expected a NotFoundFailure, got ${failure._tag}`)
      }
      expect(failure.message).toContain("the-plan")
      expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
      const said = (yield* fixture.set()).broken.flatMap((entry) =>
        entry.errors.map((finding) => finding.message)
      ).join("\n")
      expect(said).toContain("2026-99-99")
      expect(said).not.toContain("not-a-date")
      expect(fixture.refusals).toEqual(["done: NotFoundFailure"])
      expect(fixture.read("plan.olai")).toBe(PLAN_STILL_BAD)
    })))

test("a refusal the disk AGREES with heals nothing and changes nothing", () =>
  withOps({ "plan.olai": PLAN_STILL_BAD }, (fixture) =>
    Effect.gen(function*() {
      fixture.write("_olai/Properties.olai", DECLARE_PR_DATE)
      const refreshes = watchingRefresh(fixture)

      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "the-plan" }, "mcp")),
      )
      expect(failure._tag).toBe("NotFoundFailure")
      expect(fixture.refusals).toEqual(["done: NotFoundFailure"])
      expect(refreshes).toEqual([])
      expect(fixture.read("plan.olai")).toBe(PLAN_STILL_BAD)
    })))

test("the gate arm's ask is every file the verdict was judged FROM", () =>
  withOps({
    "plan.olai": PLAN_AFTER,
    "_olai/Properties.olai": DECLARE_PR_TEXT,
  }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.set()
      replaceBehindTheStamps(fixture.root, "_olai/Properties.olai", DECLARE_PR_DATE)
      fakingCommit(fixture, (attempt) =>
        attempt === 1 ? Effect.succeed(Result.fail(STALE_JUDGE)) : undefined)

      const asked = watchingDrift(fixture)
      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan", file: "plan.olai" })
      expect(asked).toEqual([["_olai/Properties.olai", "plan.olai"]])
      expect(fixture.refusals).toEqual([])
      expect(fixture.read("plan.olai")).toContain(`"done":${JSON.stringify(STAMP)}`)
    })))

test("a usage refusal never reaches the byte check — drift or no drift, the door stays shut", () =>
  withOps({
    "plan.olai":
      `{"id":"the-plan","ord":"a0","title":"The plan","done":"2026-08-01"}\n`,
    "garden.olai":
      `{"id":"garden","ord":"a0","title":"the garden","see":["nobody-declares-this"]}\n`,
  }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.store.refresh("cheap")
      replaceBehindTheStamps(
        fixture.root,
        "garden.olai",
        `{"id":"garden","ord":"a0","title":"the Garden","see":["nobody-declares-this"]}\n`,
      )
      const asked = watchingDrift(fixture)
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "the-plan" }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
      expect(asked).toEqual([])
    })))

const PLAN_OPEN =
  `{"id":"the-plan","ord":"a0","title":"The plan (and its long tail)"}\n`
const PLAN_MARKED_ELSEWHERE =
  `{"id":"the-plan","ord":"a0","title":"The plan","done":"2026-08-01"}\n`

const APPLES_BEFORE = `{"id":"apples","ord":"a0","title":"apples, before"}\n`
const APPLES_HEALED = `{"id":"apples","ord":"a0","title":"apples, healed"}\n`
const PEARS_BEFORE = `{"id":"pears","ord":"a0","title":"pears, before"}\n`
const PEARS_HEALED = `{"id":"pears","ord":"a0","title":"pears, healed"}\n`

const titles = (set: OutlineSet): ReadonlyArray<string> =>
  recordsOf(set).filter(isRegular).map((located) => located.node.title).sort()

test("a still-valid replacement of the write's own file is caught, and not clobbered", () =>
  withOps({ "plan.olai": PLAN_BEFORE }, (fixture) =>
    Effect.gen(function*() {
      const served = yield* fixture.set()
      expect(served.broken).toEqual([])
      replaceBehindTheStamps(fixture.root, "plan.olai", PLAN_AFTER)

      const asked = watchingDrift(fixture)
      const refreshes = watchingRefresh(fixture)
      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan", file: "plan.olai" })

      const text = fixture.read("plan.olai") ?? ""
      expect(text).toContain(`"pr":"2026-09-01"`)
      expect(text).not.toContain("not-a-date")
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)

      expect(asked).toEqual([])
      expect(refreshes).toEqual([])
      expect(fixture.refusals).toEqual([])
      const healed = yield* fixture.set()
      expect(
        recordsOf(healed).find((located) => located.node.id === "the-plan")?.node,
      ).toMatchObject({ custom: { pr: "2026-09-01" }, done: STAMP })
    })))

test("the round is PLANNED again: a write the true bytes refuse is refused, once", () =>
  withOps({ "plan.olai": PLAN_OPEN }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.set()
      replaceBehindTheStamps(fixture.root, "plan.olai", PLAN_MARKED_ELSEWHERE)

      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "the-plan" }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("already done")
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
      expect(fixture.read("plan.olai")).toBe(PLAN_MARKED_ELSEWHERE)
    })))

test("a write heals the file it is ABOUT, and leaves an untouched one to the door that names it", () =>
  withOps({ "a.olai": APPLES_BEFORE, "b.olai": PEARS_BEFORE }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.set()
      replaceBehindTheStamps(fixture.root, "a.olai", APPLES_HEALED)
      replaceBehindTheStamps(fixture.root, "b.olai", PEARS_HEALED)

      const refreshes = watchingRefresh(fixture)
      yield* run(fixture, { op: "done", id: "apples" })
      expect(refreshes).toEqual([])
      expect(titles(yield* fixture.set())).toEqual(["apples, healed", "pears, before"])
      expect(fixture.read("b.olai")).toBe(PEARS_HEALED)

      yield* run(fixture, { op: "done", id: "pears" })
      const text = fixture.read("b.olai") ?? ""
      expect(text).toContain("pears, healed")
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
      expect(fixture.refusals).toEqual([])
    })))

test("a bad value in one file does NOT block declaring another key — the ask stays the ask", () =>
  withOps({
    "_olai/Properties.olai":
      `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"date"}}\n` +
      `{"id":"prop-owner","ord":"a1","title":"owner","custom":{"type":"text"}}\n`,
    "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"2026-09-01"}}\n`,
  }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.set()
      fixture.write(
        "lanes.olai",
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"not-a-date"}}\n`,
      )
      yield* fixture.store.refresh("cheap")
      const applied = yield* run(fixture, {
        op: "title",
        id: "prop-owner",
        title: "the lane's owner",
      })
      expect(applied).toMatchObject({ id: "prop-owner" })
      expect(fixture.refusals).toEqual([])
    })))

test("a repair does not spend a lost race — four races and a heal still land", () =>
  withOps({
    "plan.olai": PLAN_AFTER,
    "_olai/Properties.olai": DECLARE_PR_TEXT,
  }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.set()
      replaceBehindTheStamps(fixture.root, "_olai/Properties.olai", DECLARE_PR_DATE)

      const attempts = fakingCommit(fixture, (attempt, write) =>
        attempt <= 4
          ? Effect.fail(
            new Store.StaleWrite({ baseRev: write.baseRev, currentRev: write.baseRev + 1 }),
          )
          : attempt === 5
          ? Effect.succeed(Result.fail(STALE_JUDGE))
          : undefined)

      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan" })
      expect(attempts()).toBe(6)
      expect(fixture.refusals).toEqual([])
      expect(fixture.read("plan.olai")).toContain(`"done":${JSON.stringify(STAMP)}`)
    })))

test("a outlines_prop of the value already held writes nothing at all", () =>
  withOps({ "house.olai": PROPPED }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(
          fixture.ops.run({ op: "prop", id: "order", key: "pr", value: "https://x/1" }, "mcp"),
        ),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("nothing would change")
      expect(fixture.read("house.olai")).toBe(PROPPED)
      expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
    })))

test("a outlines_prop that DOES change something lands, and stamps the write", () =>
  withOps({ "house.olai": PROPPED }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "prop", id: "order", key: "pr", value: "https://x/2" })
      const written = fixture.read("house.olai")
      expect(written).toContain(`"custom":{"pr":"https://x/2"}`)
      expect(written).toContain(`"changed":`)
    })))

test("an edit that arrives mid-write is absorbed, not lost", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      fixture.write("notes.olai", `{"id":"idea","ord":"a0","title":"an idea"}\n`)

      const applied = yield* run(fixture, { op: "done", id: "order" })
      const set = yield* fixture.set()
      expect([...outlinePaths(set)].sort()).toEqual(["house.olai", "notes.olai"])
      expect(
        recordsOf(set).find((located) => located.node.id === "order")?.node,
      ).toMatchObject({ done: STAMP })
      expect(fixture.read("notes.olai")).toContain("an idea")
    })))

test("a conditional write refuses when the field moves under the retry", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      fixture.write(
        "house.olai",
        HOUSE.replace(`"title":"order the cabinets"`, `"title":"order the chrome ones"`),
      )

      const outcome = yield* Effect.result(
        fixture.ops.run(
          {
            op: "title",
            id: "order",
            title: "put back what I replaced",
            was: "order the cabinets",
          },
          "web",
        ),
      )

      expect(Result.isFailure(outcome)).toBe(true)
      expect(fixture.read("house.olai")).toContain("order the chrome ones")
      expect(fixture.read("house.olai")).not.toContain("put back what I replaced")
    })))

test("concurrent ops all land, each re-derived from the set the last one left", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      yield* Effect.all(
        [
          run(fixture, { op: "done", id: "order" }),
          run(fixture, { op: "add", parent: "kitchen", title: "paint" }),
          run(fixture, { op: "title", id: "install", title: "install the cabinets" }),
        ],
        { concurrency: 3 },
      )

      const set = yield* fixture.set()
      const byId = new Map(recordsOf(set).map((located) => [located.node.id, located.node]))
      expect(byId.get("order")).toMatchObject({ done: STAMP })
      expect(byId.get("install")).toMatchObject({ title: "install the cabinets" })
      expect([...byId.values()].some((node) => "title" in node && node.title === "paint"))
        .toBe(true)
    })))

describe("a document's write cannot lose bytes (the 2026-09-01 incident)", () => {
  const BRIEF = [
    "---",
    "lane: doorbell-missing-claim",
    "dispatched: 2026-09-01",
    "---",
    "",
    "# Brief: the doorbell misses a claim",
    "",
    "A claim on a held terminal is answered by the doorbell's next wake rather",
    "than at the moment it is made, because the claim path and the wake path",
    "read two different clocks.",
    "",
    "## The work",
    "",
    "1. Reproduce with a held terminal and two claims in one wake.",
    "2. The fix is one clock, read once, at the doorbell's own edge.",
    "3. Pin it in the suite that owns the wake.",
    "",
    ...Array.from(
      { length: 30 },
      (_, line) => `Detail paragraph ${line + 1}: the evidence, the trace, and the ruling.`,
    ),
    "",
  ].join("\n")

  describe("a document write whose bytes do not survive its window is refused, not reported", () => {
    const looted = async (
      files: Record<string, string>,
      request: Request,
    ): Promise<{ failure: OpFailure; root: string }> => {
      const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-looted-")))
      for (const [file, contents] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
        fs.writeFileSync(path.join(root, file), contents)
      }
      return Effect.gen(function*() {
        const store = yield* Store.make({ root, codec, watch: false, settle: "10 millis" })
        const landed = store.commit
        const wrapped: typeof store = {
          ...store,
          commit: (write) =>
            Effect.map(landed(write), (outcome) => {
              if (Result.isSuccess(outcome)) {
                for (const change of write.changes) {
                  if (change.contents !== null) {
                    fs.writeFileSync(path.join(root, change.path), "")
                  }
                }
              }
              return outcome
            }),
        }
        const ops = Ops.make({claims: { current: TEST_CLAIMS }, format: "outline-olai",
          store: wrapped,
          root,
          context: steady(),
        })
        const failure = yield* Effect.flip(ops.run(request, "mcp"))
        return { failure, root }
      }).pipe(
        Effect.scoped,
        Effect.provide(NodeServices.layer),
        Effect.runPromise,
      )
    }

    test("a create: the write landed, the refusal names the 0 bytes the disk kept, and `markdown_write` is the way back", async () => {
      const { failure, root } = await looted(
        { "house.olai": HOUSE },
        { op: "create-doc", file: "briefs/dispatch.md", text: BRIEF },
      )
      try {
        expect(failure._tag).toBe("ValidationFailure")
        expect(failure.message).toContain("briefs/dispatch.md` landed")
        expect(failure.message).toContain("0 bytes where")
        expect(failure.message).toContain("markdown_write")
        expect(fs.readFileSync(path.join(root, "briefs/dispatch.md"), "utf8")).toBe("")
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })

    test("a markdown_write: the web's verb is refused with the same sentence", async () => {
      const { failure, root } = await looted(
        { "house.olai": HOUSE, "notes/plan.md": "# old plan\n" },
        { op: "doc", file: "notes/plan.md", text: BRIEF },
      )
      try {
        expect(failure._tag).toBe("ValidationFailure")
        expect(failure.message).toContain("notes/plan.md` landed")
        expect(failure.message).toContain("0 bytes where")
        expect(failure.message).toContain("markdown_write")
        expect(fs.readFileSync(path.join(root, "notes/plan.md"), "utf8")).toBe("")
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })

    test("a markdown_write killed between gate and read-back by the set itself — the gone file is named, not the disk blamed", async () => {
      const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-looted-")))
      fs.writeFileSync(path.join(root, "house.olai"), HOUSE)
      fs.mkdirSync(path.join(root, "notes"), { recursive: true })
      fs.writeFileSync(path.join(root, "notes/plan.md"), "# old plan\n")
      try {
        const failure = await Effect.gen(function*() {
          const store = yield* Store.make({ root, codec, watch: false, settle: "10 millis" })
          const landed = store.commit
          const wrapped: typeof store = {
            ...store,
            commit: (write) =>
              Effect.map(landed(write), (outcome) => {
                if (Result.isSuccess(outcome)) fs.rmSync(path.join(root, "notes/plan.md"))
                return outcome
              }),
          }
          const ops = Ops.make({claims: { current: TEST_CLAIMS }, format: "outline-olai",
            store: wrapped,
            root,
            context: steady(),
          })
          return yield* Effect.flip(ops.run({ op: "doc", file: "notes/plan.md", text: BRIEF }, "mcp"))
        }).pipe(
          Effect.scoped,
          Effect.provide(NodeServices.layer),
          Effect.runPromise,
        )
        expect(failure._tag).toBe("ValidationFailure")
        expect(failure.message).toContain("landed")
        expect(failure.message).not.toContain("not kept by the disk")
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })
  })

  test("the baseline: the body is on disk with the answer", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect(BRIEF.length).toBeGreaterThan(1800)
        const applied = yield* run(fixture, {
          op: "create-doc",
          file: "briefs/doorbell-missing-claim.md",
          text: BRIEF,
        })
        expect(applied.rev).toBeGreaterThan(1)

        expect(fixture.read("briefs/doorbell-missing-claim.md")).toBe(BRIEF)
        const documents = markdownIn(yield* fixture.set())
        expect(documents.map((document) => String(document.path))).toEqual([
          "briefs/doorbell-missing-claim.md",
        ])

      })))

  test("the batch: a create racing a delete of ANOTHER document keeps its body", () =>
    withOps(
      {
        "house.olai": HOUSE,
        ...Object.fromEntries(
          Array.from({ length: 8 }, (_, round) => [`spent-${round}.md`, `# spent ${round}\n`]),
        ),
      },
      (fixture) =>
        Effect.gen(function*() {
          for (let round = 0; round < 8; round++) {
            const created = `briefs/dispatch-${round}.md`
            yield* Effect.all(
              [
                run(fixture, { op: "create-doc", file: created, text: BRIEF }),
                run(fixture, { op: "delete", file: `spent-${round}.md` }),
              ],
              { concurrency: 2 },
            )
            expect(fixture.read(created)).toBe(BRIEF)
            expect(fixture.read(`spent-${round}.md`)).toBeNull()
          }
        }),
    ))

  test("a serve restart between the write and the commit loses nothing", async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-restart-")))
    const write = (file: string, contents: string) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), contents)
    }
    write("house.olai", HOUSE)
    const booted = <A>(use: (ops: Ops.Ops) => Effect.Effect<A, unknown>): Promise<A> =>
      Effect.gen(function*() {
        const store = yield* Store.make({
          root,
          codec,
          watch: false,
          settle: "10 millis",
        })
        return yield* use(Ops.make({claims: { current: TEST_CLAIMS }, format: "outline-olai",
          store,
          root,
          context: steady(),
        }))
      }).pipe(
        Effect.scoped,
        Effect.provide(NodeServices.layer),
        Effect.runPromise,
      )
    try {
      await booted((ops) =>
        Effect.gen(function*() {
          const applied = yield* Effect.orDie(ops.run({
            op: "create-doc",
            file: "briefs/doorbell-missing-claim.md",
            text: BRIEF,
          }, "mcp"))
          expect(applied.rev).toBeGreaterThan(1)
        }))
      expect(fs.readFileSync(path.join(root, "briefs/doorbell-missing-claim.md"), "utf8"))
        .toBe(BRIEF)

      await booted((ops) =>
        Effect.gen(function*() {
          const set = yield* Effect.orDie(ops.read)
          expect([...set.set.documents.map((d) => String(d.path))]).toContain(
            "briefs/doorbell-missing-claim.md",
          )
        }))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe("delete, against a real directory", () => {
  test("the file goes — from the disk, from the set the next read answers, and `gone` is what the reply calls it", () =>
    withOps({ "house.olai": HOUSE, "ideas.md": "# Ideas\n" }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* run(fixture, { op: "delete", file: "ideas.md" })
        expect(applied).toMatchObject({
          id: "ideas.md",
          title: "ideas.md",
          file: "ideas.md",
          rev: 2,
          summary: "delete: ideas.md",
          sort: "gone",
        })
        expect(fixture.read("ideas.md")).toBeNull()
        expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(2)
        const set = yield* fixture.set()
        expect(markdownIn(set).map((document) => document.path)).toEqual([])
      })))

  test("...and it is an honest refusal the second time — nothing silently widened", () =>
    withOps({ "house.olai": HOUSE, "ideas.md": "# Ideas\n" }, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, { op: "delete", file: "ideas.md" })
        const refusal = yield* Effect.flip(fixture.ops.run({ op: "delete", file: "ideas.md" }, "mcp"))
        expect(refusal._tag).toBe("NotFoundFailure")
        expect(refusal.message).toContain(`\`ideas.md\` is not a file under the served directory`)
      })))

  test("an outline with records is refused naming them, and the disk holds BOTH afterwards — the refusal costs nothing", () =>
    withOps({ "house.olai": HOUSE, "ideas.md": "# Ideas\n" }, (fixture) =>
      Effect.gen(function*() {
        const refusal = yield* Effect.flip(fixture.ops.run({ op: "delete", file: "house.olai" }, "mcp"))
        expect(refusal._tag).toBe("UsageFailure")
        expect(refusal.message).toContain("house.olai")
        expect(refusal.message).toContain("`order`")
        expect(fixture.read("house.olai")).toBe(HOUSE)
        expect(fixture.read("ideas.md")).toBe("# Ideas\n")
      })))

  test("a `.html` the directory shows is refused the same way — never the near-miss the `.md` one space away would be", () =>
    withOps({ "house.olai": HOUSE, "notes.md": "# notes\n", "report.html": "<h1>x</h1>\n" }, (fixture) =>
      Effect.gen(function*() {
        const refusal = yield* Effect.flip(fixture.ops.run({ op: "delete", file: "report.html" }, "mcp"))
        expect(refusal._tag).toBe("UsageFailure")
        expect(refusal.message).toContain("a page")
        expect(fixture.read("report.html")).toBe("<h1>x</h1>\n")
      })))
})

describe("apply, against a real directory", () => {
  test("a batch of three ops moves the store ONE revision", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
        const applied = yield* run(fixture, {
          op: "apply",
          ops: [
            { op: "done", id: "order" },
            { op: "prop", id: "install", key: "pr", value: "https://x/1" },
            { op: "title", id: "demo", title: "demolition, done" },
          ],
        })
        expect(applied.rev).toBe(2)
        expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(2)

        const text = fixture.read("house.olai") ?? ""
        expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
        expect(text).toContain(`"custom":{"pr":"https://x/1"}`)
        expect(text).toContain("demolition, done")
        expect(Result.isSuccess(parseOutline("house.olai", text, TEST_CLAIMS))).toBe(true)
      })))

  test("a batch refused halfway leaves the file untouched, byte for byte", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const before = fixture.read("house.olai")
        const outcome = yield* Effect.result(fixture.ops.run({
          op: "apply",
          ops: [
            { op: "done", id: "install" },
            { op: "todo", id: "order" },
            { op: "done", id: "kitchen" },
          ],
        }, "mcp"))

        expect(Result.isFailure(outcome)).toBe(true)
        if (Result.isFailure(outcome)) {
          expect(outcome.failure.message).toContain("`ops[2]` (`done`)")
          expect(outcome.failure.message).toContain("holds 1 unfinished task")
          expect(outcome.failure.message).toContain("`order the cabinets` (`order`, todo)")
          expect(outcome.failure.message).not.toContain("`install them`")
        }
        expect(fixture.read("house.olai")).toBe(before)
        expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
        expect(fixture.refusals).toEqual(["apply: UsageFailure"])
      })))

  test("a batch is ONE revision and ONE write, and it waits like any other", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* run(fixture, {
          op: "apply",
          ops: [
            { op: "done", id: "order" },
            { op: "title", id: "demo", title: "demolition, done" },
          ],
        })
        expect(applied.summary).toContain("apply: 2 ops")
        expect(applied.rev).toBe(2)
      })))

  test("`update` writes four fields of one node in one revision", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* run(fixture, {
          op: "update",
          id: "order",
          title: "order the cabinets #kitchen",
          desc: "from the joiner",
          props: { pr: "https://x/1" },
          mark: "done",
        })
        expect(applied.rev).toBe(2)
        expect(applied.title).toBe("order the cabinets #kitchen")
        const text = fixture.read("house.olai") ?? ""
        expect(text).toContain(`"desc":"from the joiner"`)
        expect(text).toContain(`"custom":{"pr":"https://x/1"}`)
        expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
      })))

  test("a capture arrives on disk with its edges and its facts", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* run(fixture, {
          op: "add",
          parent: "kitchen",
          title: "worktop",
          props: { agent: "claude-opus" },
          children: [
            { id: "cut", title: "cut it", waitsOn: ["measure"] },
            { id: "measure", title: "measure up" },
          ],
        })
        expect(applied.rev).toBe(2)
        const text = fixture.read("house.olai") ?? ""
        expect(text).toContain(`"after":["measure"]`)
        expect(text).toContain(`"custom":{"agent":"claude-opus"}`)
        const set = yield* fixture.set()
        expect(set.broken).toEqual([])
      })))
})

describe("a broken file beside a healthy one", () => {
  const GARDEN = `{"id":"garden","ord":"a0","title":"the garden"}\n`

  const DANGLING =
    `{"id":"garden","ord":"a0","title":"the garden","see":["nobody-declares-this"]}\n`

  const breakGarden = (fixture: Fixture) =>
    Effect.gen(function*() {
      fixture.write("garden.olai", DANGLING)
      yield* Effect.orDie(fixture.store.refresh("cheap"))
      expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
      const set = yield* fixture.set()
      expect(set.broken.map((one) => one.file)).toEqual(["garden.olai"])
      expect(set.broken[0]?.errors.map((one) => one.code)).toEqual(["unknown-target"])
      expect(recordsOf(set).filter((at) => at.file === "garden.olai")).toEqual([])
    })

  test("a write to the healthy file lands, and the broken one goes on being broken", () =>
    withOps(
      { "house.olai": HOUSE, "garden.olai": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)

          const applied = yield* run(fixture, { op: "done", id: "order" })
          expect(fixture.read("house.olai")).toContain(`"done":${JSON.stringify(STAMP)}`)
          expect(fixture.refusals).toEqual([])
          expect(applied.rev).toBeGreaterThan(1)

          const set = yield* fixture.set()
          const done = recordsOf(set).find((at) => at.node.id === "order")?.node
          expect(done !== undefined && !isMirror(done) ? done.done : undefined).toBe(STAMP)
          expect(set.broken.map((one) => one.file)).toEqual(["garden.olai"])
        }),
    ))

  test("a second write to the same file lands on top of the first", () =>
    withOps(
      { "house.olai": HOUSE, "garden.olai": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)
          yield* run(fixture, { op: "done", id: "order" })
          yield* run(fixture, { op: "title", id: "install", title: "install them" })
          expect(fixture.refusals).toEqual([])

          const text = fixture.read("house.olai") ?? ""
          expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
          expect(text).toContain(`"title":"install them"`)
        }),
    ))

  test("a write INTO the broken file is refused, and says which file", () =>
    withOps(
      { "house.olai": HOUSE, "garden.olai": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)
          const failure = yield* Effect.orDie(
            Effect.flip(
              fixture.ops.run({ op: "add", file: "garden.olai", title: "a new bed" }, "mcp"),
            ),
          )
          expect(failure._tag).toBe("ValidationFailure")
          expect(failure.message).toContain("`garden.olai`")
          expect(fixture.read("garden.olai")).toBe(DANGLING)
        }),
    ))

  test("the broken file comes back the moment it is fixed", () =>
    withOps(
      { "house.olai": HOUSE, "garden.olai": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)
          yield* run(fixture, { op: "done", id: "order" })

          fixture.write("garden.olai", GARDEN)
          yield* Effect.orDie(fixture.store.refresh("cheap"))

          const set = yield* fixture.set()
          expect(set.broken).toEqual([])
          expect(
            recordsOf(set).filter((at) => at.file === "garden.olai").map((at) => at.node.id),
          ).toEqual(["garden"])
          const done = recordsOf(set).find((at) => at.node.id === "order")?.node
          expect(done !== undefined && !isMirror(done) ? done.done : undefined).toBe(STAMP)
        }),
    ))
})


test("a bad type in a Properties declaration is refused naming the legal vocabulary", () =>
  withOps(
    {
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        const unknown = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({
              op: "add",
              file: "_olai/Properties.olai",
              title: "took",
              props: { type: "took" },
            }, "mcp"),
          ),
        )
        expect(unknown._tag).toBe("UsageFailure")
        expect(unknown.message).toContain("`type` is `took`, which is not a property type")
        expect(unknown.message).toContain("`int` (a digit run)")
        expect(unknown.message).toContain("`ref` (a child's id; `under` names the parent)")
        expect(unknown.message).not.toContain("would leave")

        const missing = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({
              op: "add",
              file: "_olai/Properties.olai",
              title: "musts",
            }, "mcp"),
          ),
        )
        expect(missing._tag).toBe("UsageFailure")
        expect(missing.message).toContain("does not say its `type`")
        expect(missing.message).toContain("`text` (anything)")
        expect(missing.message).toContain("`ref` (a child's id; `under` names the parent)")
        expect(missing.message).not.toContain("would leave")
      }),
  ))

describe("a declaration over unfit values", () => {
  const LANES = [
    `{"id":"a","ord":"a0","title":"first","custom":{"brainstorm":"not a path"}}`,
    `{"id":"b","ord":"a1","title":"second","custom":{"brainstorm":"also prose"}}`,
    `{"id":"c","ord":"a2","title":"third","custom":{"brainstorm":"still not"}}`,
    "",
  ].join("\n")

  const FILES = {
    "_olai/Properties.olai":
      `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n`,
    "lanes.olai": LANES,
    "briefs/one.md": "one\n",
    "briefs/two.md": "two\n",
    "briefs/three.md": "three\n",
  }

  test("outlines_add of the declaration refuses, naming file + node + value", () =>
    withOps(FILES, (fixture) =>
      Effect.gen(function*() {
        const failure = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({
              op: "add",
              file: "_olai/Properties.olai",
              title: "brainstorm",
              props: { type: "doc" },
            }, "mcp"),
          ),
        )
        expect(failure._tag).toBe("UsageFailure")
        expect(failure.message).toContain("`brainstorm` cannot be declared `doc`")
        expect(failure.message).toContain("`lanes.olai` `first` (`a`) holds \"not a path\"")
        expect(failure.message).toContain("`lanes.olai` `second` (`b`) holds \"also prose\"")
        expect(failure.message).toContain("`lanes.olai` `third` (`c`) holds \"still not\"")
        expect(fixture.read("_olai/Properties.olai")).not.toContain("brainstorm")
      })))

  test("one apply cleans every value, then the declaration is accepted", () =>
    withOps(FILES, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, {
          op: "apply",
          ops: [
            { op: "prop", id: "a", key: "brainstorm", value: "briefs/one.md" },
            { op: "prop", id: "b", key: "brainstorm", value: "briefs/two.md" },
            { op: "prop", id: "c", key: "brainstorm", value: "briefs/three.md" },
          ],
        })
        yield* run(fixture, {
          op: "add",
          file: "_olai/Properties.olai",
          title: "brainstorm",
          props: { type: "doc" },
        })
        expect(fixture.read("_olai/Properties.olai")).toContain(`"title":"brainstorm"`)
        expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
        const set = yield* fixture.set()
        expect(set.broken).toEqual([])
      })))

  test("a hand-edited declaration withholds the file, and no node op reaches it", () =>
    withOps(FILES, (fixture) =>
      Effect.gen(function*() {
        fixture.write(
          "_olai/Properties.olai",
          `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n` +
            `{"id":"prop-brief","ord":"a1","title":"brainstorm","custom":{"type":"doc"}}\n`,
        )
        yield* Effect.orDie(fixture.store.refresh("cheap"))
        expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
        const held = yield* fixture.set()
        expect(held.broken.map((one) => one.file)).toEqual(["lanes.olai"])
        expect(held.broken[0]?.errors.map((one) => one.code)).toEqual([
          "bad-prop",
          "bad-prop",
          "bad-prop",
        ])

        const one = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({
              op: "prop",
              id: "a",
              key: "brainstorm",
              value: "briefs/one.md",
            }, "mcp"),
          ),
        )
        expect(one._tag).toBe("NotFoundFailure")

        const batch = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({
              op: "apply",
              ops: [
                { op: "prop", id: "a", key: "brainstorm", value: "briefs/one.md" },
                { op: "prop", id: "b", key: "brainstorm", value: "briefs/two.md" },
                { op: "prop", id: "c", key: "brainstorm", value: "briefs/three.md" },
              ],
            }, "mcp"),
          ),
        )
        expect(batch._tag).toBe("NotFoundFailure")
        expect(fixture.read("lanes.olai")).toContain("not a path")

        fixture.write(
          "lanes.olai",
          [
            `{"id":"a","ord":"a0","title":"first","custom":{"brainstorm":"briefs/one.md"}}`,
            `{"id":"b","ord":"a1","title":"second","custom":{"brainstorm":"briefs/two.md"}}`,
            `{"id":"c","ord":"a2","title":"third","custom":{"brainstorm":"briefs/three.md"}}`,
            "",
          ].join("\n"),
        )
        yield* Effect.orDie(fixture.store.refresh("cheap"))
        expect((yield* fixture.set()).broken).toEqual([])
      })))

  test("apply can reach a value on a trashed node", () =>
    withOps(
      {
        "house.olai": `{"id":"live","ord":"a0","title":"still here"}\n`,
        "_olai/Trash.olai":
          `{"id":"filed","ord":"a0","title":"put away","custom":{"brainstorm":"old prose"}}\n`,
      },
      (fixture) =>
        Effect.gen(function*() {
          yield* run(fixture, {
            op: "apply",
            ops: [{ op: "prop", id: "filed", key: "brainstorm", value: "new prose" }],
          })
          expect(fixture.read("_olai/Trash.olai")).toContain("new prose")
          expect(fixture.read("_olai/Trash.olai")).not.toContain("old prose")
        }),
    ))
})

test("moving a ref variant is refused, naming the third file it would strand", () =>
  withOps(
    {
      "_olai/Properties.olai":
        `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}\n`,
      "agents.olai": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
        "",
      ].join("\n"),
      "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}\n`,
      "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        const agents = fixture.read("agents.olai")
        const garden = fixture.read("garden.olai")

        const failure = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({ op: "move", id: "claude", parent: "garden" }, "mcp"),
          ),
        )
        expect(failure._tag).toBe("ValidationFailure")
        expect(failure.message).toContain("`lanes.olai`")
        if (failure._tag !== "ValidationFailure") throw new Error("a validation refusal")
        expect(failure.verdict.findings.map((one) => [one.file, one.code]))
          .toEqual([["lanes.olai", "bad-prop"]])

        expect(fixture.read("agents.olai")).toBe(agents)
        expect(fixture.read("garden.olai")).toBe(garden)
        const set = yield* fixture.set()
        expect(set.broken).toEqual([])

        yield* run(fixture, { op: "prop", id: "lane", key: "agent", value: null })
        yield* run(fixture, { op: "move", id: "claude", parent: "garden" })
        expect(fixture.read("garden.olai")).toContain(`"id":"claude"`)
        expect((yield* fixture.set()).broken).toEqual([])
      }),
  ))

test("a bystander refusal reaches the drift arm with the judge in the ask", () =>
  withOps(
    {
      "_olai/Properties.olai":
        `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}\n`,
      "agents.olai": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
        "",
      ].join("\n"),
      "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}\n`,
      "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        const asked = watchingDrift(fixture)
        const failure = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({ op: "move", id: "claude", parent: "garden" }, "mcp"),
          ),
        )
        expect(failure._tag).toBe("ValidationFailure")

        expect(asked).toEqual([["_olai/Properties.olai", "lanes.olai"]])

        expect(fixture.refusals).toEqual(["move: ValidationFailure"])
      }),
  ))

test("a file that was already dark is not a bystander this write struck", () =>
  withOps(
    {
      "_olai/Properties.olai":
        `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}\n`,
      "agents.olai": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
        "",
      ].join("\n"),
      "lanes.olai": [
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}`,
        `{"id":"other","ord":"a1","title":"another lane","custom":{"agent":"nobody-declared-this"}}`,
        "",
      ].join("\n"),
      "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        const before = yield* fixture.set()
        expect(before.broken.map((one) => one.file)).toEqual(["lanes.olai"])

        yield* run(fixture, { op: "move", id: "claude", parent: "garden" })
        expect(fixture.read("garden.olai")).toContain(`"id":"claude"`)

        const set = yield* fixture.set()
        expect(set.broken.map((one) => one.file)).toEqual(["lanes.olai"])
        expect(set.broken[0]?.errors.length).toBe(2)
        expect(admits(set.broken, ["garden.olai"])._tag).toBe("admitted")
      }),
  ))

test("a foreign parent darkens the child's file, and the parent's stays writable", () =>
  withOps(
    {
      "parent.olai": `{"id":"kitchen","ord":"a0","title":"the kitchen"}\n`,
      "child.olai": `{"id":"sink","parent":"kitchen","ord":"a0","title":"the sink"}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        const set = yield* fixture.set()
        expect(set.broken.map((one) => one.file)).toEqual(["child.olai"])
        expect(set.broken[0]?.errors.map((one) => one.code)).toEqual(["foreign-parent"])
        expect(implicatedBy(set.broken[0]?.errors[0] as OutlineError))
          .toEqual(["child.olai", "parent.olai"])
        expect(admits(set.broken, ["parent.olai"])._tag).toBe("admitted")

        yield* run(fixture, { op: "title", id: "kitchen", title: "the kitchen, tidied" })
        expect(fixture.read("parent.olai")).toContain("the kitchen, tidied")

        const refused = yield* Effect.orDie(
          Effect.flip(fixture.ops.run({ op: "title", id: "sink", title: "no" }, "mcp")),
        )
        expect(refused._tag).toBe("NotFoundFailure")
      }),
  ))

test("claims mismatch spends the bounded retry budget even if refresh publishes nothing", () =>
  withOps({ "a.olai": '{"id":"n","ord":"a0","title":"before"}\n' }, fixture => Effect.gen(function*() {
    let refreshes = 0
    const ops = Ops.make({
      claims: { current: { ...TEST_CLAIMS } }, format: "outline-olai", root: fixture.root,
      store: { ...fixture.store, refresh: () => { refreshes++; return Effect.void } },
    })
    const result = yield* Effect.result(ops.run({ op: "title", id: "n", title: "after" }, "mcp"))
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("BusyFailure")
      expect(result.failure.message).toContain("this write was not written")
      expect(result.failure.message).toContain("file kinds")
      expect(result.failure.message).toContain("out of date on all 5 attempts")
      expect(result.failure.message).toContain("olai's own fault")
      expect(result.failure.message).not.toContain("rewriting")
    }
    expect(refreshes).toBe(5)
    expect(fixture.read("a.olai")).toContain("before")
  })))


test("the first outline lands after file kinds register on an empty directory", () => {
  const table = { current: claims([]) }
  return withOps({}, fixture => Effect.gen(function*() {
    const before = (yield* fixture.store.read("cheap")).snapshot
    expect(before?.value.claims).toBe(table.current)
    table.current = TEST_CLAIMS
    yield* run(fixture, { op: "create", file: "sdf.olai" })
    expect(fixture.read("sdf.olai")).toBe("")
    expect((yield* fixture.store.read("cheap")).snapshot?.value.claims).toBe(TEST_CLAIMS)
  }), { claims: table })
})

test("five stale writes name the plan, revisions, frequent paths and removals", () =>
  withOps({ "gone.olai": "" }, fixture => Effect.gen(function*() {
    const reads = countingReads(fixture)
    const attempts = fakingCommit(fixture, (attempt, write) => Effect.gen(function*() {
      fixture.write("_olai/Terminals.olai", `{"id":"terminal","ord":"a0","title":"${"x".repeat(attempt)}"}\n`)
      if (attempt === 1) {
        fs.unlinkSync(path.join(fixture.root, "gone.olai"))
        for (const file of ["Inbox", "Other", "Third", "Fourth"]) fixture.write(`${file}.olai`, "")
      }
      yield* fixture.store.refresh("cheap")
      return yield* new Store.StaleWrite({ baseRev: write.baseRev, currentRev: write.baseRev + 1 })
    }))
    const failure = yield* Effect.flip(fixture.ops.run({ op: "create", file: "sdf.olai" }, "web"))
    expect(attempts()).toBe(5)
    expect(reads()).toBe(6)
    expect(failure._tag).toBe("BusyFailure")
    expect(failure.message).toContain("`create: sdf.olai` was not written")
    expect(failure.message).toContain("all 5 attempts (revision 1 → 6)")
    expect(failure.message).toContain("`_olai/Terminals.olai` every time")
    expect(failure.message).toContain("`gone.olai` removed once")
    expect(failure.message).toContain("`Inbox.olai` once")
    expect(failure.message).toContain("and 2 more")
    expect(fixture.read("sdf.olai")).toBeNull()
  })))

test("a revision-only race does not invent file names", () =>
  withOps({}, fixture => Effect.gen(function*() {
    fakingCommit(fixture, (attempt, write) => Effect.fail(
      new Store.StaleWrite({ baseRev: write.baseRev, currentRev: write.baseRev + attempt }),
    ))
    const failure = yield* Effect.flip(fixture.ops.run({ op: "create", file: "sdf.olai" }, "web"))
    expect(failure._tag).toBe("BusyFailure")
    expect(failure.message).toContain("revision 1 → 6")
    expect(failure.message).not.toContain("every time")
  })))

test("mixed races keep the last plan and distinguish file movement from claims", () =>
  withOps({}, fixture => Effect.gen(function*() {
    const table = { current: TEST_CLAIMS }
    fakingCommit(fixture, (_, write) => {
      table.current = { ...TEST_CLAIMS }
      return Effect.fail(new Store.StaleWrite({ baseRev: write.baseRev, currentRev: write.baseRev + 1 }))
    })
    const ops = Ops.make({
      claims: table, format: "outline-olai", root: fixture.root,
      store: { ...fixture.store, refresh: () => Effect.void },
    })
    const failure = yield* Effect.flip(ops.run({ op: "create", file: "sdf.olai" }, "web"))
    expect(failure._tag).toBe("BusyFailure")
    expect(failure.message).toContain("`create: sdf.olai` was not written")
    expect(failure.message).toContain("1 of 5 attempts (revision 1 → 2)")
    expect(failure.message).toContain("file kinds was also out of date on 4 attempts")
    expect(failure.message).not.toContain("all 5")
  })))

test("a removed and recreated path is not described as removed every time", () =>
  withOps({ "other.olai": "" }, fixture => Effect.gen(function*() {
    fakingCommit(fixture, (attempt, write) => Effect.gen(function*() {
      if (attempt === 1) fs.unlinkSync(path.join(fixture.root, "other.olai"))
      else fixture.write("other.olai", `{"id":"other","ord":"a0","title":"${"x".repeat(attempt)}"}\n`)
      yield* fixture.store.refresh("cheap")
      return yield* new Store.StaleWrite({ baseRev: write.baseRev, currentRev: write.baseRev + 1 })
    }))
    const failure = yield* Effect.flip(fixture.ops.run({ op: "create", file: "sdf.olai" }, "web"))
    expect(failure.message).toContain("`other.olai` every time (removed once)")
  })))


test("a successful retry uses its next planning read for the lost race's evidence", () =>
  withOps({}, fixture => Effect.gen(function*() {
    const reads = countingReads(fixture)
    fakingCommit(fixture, (attempt, write) => attempt === 1
      ? Effect.fail(new Store.StaleWrite({ baseRev: write.baseRev, currentRev: write.baseRev + 1 }))
      : undefined)
    yield* run(fixture, { op: "create", file: "sdf.olai" })
    expect(reads()).toBe(2)
    expect(fixture.read("sdf.olai")).toBe("")
  })))
