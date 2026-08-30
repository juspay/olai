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
import {
  bodyOf,
  isMirror,
  type OutlineError,
  type OutlineSet,
  outlinePaths,
  parseOutline,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
import { recordsOf } from "@olai/format/testlib"
import * as Store from "@olai/store"
import { describe, expect, test } from "bun:test"
import { Deferred, Effect, Fiber, Result, SubscriptionRef } from "effect"

import { codec } from "./codec.ts"
import type { Store as OutlineStore } from "./deps.ts"
import { repoAt, STAMP, STAMP_SHAPE, steady } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"
import { fixedPolicy } from "./pending.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","doing":"2026-08-02"}`,
  "",
].join("\n")

/** The same outline with a property on it — what a stamp-only write needs to
 *  be about, since the seam only shows on a node that carries one. */
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
  options: {
    readonly git?: boolean
    readonly realClock?: boolean
    /** `false` inits the repository with an EMPTY identity, which is git's own
     *  "Author identity unknown" — the commit failure a person actually hits,
     *  reproduced without depending on the developer's global config. */
    readonly identity?: boolean
  } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-")))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  if (options.git === true) {
    repoAt(root, ...(options.identity === false ? [{ identity: false }] : []))
  }

  return Effect.gen(function*() {
    const store = yield* Store.make({ root, codec, watch: false, settle: "10 millis" })
    const refusals: Array<string> = []
    const ops = Ops.make({
      store,
      root,
      // `auto` where there is a repository, so what these tests see is the
      // policy a directory with the window on runs under. Nothing commits a
      // write on its own under it — the loop is forked by a composition root
      // and none of these forks one — so a commit here is one this file asked
      // for. The window itself is `./pending.test.ts`'s subject.
      policy: fixedPolicy({ commit: options.git === true ? "auto" : "off", push: null }),
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

/** Run an op, or fail the test with what it refused. */
const run = (
  fixture: Fixture,
  request: Request,
): Effect.Effect<Applied> =>
  Effect.catch(fixture.ops.run(request, "mcp"), (failure) =>
    Effect.die(
      new Error(`\`${request.op}\` was refused: ${failure._tag} — ${failure.message}`),
    ))

const gitLog = (root: string): ReadonlyArray<string> =>
  execFileSync("git", ["log", "--format=%s"], { cwd: root, encoding: "utf8" })
    .trim()
    .split("\n")

// ── what one load holds ────────────────────────────────────────────────

// The codec's seam and the store's, read from the outside as the SET a real
// directory produces: every bodied file is in it, a document brings its text,
// and a `.html` brings its path and a `null` where the bytes used to be. That
// last one is the whole memory claim — a vault of saved pages costs paths — and
// the reference below is the other half of it: `doc` is still checked, so the
// set is still valid or not for the same reasons it was.
test("the shown kinds join the set as paths; a `.md` brings its text", () =>
  withOps(
    {
      "house.olai": `${HOUSE}{"id":"quote","ord":"b0","title":"quote","doc":"notes.md"}\n`,
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
            ["house.olai", "outline", null],
            ["notes.md", "document", "# cabinets\n"],
            ["q3.pdf", "pdf", null],
            ["report.html", "hypertext", null],
            ["sales.csv", "csv", null],
            ["shot.png", "image", null],
          ])
        // THE BYTES ARE NEVER READ, which is what `kept: false` buys and why
        // the two files above hold text no reader of a picture would accept: a
        // probe that opened them would have to decide what to do with that,
        // and it does not open them at all.
        // The set loaded, which is what says the `doc` above resolved against
        // the documents found: a reference is checked against PATHS, and those
        // are the half this keeps for every bodied file.
        expect(set.broken).toEqual([])
        // And the bytes are still there for whoever asks for them — read from
        // the disk on demand, held by nobody. That read is the `.csv` page's
        // as well as the saved page's; a picture and a `.pdf` have one only in
        // the sense that any path does, since what draws those points a
        // browser at `/media/` instead.
        expect(yield* Effect.orDie(fixture.store.body("report.html"))).toBe(
          "<h1>Cabinet quote</h1>\n",
        )
        expect(yield* Effect.orDie(fixture.store.body("sales.csv"))).toBe(
          "region,units\nnorth,12\n",
        )
      }),
  ))

// ── the write path ─────────────────────────────────────────────────────

test("PIN (idle): idle is already true when nothing is writing", () =>
  withOps({ "house.olai": HOUSE }, (fixture) => fixture.ops.idle))

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
    const ops = Ops.make({
      store: gated,
      root,
      policy: fixedPolicy({ commit: "off", push: null }),
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

      const parsed = parseOutline("house.olai", text)
      expect(Result.isSuccess(parsed)).toBe(true)

      // And the browser sees it: the snapshot moved, without anyone probing.
      const set = yield* fixture.set()
      const order = recordsOf(set).find((located) => located.node.id === "order")
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
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // Whole seconds: the stamp has no fraction, so it can land a fraction of
      // a second before this test started counting.
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

/**
 * The last hole in the atomicity claim, closed on disk.
 *
 * A new outline used to be `create` then `add_node` — two plans, two gates, two
 * commits — so a second call that refused left an EMPTY outline behind that
 * nobody had asked for. The seed is a whole capture now: one plan, one
 * validation, one rename, and a refusal costs nothing at all, which is only
 * checkable where the file system is.
 */
test("a new outline arrives holding its whole tree, or does not arrive", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // Refused: the seed names an id the set already holds, two levels down.
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
      // Not an empty outline, not a partial one: no file.
      expect(fixture.read("shed.olai")).toBeNull()
      expect(outlinePaths(yield* fixture.set())).toEqual(["house.olai"])
      expect(gitLog(fixture.root)).toEqual(["fixtures"])
      // And the outline that WAS there is untouched, byte for byte.
      expect(fixture.read("house.olai")).toBe(HOUSE)

      // The same call with the collision fixed lands all of it at once.
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
      expect(Result.isSuccess(parseOutline("shed.olai", text))).toBe(true)
      expect(fixture.read("house.olai")).toBe(HOUSE)

      // ONE REVISION for a file and everything in it — and nothing in the log
      // yet, because no write commits itself: what records is the quiet window
      // over the whole repository (`./pending.test.ts`).
      expect(applied.rev).toBe(2)
      expect(gitLog(fixture.root)).toEqual(["fixtures"])
    }), { git: true }))

test("creating an empty outline is a zero-byte file the sidebar can list", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "create", file: "empty.olai" })
      expect(applied.summary).toBe("create: empty.olai")
      expect(fixture.read("empty.olai")).toBe("")
      expect(outlinePaths(yield* fixture.set())).toContain("empty.olai")
    })))

// The published set is in LISTING order, which is path order — what
// `list_outlines` answers with and what a search tie breaks on. A create is the
// one write that can put a file at the FRONT of that order, and it is the case
// where the gate's own candidate map disagrees with the listing: the candidate
// is what the last probe held with the new path appended, so a file sorting
// before an existing one lands last there and first here. The gate must not
// publish the candidate's order for the listing's.
test("a created file sorting before an existing one is published in path order", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "create", file: "_olai/Trash.olai" })
      expect(outlinePaths(yield* fixture.set())).toEqual(["_olai/Trash.olai", "house.olai"])
      // And the flat node list follows the same order, which is what a search
      // tie reads: every record of the earlier file comes first.
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

      // One revision for the pair, not two — the gate renamed both or neither.
      expect(applied.rev).toBe(2)
      const set = yield* fixture.set()
      expect([...outlinePaths(set)].sort()).toEqual(["_olai/Trash.olai", "house.olai"])
    })))

/**
 * The whole claim of a batch capture, and it is only true end to end: thirteen
 * nodes used to be thirteen calls, thirteen revalidations and thirteen commits,
 * with a failure partway through leaving half an outline behind. One call is
 * ONE revision and ONE commit, and the ids it hands back are the ids on disk.
 */
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
      // One revision for four records: the gate renamed the file once.
      expect(applied.rev).toBe(2)
      expect(applied.captured?.map((node) => node.title)).toEqual([
        "the pantry",
        "shelves",
        "measure",
        "paint",
      ])

      const text = fixture.read("house.olai") ?? ""
      expect(Result.isSuccess(parseOutline("house.olai", text))).toBe(true)
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(8)

      // The round-trip promise, over the op that rewrites the most records at
      // once: a capture re-emits the WHOLE file, so every line that was already
      // there has to come back as the bytes it was read as — `demo`'s day-only
      // `done` and `install`'s `doing` included. Only the new lines are new.
      expect(text.split("\n").slice(0, 4)).toEqual(HOUSE.trimEnd().split("\n"))

      // The ids in the answer are the ids in the set, which is what makes a
      // second call under one of them possible without a search.
      const set = yield* fixture.set()
      const byId = new Map(recordsOf(set).map((located) => [located.node.id, located.node]))
      for (const node of applied.captured ?? []) expect(byId.has(node.id)).toBe(true)
      expect(byId.get(applied.captured?.[3]?.id ?? "")).toMatchObject({ done: STAMP })

      // ONE REVISION for the whole subtree, and nothing in the log yet: a
      // write waits, whichever mode this directory is in.
      expect(gitLog(fixture.root)).toEqual(["fixtures"])
    }), { git: true }))

test("a refusal writes nothing and comes back with its structured detail", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "kitchen", undo: true }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(fixture.read("house.olai")).toBe(HOUSE)
      expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
      // Reported wherever it came from: the observer hangs off the WRITER, so
      // a second caller — the web UI's own procedures, when they arrive — is
      // not a second place to remember to report from.
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
    })))

/**
 * A `set_prop` of the value a node already holds is a refusal, and the point is
 * the BYTES: nothing lands, so nothing is stamped, so git sees nothing.
 *
 * The planner's own test says it is refused; this says what that buys. Before
 * the guard the write landed — the record was rewritten with a fresh `changed`
 * — and every face then told a different story: git called the tree dirty, the
 * pending panel listed nothing (it does not compare stamps, on purpose), and the
 * transcript claimed an edit. Disclosed by opencode in review of #179, and the
 * one assertion that covers all three is that the file did not move.
 */
test("a set_prop of the value already held writes nothing at all", () =>
  withOps({ "house.olai": PROPPED }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(
          fixture.ops.run({ op: "prop", id: "order", key: "pr", value: "https://x/1" }, "mcp"),
        ),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("nothing would change")
      // Byte for byte, including the stamp that would otherwise have been put
      // there — and the store never moved, so nothing downstream was told a
      // revision happened.
      expect(fixture.read("house.olai")).toBe(PROPPED)
      expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
    })))

test("a set_prop that DOES change something lands, and stamps the write", () =>
  withOps({ "house.olai": PROPPED }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "prop", id: "order", key: "pr", value: "https://x/2" })
      const written = fixture.read("house.olai")
      expect(written).toContain(`"custom":{"pr":"https://x/2"}`)
      expect(written).toContain(`"changed":`)
    })))

/**
 * The retry, seen from outside: the op is derived from revision 1, somebody
 * else's edit lands first, and the op still succeeds because "mark `order`
 * done" means the same thing against the newer set. A SUCCEEDING retry is
 * invisible by design — there is nothing in the answer that says it happened,
 * and that is what is being asserted.
 */
test("an edit that arrives mid-write is absorbed, not lost", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // A second outline appears the way a `git pull` would put it there. The
      // store has not probed yet, so the op's first attempt is against a
      // revision the gate's own probe is about to overtake.
      fixture.write("notes.olai", `{"id":"idea","ord":"a0","title":"an idea"}\n`)

      const applied = yield* run(fixture, { op: "done", id: "order" })
      const set = yield* fixture.set()
      expect([...outlinePaths(set)].sort()).toEqual(["house.olai", "notes.olai"])
      expect(
        recordsOf(set).find((located) => located.node.id === "order")?.node,
      ).toMatchObject({ done: STAMP })
      // The pulled file is still there: the write re-derived rather than
      // re-sending bytes computed from a set that no longer existed.
      expect(fixture.read("notes.olai")).toContain("an idea")
    })))

/**
 * The other half of that retry, and the half a condition exists for.
 *
 * "Mark `order` done" means the same thing against the newer set, so the retry
 * absorbs it. "Set this title back to what it said, ASSUMING it still says
 * what I read" does not: if the thing it assumed stopped being true while the
 * write was in flight, re-planning it would write over somebody's words.
 *
 * The interleaving is the same one the test above sets up — the file changes
 * before the gate's own probe — so the request is planned once against a
 * snapshot where the condition holds and again against one where it does not.
 * Either attempt may be the one that sees the new title, and BOTH must refuse:
 * that is what makes this a fence rather than a race.
 */
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
      // And the other writer's words are still on disk, which is the claim.
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

// ── git ────────────────────────────────────────────────────────────────

/**
 * The git seam at THIS layer: what a write says about the history it is not in
 * yet, and what a commit somebody asked for puts there.
 *
 * These used to be the `--commit=auto` scenarios and asserted `committed: true`
 * on each write. That mode is retired — nothing commits a write inside the
 * write gate any more — so the same properties are asserted about a commit
 * ASKED for, which is the only kind there is: one prefix, one sweep, and a
 * refusal that lands where a reader can see it. The quiet window that makes
 * those commits unasked-for is `./pending.test.ts`.
 */
describe("the git seam", () => {
  /** Everything waiting, committed, or the test dies naming what git said —
   *  the sweep this layer makes for the button, the tool and the window
   *  alike. */
  const sweep = (fixture: Fixture): Effect.Effect<void> =>
    Effect.flatMap(fixture.ops.commit({}, "mcp"), (done) =>
      done._tag === "Committed"
        ? Effect.void
        : Effect.die(new Error(`the commit did not land: ${JSON.stringify(done)}`)))

  test("a commit carries olai's message convention, and sweeps what is waiting", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, { op: "done", id: "order" })
        yield* sweep(fixture)
        yield* run(fixture, { op: "add", parent: "kitchen", title: "paint" })
        yield* sweep(fixture)
        yield* run(fixture, {
          op: "create",
          file: "shed.olai",
          seed: { title: "clear the shed" },
        })
        yield* sweep(fixture)
        yield* run(fixture, { op: "trash", id: "install" })
        yield* sweep(fixture)

        // Every subject carries the `olai` prefix, which IS the audit filter:
        // `git log --grep '^olai'` is the view of what the tool wrote, and
        // `--invert-grep` gives back the repository's real history.
        // The SUBJECT is composed from what the sweep found rather than from
        // the op that produced it, which is the difference between a commit
        // per write and a commit per piece of work — but the prefix is the
        // same, because the audit filter is the whole reason it exists.
        expect(gitLog(fixture.root).slice(0, 4)).toEqual([
          "olai: 3 edits to Trash — house.olai created",
          "olai: 1 edit to shed — clear the shed created",
          "olai: 1 edit to house — paint created",
          "olai: 1 edit to house — order the cabinets done",
        ])
        // Both files of the archive landed in ONE commit.
        expect(
          execFileSync("git", ["show", "--name-only", "--format=", "HEAD"], {
            cwd: fixture.root,
            encoding: "utf8",
          }).trim().split("\n").sort(),
        ).toEqual(["_olai/Trash.olai", "house.olai"])
      }), { git: true }))

  test("a write says it is waiting for the window, and git reads healthy", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* run(fixture, { op: "done", id: "order" })
        expect(applied.why).toContain("--commit=auto")
        expect(yield* fixture.ops.git).toMatchObject({
          status: "repo",
          said: null,
          pushSaid: null,
          paused: null,
          pinned: { commit: "auto", push: null },
          policy: { commit: "auto", push: "off" },
        })
      }), { git: true }))

  test("a directory that is not a work tree is written anyway, and says why", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // `commits: "auto"`, but there is no repository here.
        const ops = Ops.make({
          store: fixture.store,
          root: fixture.root,
          policy: fixedPolicy({ commit: "auto", push: null }),
        })
        const applied = yield* Effect.orDie(ops.run({ op: "done", id: "order" }, "mcp"))
        // The half that was missing: "not committed" on its own is six
        // different pieces of news, and this is the one that says which.
        expect(applied.why).toContain("not a git work tree")
        expect(yield* ops.git).toMatchObject({
          status: "none",
          said: null,
          pinned: { commit: "auto", push: null },
        })
        expect(fixture.read("house.olai")).toContain(`"done"`)
      })))

  /**
   * The bug, end to end: a repository whose next commit cannot be made.
   *
   * The write lands — that is the guarantee, and no part of this may fail,
   * delay or retry it — and everything the reader needs arrives with the
   * COMMIT: the answer says why in git's own words, and the state the server
   * publishes goes to `error`, which is what puts "Git error" in the app header
   * instead of nothing at all.
   *
   * This is the case that CANNOT be derived from a probe, which is why the
   * refusal is one of the things `./pending.ts` remembers: `rev-parse` answers
   * perfectly happily in a repository with no identity, so a state derived from
   * the directory alone would read healthy while every commit failed.
   */
  test("a git that refuses the commit lands the write, says why, and turns the state", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, { op: "done", id: "order" })
        const done = yield* fixture.ops.commit({}, "mcp")

        expect(done).toMatchObject({ _tag: "Failed" })
        expect(fixture.read("house.olai")).toContain(`"done"`)
        // Nothing was refused: a git failure is not an op failure.
        expect(fixture.refusals).toEqual([])
        // Still the repository's own history, with nothing new in it.
        expect(gitLog(fixture.root)).toEqual(["fixtures"])

        const state = yield* fixture.ops.git
        expect(state.status).toBe("error")
        expect(state.said).toContain("identity")
        // ... and the loop is stopped, because this directory's policy is the
        // window and a window that went round again would be a blind retry.
        expect(state.paused).not.toBeNull()
      }), { git: true, identity: false }))

  test("a git that recovers takes the state back to healthy", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, { op: "done", id: "order" })
        yield* fixture.ops.commit({}, "mcp")
        expect((yield* fixture.ops.git).status).toBe("error")

        // The identity the repository was missing, set the way a person would.
        execFileSync("git", ["config", "user.email", "test@olai.invalid"], {
          cwd: fixture.root,
          stdio: "ignore",
        })
        execFileSync("git", ["config", "user.name", "olai tests"], {
          cwd: fixture.root,
          stdio: "ignore",
        })

        yield* run(fixture, { op: "add", parent: "kitchen", title: "paint" })
        yield* sweep(fixture)
        // Cleared by the thing that worked, which is the other half of
        // remembering it: a refusal that outlived its cause would be a header
        // shouting about a repository that is fine now. The STOP is not
        // cleared with it — that is a person's to lift, through `resume`.
        const state = yield* fixture.ops.git
        expect(state.status).toBe("repo")
        expect(state.said).toBeNull()
      }), { git: true, identity: false }))

  /**
   * The default mode, at this seam: a write LANDS and WAITS, and the sentence
   * it carries back says exactly that.
   *
   * The whole of `Applied.why` under `manual` is that it must not read as a
   * fault. "Not committed" is six different pieces of news — the opt-out, no
   * repository, a git that refuses, a busy one, the window, and this one — and
   * this one is the feature working. A reader who saw the git-error wording
   * here would go looking for a broken repository that is not broken.
   */
  test("a write under the default mode waits, and says so without sounding broken", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const ops = Ops.make({
          store: fixture.store,
          root: fixture.root,
          policy: fixedPolicy({ commit: "manual", push: null }),
          context: steady(),
        })
        const applied = yield* Effect.orDie(ops.run({ op: "done", id: "order" }, "mcp"))

        expect(applied.why).toContain("waiting to be committed")
        // Not a fault, in either vocabulary: nothing about git failing, and the
        // readout stays healthy.
        expect(applied.why).not.toContain("could not")
        expect(applied.why).not.toContain("refused")
        expect(yield* ops.git).toMatchObject({
          status: "repo",
          said: null,
          pinned: { commit: "manual", push: null },
          policy: { commit: "manual", push: "off" },
        })
        // The write is on disk, and nothing is in the log yet.
        expect(fixture.read("house.olai")).toContain(`"done"`)
        expect(gitLog(fixture.root)).toEqual(["fixtures"])
      }), { git: true }))

  test("the opt-out writes without committing, and says that is why", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const ops = Ops.make({
          store: fixture.store,
          root: fixture.root,
          policy: fixedPolicy({ commit: "off", push: null }),
        })
        const applied = yield* Effect.orDie(ops.run({ op: "done", id: "order" }, "mcp"))
        expect(applied.why).toContain("--commit=off")
        expect(gitLog(fixture.root)).toEqual(["fixtures"])
        // `off` without asking git anything: the opt-out is a state, not a
        // probe that came back empty — which is what keeps olai out of the
        // history of a directory whose history is somebody else's job.
        expect(yield* ops.git).toMatchObject({
          status: "off",
          said: null,
          pinned: { commit: "off", push: null },
        })
      }), { git: true }))
})


// ── a batch on the disk ────────────────────────────────────────────────

/**
 * What batching is actually FOR, at the only level where the claim can be made.
 *
 * {@link ./batch.test.ts} proves that a run of ops decides what the same ops
 * decide one at a time. Neither of the two properties that make it worth having
 * is visible there, because both are about what reaches a disk: one revision for
 * the whole run, and a refused run leaving the file byte for byte as it was.
 */
describe("apply, against a real directory", () => {
  test("a batch of three ops moves the store ONE revision", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // The load is revision 1, so a single write lands at 2. Three ops in a
        // batch land at 2 as well — which is the whole claim: one plan, one
        // validation, one rename, one publication. Three calls would have been
        // 2, 3 and 4, and three frames to every open page.
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
        // Still one record per line, read back by the parser that wrote it.
        expect(Result.isSuccess(parseOutline("house.olai", text))).toBe(true)
      })))

  test("a batch refused halfway leaves the file untouched, byte for byte", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const before = fixture.read("house.olai")
        // The three are chosen so op 2 can only refuse for a reason ops 0 and 1
        // MADE. `install` arrives `doing` and `order` arrives a bullet, so
        // against the set this call was handed, `kitchen` holds exactly one
        // unfinished task and it is `install`. Op 0 finishes it; op 1 turns the
        // bullet into a task, which is unfinished work that did not exist a
        // moment ago; op 2 is refused NAMING THAT — a sentence no
        // implementation that planned each op against the arriving set could
        // produce, since `order` is not work there at all.
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
          // …and NOT the one the arriving set would have named.
          expect(outcome.failure.message).not.toContain("`install them`")
        }
        // Nothing landed — not the two ops that would have, not a stamp, not a
        // rewritten line. The bytes are the bytes.
        expect(fixture.read("house.olai")).toBe(before)
        // …and the store never moved, so no open page saw a half-run.
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
        // The run's own summary is still what a batch composes for itself —
        // it is what the reply and the chat transcript read — but it is no
        // longer a commit subject: nothing commits a write any more, so the
        // batch waits with everything else for the sweep.
        expect(applied.summary).toContain("apply: 2 ops")
        expect(applied.rev).toBe(2)
        expect(gitLog(fixture.root)).toEqual(["fixtures"])
      }), { git: true }))

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
        // The whole set still validates — the forward reference resolved to a
        // record in the same write, which is what makes it legal at all.
        const set = yield* fixture.set()
        expect(set.broken).toEqual([])
      })))
})

/**
 * WRITES DEGRADE PER FILE, the way reads have since 2026-08-09.
 *
 * The bug (`broken-file-blocks-healthy-writes`, sighted 2026-08-25): one
 * outline failing typed validation refused an `add_node` into a perfectly
 * healthy file — the gate reduced the whole set's verdict to one boolean, so
 * every write in the vault was frozen by a file it had nothing to do with, and
 * the refusal said "would leave the outlines invalid", which reads as an
 * indictment of a write that was innocent. Filing THAT BUG was blocked by it.
 *
 * The socket is `@olai/format`'s `admits` and the seam is the store's
 * (`@olai/store`'s `Codec.admits`, spent by `commit`); what is only true END TO
 * END is here — that the bytes land, that the brokenness is still reported
 * beside the success, and that the writes which must still be refused are
 * refused with the file named.
 */
describe("a broken file beside a healthy one", () => {
  /** A second outline, valid on its own — what the healthy write goes into. */
  const GARDEN = `{"id":"garden","ord":"a0","title":"the garden"}\n`

  /** The same file, saying something the set cannot hold: an edge naming an id
   *  nothing in the directory declares. It PARSES — that is the point, since a
   *  file that merely failed to parse has degraded gracefully for a year. */
  const DANGLING =
    `{"id":"garden","ord":"a0","title":"the garden","see":["nobody-declares-this"]}\n`

  /** Break `garden.olai` on disk and let the store see it: the snapshot stays
   *  where it was, and the errors channel carries the verdict. */
  const breakGarden = (fixture: Fixture) =>
    Effect.gen(function*() {
      fixture.write("garden.olai", DANGLING)
      yield* Effect.orDie(fixture.store.refresh("cheap"))
      const errors = yield* SubscriptionRef.get(fixture.store.errors)
      expect(errors?.findings.map((one) => one.code)).toEqual(["unknown-target"])
    })

  test("a write to the healthy file lands, and the broken one goes on being broken", () =>
    withOps(
      { "house.olai": HOUSE, "garden.olai": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)

          const applied = yield* run(fixture, { op: "done", id: "order" })
          // THE BYTES ARE ON DISK. Under the old gate this write was refused
          // outright and nothing was written at all.
          expect(fixture.read("house.olai")).toContain(`"done":${JSON.stringify(STAMP)}`)
          // The revision does NOT move, and that is the honest answer rather
          // than a wart: the served set still does not validate, so the last
          // good snapshot is still what every reader is reading.
          expect(applied.rev).toBe(1)
          expect(fixture.refusals).toEqual([])

          // …and the brokenness is reported BESIDE the success rather than in
          // place of it, which is the sentence the bug asked for.
          const errors = yield* SubscriptionRef.get(fixture.store.errors)
          expect(errors?.findings.map((one) => one.file)).toEqual(["garden.olai"])
        }),
    ))

  // THE OTHER HALF of the same narrowing — a write the verdict IS about, still
  // refused and now naming the file — is asserted where it can be reached end
  // to end through a real agent call: `@olai/server`'s `tools.test.ts`, whose
  // typed-property fixture makes a `move_node` break a file it does not write.
  // Reaching it from here would mean a second copy of that fixture, and the
  // sentence is the same sentence.

  /**
   * THE GUARD THAT MAKES THE NARROWING SAFE, and it is the reason `admits` is
   * not the whole of the store's question.
   *
   * A write is planned against the SNAPSHOT, and while the set will not
   * validate the snapshot does not move — so the second write to a file the
   * first one already changed would be planned off a copy without the first
   * write in it, and would put that copy back. The store refuses exactly that:
   * a path the published revision no longer accounts for cannot be written from
   * it ({@link ../../store/src/store.ts}'s `commit`), and the refusal names the
   * paths so the reader knows which file to look at.
   */
  test("a second write to the same file, over a frozen snapshot, is refused rather than losing the first", () =>
    withOps(
      { "house.olai": HOUSE, "garden.olai": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)
          yield* run(fixture, { op: "done", id: "order" })
          const landed = fixture.read("house.olai") ?? ""

          const failure = yield* Effect.orDie(
            Effect.flip(
              fixture.ops.run({ op: "title", id: "install", title: "install them" }, "mcp"),
            ),
          )
          expect(failure._tag).toBe("ValidationFailure")
          expect(failure.message).toContain("`house.olai`")
          // The first write is still there, which is the whole of what this
          // refusal buys.
          expect(fixture.read("house.olai")).toBe(landed)
        }),
    ))

  // And the freeze really does lift: fixing the broken file publishes again,
  // with the admitted write in the set the way any other write would be.
  test("the admitted write is in the set the moment the broken file is fixed", () =>
    withOps(
      { "house.olai": HOUSE, "garden.olai": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)
          yield* run(fixture, { op: "done", id: "order" })

          fixture.write("garden.olai", GARDEN)
          yield* Effect.orDie(fixture.store.refresh("cheap"))
          expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()

          const set = yield* fixture.set()
          const done = recordsOf(set).find((at) => at.node.id === "order")?.node
          expect(done !== undefined && !isMirror(done) ? done.done : undefined).toBe(STAMP)
        }),
    ))
})

/**
 * A bad `type` in a Properties declaration used to pass the planner and meet
 * the generic write gate — "`capture: took` would leave `_olai/Properties.olai`
 * invalid" — which named nothing. The planner now refuses as `usage`, naming
 * the legal kinds, so this layer never reaches that sentence.
 */
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

/**
 * THE INCIDENT, replayed: declaring a key over unfit values used to land
 * (`admits` ignored `bad-prop` findings on other files) and took the vault
 * into last-good. The declaration now refuses at the planner, naming the
 * offenders; one `apply` cleans them; the declaration then accepts.
 */
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

  test("add_node of the declaration refuses, naming file + node + value", () =>
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

  /**
   * Declare-blocked cleanup of the last-good trap: a hand-edited declaration
   * is already on disk, the snapshot is frozen, and a single `set_prop` of
   * one of several bad values in one file is refused (the file still has
   * the others). One `apply` that fixes them all lands.
   */
  test("a hand-edited declaration: one apply repairs the file, a single write does not", () =>
    withOps(FILES, (fixture) =>
      Effect.gen(function*() {
        fixture.write(
          "_olai/Properties.olai",
          `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n` +
            `{"id":"prop-brief","ord":"a1","title":"brainstorm","custom":{"type":"doc"}}\n`,
        )
        yield* Effect.orDie(fixture.store.refresh("cheap"))
        const errors = yield* SubscriptionRef.get(fixture.store.errors)
        expect(errors?.findings.map((one) => one.code)).toEqual([
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
        expect(one._tag).toBe("ValidationFailure")
        expect(one.message).toContain("lanes.olai")

        yield* run(fixture, {
          op: "apply",
          ops: [
            { op: "prop", id: "a", key: "brainstorm", value: "briefs/one.md" },
            { op: "prop", id: "b", key: "brainstorm", value: "briefs/two.md" },
            { op: "prop", id: "c", key: "brainstorm", value: "briefs/three.md" },
          ],
        })
        expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
        expect(fixture.read("lanes.olai")).toContain("briefs/one.md")
        expect(fixture.read("lanes.olai")).toContain("briefs/two.md")
        expect(fixture.read("lanes.olai")).toContain("briefs/three.md")
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

/**
 * A write-door the load would refuse: moving a `ref` VARIANT into a file
 * that does not hold the values pointing at it. The planner builds it; the
 * gate used to admit it (`admits` saw findings only on the unwritten file).
 * From a loading directory that write is this write's, and is refused.
 */
test("moving a ref variant into a third file is refused, and nothing lands", () =>
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
        const lanes = fixture.read("lanes.olai")
        const garden = fixture.read("garden.olai")
        const failure = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({ op: "move", id: "claude", parent: "garden" }, "mcp"),
          ),
        )
        expect(failure._tag).toBe("ValidationFailure")
        expect(failure.message).toContain("lanes.olai")
        expect(fixture.read("agents.olai")).toBe(agents)
        expect(fixture.read("lanes.olai")).toBe(lanes)
        expect(fixture.read("garden.olai")).toBe(garden)
      }),
  ))
