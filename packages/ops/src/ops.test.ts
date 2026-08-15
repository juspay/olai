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
  isMirror,
  type OutlineError,
  type OutlineSet,
  parseOutline,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
import * as Store from "@olai/store"
import { describe, expect, test } from "bun:test"
import { Effect, Result, SubscriptionRef } from "effect"

import { codec } from "./codec.ts"
import { repoAt, STAMP, STAMP_SHAPE, steady } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"

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
      // `auto` is the old behaviour, one commit per op, and it is what these
      // tests are written against: the MANUAL path — a commit somebody asks
      // for — is `pending.test.ts`'s subject.
      commits: options.git === true ? "auto" : "off",
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
  Effect.catch(fixture.ops.run(request, "mcp"), (failure) =>
    Effect.die(
      new Error(`\`${request.op}\` was refused: ${failure._tag} — ${failure.message}`),
    ))

const gitLog = (root: string): ReadonlyArray<string> =>
  execFileSync("git", ["log", "--format=%s"], { cwd: root, encoding: "utf8" })
    .trim()
    .split("\n")

// ── the write path ─────────────────────────────────────────────────────

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
      const order = set.nodes.find((located) => located.node.id === "order")?.node
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
        committed: false,
      })

      const text = fixture.read("notes/ideas.olai") ?? ""
      expect(text).toContain(`"title":"an idea"`)
      expect(text.endsWith("\n")).toBe(true)

      const set = yield* fixture.set()
      expect([...set.files].sort()).toEqual(["house.olai", "notes/ideas.olai"])
      expect(set.nodes.some((located) => located.node.id === applied.id)).toBe(true)
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
      expect((yield* fixture.set()).files).toEqual(["house.olai"])
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

      // One revision and one commit for a file and everything in it.
      expect(applied.rev).toBe(2)
      expect(gitLog(fixture.root)).toEqual(["olai: capture: The shed (+2)", "fixtures"])
    }), { git: true }))

test("creating an empty outline is a zero-byte file the sidebar can list", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "create", file: "empty.olai" })
      expect(applied.summary).toBe("create: empty.olai")
      expect(fixture.read("empty.olai")).toBe("")
      expect((yield* fixture.set()).files).toContain("empty.olai")
    })))

test("archiving writes both files, and the set stays valid across them", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "archive", id: "order" })
      expect(applied.file).toBe("Archive.olai")

      expect(fixture.read("house.olai")).not.toContain(`"order"`)
      const archive = fixture.read("Archive.olai") ?? ""
      expect(archive).toContain(`"title":"Kitchen remodel"`)
      expect(archive).toContain(`"id":"order"`)

      // One revision for the pair, not two — the gate renamed both or neither.
      expect(applied.rev).toBe(2)
      const set = yield* fixture.set()
      expect([...set.files].sort()).toEqual(["Archive.olai", "house.olai"])
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
      const byId = new Map(set.nodes.map((located) => [located.node.id, located.node]))
      for (const node of applied.captured ?? []) expect(byId.has(node.id)).toBe(true)
      expect(byId.get(applied.captured?.[3]?.id ?? "")).toMatchObject({ done: STAMP })

      expect(gitLog(fixture.root)).toEqual([
        "olai: capture: the pantry (+3)",
        "fixtures",
      ])
    }), { git: true }))

test("a refusal writes nothing and comes back with its structured detail", () =>
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "kitchen", undo: true }, "mcp")),
      )
      expect(failure._tag).toBe("UsageFailure")
      expect(fixture.read("house.olai")).toBe(HOUSE)
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
  withOps({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // A second outline appears the way a `git pull` would put it there. The
      // store has not probed yet, so the op's first attempt is against a
      // revision the gate's own probe is about to overtake.
      fixture.write("notes.olai", `{"id":"idea","ord":"a0","title":"an idea"}\n`)

      const applied = yield* run(fixture, { op: "done", id: "order" })
      const set = yield* fixture.set()
      expect([...set.files].sort()).toEqual(["house.olai", "notes.olai"])
      expect(
        set.nodes.find((located) => located.node.id === "order")?.node,
      ).toMatchObject({ done: STAMP })
      // The pulled file is still there: the write re-derived rather than
      // re-sending bytes computed from a set that no longer existed.
      expect(fixture.read("notes.olai")).toContain("an idea")
      expect(applied.committed).toBe(false)
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
      const byId = new Map(set.nodes.map((located) => [located.node.id, located.node]))
      expect(byId.get("order")).toMatchObject({ done: STAMP })
      expect(byId.get("install")).toMatchObject({ title: "install the cabinets" })
      expect([...byId.values()].some((node) => "title" in node && node.title === "paint"))
        .toBe(true)
    })))

// ── git ────────────────────────────────────────────────────────────────

describe("the auto-commit", () => {
  test("commits each write with racket's message convention", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* run(fixture, { op: "done", id: "order" })).committed).toBe(true)
        expect((yield* run(fixture, { op: "add", parent: "kitchen", title: "paint" }))
          .committed).toBe(true)
        expect((yield* run(fixture, {
          op: "create",
          file: "shed.olai",
          seed: { title: "clear the shed" },
        })).committed).toBe(true)
        expect((yield* run(fixture, { op: "archive", id: "install" })).committed).toBe(true)

        // Every subject carries the `olai` prefix, which IS the audit filter:
        // `git log --grep '^olai'` is the view of what the tool wrote, and
        // `--invert-grep` gives back the repository's real history.
        expect(gitLog(fixture.root).slice(0, 4)).toEqual([
          "olai: archive: install them",
          "olai: capture: clear the shed",
          "olai: capture: paint",
          "olai: done: order the cabinets",
        ])
        // Both files of the archive landed in ONE commit.
        expect(
          execFileSync("git", ["show", "--name-only", "--format=", "HEAD"], {
            cwd: fixture.root,
            encoding: "utf8",
          }).trim().split("\n").sort(),
        ).toEqual(["Archive.olai", "house.olai"])
      }), { git: true }))

  test("a write that committed says nothing about why not, and git reads healthy", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* run(fixture, { op: "done", id: "order" })
        expect(applied.committed).toBe(true)
        expect(applied.why).toBeUndefined()
        expect(yield* fixture.ops.git).toEqual({ status: "repo", said: null })
      }), { git: true }))

  test("a directory that is not a work tree is written anyway, and says why", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // `commits: "auto"`, but there is no repository here.
        const ops = Ops.make({ store: fixture.store, root: fixture.root, commits: "auto" })
        const applied = yield* Effect.orDie(ops.run({ op: "done", id: "order" }, "mcp"))
        expect(applied.committed).toBe(false)
        // The half that was missing: `false` on its own is four different
        // pieces of news, and this is the one that says which.
        expect(applied.why).toContain("not a git work tree")
        expect(yield* ops.git).toEqual({ status: "none", said: null })
        expect(fixture.read("house.olai")).toContain(`"done"`)
      })))

  /**
   * The bug, end to end: a repository whose next commit cannot be made.
   *
   * The write lands — that is the guarantee, and no part of this may fail,
   * delay or retry it — and everything the reader needs arrives with it: the
   * reply says why in git's own words, and the state the server publishes goes
   * to `error`, which is what puts "Git error" in the app header instead of
   * nothing at all.
   *
   * This is the case that CANNOT be derived from a probe, which is why the
   * refusal is the one thing `./pending.ts` remembers: `rev-parse` answers
   * perfectly happily in a repository with no identity, so a state derived from
   * the directory alone would read healthy while every commit failed.
   */
  test("a git that refuses the commit lands the write, says why, and turns the state", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* run(fixture, { op: "done", id: "order" })

        expect(applied.committed).toBe(false)
        expect(applied.why).toContain("identity")
        expect(fixture.read("house.olai")).toContain(`"done"`)
        // Nothing was refused: a git failure is not an op failure.
        expect(fixture.refusals).toEqual([])
        // Still the repository's own history, with nothing new in it.
        expect(gitLog(fixture.root)).toEqual(["fixtures"])

        const state = yield* fixture.ops.git
        expect(state.status).toBe("error")
        expect(state.said).toContain("identity")
      }), { git: true, identity: false }))

  test("a git that recovers takes the state back to healthy", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* run(fixture, { op: "done", id: "order" })
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

        const applied = yield* run(fixture, { op: "add", parent: "kitchen", title: "paint" })
        expect(applied.committed).toBe(true)
        expect(applied.why).toBeUndefined()
        // Cleared by the thing that worked, which is the other half of
        // remembering it: a refusal that outlived its cause would be a header
        // shouting about a repository that is fine now.
        expect(yield* fixture.ops.git).toEqual({ status: "repo", said: null })
      }), { git: true, identity: false }))

  /**
   * The default mode, at this seam: a write LANDS and WAITS, and the sentence
   * it carries back says exactly that.
   *
   * The whole of `Applied.why` under `manual` is that it must not read as a
   * fault. `committed: false` is four different pieces of news — the opt-out, no
   * repository, a git that refuses, and this one — and this one is the feature
   * working. A reader who saw the git-error wording here would go looking for a
   * broken repository that is not broken.
   */
  test("a write under the default mode waits, and says so without sounding broken", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const ops = Ops.make({
          store: fixture.store,
          root: fixture.root,
          commits: "manual",
          context: steady(),
        })
        const applied = yield* Effect.orDie(ops.run({ op: "done", id: "order" }, "mcp"))

        expect(applied.committed).toBe(false)
        expect(applied.why).toContain("waiting to be committed")
        // Not a fault, in either vocabulary: nothing about git failing, and the
        // readout stays healthy.
        expect(applied.why).not.toContain("could not")
        expect(applied.why).not.toContain("refused")
        expect(yield* ops.git).toEqual({ status: "repo", said: null })
        // The write is on disk, and nothing is in the log yet.
        expect(fixture.read("house.olai")).toContain(`"done"`)
        expect(gitLog(fixture.root)).toEqual(["fixtures"])
      }), { git: true }))

  test("the opt-out writes without committing, and says that is why", () =>
    withOps({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const ops = Ops.make({ store: fixture.store, root: fixture.root, commits: "off" })
        const applied = yield* Effect.orDie(ops.run({ op: "done", id: "order" }, "mcp"))
        expect(applied.committed).toBe(false)
        expect(applied.why).toContain("--commit=off")
        expect(gitLog(fixture.root)).toEqual(["fixtures"])
        // `off` without asking git anything: the opt-out is a state, not a
        // probe that came back empty — which is what keeps olai out of the
        // history of a directory whose history is somebody else's job.
        expect(yield* ops.git).toEqual({ status: "off", said: null })
      }), { git: true }))
})

