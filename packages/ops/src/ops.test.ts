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
  admits,
  bodyOf,
  implicatedBy,
  isMirror,
  isRegular,
  markdownIn,
  type OutlineError,
  type OutlineSet,
  NO_KINDS,
  outlinePaths,
  parseOutline,
  verdictOf,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
import { orgFixture, recordsOf } from "@olai/format/testlib"
import * as Store from "@olai/store"
import { replaceBehindTheStamps as replaceRawBehindTheStamps } from "@olai/store/testlib"
import { describe, expect, test } from "bun:test"
import { Deferred, Effect, Fiber, Result, SubscriptionRef } from "effect"

import { codecFor } from "./codec.ts"
import type { Store as OutlineStore } from "./deps.ts"
import { repoAt, STAMP, STAMP_SHAPE, steady } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"
import { fixedPolicy } from "./pending.ts"

/** The codec this suite validates through — the vocabulary of a build that
 *  composed no plugin, which is what every test in this package runs under
 *  ({@link ./codec.ts}'s `codecFor`, and `@olai/format`'s `NO_KINDS`). */
const codec = codecFor(NO_KINDS)

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
  /** Physical bytes. New storage tests assert on this; older behavioral
   * fixtures keep using their compact logical-record view through `read`. */
  readonly raw: (file: string) => string | null
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
  // `unknown`, because a test yields whatever it needs to: the direct store
  // calls some of these make fail with `PlatformFailure` on a tired disk, and
  // a test that fails is a failing test whichever channel it came out of —
  // enumerating them here would be a list to maintain. Matches
  // `@olai/store`'s own fixture.
  use: (fixture: Fixture) => Effect.Effect<A, unknown>,
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
    fs.writeFileSync(path.join(root, file), file.endsWith(".org") ? orgFixture(contents) : contents)
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
    const raw = (file: string): string | null => {
      const at = path.join(root, file)
      return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null
    }
    return yield* use({
      ops,
      store,
      root,
      write,
      refusals,
      raw,
      read: (file) => {
        const contents = raw(file)
        if (contents === null || !file.endsWith(".org")) return contents
        const parsed = parseOutline(file, contents)
        return Result.isFailure(parsed)
          ? contents
          : parsed.success.nodes.map(({ node }) => JSON.stringify(node)).join("\n") +
            (parsed.success.nodes.length === 0 ? "" : "\n")
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

/** Stamp-preserving external edits in these tests are still written as
 * compact logical records. Convert at the fixture boundary, never in product
 * parsing. */
const replaceBehindTheStamps = (root: string, file: string, contents: string): void => {
  let replacement = file.endsWith(".org") ? orgFixture(contents) : contents
  if (file.endsWith(".org")) {
    const current = fs.readFileSync(path.join(root, file), "utf8")
    const padding = Buffer.byteLength(current) - Buffer.byteLength(replacement)
    // The old compact fixtures could choose equal-size JSON records directly.
    // Org repeats the human title in the heading face, so preserve the same
    // stamp-blind replacement by padding that non-authoritative face.
    if (padding > 0) replacement = replacement.replace("\n", `${" ".repeat(padding)}\n`)
  }
  replaceRawBehindTheStamps(root, file, replacement)
}

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
      "house.org": `${HOUSE}{"id":"quote","ord":"b0","title":"quote","doc":"notes.md"}\n`,
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
            ["house.org", "outline", null],
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

test("Org2 storage survives create, property, subtree move, mirror, and write guards", () =>
  withOps({}, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, {
        op: "create",
        file: "project.org",
        seed: {
          id: "root",
          title: "Root",
          children: [{
            id: "child",
            title: "Child",
            children: [{ id: "grandchild", title: "Grandchild" }],
          }],
        },
      })
      yield* run(fixture, {
        op: "create",
        file: "other.org",
        seed: { id: "other", title: "Other" },
      })
      yield* run(fixture, {
        op: "prop",
        id: "child",
        key: "pr",
        value: "https://example.test/1",
      })
      yield* run(fixture, { op: "move", id: "child", parent: "other" })
      const mirrored = yield* run(fixture, {
        op: "mirror",
        id: "child-here",
        target: "child",
        parent: "root",
      })
      expect(mirrored.id).toBe("child-here")

      const set = yield* fixture.set()
      const nodes = recordsOf(set).map(({ node }) => node)
      expect(nodes.find(({ id }) => id === "child")).toMatchObject({
        parent: "other",
        custom: { pr: "https://example.test/1" },
      })
      expect(nodes.find(({ id }) => id === "grandchild")).toMatchObject({
        parent: "child",
      })
      expect(nodes.find(({ id }) => id === "child-here")).toMatchObject({
        parent: "root",
        mirror: "child",
      })

      const project = fixture.raw("project.org") ?? ""
      const other = fixture.raw("other.org") ?? ""
      expect(project).toContain("* Root")
      expect(project).toContain("** mirror of child")
      expect(project).toContain(":OLAI_MIRROR: \"child\"")
      expect(other).toContain("* Other")
      expect(other).toContain("** Child")
      expect(other).toContain("*** Grandchild")
      expect(other).toContain(
        ':OLAI_CUSTOM: {"pr":"https://example.test/1"}',
      )
      expect(`${project}\n${other}`).not.toContain('{"id"')

      const beforeRefusal = yield* fixture.store.read("cheap")
      const beforeRefusalRev = beforeRefusal.snapshot?.rev ?? 0
      const malformed = other.replace(
        /:OLAI_TITLE: .+\n/,
        ":OLAI_TITLE: not-json\n",
      )
      const refused = yield* fixture.store.commit({
        baseRev: beforeRefusalRev,
        changes: [{ path: "other.org", contents: malformed }],
      })
      expect(Result.isFailure(refused)).toBe(true)
      expect(fixture.raw("other.org")).toBe(other)

      const childRevised = other
        .replace("** Child\n", "** Child revised\n")
        .replace(':OLAI_TITLE: "Child"', ':OLAI_TITLE: "Child revised"')
      const first = yield* fixture.store.commit({
        baseRev: beforeRefusalRev,
        changes: [{ path: "other.org", contents: childRevised }],
      })
      expect(Result.isSuccess(first)).toBe(true)

      const stale = yield* Effect.result(fixture.store.commit({
        baseRev: beforeRefusalRev,
        changes: [{ path: "other.org", contents: other }],
      }))
      expect(Result.isFailure(stale)).toBe(true)
      if (Result.isFailure(stale)) expect(stale.failure._tag).toBe("StaleWrite")
      expect(fixture.raw("other.org")).toBe(childRevised)
    })))

test("PIN (idle): idle is already true when nothing is writing", () =>
  withOps({ "house.org": HOUSE }, (fixture) => fixture.ops.idle))

test("PIN (idle): idle does not complete while a run is in the gate", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-idle-")))
  fs.writeFileSync(path.join(root, "house.org"), orgFixture(HOUSE))
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
    expect(applied).toMatchObject({ id: "order", file: "house.org" })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
})

test("a mark lands on disk as bytes the parser reads back", () =>
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "done", id: "order" })
      expect(applied).toMatchObject({ id: "order", file: "house.org", rev: 2 })

      const text = fixture.read("house.org") ?? ""
      expect(text.endsWith("\n")).toBe(true)
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(4)

      const parsed = parseOutline("house.org", fixture.raw("house.org") ?? "")
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
    "house.org": [
      `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
      `{"id":"old","parent":"kitchen","ord":"a0","title":"an old habit","done":true}`,
      `{"id":"quote","parent":"kitchen","ord":"a1","title":"get a quote","done":"2026-08-01"}`,
      `{"id":"order","parent":"kitchen","ord":"a2","title":"order the cabinets"}`,
      "",
    ].join("\n"),
  }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "done", id: "order" })

      const text = fixture.read("house.org") ?? ""
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
  withOps({ "house.org": HOUSE }, (fixture) =>
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
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, {
        op: "create",
        file: "notes/ideas.org",
        seed: { title: "an idea" },
      })
      expect(applied).toMatchObject({
        file: "notes/ideas.org",
        title: "an idea",
        summary: "capture: an idea",
      })

      const text = fixture.read("notes/ideas.org") ?? ""
      expect(text).toContain(`"title":"an idea"`)
      expect(text.endsWith("\n")).toBe(true)

      const set = yield* fixture.set()
      expect([...outlinePaths(set)].sort()).toEqual(["house.org", "notes/ideas.org"])
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
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // Refused: the seed names an id the set already holds, two levels down.
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({
          op: "create",
          file: "shed.org",
          seed: {
            title: "The shed",
            children: [{ title: "clear it out", children: [{ title: "x", id: "order" }] }],
          },
        }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      // Not an empty outline, not a partial one: no file.
      expect(fixture.read("shed.org")).toBeNull()
      expect(outlinePaths(yield* fixture.set())).toEqual(["house.org"])
      expect(gitLog(fixture.root)).toEqual(["fixtures"])
      // And the outline that WAS there is untouched, byte for byte.
      expect(fixture.read("house.org")).toBe(HOUSE)

      // The same call with the collision fixed lands all of it at once.
      const applied = yield* run(fixture, {
        op: "create",
        file: "shed.org",
        seed: {
          title: "The shed",
          children: [{ title: "clear it out", children: [{ title: "the paint tins" }] }],
        },
      })
      expect(applied.summary).toBe("capture: The shed (+2)")
      expect(applied.captured).toHaveLength(3)
      const text = fixture.read("shed.org") ?? ""
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(3)
      expect(Result.isSuccess(parseOutline("shed.org", fixture.raw("shed.org") ?? ""))).toBe(true)
      expect(fixture.read("house.org")).toBe(HOUSE)

      // ONE REVISION for a file and everything in it — and nothing in the log
      // yet, because no write commits itself: what records is the quiet window
      // over the whole repository (`./pending.test.ts`).
      expect(applied.rev).toBe(2)
      expect(gitLog(fixture.root)).toEqual(["fixtures"])
    }), { git: true }))

test("creating an empty outline is a zero-byte file the sidebar can list", () =>
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "create", file: "empty.org" })
      expect(applied.summary).toBe("create: empty.org")
      expect(fixture.read("empty.org")).toBe("")
      expect(outlinePaths(yield* fixture.set())).toContain("empty.org")
    })))

// The published set is in LISTING order, which is path order — what
// `list_outlines` answers with and what a search tie breaks on. A create is the
// one write that can put a file at the FRONT of that order, and it is the case
// where the gate's own candidate map disagrees with the listing: the candidate
// is what the last probe held with the new path appended, so a file sorting
// before an existing one lands last there and first here. The gate must not
// publish the candidate's order for the listing's.
test("a created file sorting before an existing one is published in path order", () =>
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "create", file: "_olai/Trash.org" })
      expect(outlinePaths(yield* fixture.set())).toEqual(["_olai/Trash.org", "house.org"])
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
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "trash", id: "order" })
      expect(applied.file).toBe("_olai/Trash.org")

      expect(fixture.read("house.org")).not.toContain(`"order"`)
      const archive = fixture.read("_olai/Trash.org") ?? ""
      expect(archive).toContain(`"title":"Kitchen remodel"`)
      expect(archive).toContain(`"id":"order"`)

      // One revision for the pair, not two — the gate renamed both or neither.
      expect(applied.rev).toBe(2)
      const set = yield* fixture.set()
      expect([...outlinePaths(set)].sort()).toEqual(["_olai/Trash.org", "house.org"])
    })))

/**
 * The whole claim of a batch capture, and it is only true end to end: thirteen
 * nodes used to be thirteen calls, thirteen revalidations and thirteen commits,
 * with a failure partway through leaving half an outline behind. One call is
 * ONE revision and ONE commit, and the ids it hands back are the ids on disk.
 */
test("a subtree captured in one call is one revision and one commit", () =>
  withOps({ "house.org": HOUSE }, (fixture) =>
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

      const text = fixture.read("house.org") ?? ""
      expect(Result.isSuccess(parseOutline("house.org", fixture.raw("house.org") ?? ""))).toBe(true)
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
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "kitchen", undo: true }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(fixture.read("house.org")).toBe(HOUSE)
      expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
      // Reported wherever it came from: the observer hangs off the WRITER, so
      // a second caller — the web UI's own procedures, when they arrive — is
      // not a second place to remember to report from.
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
    })))

// ── self-heal on refusal: the stale-set repair ──────────────────────────
//
// `stale-set-reads-clean-writes-refuse`: a git operation replaces a file
// inside the stamp's own resolution, so the loop never sees it — reads serve
// the old set with no error, and writes REFUSE, because the same operation's
// declarations now judge the old bytes wrong. The repair is asked where the
// refusal shows, and since brokenness went per file that is one of TWO
// doors: the gate's verdict names its files, and the PLANNER'S refusal
// stands behind a set withholding a file it judged from bytes — if the
// disk's bytes there are not the set's, the set — not the write — was the
// problem, so the resync door opens for the writer and the write runs once
// more.

/** A record whose `pr` is free text at boot (no vault declares it) and a
 *  wrong `date` once the declaration below lands — the two halves of a
 *  refusal the SET owes, not the write. The three spellings are ONE LENGTH,
 *  which is the whole of the blind spot they swap inside. */
const PLAN_BEFORE =
  `{"id":"the-plan","ord":"a0","title":"The plan","custom":{"pr":"not-a-date"}}\n`
const PLAN_AFTER =
  `{"id":"the-plan","ord":"a0","title":"The plan","custom":{"pr":"2026-09-01"}}\n`
/** The same length again, and STILL not a date: the repair that lands and
 *  still refuses answers THIS file's refusal — the fresh one. */
const PLAN_STILL_BAD =
  `{"id":"the-plan","ord":"a0","title":"The plan","custom":{"pr":"2026-99-99"}}\n`
/** The migration's other half: declaring `pr` a date, and nothing else. */
const DECLARE_PR_DATE =
  `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"date"}}\n`
/** The same declaration BEFORE that migration — `text` and `date` are four
 *  letters each, so the two spellings swap inside the stamps' blind spot the
 *  way the records above do. What it buys is a stale JUDGE: a set that
 *  withholds a file over a declaration the disk no longer holds. */
const DECLARE_PR_TEXT =
  `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"text"}}\n`

/**
 * The store's byte check, wrapped so a test can name EXACTLY what a refusal
 * asked it. The drift question's whole correctness is its set of paths —
 * one the verdict forgot is a refusal that never heals — and the shape of
 * the set cannot be read back out of what lands on disk.
 */
const watchingDrift = (fixture: Fixture): ReadonlyArray<ReadonlyArray<string>> => {
  const asked: Array<ReadonlyArray<string>> = []
  const original = fixture.store.drifted
  ;(fixture.store as { drifted: typeof original }).drifted = (paths) => {
    asked.push([...paths])
    return original(paths)
  }
  return asked
}

/**
 * THE STALE JUDGE'S VERDICT: `bad-prop` filed on the write's own file, the
 * declaration that judged the value reached as a `related` site and marked
 * NAMED-but-not-broken.
 *
 * Faked rather than earned, in both tests that use it, and for one reason:
 * the pin is the ARM's behaviour — which files it asks about — and not the
 * codec's means of arriving at a verdict of this shape. Said once because the
 * `broken: false` related site is the load-bearing detail of both (it is what
 * puts a declarations file on `implicatedBy`'s about-axis at all), and two
 * copies is one place for that shape to go stale while the other test goes on
 * passing.
 */
const STALE_JUDGE = verdictOf([{
  file: "plan.org",
  line: 1,
  code: "bad-prop",
  message: "`pr` must be a day — the value here is not one",
  related: [{ file: "_olai/Properties.org", line: 1, note: "declared here", broken: false }],
}])

/**
 * `commit`, wrapped so a test can answer the first attempts itself and let
 * the rest through — the store's own gate, reached by returning `undefined`.
 *
 * Both the arm tests below fake this, and the cast is the same three lines
 * each time. What a case is left holding is the LADDER it wants (attempt one
 * refuses; attempts one to four are lost races) and the counter, which is
 * what `expect(attempts())` reads.
 */
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

/** The resync door, wrapped so a test can say whether the repair ever
 *  knocked on it: the byte check standing in front is only a guarantee if a
 *  NO from it keeps THIS latched. */
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
  withOps({ "plan.org": PLAN_BEFORE }, (fixture) =>
    Effect.gen(function*() {
      // The migration: the declaration lands visibly (a NEW file — any
      // listing sees it), the content lands INVISIBLY. Reads go on serving
      // the set that was valid at boot…
      fixture.write("_olai/Properties.org", DECLARE_PR_DATE)
      replaceBehindTheStamps(fixture.root, "plan.org", PLAN_AFTER)
      const served = yield* fixture.set()
      expect(
        recordsOf(served).find((located) => located.node.id === "the-plan")?.node,
      ).toMatchObject({ custom: { pr: "not-a-date" } })

      // …and the write heals BELOW this loop. Its plan is derived off the
      // stale copy, and the gate compares the file it is about to write over
      // against the disk before judging anything: the bytes are not the ones
      // the plan was made from, so the write comes back `StaleWrite` and the
      // round runs again off the truth. The refusal this shape is named for
      // (a PLAN against a set withholding the very node it names) is never
      // reached — the drift is caught a door earlier than #440 could catch
      // it, which is this lane.
      const asked = watchingDrift(fixture)
      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan", file: "plan.org" })
      // So NO repair is asked for up here: the ruled bug's own reproduction
      // costs one re-derivation and nothing else.
      expect(asked).toEqual([])

      // The caller was never told there was anything to heal.
      expect(fixture.refusals).toEqual([])
      // The write did not trample the rebase's file: its NEW `pr` survived,
      // and the mark was planned against it.
      const text = fixture.read("plan.org") ?? ""
      expect(text).toContain(`"pr":"2026-09-01"`)
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
      // And the reads catch up with the write: the served set says what the
      // disk said from the moment the refusal showed.
      const healed = yield* fixture.set()
      expect(
        recordsOf(healed).find((located) => located.node.id === "the-plan")?.node,
      ).toMatchObject({ custom: { pr: "2026-09-01" }, done: STAMP })
    })))

// THE PLANNER ARM'S OWN ASK, pinned — and reachable only where the write's
// own files are NOT the stale half, since the ask above stands in front of
// every write and would spend the budget first. That is the STALE JUDGE: the
// declaration migrated behind the stamps in the OTHER direction, so the set
// goes on withholding a file over a rule the disk has already dropped, and the
// write's own bytes are exactly what the set holds.
test("the planner arm's ask is every file the withheld rows were judged FROM", () =>
  withOps({
    "plan.org": PLAN_BEFORE,
    "_olai/Properties.org": DECLARE_PR_DATE,
  }, (fixture) =>
    Effect.gen(function*() {
      // Loaded as broken: `not-a-date` is not a date, so plan.org is
      // withheld and the node cannot be reached at all.
      const served = yield* fixture.set()
      expect(served.broken.map((entry) => entry.file)).toEqual(["plan.org"])
      // …and then the declaration is relaxed, invisibly. The disk now says
      // `pr` is free text, which `not-a-date` has always been.
      replaceBehindTheStamps(fixture.root, "_olai/Properties.org", DECLARE_PR_TEXT)

      const asked = watchingDrift(fixture)
      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan", file: "plan.org" })
      // THE PIN: the plan refuses before there are any files of its own to
      // ask about, so the ask is the withheld rows' ABOUT axis — every file
      // they were judged FROM, in `byPath` order. `reportPropValues`'s
      // related site (`broken: false`) is what puts the DECLARATIONS file in
      // it, and the declarations file is the drifted one here.
      expect(asked).toEqual([["_olai/Properties.org", "plan.org"]])
      expect(fixture.refusals).toEqual([])
      // The value the stale judge condemned is still there, now legally.
      const text = fixture.read("plan.org") ?? ""
      expect(text).toContain(`"pr":"not-a-date"`)
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
    })))

test("a repair that still refuses answers the FRESH refusal, once", () =>
  withOps({ "plan.org": PLAN_BEFORE }, (fixture) =>
    Effect.gen(function*() {
      // The same shape, except the migration's plan.org is wrong under its
      // own declaration: the repair resyncs, the disk's truth STILL refuses
      // the declaration, and the same write is refused again — at the same
      // door, against the resynced set.
      fixture.write("_olai/Properties.org", DECLARE_PR_DATE)
      replaceBehindTheStamps(fixture.root, "plan.org", PLAN_STILL_BAD)

      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "the-plan" }, "mcp")),
      )
      // THE CALLER'S "NO" IS THE FRESH ONE: reached against the resynced
      // set, where the node is withheld because the DISK'S OWN bytes refuse
      // the declaration — the planner's sentence names nothing stale
      // because nothing stale is in it.
      if (failure._tag !== "NotFoundFailure") {
        throw new Error(`expected a NotFoundFailure, got ${failure._tag}`)
      }
      expect(failure.message).toContain("the-plan")
      // What the repair CHANGED is the story the SERVER tells: the served
      // set's broken rows were re-judged against the resynced tree, so they
      // quote the bytes ON DISK — before it, the same rows quoted the stale
      // copy, and a reader of them would go hunting for `not-a-date` in a
      // file that says `2026-99-99`. (The errors channel stays EMPTY: one
      // broken file is the set's own sentence now, not the channel's.)
      expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
      const said = (yield* fixture.set()).broken.flatMap((entry) =>
        entry.errors.map((finding) => finding.message)
      ).join("\n")
      expect(said).toContain("2026-99-99")
      expect(said).not.toContain("not-a-date")
      // One refusal reached the caller — the retry's, not the stale one's —
      // and nothing was written by any round.
      expect(fixture.refusals).toEqual(["done: NotFoundFailure"])
      expect(fixture.read("plan.org")).toBe(PLAN_STILL_BAD)
    })))

test("a refusal the disk AGREES with heals nothing and changes nothing", () =>
  withOps({ "plan.org": PLAN_STILL_BAD }, (fixture) =>
    Effect.gen(function*() {
      // The same brokenness, honestly earned: the declaration arrives and
      // the file IS what the set holds, so the byte check agrees with the
      // refusal and the door stays shut — no resync, the refusal answered
      // exactly as it was.
      fixture.write("_olai/Properties.org", DECLARE_PR_DATE)
      const refreshes = watchingRefresh(fixture)

      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "the-plan" }, "mcp")),
      )
      expect(failure._tag).toBe("NotFoundFailure")
      expect(fixture.refusals).toEqual(["done: NotFoundFailure"])
      // The check was asked and answered NO, so the one look the repair
      // would spend was never spent — the degraded set the gate's cycle
      // published is the served one, and nothing re-read the tree.
      expect(refreshes).toEqual([])
      expect(fixture.read("plan.org")).toBe(PLAN_STILL_BAD)
    })))

// THE GATE'S OWN ASK, pinned. The repairs above all show at the planner's
// door or at the write's own files — per-file brokenness withholds the
// stale-judged file from the set before the gate is ever reached, and every
// class of write a `plan` can emit is fenced at the plan by the same tables
// the validator re-judges with (`typedProps`, `declaredWrong`), so an
// ordinary write's plan and gate cannot come to different answers about its
// bytes. The gate arm below is the door left for the case they CAN diverge —
// a stale JUDGE against a healthy target — and its contract is the asked set.
// The verdict is therefore FAKED ({@link STALE_JUDGE}): the pin is the arm's
// own behaviour, not the codec's means of producing the answer. The write's own file is honest here for the same reason as the
// planner arm above: a write whose own bytes have moved never reaches a
// refusal at all — the gate answers `StaleWrite` on its way in — so the only
// stale half a refusal arm can be about is one the write does not carry.
test("the gate arm's ask is every file the verdict was judged FROM", () =>
  withOps({
    "plan.org": PLAN_AFTER,
    "_olai/Properties.org": DECLARE_PR_TEXT,
  }, (fixture) =>
    Effect.gen(function*() {
      // The declaration replaced invisibly — the drift the heal stands on —
      // and one commit answered with a stale judge's verdict: `bad-prop`
      // filed on the write's own file, the judging declaration
      // NAMED-but-not-broken. (`2026-09-01` satisfies both spellings, so the
      // set itself is whole either way and the ONLY refusal here is the
      // faked one.)
      yield* fixture.set()
      replaceBehindTheStamps(fixture.root, "_olai/Properties.org", DECLARE_PR_DATE)
      fakingCommit(fixture, (attempt) =>
        attempt === 1 ? Effect.succeed(Result.fail(STALE_JUDGE)) : undefined)

      const asked = watchingDrift(fixture)
      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan", file: "plan.org" })
      // THE PIN: the verdict's ABOUT axis in `byPath` order, which is this
      // arm's whole question. The `broken: false` judge is ASKED (a stale
      // declaration is exactly the drift this arm exists for) even though the
      // blame would never file it — and the write's own file rides in on the
      // same axis, because the finding is about it.
      expect(asked).toEqual([["_olai/Properties.org", "plan.org"]])
      // The refusal the verdict carried was never delivered — the heal
      // answered it — and the write landed on the current set.
      expect(fixture.refusals).toEqual([])
      expect(fixture.read("plan.org")).toContain(`"done":${JSON.stringify(STAMP)}`)
    })))

// THE NARROWING, pinned: a `UsageFailure` is words about the REQUEST — a
// typo, a misuse — and a stale copy cannot invent one, so the hottest refusal
// path pays no byte check: not even when a broken file sits in the set AND
// the disk under it has drifted.
test("a usage refusal never reaches the byte check — drift or no drift, the door stays shut", () =>
  withOps({
    "plan.org":
      `{"id":"the-plan","ord":"a0","title":"The plan","done":"2026-08-01"}\n`,
    "garden.org":
      `{"id":"garden","ord":"a0","title":"the garden","see":["nobody-declares-this"]}\n`,
  }, (fixture) =>
    Effect.gen(function*() {
      // garden.org is broken (its `see` dangles) AND its on-disk bytes have
      // drifted from the set's — everything the check could spend itself on,
      // present at once.
      yield* fixture.store.refresh("cheap")
      replaceBehindTheStamps(
        fixture.root,
        "garden.org",
        `{"id":"garden","ord":"a0","title":"the Garden","see":["nobody-declares-this"]}\n`,
      )
      const asked = watchingDrift(fixture)
      // The write's refusal is a USAGE one: the node is already done.
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "the-plan" }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
      expect(asked).toEqual([])
    })))

// ── drift with no refusal in it, from the outside ──────────────────────
//
// The other half of the same bug, and the half no refusal ever reaches
// (#440's `The no-refusal arm`, ruled closed 2026-08-30). A replacement that
// lands inside the stamps' blind spot does not have to make the set INVALID:
// swap one accepted value for another and every door #440 opened stays shut —
// the write is planned off bytes that are gone, lands on top of them, and the
// other process's write is simply not there any more, with nothing said
// anywhere.
//
// What closes it is one layer DOWN, in the write gate: `commit` compares its
// own paths by bytes on the way in and answers `StaleWrite` when they have
// moved, which this loop already knows how to do something about
// (`store/src/store.test.ts` pins the gate's own half). So there is no arm
// here at all, and no repair is spent — these say what that buys from the
// caller's chair, which is the seat the bug was reported from.

/** Open at boot, and marked done by somebody else behind the stamps — the two
 *  are one length, so the replacement is invisible to the loop and the set
 *  goes on saying the row is open. */
const PLAN_OPEN =
  `{"id":"the-plan","ord":"a0","title":"The plan (and its long tail)"}\n`
const PLAN_MARKED_ELSEWHERE =
  `{"id":"the-plan","ord":"a0","title":"The plan","done":"2026-08-01"}\n`

/** Two outlines, so a test can say what a write does about a file it does NOT
 *  touch. `before` and `healed` are one length. */
const APPLES_BEFORE = `{"id":"apples","ord":"a0","title":"apples, before"}\n`
const APPLES_HEALED = `{"id":"apples","ord":"a0","title":"apples, healed"}\n`
const PEARS_BEFORE = `{"id":"pears","ord":"a0","title":"pears, before"}\n`
const PEARS_HEALED = `{"id":"pears","ord":"a0","title":"pears, healed"}\n`

/** Every ordinary record's title, sorted — what a two-file set looks like from
 *  the outside. `isRegular` is the format's own mirror drop, asked of the
 *  `Located` pair rather than re-spelled here. */
const titles = (set: OutlineSet): ReadonlyArray<string> =>
  recordsOf(set).filter(isRegular).map((located) => located.node.title).sort()

test("a still-valid replacement of the write's own file is caught, and not clobbered", () =>
  withOps({ "plan.org": PLAN_BEFORE }, (fixture) =>
    Effect.gen(function*() {
      // The migration WITHOUT its declaration: `pr` moves from free text to a
      // day, and since nothing in this vault declares `pr` at all, both
      // spellings are valid. Nothing refuses anything, at any door — which is
      // exactly why #440's arms could not see this.
      const served = yield* fixture.set()
      expect(served.broken).toEqual([])
      replaceBehindTheStamps(fixture.root, "plan.org", PLAN_AFTER)

      const asked = watchingDrift(fixture)
      const refreshes = watchingRefresh(fixture)
      const applied = yield* run(fixture, { op: "done", id: "the-plan" })
      expect(applied).toMatchObject({ id: "the-plan", file: "plan.org" })

      // THE BUG, closed: the replacement's value is still on disk, with this
      // write's mark beside it. Before the gate's own check, the write was
      // planned off the stale copy and its bytes went straight over the top —
      // `not-a-date` written back with a `done` on it, and the other
      // process's edit gone with no error anywhere.
      const text = fixture.read("plan.org") ?? ""
      expect(text).toContain(`"pr":"2026-09-01"`)
      expect(text).not.toContain("not-a-date")
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)

      // AND NOTHING UP HERE KNEW. No repair was asked for and no whole-tree
      // resync was taken: the gate answered `StaleWrite`, which this loop has
      // always answered by re-deriving, so the fix costs the caller a round
      // it already had rather than a door it did not.
      expect(asked).toEqual([])
      expect(refreshes).toEqual([])
      expect(fixture.refusals).toEqual([])
      // And the served set caught up with the disk on the way through.
      const healed = yield* fixture.set()
      expect(
        recordsOf(healed).find((located) => located.node.id === "the-plan")?.node,
      ).toMatchObject({ custom: { pr: "2026-09-01" }, done: STAMP })
    })))

test("the round is PLANNED again: a write the true bytes refuse is refused, once", () =>
  withOps({ "plan.org": PLAN_OPEN }, (fixture) =>
    Effect.gen(function*() {
      // Somebody else marked the row done, invisibly. The set still says
      // open, so the plan derived from it is a perfectly good `done` — and
      // landing it would erase both their mark and their title.
      yield* fixture.set()
      replaceBehindTheStamps(fixture.root, "plan.org", PLAN_MARKED_ELSEWHERE)

      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "the-plan" }, "mcp")),
      )
      // THE ROUND IS RE-DERIVED, NOT RE-SENT, which is what makes the fresh
      // bytes able to refuse at all: a `StaleWrite` sends this loop back to a
      // fresh read and a fresh plan, and against the truth this op has
      // nothing left to do.
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("already done")
      // ONE refusal reached the caller, and it is the FRESH one — #440's
      // retry semantics, reached without a refusal to start from.
      expect(fixture.refusals).toEqual(["done: UsageFailure"])
      // Their bytes, untouched.
      expect(fixture.read("plan.org")).toBe(PLAN_MARKED_ELSEWHERE)
    })))

test("a write heals the file it is ABOUT, and leaves an untouched one to the door that names it", () =>
  withOps({ "a.org": APPLES_BEFORE, "b.org": PEARS_BEFORE }, (fixture) =>
    Effect.gen(function*() {
      // One operation replaced both files invisibly; the write is about one
      // of them. The gate asks about the bytes it is about to write over and
      // heals exactly those — going looking for the other would mean reading
      // the whole tree on every write, which is the read side's own red line
      // moved onto the write side.
      yield* fixture.set()
      replaceBehindTheStamps(fixture.root, "a.org", APPLES_HEALED)
      replaceBehindTheStamps(fixture.root, "b.org", PEARS_HEALED)

      const refreshes = watchingRefresh(fixture)
      yield* run(fixture, { op: "done", id: "apples" })
      expect(refreshes).toEqual([])
      expect(titles(yield* fixture.set())).toEqual(["apples, healed", "pears, before"])
      // b.org's replacement is still ON DISK and still unread — waiting, not
      // lost, and never overwritten by a write that was not about it.
      expect(fixture.read("b.org")).toBe(PEARS_HEALED)

      // THE DOOR THAT NAMES IT is the next write to that file — or the resync
      // a person knocks on, which is the same look one size larger.
      yield* run(fixture, { op: "done", id: "pears" })
      const text = fixture.read("b.org") ?? ""
      expect(text).toContain("pears, healed")
      expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
      expect(fixture.refusals).toEqual([])
    })))

// THE REVIEWER'S PROBE, pinned. The declaraxis-fix's `related` asks the
// DECLARATION where an ordinary value went wrong — and without the
// `implicating` split, that ask leaks into the write gate's answer: one bad
// value in lanes.org refuses every write to `_olai/Properties.org`, the
// one door every declaration lives behind (`broken-file-blocks-healthy-writes`,
// redeployed at the one site the whole vault shares). With it, the gate is
// asked the finding's FILED file, and the laned writing of a DIFFERENT key
// lands.
test("a bad value in one file does NOT block declaring another key — the ask stays the ask", () =>
  withOps({
    "_olai/Properties.org":
      `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"date"}}\n` +
      `{"id":"prop-owner","ord":"a1","title":"owner","custom":{"type":"text"}}\n`,
    "lanes.org": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"2026-09-01"}}\n`,
  }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.set()
      // The hand edit that makes one ordinary value bad — the loop sees it,
      // so the verdict the gate will ask about CARRIES the finding.
      fixture.write(
        "lanes.org",
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"not-a-date"}}\n`,
      )
      yield* fixture.store.refresh("cheap")
      // The write is to the DECLARATIONS file, about a key lanes.org has
      // never heard of: pre-fix, the shared axis refused this outright.
      const applied = yield* run(fixture, {
        op: "title",
        id: "prop-owner",
        title: "the lane's owner",
      })
      expect(applied).toMatchObject({ id: "prop-owner" })
      expect(fixture.refusals).toEqual([])
    })))

// A repair does not spend a LOST RACE, which is the whole of what `ROUNDS`
// counts. Without that rule a write that had already lost four races would
// walk off the loop the moment its refusal healed, and the caller would hear
// `BusyFailure` about a flood that never happened. The rule is the counter's
// now — it moves at the one site a race is observed — and this is the pin from
// outside: the write LANDS.
//
// The stale half is the JUDGE here, so the write's own file is honest and the
// repair waits for the gate — which is what puts it AFTER every race.
test("a repair does not spend a lost race — four races and a heal still land", () =>
  withOps({
    "plan.org": PLAN_AFTER,
    "_olai/Properties.org": DECLARE_PR_TEXT,
  }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.set()
      replaceBehindTheStamps(fixture.root, "_olai/Properties.org", DECLARE_PR_DATE)

      // Four attempts overtaken, then one refusal from the stale judge. The
      // sixth attempt is the repair's, and a sixth is exactly what a repair
      // that spent a race could not have reached.
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
      expect(fixture.read("plan.org")).toContain(`"done":${JSON.stringify(STAMP)}`)
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
  withOps({ "house.org": PROPPED }, (fixture) =>
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
      expect(fixture.read("house.org")).toBe(PROPPED)
      expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
    })))

test("a set_prop that DOES change something lands, and stamps the write", () =>
  withOps({ "house.org": PROPPED }, (fixture) =>
    Effect.gen(function*() {
      yield* run(fixture, { op: "prop", id: "order", key: "pr", value: "https://x/2" })
      const written = fixture.read("house.org")
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
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // A second outline appears the way a `git pull` would put it there. The
      // store has not probed yet, so the op's first attempt is against a
      // revision the gate's own probe is about to overtake.
      fixture.write("notes.org", `{"id":"idea","ord":"a0","title":"an idea"}\n`)

      const applied = yield* run(fixture, { op: "done", id: "order" })
      const set = yield* fixture.set()
      expect([...outlinePaths(set)].sort()).toEqual(["house.org", "notes.org"])
      expect(
        recordsOf(set).find((located) => located.node.id === "order")?.node,
      ).toMatchObject({ done: STAMP })
      // The pulled file is still there: the write re-derived rather than
      // re-sending bytes computed from a set that no longer existed.
      expect(fixture.read("notes.org")).toContain("an idea")
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
  withOps({ "house.org": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      fixture.write(
        "house.org",
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
      expect(fixture.read("house.org")).toContain("order the chrome ones")
      expect(fixture.read("house.org")).not.toContain("put back what I replaced")
    })))

test("concurrent ops all land, each re-derived from the set the last one left", () =>
  withOps({ "house.org": HOUSE }, (fixture) =>
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
describe("delete, against a real directory", () => {
  test("the file goes — from the disk, from the set the next read answers, and `gone` is what the reply calls it", () =>
    withOps({ "house.org": HOUSE, "ideas.md": "# Ideas\n" }, (fixture) =>
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
        // One revision, one publication: THE GATE'S claim, at the place the
        // claim is made. The disk holds the path no longer, and the set the
        // read gate hands anybody — the same value a `list_documents` call
        // answers with — holds it no longer either.
        expect(fixture.read("ideas.md")).toBeNull()
        expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(2)
        const set = yield* fixture.set()
        expect(markdownIn(set).map((document) => document.path)).toEqual([])
      })))

  test("...and it is an honest refusal the second time — nothing silently widened", () =>
    withOps({ "house.org": HOUSE, "ideas.md": "# Ideas\n" }, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, { op: "delete", file: "ideas.md" })
        const refusal = yield* Effect.flip(fixture.ops.run({ op: "delete", file: "ideas.md" }, "mcp"))
        expect(refusal._tag).toBe("NotFoundFailure")
        expect(refusal.message).toContain(`\`ideas.md\` is not a file under the served directory`)
      })))

  test("an outline with records is refused naming them, and the disk holds BOTH afterwards — the refusal costs nothing", () =>
    withOps({ "house.org": HOUSE, "ideas.md": "# Ideas\n" }, (fixture) =>
      Effect.gen(function*() {
        const refusal = yield* Effect.flip(fixture.ops.run({ op: "delete", file: "house.org" }, "mcp"))
        expect(refusal._tag).toBe("UsageFailure")
        expect(refusal.message).toContain("house.org")
        expect(refusal.message).toContain("`order`")
        // NOTHING IS WRITTEN is the promise the refusal makes, and the two
        // files untouched are its proof: the refusal was judged in the
        // planner and never reached a staged byte.
        expect(fixture.read("house.org")).toBe(HOUSE)
        expect(fixture.read("ideas.md")).toBe("# Ideas\n")
      })))

  test("a `.html` the directory shows is refused the same way — never the near-miss the `.md` one space away would be", () =>
    withOps({ "house.org": HOUSE, "notes.md": "# notes\n", "report.html": "<h1>x</h1>\n" }, (fixture) =>
      Effect.gen(function*() {
        const refusal = yield* Effect.flip(fixture.ops.run({ op: "delete", file: "report.html" }, "mcp"))
        expect(refusal._tag).toBe("UsageFailure")
        expect(refusal.message).toContain("hypertext")
        expect(fixture.read("report.html")).toBe("<h1>x</h1>\n")
      })))
})

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
    withOps({ "house.org": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, { op: "done", id: "order" })
        yield* sweep(fixture)
        yield* run(fixture, { op: "add", parent: "kitchen", title: "paint" })
        yield* sweep(fixture)
        yield* run(fixture, {
          op: "create",
          file: "shed.org",
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
          "olai: 3 edits to Trash — house.org created",
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
        ).toEqual(["_olai/Trash.org", "house.org"])
      }), { git: true }), 15_000)

  test("a write says it is waiting for the window, and git reads healthy", () =>
    withOps({ "house.org": HOUSE }, (fixture) =>
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
    withOps({ "house.org": HOUSE }, (fixture) =>
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
        expect(fixture.read("house.org")).toContain(`"done"`)
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
    withOps({ "house.org": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, { op: "done", id: "order" })
        const done = yield* fixture.ops.commit({}, "mcp")

        expect(done).toMatchObject({ _tag: "Failed" })
        expect(fixture.read("house.org")).toContain(`"done"`)
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
    withOps({ "house.org": HOUSE }, (fixture) =>
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
    withOps({ "house.org": HOUSE }, (fixture) =>
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
        expect(fixture.read("house.org")).toContain(`"done"`)
        expect(gitLog(fixture.root)).toEqual(["fixtures"])
      }), { git: true }))

  test("the opt-out writes without committing, and says that is why", () =>
    withOps({ "house.org": HOUSE }, (fixture) =>
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
    withOps({ "house.org": HOUSE }, (fixture) =>
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

        const text = fixture.read("house.org") ?? ""
        expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
        expect(text).toContain(`"custom":{"pr":"https://x/1"}`)
        expect(text).toContain("demolition, done")
        // Still one record per line, read back by the parser that wrote it.
        expect(Result.isSuccess(parseOutline("house.org", fixture.raw("house.org") ?? ""))).toBe(true)
      })))

  test("a batch refused halfway leaves the file untouched, byte for byte", () =>
    withOps({ "house.org": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const before = fixture.read("house.org")
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
        expect(fixture.read("house.org")).toBe(before)
        // …and the store never moved, so no open page saw a half-run.
        expect((yield* Effect.map(fixture.store.read("cheap"), (aged) => aged.snapshot))?.rev).toBe(1)
        expect(fixture.refusals).toEqual(["apply: UsageFailure"])
      })))

  test("a batch is ONE revision and ONE write, and it waits like any other", () =>
    withOps({ "house.org": HOUSE }, (fixture) =>
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
    withOps({ "house.org": HOUSE }, (fixture) =>
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
        const text = fixture.read("house.org") ?? ""
        expect(text).toContain(`"desc":"from the joiner"`)
        expect(text).toContain(`"custom":{"pr":"https://x/1"}`)
        expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
      })))

  test("a capture arrives on disk with its edges and its facts", () =>
    withOps({ "house.org": HOUSE }, (fixture) =>
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
        const text = fixture.read("house.org") ?? ""
        expect(text).toContain(`"after":["measure"]`)
        expect(text).toContain(`"custom":{"agent":"claude-opus"}`)
        // The whole set still validates — the forward reference resolved to a
        // record in the same write, which is what makes it legal at all.
        const set = yield* fixture.set()
        expect(set.broken).toEqual([])
      })))
})

/**
 * ONE BROKEN OUTLINE DEGRADES ALONE — reads, writes and all.
 *
 * The bug (`broken-file-blocks-healthy-writes`, sighted 2026-08-25): one
 * outline failing typed validation refused an `add_node` into a perfectly
 * healthy file — the gate reduced the whole set's verdict to one boolean, so
 * every write in the vault was frozen by a file it had nothing to do with, and
 * the refusal said "would leave the outlines invalid", which reads as an
 * indictment of a write that was innocent. Filing THAT BUG was blocked by it.
 *
 * The first fix let the BYTES land while the snapshot stayed frozen at the last
 * good revision — better, and still a vault where nothing on screen moved. The
 * human's ruling of 2026-08-29 took the freeze out: a broken `.org` degrades
 * alone, so the set is PUBLISHED with that file withheld and every other file
 * is live, revisioned and writable. What is only true END TO END is here — that
 * the revision moves, that the brokenness is carried on the file rather than on
 * the errors channel, that a second write lands on top of the first, and that
 * the writes which must still be refused are refused with the file named.
 */
describe("a broken file beside a healthy one", () => {
  /** A second outline, valid on its own — what the healthy write goes into. */
  const GARDEN = `{"id":"garden","ord":"a0","title":"the garden"}\n`

  /** The same file, saying something the set cannot hold: an edge naming an id
   *  nothing in the directory declares. It PARSES — that is the point, since a
   *  file that merely failed to parse has degraded gracefully for a year. */
  const DANGLING =
    `{"id":"garden","ord":"a0","title":"the garden","see":["nobody-declares-this"]}\n`

  /**
   * Break `garden.org` on disk and let the store see it.
   *
   * THE DIRECTORY GOES ON BEING SERVED, which is the ruling in one assertion:
   * a revision is published, `garden.org` is in the set's `broken` with its own
   * row, and the ERRORS CHANNEL IS EMPTY — that channel says the directory
   * could not be read, and this directory was read perfectly.
   */
  const breakGarden = (fixture: Fixture) =>
    Effect.gen(function*() {
      fixture.write("garden.org", DANGLING)
      yield* Effect.orDie(fixture.store.refresh("cheap"))
      expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
      const set = yield* fixture.set()
      expect(set.broken.map((one) => one.file)).toEqual(["garden.org"])
      expect(set.broken[0]?.errors.map((one) => one.code)).toEqual(["unknown-target"])
      // The file keeps its PLACE and loses its content, which is what makes its
      // own page draw rows where its tree was.
      expect(recordsOf(set).filter((at) => at.file === "garden.org")).toEqual([])
    })

  test("a write to the healthy file lands, and the broken one goes on being broken", () =>
    withOps(
      { "house.org": HOUSE, "garden.org": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)

          const applied = yield* run(fixture, { op: "done", id: "order" })
          // THE BYTES ARE ON DISK. Under the original gate this write was
          // refused outright and nothing was written at all.
          expect(fixture.read("house.org")).toContain(`"done":${JSON.stringify(STAMP)}`)
          expect(fixture.refusals).toEqual([])
          // AND THE REVISION MOVES, which is what the ruling added: the write
          // is on screen. It used to come back at the standing revision, with
          // the last good snapshot still being served to every reader.
          expect(applied.rev).toBeGreaterThan(1)

          const set = yield* fixture.set()
          const done = recordsOf(set).find((at) => at.node.id === "order")?.node
          expect(done !== undefined && !isMirror(done) ? done.done : undefined).toBe(STAMP)
          // …and the broken file is still broken, in the same set, beside it.
          expect(set.broken.map((one) => one.file)).toEqual(["garden.org"])
        }),
    ))

  /**
   * THE FREEZE IS GONE, and this is the test that was written the other way up.
   *
   * While a broken file held the snapshot at the last good revision, a second
   * write to a file the first one had already changed had to be REFUSED: it
   * would have been planned off a copy without the first write in it and would
   * have put that copy back. The store still owns that guard — a path the
   * published revision no longer accounts for cannot be written from it — and
   * it has nothing to defend against here, because the snapshot moves on every
   * write. Both writes land, and the second is derived from the first.
   */
  test("a second write to the same file lands on top of the first", () =>
    withOps(
      { "house.org": HOUSE, "garden.org": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)
          yield* run(fixture, { op: "done", id: "order" })
          yield* run(fixture, { op: "title", id: "install", title: "install them" })
          expect(fixture.refusals).toEqual([])

          const text = fixture.read("house.org") ?? ""
          expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
          expect(text).toContain(`"title":"install them"`)
        }),
    ))

  /**
   * …AND A WRITE TO THE BROKEN FILE ITSELF IS REFUSED, naming it.
   *
   * The other end of the same rule, and the refusal is the planner's rather
   * than the gate's: the set holds a PLACE for `garden.org` and no records, so
   * there is nothing in it for an op to name, and re-emitting the file from the
   * set would erase what is really on disk. One sentence for every kind of
   * broken — the same one a file that would not parse has always got — and the
   * repair is a whole-file write rather than a node edit.
   */
  test("a write INTO the broken file is refused, and says which file", () =>
    withOps(
      { "house.org": HOUSE, "garden.org": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)
          const failure = yield* Effect.orDie(
            Effect.flip(
              fixture.ops.run({ op: "add", file: "garden.org", title: "a new bed" }, "mcp"),
            ),
          )
          expect(failure._tag).toBe("ValidationFailure")
          expect(failure.message).toContain("`garden.org`")
          // Nothing was written, so the broken file is still exactly the bytes
          // its owner has to go and fix.
          expect(fixture.read("garden.org")).toBe(DANGLING)
        }),
    ))

  // And it comes back on its own: fixing the file publishes it, with the
  // healthy file's writes still in the set the way any other write would be.
  test("the broken file comes back the moment it is fixed", () =>
    withOps(
      { "house.org": HOUSE, "garden.org": GARDEN },
      (fixture) =>
        Effect.gen(function*() {
          yield* breakGarden(fixture)
          yield* run(fixture, { op: "done", id: "order" })

          fixture.write("garden.org", GARDEN)
          yield* Effect.orDie(fixture.store.refresh("cheap"))

          const set = yield* fixture.set()
          expect(set.broken).toEqual([])
          expect(
            recordsOf(set).filter((at) => at.file === "garden.org").map((at) => at.node.id),
          ).toEqual(["garden"])
          const done = recordsOf(set).find((at) => at.node.id === "order")?.node
          expect(done !== undefined && !isMirror(done) ? done.done : undefined).toBe(STAMP)
        }),
    ))
})


/**
 * A bad `type` in a Properties declaration used to pass the planner and meet
 * the generic write gate — "`capture: took` would leave `_olai/Properties.org`
 * invalid" — which named nothing. The planner now refuses as `usage`, naming
 * the legal kinds, so this layer never reaches that sentence.
 */
test("a bad type in a Properties declaration is refused naming the legal vocabulary", () =>
  withOps(
    {
      "_olai/Properties.org":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        const unknown = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({
              op: "add",
              file: "_olai/Properties.org",
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
              file: "_olai/Properties.org",
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
    "_olai/Properties.org":
      `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n`,
    "lanes.org": LANES,
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
              file: "_olai/Properties.org",
              title: "brainstorm",
              props: { type: "doc" },
            }, "mcp"),
          ),
        )
        expect(failure._tag).toBe("UsageFailure")
        expect(failure.message).toContain("`brainstorm` cannot be declared `doc`")
        expect(failure.message).toContain("`lanes.org` `first` (`a`) holds \"not a path\"")
        expect(failure.message).toContain("`lanes.org` `second` (`b`) holds \"also prose\"")
        expect(failure.message).toContain("`lanes.org` `third` (`c`) holds \"still not\"")
        expect(fixture.read("_olai/Properties.org")).not.toContain("brainstorm")
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
          file: "_olai/Properties.org",
          title: "brainstorm",
          props: { type: "doc" },
        })
        expect(fixture.read("_olai/Properties.org")).toContain(`"title":"brainstorm"`)
        expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
        const set = yield* fixture.set()
        expect(set.broken).toEqual([])
      })))

  /**
   * Declare-blocked cleanup of the last-good trap: a hand-edited declaration
   * is already on disk, the file it fences is WITHHELD from the published set,
   * and a single `set_prop` of one of several bad values in that file is
   * refused (the candidate still has the others). One `apply` that fixes them
   * all lands.
   *
   * THE FROZEN SNAPSHOT IS GONE and the claim is not: since the per-file
   * ruling the directory publishes with `lanes.org` withheld rather than
   * holding every page at the last good revision, so what says the file is in
   * trouble is its own `broken` entry and not the errors channel — which is
   * about a directory that could not be read.
   */
  test("a hand-edited declaration withholds the file, and no node op reaches it", () =>
    withOps(FILES, (fixture) =>
      Effect.gen(function*() {
        fixture.write(
          "_olai/Properties.org",
          `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n` +
            `{"id":"prop-brief","ord":"a1","title":"brainstorm","custom":{"type":"doc"}}\n`,
        )
        yield* Effect.orDie(fixture.store.refresh("cheap"))
        expect(yield* SubscriptionRef.get(fixture.store.errors)).toBeNull()
        const held = yield* fixture.set()
        expect(held.broken.map((one) => one.file)).toEqual(["lanes.org"])
        expect(held.broken[0]?.errors.map((one) => one.code)).toEqual([
          "bad-prop",
          "bad-prop",
          "bad-prop",
        ])

        // NEITHER OP REACHES IT, and that is the per-file ruling rather than a
        // gap: a withheld file is one the set holds a PLACE for and no records,
        // so there is no `a` for a planner to resolve. #439 shipped `apply` as
        // the one-write repair of several bad values in one file, and that door
        // is a repair of a file the set still HOLDS — a healthy file that would
        // become broken. A file already withheld is a hand edit's to mend.
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
        expect(fixture.read("lanes.org")).toContain("not a path")

        // AND THE HAND EDIT MENDS IT, with no reload and nothing else touched —
        // which is the state's only door, and is why #439's other half (the
        // planner fence that stops a declaration landing over unfit values in
        // the first place) is what keeps a vault out of here through olai.
        fixture.write(
          "lanes.org",
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
        "house.org": `{"id":"live","ord":"a0","title":"still here"}\n`,
        "_olai/Trash.org":
          `{"id":"filed","ord":"a0","title":"put away","custom":{"brainstorm":"old prose"}}\n`,
      },
      (fixture) =>
        Effect.gen(function*() {
          yield* run(fixture, {
            op: "apply",
            ops: [{ op: "prop", id: "filed", key: "brainstorm", value: "new prose" }],
          })
          expect(fixture.read("_olai/Trash.org")).toContain("new prose")
          expect(fixture.read("_olai/Trash.org")).not.toContain("old prose")
        }),
    ))
})

/**
 * MOVING A `ref` VARIANT INTO A THIRD FILE — refused, naming the file it would
 * have broken.
 *
 * THE PIN THAT USED TO BE HERE said the move LANDED and the third file went
 * dark, and said out loud that it was pinned rather than endorsed. This is that
 * pin flipped. The behaviour it recorded was the one place per-file degradation
 * let a write break a file it did not write: the planner builds the move
 * (nothing about one record says a value in a third file goes stale), #439
 * caught it at the STORE over a candidate the codec REFUSED, and per-file
 * publishing left no refusal there to read — the candidate is published with
 * `lanes.org` withheld, and `stopping` was asked only about the files the
 * write put down.
 *
 * IT IS ASKED ABOUT MORE FILES NOW. `Codec.stopping` is handed the STANDING
 * value as well as the candidate ({@link @olai/store}'s `Codec`), so the write
 * gate's ask is the files it puts down PLUS the ones it darkened
 * (`@olai/format`'s `darkened`): `lanes.org` was lit before this write and
 * would be dark after it, and no write of this shape has ever been anything but
 * the cause of that. #439's law — an ops write must never mint a state the next
 * load refuses, even when the findings sit on files it did not write — is back,
 * and per file rather than whole-set, which is what makes it live beside #441's.
 *
 * The other candidate fix was a fence at the planner, the way #439 fenced the
 * declaration doors. The PR body argues why the gate got it: a fence is
 * per-verb and this door is not the only one.
 */
test("moving a ref variant is refused, naming the third file it would strand", () =>
  withOps(
    {
      "_olai/Properties.org":
        `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}\n`,
      "agents.org": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
        "",
      ].join("\n"),
      "lanes.org": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}\n`,
      "garden.org": `{"id":"garden","ord":"a0","title":"the garden"}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        const agents = fixture.read("agents.org")
        const garden = fixture.read("garden.org")

        const failure = yield* Effect.orDie(
          Effect.flip(
            fixture.ops.run({ op: "move", id: "claude", parent: "garden" }, "mcp"),
          ),
        )
        // THE REFUSAL NAMES THE BYSTANDER — not `garden.org`, which is the
        // file the write was putting down and has nothing wrong with it.
        expect(failure._tag).toBe("ValidationFailure")
        expect(failure.message).toContain("`lanes.org`")
        if (failure._tag !== "ValidationFailure") throw new Error("a validation refusal")
        // …and it shows its work: the bystander's own rows, so the reader is
        // told what the move would have meant rather than only that it stopped.
        expect(failure.verdict.findings.map((one) => [one.file, one.code]))
          .toEqual([["lanes.org", "bad-prop"]])

        // NOTHING WAS WRITTEN. Not the file the variant left, not the one it
        // was going to, not the one that names it.
        expect(fixture.read("agents.org")).toBe(agents)
        expect(fixture.read("garden.org")).toBe(garden)
        const set = yield* fixture.set()
        expect(set.broken).toEqual([])

        // …AND IT LANDS THE MOMENT NOTHING NAMES THE VARIANT. The value is
        // cleared first — one write to `lanes.org`, which is legal because
        // clearing it breaks nothing — and then the same move goes through.
        yield* run(fixture, { op: "prop", id: "lane", key: "agent", value: null })
        yield* run(fixture, { op: "move", id: "claude", parent: "garden" })
        expect(fixture.read("garden.org")).toContain(`"id":"claude"`)
        expect((yield* fixture.set()).broken).toEqual([])
      }),
  ))

/**
 * …AND THE GATE ARM IS A LIVE PATH NOW, which is what this refusal did to
 * #440's drift door and why the asked SET is pinned against a real one.
 *
 * The arm above it (`the gate arm's ask is the write's own files, then every
 * file the verdict was judged FROM`) FAKES its verdict, deliberately: before
 * this lane the shapes that reached the gate named the write's own files, so
 * there was no ordinary write whose refusal carried somebody else's rows. A
 * bystander refusal is exactly that write, and it arrives with a `bad-prop`
 * about a file the commit never opened plus the `broken: false` declaration
 * that judged it.
 *
 * SO THE ASK IS PINNED HERE ON THE REAL THING, and what it protects is one
 * swap: `aboutFiles` rides the ABOUT plane (`implicatedBy`), and the two
 * planes are two functions beside each other in `@olai/format` since this
 * lane. Reading the BLAME plane instead would drop `_olai/Properties.org` —
 * the judge, and the file a stale declaration lives in — out of the drift ask
 * and leave a refusal of exactly this shape unhealable, silently, because
 * every other path in the ask would be unchanged.
 *
 * THE COMPOSITION IS #442's, and this is the merge of the two lanes: #440's
 * `paths` first, then the about-axis, has become the about-axis ALONE. The
 * write's own files are asked by the write GATE now, by bytes, on its way in
 * ({@link @olai/store}'s `commit`), so a write standing on moved bytes never
 * reaches a verdict at all — and re-asking them here would be this door asking
 * the question that door already answered, for this same round.
 *
 * So the set below pins both halves at once, which is what makes it worth
 * pinning exactly rather than by `toContain`: the JUDGE is in it (#443's half
 * — read the blame plane instead and `_olai/Properties.org` silently leaves,
 * taking healability with it), and the write's OWN files are not (#442's half
 * — `agents.org` and `garden.org` are what this move puts down, and they
 * were compared before the commit that refused).
 */
test("a bystander refusal reaches the drift arm with the judge in the ask", () =>
  withOps(
    {
      "_olai/Properties.org":
        `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}\n`,
      "agents.org": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
        "",
      ].join("\n"),
      "lanes.org": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}\n`,
      "garden.org": `{"id":"garden","ord":"a0","title":"the garden"}\n`,
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

        // The check ran once, over the verdict's ABOUT axis in `byPath`
        // order and nothing else: the bystander the `bad-prop` was filed on,
        // and the declarations file it was judged FROM. The judge is the half
        // the blame axis would silently drop; the write's own `agents.org`
        // and `garden.org` are the half the gate has already compared.
        expect(asked).toEqual([["_olai/Properties.org", "lanes.org"]])

        // The disk AGREES with the refusal — nothing drifted — so the door
        // stays shut and the caller hears the refusal once, unhealed.
        expect(fixture.refusals).toEqual(["move: ValidationFailure"])
      }),
  ))

/**
 * THE BYSTANDER RULE IS A DIFFERENCE, NOT A STATE — which is what keeps
 * `broken-file-blocks-healthy-writes` closed while the refusal above stands.
 *
 * `lanes.org` is ALREADY broken here, by a hand edit nobody's write made: it
 * holds a second value naming a variant that was never declared. It is off
 * every page and refusing its own writes before the move is asked for. So the
 * move that would strand its OTHER value is not what took it off the screen,
 * and the write lands — the file it darkens was dark.
 *
 * The alternative — comparing ROWS rather than files — would refuse this, and
 * that is the freeze re-entering one row at a time: every already-broken file
 * becomes a wall for writes three directories away, which is the bug the
 * per-file ruling closed.
 */
test("a file that was already dark is not a bystander this write struck", () =>
  withOps(
    {
      "_olai/Properties.org":
        `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}\n`,
      "agents.org": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
        "",
      ].join("\n"),
      "lanes.org": [
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}`,
        `{"id":"other","ord":"a1","title":"another lane","custom":{"agent":"nobody-declared-this"}}`,
        "",
      ].join("\n"),
      "garden.org": `{"id":"garden","ord":"a0","title":"the garden"}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        // It is dark before anybody writes anything.
        const before = yield* fixture.set()
        expect(before.broken.map((one) => one.file)).toEqual(["lanes.org"])

        yield* run(fixture, { op: "move", id: "claude", parent: "garden" })
        expect(fixture.read("garden.org")).toContain(`"id":"claude"`)

        // Still exactly one dark file, now carrying both rows — and every
        // other file still live and writable.
        const set = yield* fixture.set()
        expect(set.broken.map((one) => one.file)).toEqual(["lanes.org"])
        expect(set.broken[0]?.errors.length).toBe(2)
        expect(admits(set.broken, ["garden.org"])._tag).toBe("admitted")
      }),
  ))

/**
 * THE FOREIGN PARENT'S FILE KEEPS ITS WRITES — the other half of this lane,
 * at the door it is about.
 *
 * `child.org` places a record under a parent declared in `parent.org`. The
 * finding is `foreign-parent`, and it NAMES both files: the record that reached
 * across, and the parent it reached at. Only the first is at fault — the edit
 * that fixes it is the `parent` field, in `child.org` — so `parent.org` stays
 * lit, keeps its records in the set, and accepts writes. It used to go
 * errors-only and refuse every write in it, which is
 * `broken-file-blocks-healthy-writes` re-entering through one code's blame.
 */
test("a foreign parent darkens the child's file, and the parent's stays writable", () =>
  withOps(
    {
      "parent.org": `{"id":"kitchen","ord":"a0","title":"the kitchen"}\n`,
      "child.org": `{"id":"sink","parent":"kitchen","ord":"a0","title":"the sink"}\n`,
    },
    (fixture) =>
      Effect.gen(function*() {
        const set = yield* fixture.set()
        // ONE dark file, and it is the one holding the `parent`.
        expect(set.broken.map((one) => one.file)).toEqual(["child.org"])
        expect(set.broken[0]?.errors.map((one) => one.code)).toEqual(["foreign-parent"])
        // The finding still NAMES the parent's file — the about axis is
        // unfiltered, and the drift check rides it.
        expect(implicatedBy(set.broken[0]?.errors[0] as OutlineError))
          .toEqual(["child.org", "parent.org"])
        expect(admits(set.broken, ["parent.org"])._tag).toBe("admitted")

        // …and the write lands: a retitle inside the file that was merely
        // pointed at, with the bytes on disk.
        yield* run(fixture, { op: "title", id: "kitchen", title: "the kitchen, tidied" })
        expect(fixture.read("parent.org")).toContain("the kitchen, tidied")

        // A write INTO the broken file is still refused, naming it — the
        // pointed-at file being innocent does not make the pointing one so.
        const refused = yield* Effect.orDie(
          Effect.flip(fixture.ops.run({ op: "title", id: "sink", title: "no" }, "mcp")),
        )
        expect(refused._tag).toBe("NotFoundFailure")
      }),
  ))
