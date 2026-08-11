/**
 * The ops layer against a real directory: the planner, the write gate and the
 * file system, joined the way the server joins them.
 *
 * {@link ./plan.test.ts} already proves what each op DECIDES, so nothing here
 * re-asserts that. What is only true end to end is what these tests are for:
 * that the bytes on disk are what a reader can read back, that a write racing
 * another writer re-derives instead of losing, and that git gets a commit with
 * the message the convention says.
 *
 * The TOOL surface used to be proved here too, because this package used to own
 * an MCP server. It does not any more — the table is projected onto
 * `@kolu/surface-mcp` up in `@olai/server`, which is where the MCP SDK belongs —
 * so those tests moved with it, to `packages/server/src/mcp/tools.test.ts`, and
 * got better on the way: they now run through a real MCP client rather than
 * through a dispatch function.
 */

import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import { isMirror, type OutlineError, type OutlineSet, parseOutline } from "@olai/format"
import * as Store from "@olai/store"
import { describe, expect, test } from "bun:test"
import { Effect, Result, SubscriptionRef } from "effect"

import { codec } from "./codec.ts"
import { STAMP, STAMP_SHAPE, steady } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"
import type { Applied, Request } from "./request.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","doing":"2026-08-02"}`,
  "",
].join("\n")

interface Fixture {
  readonly ops: Ops.Ops
  readonly store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>>
  readonly root: string
  readonly read: (file: string) => string | null
  readonly write: (file: string, contents: string) => void
  /** The set as it stands, so a test can look at records rather than bytes. */
  readonly set: () => Effect.Effect<OutlineSet>
  /** Every write this layer refused, as `<op>: <tag>`. Collected at the OPS
   *  seam, which is where the observer hangs — so it records a refusal
   *  whichever caller asked for the write. */
  readonly refusals: ReadonlyArray<string>
}

const withOps = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Effect.Effect<A, never>,
  options: { readonly git?: boolean; readonly realClock?: boolean } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-")))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  if (options.git === true) {
    const git = (...argv: ReadonlyArray<string>) =>
      execFileSync("git", argv, { cwd: root, stdio: "ignore" })
    git("init", "--quiet")
    git("config", "user.email", "test@olai.invalid")
    git("config", "user.name", "olai tests")
    git("add", "-A")
    git("commit", "--quiet", "-m", "fixtures")
  }

  return Effect.gen(function*() {
    const store = yield* Store.make({ root, codec, watch: false, settle: "10 millis" })
    const refusals: Array<string> = []
    const ops = Ops.make({
      store,
      root,
      commit: options.git === true,
      // The planner's own fixture context by default — ids from `n1`, one fixed
      // instant — so an assertion can name what a mark stamps. `realClock`
      // hands the layer back its OWN: the one test that is about what that
      // context mints cannot be handed a fixture of it.
      ...(options.realClock === true ? {} : { context: steady() }),
      onRefusal: (request, failure) =>
        Effect.sync(() => {
          refusals.push(`${request.op}: ${failure._tag}`)
        }),
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
        Effect.map(SubscriptionRef.get(store.snapshot), (snapshot) => {
          if (snapshot === null) throw new Error("the fixture directory never loaded")
          return snapshot.value
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

/** Run an op, or fail the test with what it refused. */
const run = (
  fixture: Fixture,
  request: Request,
): Effect.Effect<Applied> =>
  Effect.catch(fixture.ops.run(request), (failure) =>
    Effect.die(
      new Error(`\`${request.op}\` was refused: ${failure._tag} — ${failure.message}`),
    ))

const gitLog = (root: string): ReadonlyArray<string> =>
  execFileSync("git", ["log", "--format=%s"], { cwd: root, encoding: "utf8" })
    .trim()
    .split("\n")

// ── the write path ─────────────────────────────────────────────────────

test("a mark lands on disk as bytes the parser reads back", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "done", id: "order" })
      expect(applied).toMatchObject({ id: "order", file: "house.jsonl", rev: 2 })

      const text = fixture.read("house.jsonl") ?? ""
      expect(text.endsWith("\n")).toBe(true)
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(4)

      const parsed = parseOutline("house.jsonl", text)
      expect(Result.isSuccess(parsed)).toBe(true)

      // And the browser sees it: the snapshot moved, without anyone probing.
      const set = yield* fixture.set()
      const order = set.nodes.find((located) => located.node.id === "order")
      expect(order?.node).toMatchObject({ done: STAMP })
    })))

/**
 * The round-trip promise, in the language it is made in.
 *
 * `docs/format.md` and `packages/ops/README.md` both say it about BYTES — a
 * writer must reproduce what it read — and the planner's test compares
 * records, which is a different sentence about the same thing. Here the file
 * is read back as text, so a `true` that came back `"true"`, a day-only value
 * widened into an instant, or a neighbour restamped by the op would all be
 * caught where the claim is actually made.
 */
test("the marks on the other records come back as the bytes they were", () =>
  withOps({
    "house.jsonl": [
      `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
      `{"id":"old","parent":"kitchen","ord":"a0","title":"an old habit","done":true}`,
      `{"id":"quote","parent":"kitchen","ord":"a1","title":"get a quote","done":"2026-08-01"}`,
      `{"id":"order","parent":"kitchen","ord":"a2","title":"order the cabinets"}`,
      "",
    ].join("\n"),
  }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "done", id: "order" })

      const text = fixture.read("house.jsonl") ?? ""
      expect(text).toContain(`"done":true`)
      expect(text).toContain(`"done":"2026-08-01"`)
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
    })))

/**
 * What the layer stamps when nobody hands it a clock — the whole of the
 * `set_done`-stamps-itself promise, and the one test that has to use the real
 * one.
 *
 * Asserted as a SHAPE and a window rather than a value: what a wall clock says
 * is not something a test can name, but "an ISO datetime, with its zone, that
 * names an instant this test was running in" is exactly the promise. It rules
 * out every wrong answer the op could give — a bare `true`, a day with no
 * time, a UTC `Z` on a machine that is not in UTC (the day would be tomorrow's
 * for anyone east of the line, and the value would not parse back to now).
 */
test("marking done with no clock handed in stamps the current instant", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // Whole seconds: the stamp has no fraction, so it can land a fraction of
      // a second before this test started counting.
      const before = Math.floor(Date.now() / 1000) * 1000
      yield* run(fixture, { op: "done", id: "order" })

      const set = yield* fixture.set()
      const order = set.nodes.find((located) => located.node.id === "order")?.node
      const done = order === undefined || isMirror(order) ? undefined : order.done
      expect(done).toMatch(STAMP_SHAPE)

      const at = new Date(String(done)).getTime()
      expect(at).toBeGreaterThanOrEqual(before)
      expect(at).toBeLessThanOrEqual(Date.now())
    }), { realClock: true }))

test("creating an outline lands a new file the set and the disk both see", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, {
        op: "create",
        file: "notes/ideas.jsonl",
        seed: { title: "an idea" },
      })
      expect(applied).toMatchObject({
        file: "notes/ideas.jsonl",
        title: "an idea",
        summary: "capture: an idea",
        committed: false,
      })

      const text = fixture.read("notes/ideas.jsonl") ?? ""
      expect(text).toContain(`"title":"an idea"`)
      expect(text.endsWith("\n")).toBe(true)

      const set = yield* fixture.set()
      expect([...set.files].sort()).toEqual(["house.jsonl", "notes/ideas.jsonl"])
      expect(set.nodes.some((located) => located.node.id === applied.id)).toBe(true)
    })))

test("creating an empty outline is a zero-byte file the sidebar can list", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "create", file: "empty.jsonl" })
      expect(applied.summary).toBe("create: empty.jsonl")
      expect(fixture.read("empty.jsonl")).toBe("")
      expect((yield* fixture.set()).files).toContain("empty.jsonl")
    })))

test("archiving writes both files, and the set stays valid across them", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "archive", id: "order" })
      expect(applied.file).toBe("Archive.jsonl")

      expect(fixture.read("house.jsonl")).not.toContain(`"order"`)
      const archive = fixture.read("Archive.jsonl") ?? ""
      expect(archive).toContain(`"title":"Kitchen remodel"`)
      expect(archive).toContain(`"id":"order"`)

      // One revision for the pair, not two — the gate renamed both or neither.
      expect(applied.rev).toBe(2)
      const set = yield* fixture.set()
      expect([...set.files].sort()).toEqual(["Archive.jsonl", "house.jsonl"])
    })))

/**
 * The whole claim of a batch capture, and it is only true end to end: thirteen
 * nodes used to be thirteen calls, thirteen revalidations and thirteen commits,
 * with a failure partway through leaving half an outline behind. One call is
 * ONE revision and ONE commit, and the ids it hands back are the ids on disk.
 */
test("a subtree captured in one call is one revision and one commit", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
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
      // One revision for four records: the gate renamed the file once.
      expect(applied.rev).toBe(2)
      expect(applied.captured?.map((node) => node.title)).toEqual([
        "the pantry",
        "shelves",
        "measure",
        "paint",
      ])

      const text = fixture.read("house.jsonl") ?? ""
      expect(Result.isSuccess(parseOutline("house.jsonl", text))).toBe(true)
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(8)

      // The round-trip promise, over the op that rewrites the most records at
      // once: a capture re-emits the WHOLE file, so every line that was already
      // there has to come back as the bytes it was read as — `demo`'s day-only
      // `done` and `install`'s `doing` included. Only the new lines are new.
      expect(text.split("\n").slice(0, 4)).toEqual(HOUSE.trimEnd().split("\n"))

      // The ids in the answer are the ids in the set, which is what makes a
      // second call under one of them possible without a search.
      const set = yield* fixture.set()
      const byId = new Map(set.nodes.map((located) => [located.node.id, located.node]))
      for (const node of applied.captured ?? []) expect(byId.has(node.id)).toBe(true)
      expect(byId.get(applied.captured?.[3]?.id ?? "")).toMatchObject({ done: STAMP })

      expect(gitLog(fixture.root)).toEqual([
        "capture: the pantry (+3)",
        "fixtures",
      ])
    }), { git: true }))

test("a refusal writes nothing and comes back with its structured detail", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "kitchen", undo: true })),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(fixture.read("house.jsonl")).toBe(HOUSE)
      expect((yield* SubscriptionRef.get(fixture.store.snapshot))?.rev).toBe(1)
      // Reported wherever it came from: the observer hangs off the WRITER, so
      // a second caller — the web UI's own procedures, when they arrive — is
      // not a second place to remember to report from.
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
    })))

/**
 * The retry, seen from outside: the op is derived from revision 1, somebody
 * else's edit lands first, and the op still succeeds because "mark `order`
 * done" means the same thing against the newer set. A SUCCEEDING retry is
 * invisible by design — there is nothing in the answer that says it happened,
 * and that is what is being asserted.
 */
test("an edit that arrives mid-write is absorbed, not lost", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // A second outline appears the way a `git pull` would put it there. The
      // store has not probed yet, so the op's first attempt is against a
      // revision the gate's own probe is about to overtake.
      fixture.write("notes.jsonl", `{"id":"idea","ord":"a0","title":"an idea"}\n`)

      const applied = yield* run(fixture, { op: "done", id: "order" })
      const set = yield* fixture.set()
      expect([...set.files].sort()).toEqual(["house.jsonl", "notes.jsonl"])
      expect(
        set.nodes.find((located) => located.node.id === "order")?.node,
      ).toMatchObject({ done: STAMP })
      // The pulled file is still there: the write re-derived rather than
      // re-sending bytes computed from a set that no longer existed.
      expect(fixture.read("notes.jsonl")).toContain("an idea")
      expect(applied.committed).toBe(false)
    })))

test("concurrent ops all land, each re-derived from the set the last one left", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
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
      const byId = new Map(set.nodes.map((located) => [located.node.id, located.node]))
      expect(byId.get("order")).toMatchObject({ done: STAMP })
      expect(byId.get("install")).toMatchObject({ title: "install the cabinets" })
      expect([...byId.values()].some((node) => "title" in node && node.title === "paint"))
        .toBe(true)
    })))

// ── git ────────────────────────────────────────────────────────────────

describe("the auto-commit", () => {
  test("commits each write with racket's message convention", () =>
    withOps({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* run(fixture, { op: "done", id: "order" })).committed).toBe(true)
        expect((yield* run(fixture, { op: "add", parent: "kitchen", title: "paint" }))
          .committed).toBe(true)
        expect((yield* run(fixture, {
          op: "create",
          file: "shed.jsonl",
          seed: { title: "clear the shed" },
        })).committed).toBe(true)
        expect((yield* run(fixture, { op: "archive", id: "install" })).committed).toBe(true)

        expect(gitLog(fixture.root).slice(0, 4)).toEqual([
          "archive: install them",
          "capture: clear the shed",
          "capture: paint",
          "done: order the cabinets",
        ])
        // Both files of the archive landed in ONE commit.
        expect(
          execFileSync("git", ["show", "--name-only", "--format=", "HEAD"], {
            cwd: fixture.root,
            encoding: "utf8",
          }).trim().split("\n").sort(),
        ).toEqual(["Archive.jsonl", "house.jsonl"])
      }), { git: true }))

  test("a directory that is not a work tree is written anyway, and says so", () =>
    withOps({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // `commit: true`, but there is no repository here.
        const ops = Ops.make({ store: fixture.store, root: fixture.root, commit: true })
        const applied = yield* Effect.orDie(ops.run({ op: "done", id: "order" }))
        expect(applied.committed).toBe(false)
        expect(fixture.read("house.jsonl")).toContain(`"done"`)
      })))

  test("the opt-out writes without committing", () =>
    withOps({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const ops = Ops.make({ store: fixture.store, root: fixture.root, commit: false })
        expect((yield* Effect.orDie(ops.run({ op: "done", id: "order" }))).committed)
          .toBe(false)
        expect(gitLog(fixture.root)).toEqual(["fixtures"])
      }), { git: true }))
})

