import { parsers } from "./parser.testlib.ts"
import { TEST_CLAIMS } from "@olai/ops/testlib"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import { COMMIT_BUTTON, DEFAULT_POLICY, NO_KINDS, Writer } from "@olai/format"
import * as Store from "@olai/store"
import { describe, expect, test } from "bun:test"
import { Cause, Effect, Exit, type Scope } from "effect"

import { codecFor } from "@olai/ops"
import type { Reading, Verdict } from "@olai/format"
import type * as StoreModule from "@olai/store"
import { GIT_IDENT, GIT_IDENT_KEYS, gitIn, repoAt, writerOf } from "../git/fixtures.testlib.ts"
import * as Ops from "@olai/ops"
import {
  COMMIT_TOOL,
  commitDoor,
  type Committing,
  make as makeLedger,
  whyOf,
} from "./pending.ts"

type OutlineStore = StoreModule.Store<Reading, Verdict>

const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS })

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  "",
].join("\n")

type GitOps = Ops.Ops & Pick<
  Committing,
  "pending" | "waiting" | "status" | "observe" | "hold" | "loop" | "git" | "catchUp" | "unlock"
>

interface Fixture {
  readonly ops: GitOps
  readonly root: string
  readonly git: (...argv: ReadonlyArray<string>) => string
  readonly write: (file: string, contents: string) => void
  readonly refresh: Effect.Effect<void>
  readonly remote: () => string
  readonly settlements: () => number
  readonly settled: (from: number) => Effect.Effect<void>
  readonly unident: () => void
  readonly reident: () => void
  readonly observe: Effect.Effect<void>
}

const withRepo = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Effect.Effect<A, never, Scope.Scope>,
  options: {
    readonly commits?: "off" | "manual" | "auto"
    readonly pushes?: "off" | "auto"
    readonly quiet?: number
    readonly serve?: string
  } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-pending-")))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  // git reads the ident from the environment first: an empty `GIT_AUTHOR_NAME`
  // beats local `user.name`, so the ident is pinned in the env here.
  const savedIdent = Object.fromEntries(
    GIT_IDENT_KEYS.map((key) => [key, process.env[key]]),
  )
  Object.assign(process.env, GIT_IDENT)

  const git = gitIn(root)
  const served = options.serve === undefined ? root : path.join(root, options.serve)
  fs.mkdirSync(served, { recursive: true })
  repoAt(root)

  const remote = (): string => {
    const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-remote-")))
    gitIn(bare)("init", "--quiet", "--bare", "--initial-branch", "main")
    git("remote", "add", "origin", bare)
    git("push", "--quiet", "--set-upstream", "origin", "main")
    return bare
  }

  let settlements = 0
  const waiters: Array<() => void> = []
  const onSettled = () => {
    settlements += 1
    const ready = waiters.splice(0)
    for (const wake of ready) wake()
  }
  return Effect.gen(function*() {
    const store: OutlineStore = yield* Store.make({
      root: served,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const policy = {
      commit: options.commits ?? "manual",
      push: options.pushes ?? "off",
    } as const
    const ledger = makeLedger({
      ops: parsers,
      at: Effect.map(store.read("cheap"), (s) => s.snapshot?.value ?? null),
      root: served,
      policy: () => policy,
      onSettled,
      ...(options.quiet === undefined ? {} : { quiet: options.quiet }),
    })
    const ops: GitOps = {
      ...Ops.make({claims: { current: TEST_CLAIMS }, format: "outline-olai",
        store,
        root: served,
        ledger: {
          wrote: ledger.wrote,
          whyWaiting: ledger.whyWaiting,
          record: ledger.commit,
          push: ledger.push,
          resume: ledger.resume,
          hold: ledger.hold,
          waiting: ledger.waiting,
        },
        context: { mint: () => "minted", now: () => "2026-08-10T09:00:00-04:00" },
      }),
      pending: ledger.pending,
      status: ledger.status,
      waiting: ledger.waiting,
      observe: ledger.observe,
      hold: ledger.hold,
      loop: ledger.loop,
      git: ledger.git,
      catchUp: ledger.catchUp,
      unlock: ledger.unlock,
    }
    return yield* use({
      ops,
      root,
      git,
      write,
      remote,
      refresh: Effect.orDie(store.refresh("cheap")),
      settlements: () => settlements,
      settled: (from: number) =>
        Effect.callback<void>((resume) => {
          let done = false
          const check = () => {
            if (done || settlements <= from) return
            done = true
            resume(Effect.void)
          }
          waiters.push(check)
          check()
        }),
      unident: () => {
        git("config", "user.email", "")
        git("config", "user.name", "")
        for (const key of GIT_IDENT_KEYS) process.env[key] = ""
      },
      reident: () => {
        git("config", "user.email", GIT_IDENT.GIT_AUTHOR_EMAIL)
        git("config", "user.name", GIT_IDENT.GIT_AUTHOR_NAME)
        Object.assign(process.env, GIT_IDENT)
      },
      observe: Effect.flatMap(ops.pending, ops.observe),
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    for (const key of GIT_IDENT_KEYS) {
      const was = savedIdent[key]
      if (was === undefined) delete process.env[key]
      else process.env[key] = was
    }
    fs.rmSync(root, { recursive: true, force: true })
  })
}

const subjects = (fixture: Fixture): ReadonlyArray<string> =>
  fixture.git("log", "--format=%s").trim().split("\n")

const conflicted = (fixture: Fixture): Effect.Effect<void> =>
  Effect.gen(function*() {
    fixture.write("notes.md", "as it was\n")
    fixture.git("add", "-A")
    fixture.git("commit", "--quiet", "-m", "notes")

    fixture.git("checkout", "--quiet", "-b", "other")
    fixture.write("notes.md", "their side\n")
    fixture.git("commit", "--quiet", "-am", "other")
    fixture.git("checkout", "--quiet", "main")
    fixture.write("notes.md", "our side\n")
    fixture.git("commit", "--quiet", "-am", "main")
    try {
      fixture.git("merge", "other")
    } catch {
    }
    yield* fixture.refresh
  })

describe("manual is the default", () => {
  test("a write lands on disk and waits, and says what is waiting", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* Effect.orDie(
          fixture.ops.run({ op: "done", id: "order" }, "chat-agent"),
        )
        expect(applied.why).toContain("commit: manual")
        expect(subjects(fixture)).toEqual(["fixtures"])

        const pending = yield* fixture.ops.pending
        expect(pending.repo).toEqual({ _tag: "Ready", branch: "main" })
        expect(pending.changes).toEqual([
          {
            file: "house.olai",
            id: "order",
            title: "order the cabinets",
            fields: ["done"],
            sort: "done",
          },
        ])
        expect(pending.wrote).toEqual([{ writer: "chat-agent", ops: 1 }])
        expect(pending.message).toStartWith("olai: 1 edit to house — order the cabinets done")
      })))

  test("committing records it, signs it, and empties what was waiting", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* Effect.orDie(
          fixture.ops.run({ op: "add", parent: "kitchen", title: "paint" }, "chat-agent"),
        )

        const result = yield* fixture.ops.commit(
          { message: "reconcile the kitchen" },
          "chat-agent",
        )
        expect(result._tag).toBe("Committed")
        expect(result._tag === "Committed" ? result.changes : 0).toBe(2)

        expect(subjects(fixture)[0]).toBe("olai: reconcile the kitchen")
        expect(
          fixture.git("log", "--format=%(trailers:key=X-Olai-Writer,valueonly)", "-1").trim(),
        ).toBe("chat-agent")

        const after = yield* fixture.ops.pending
        expect(after.changes).toEqual([])
        expect(after.wrote).toEqual([])
      })))

  test("a quick capture signs its own commits, so the log says which door", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(
          fixture.ops.run({ op: "add", parent: "kitchen", title: "buy handles" }, "mcp"),
        )
        const pending = yield* fixture.ops.pending
        expect(pending.wrote).toEqual([{ writer: "mcp", ops: 1 }])

        yield* fixture.ops.commit({ message: "one captured line" }, "mcp")
        expect(writerOf(fixture.root)).toBe("mcp")
        expect((yield* fixture.ops.pending).last).toMatchObject({ writer: "mcp" })
      })))

  test("a commit an older olai signed `filer` still reads back as a writer", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("notes.md", "filed under something\n")
        fixture.git("add", "-A")
        fixture.git("commit", "--quiet", "-m", "olai: filed a conversation\n\nX-Olai-Writer: filer\n")
        expect(writerOf(fixture.root)).toBe("filer")

        expect((yield* fixture.ops.pending).last).toMatchObject({ writer: "filer" })

        expect(commitDoor("filer")).toBe(COMMIT_BUTTON)
      })))

  test("what was last recorded is answered beside what is waiting", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* fixture.ops.pending).last).toBe(null)

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* fixture.ops.commit({ message: "the cabinets are ordered" }, "chat-agent")

        const after = yield* fixture.ops.pending
        expect(after.changes).toEqual([])
        expect(after.last).toMatchObject({
          message: "olai: the cabinets are ordered",
          writer: "chat-agent",
        })

        fixture.write("notes.md", "mine\n")
        fixture.git("add", "-A")
        fixture.git("commit", "--quiet", "-m", "mine, by hand")
        expect((yield* fixture.ops.pending).last).toMatchObject({
          message: "olai: the cabinets are ordered",
        })
      })))

  test("a second commit with nothing waiting is an answer, not a commit", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("NothingToCommit")
        expect(subjects(fixture)).toEqual(["fixtures"])
      })))

  test("an edit made behind olai's back is pending too, and is swept up", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("house.olai", HOUSE.replace("install them", "install the cabinets"))
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.changes).toEqual([
          {
            file: "house.olai",
            id: "install",
            title: "install the cabinets",
            fields: ["title"],
            sort: "renamed",
          },
        ])
        expect(pending.wrote).toEqual([])

        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Committed")
        expect(yield* fixture.ops.pending).toMatchObject({ changes: [] })
      })))

  test("a commit made in a terminal empties it, with no write in between", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        expect((yield* fixture.ops.pending).changes).toHaveLength(1)

        fixture.git("commit", "--quiet", "-am", "by hand")
        expect((yield* fixture.ops.pending).changes).toEqual([])
      })))
})

describe("what is committed, and what is not", () => {
  test("every other dirty file in the repository waits too, and is swept up", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("notes.md", "a document, which olai never writes\n")
        fixture.write("script.sh", "somebody else's work\n")
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.changes).toHaveLength(1)
        expect(pending.outlines).toEqual([
          { file: "house.olai", path: "house.olai", how: "modified", from: null },
        ])
        expect([...pending.others].sort((a, b) => a.path.localeCompare(b.path)))
          .toEqual([
            { path: "notes.md", how: "untracked", from: null },
            { path: "script.sh", how: "untracked", from: null },
          ])
        expect(pending.message).toContain("· 2 other files")
        expect(pending.message).toContain("untracked: notes.md")

        const done = yield* fixture.ops.commit({}, "web")
        expect(done._tag).toBe("Committed")
        expect(done._tag === "Committed" ? done.changes : -1).toBe(1)
        expect(done._tag === "Committed" ? done.others : -1).toBe(2)
        expect(fixture.git("status", "--porcelain").trim()).toBe("")
      })))

  test("a commit takes exactly the paths it was given, and leaves the index alone", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("notes.md", "the one to commit\n")
        fixture.write("later.md", "not this time\n")
        fixture.write("mine.md", "half-finished, staged by hand\n")
        fixture.git("add", "mine.md")
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.refresh

        const done = yield* fixture.ops.commit(
          { paths: ["house.olai", "notes.md"] },
          "web",
        )
        expect(done._tag).toBe("Committed")
        expect(done._tag === "Committed" ? done.others : -1).toBe(1)

        expect(fixture.git("show", "--name-only", "--format=", "HEAD").trim().split("\n").sort())
          .toEqual(["house.olai", "notes.md"])
        expect(fixture.git("status", "--porcelain").trim().split("\n").sort())
          .toEqual(["?? later.md", "A  mine.md"])

        const after = yield* fixture.ops.pending
        expect(after.changes).toEqual([])
        expect([...after.others].map((one) => one.path).sort())
          .toEqual(["later.md", "mine.md"])
      })))

  test("a path that is not waiting refuses, and commits nothing", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))

        const done = yield* fixture.ops.commit(
          { paths: ["house.olai", "typo.md"] },
          "web",
        )
        expect(done._tag).toBe("Failed")
        expect(done._tag === "Failed" ? done.said : "").toContain("typo.md")
        expect(subjects(fixture)).toEqual(["fixtures"])
      })))

  test("an unreadable outline is listed rather than dropped", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("house.olai", "this is not a record\n")
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.unreadable).toEqual(["house.olai"])
        expect(pending.changes).toEqual([])
      })))
})

describe("a rename staged by hand", () => {
  const KEPT = [
    `{"id":"kept","ord":"a0","title":"Kept for later"}`,
    "",
  ].join("\n")

  test("reads as a rename in the panel, not as a deletion", () =>
    withRepo({ "house.olai": HOUSE, "Kept.md": KEPT }, (fixture) =>
      Effect.gen(function*() {
        fixture.git("mv", "Kept.md", "Kept.olai")
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.outlines).toEqual([
          {
            file: "Kept.olai",
            path: "Kept.olai",
            how: "renamed",
            from: "Kept.md",
          },
        ])
        expect(pending.others).toEqual([])
        expect(pending.message).not.toContain("deleted: Kept.md")
        expect(pending.changes).toEqual([
          {
            file: "Kept.olai",
            id: "kept",
            title: "Kept for later",
            fields: [],
            sort: "created",
          },
        ])
      })))

  test("names both halves in the log, for a file that is not an outline", () =>
    withRepo({ "house.olai": HOUSE, "notes.md": "a document\n" }, (fixture) =>
      Effect.gen(function*() {
        fixture.git("mv", "notes.md", "later.md")
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.others).toEqual([
          { path: "later.md", how: "renamed", from: "notes.md" },
        ])
        expect(pending.message).toContain("renamed: notes.md → later.md")
      })))

  test("commits as one rename rather than leaking git's pathspec fatal", () =>
    withRepo({ "house.olai": HOUSE, "Kept.md": KEPT }, (fixture) =>
      Effect.gen(function*() {
        fixture.git("mv", "Kept.md", "Kept.olai")
        yield* fixture.refresh

        const done = yield* fixture.ops.commit({}, "mcp")
        expect(done._tag === "Failed" ? done.said : "").not.toContain("pathspec")
        expect(done._tag).toBe("Committed")

        expect(
          fixture.git("show", "--name-status", "--find-renames", "--format=", "HEAD").trim(),
        ).toBe("R100\tKept.md\tKept.olai")
        expect(fixture.git("status", "--porcelain").trim()).toBe("")
      })))

  test("a selection naming the new side takes the whole rename", () =>
    withRepo({ "house.olai": HOUSE, "Kept.md": KEPT }, (fixture) =>
      Effect.gen(function*() {
        fixture.git("mv", "Kept.md", "Kept.olai")
        fixture.write("later.md", "not this time\n")
        yield* fixture.refresh

        const done = yield* fixture.ops.commit({ paths: ["Kept.olai"] }, "web")
        expect(done._tag).toBe("Committed")

        expect(
          fixture.git("show", "--name-status", "--find-renames", "--format=", "HEAD").trim(),
        ).toBe("R100\tKept.md\tKept.olai")
        expect(fixture.git("status", "--porcelain").trim()).toBe("?? later.md")
      })))

  test("between two served outlines, the nodes read as moved rather than reborn", () =>
    withRepo({ "house.olai": HOUSE, "keep.olai": KEPT }, (fixture) =>
      Effect.gen(function*() {
        fixture.git("mv", "keep.olai", "later.olai")
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.outlines).toEqual([
          { file: "later.olai", path: "later.olai", how: "renamed", from: "keep.olai" },
        ])
        expect(pending.changes).toEqual([
          {
            file: "later.olai",
            id: "kept",
            title: "Kept for later",
            fields: ["file"],
            sort: "moved",
          },
        ])
      })))

  test("a file added to the index by hand is waiting, and commits when picked", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("staged.md", "staged by hand\n")
        fixture.git("add", "staged.md")
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.others).toEqual([{ path: "staged.md", how: "added", from: null }])

        const done = yield* fixture.ops.commit({ paths: ["staged.md"] }, "web")
        expect(done._tag).toBe("Committed")
        expect(fixture.git("status", "--porcelain").trim()).toBe("")
      })))
})

describe("a served subdirectory reports on the whole repository", () => {
  test("root-level dirt is waiting, and says which part olai serves", () =>
    withRepo(
      { "docs/house.olai": HOUSE },
      (fixture) =>
        Effect.gen(function*() {
          fixture.write("README.md", "edited by hand, one level up\n")
          fixture.write("elsewhere.olai", `{"id":"e","ord":"a0","title":"e"}\n`)
          yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
          yield* fixture.refresh

          const pending = yield* fixture.ops.pending
          expect(pending.served).toBe("docs/")
          expect(pending.outlines).toEqual([
            { file: "house.olai", path: "docs/house.olai", how: "modified", from: null },
          ])
          expect([...pending.others].map((one) => one.path).sort())
            .toEqual(["README.md", "elsewhere.olai"])
          expect(pending.changes).toEqual([
            {
              file: "house.olai",
              id: "order",
              title: "order the cabinets",
              fields: ["done"],
              sort: "done",
            },
          ])

          expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Committed")
          expect(fixture.git("status", "--porcelain").trim()).toBe("")
          expect((yield* fixture.ops.pending).last).not.toBe(null)
        }),
      { serve: "docs" },
    ))

  test("what is waiting carries the served name and the repository one", () =>
    withRepo(
      { "docs/house.olai": HOUSE, "docs/notes.md": "as it was\n" },
      (fixture) =>
        Effect.gen(function*() {
          fixture.write("docs/house.olai", `${HOUSE}{"id":"later","parent":"kitchen","ord":"a9","title":"later"}\n`)
          yield* fixture.refresh
          fixture.write("docs/notes.md", "and another thing\n")
          yield* fixture.refresh
          expect(yield* fixture.ops.waiting).toEqual([
            { file: "house.olai", path: "docs/house.olai" },
          ])
        }),
      { serve: "docs" },
    ))

  test("a rename from above the served root still reads against HEAD's own copy", () =>
    withRepo(
      { "docs/house.olai": HOUSE, "Before.olai": `{"id":"kept","ord":"a0","title":"Kept"}\n` },
      (fixture) =>
        Effect.gen(function*() {
          fixture.git("mv", "Before.olai", "docs/Notes.olai")
          yield* fixture.refresh

          const pending = yield* fixture.ops.pending
          expect(pending.outlines).toEqual([
            {
              file: "Notes.olai",
              path: "docs/Notes.olai",
              how: "renamed",
              from: "Before.olai",
            },
          ])
          expect(pending.others).toEqual([])
          expect(pending.changes).toEqual([
            {
              file: "Notes.olai",
              id: "kept",
              title: "Kept",
              fields: ["file"],
              sort: "moved",
            },
          ])

          expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Committed")
          expect(
            fixture.git("show", "--name-status", "--find-renames", "--format=", "HEAD").trim(),
          ).toBe("R100\tBefore.olai\tdocs/Notes.olai")
        }),
      { serve: "docs" },
    ))

  test("a served outline and a root file of the same name are two ticks", () =>
    withRepo(
      { "docs/house.olai": HOUSE },
      (fixture) =>
        Effect.gen(function*() {
          fixture.write("house.olai", `{"id":"other","ord":"a0","title":"not served"}\n`)
          yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
          yield* fixture.refresh

          const done = yield* fixture.ops.commit({ paths: ["house.olai"] }, "web")
          expect(done._tag).toBe("Committed")
          expect(fixture.git("show", "--name-only", "--format=", "HEAD").trim())
            .toBe("house.olai")
          expect((yield* fixture.ops.pending).outlines)
            .toEqual([{ file: "house.olai", path: "docs/house.olai", how: "modified", from: null }])
        }),
      { serve: "docs" },
    ))
})

describe("push", () => {
  test("what is unpushed is surveyed, and pushing sends it", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        expect((yield* fixture.ops.pending).unpushed)
          .toEqual({ upstream: "origin/main", commits: 0 })
        expect((yield* fixture.ops.push)._tag).toBe("NothingToPush")

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.ops.commit({ message: "the cabinets are ordered" }, "web")
        expect((yield* fixture.ops.pending).unpushed)
          .toEqual({ upstream: "origin/main", commits: 1 })
        const sent = yield* fixture.ops.push
        expect(sent).toEqual({
          _tag: "Pushed",
          upstream: "origin/main",
          commits: 1,
          integrated: 0,
        })
        expect(gitIn(bare)("log", "--format=%s", "-1", "main").trim())
          .toBe("olai: the cabinets are ordered")
        expect((yield* fixture.ops.pending).unpushed)
          .toEqual({ upstream: "origin/main", commits: 0 })
      })))

  test("no upstream is not the same as nothing to push", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* fixture.ops.pending).unpushed).toBe(null)
      })))

  test("a push with no upstream is git's own refusal, remembered and republished", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-remote-")))
        gitIn(bare)("init", "--quiet", "--bare", "--initial-branch", "main")
        fixture.git("remote", "add", "origin", bare)
        fixture.git("push", "--quiet", "origin", "main")
        fixture.git("checkout", "--quiet", "-b", "mine")
        fixture.write("notes.md", "the cabinets are late\n")
        fixture.git("add", "notes.md")
        fixture.git("commit", "--quiet", "-m", "olai: mine")
        yield* fixture.refresh

        const sent = yield* fixture.ops.push
        expect(sent._tag).toBe("Failed")
        if (sent._tag !== "Failed") throw new Error("unreachable")
        expect(sent.said).toBeTruthy()
        expect(sent.said).not.toContain("no upstream to push to")
        expect(sent.said.toLowerCase()).toContain("upstream")
        const said = yield* fixture.ops.git
        expect(said.pushSaid).not.toBeNull()
        expect(said.paused).toBeNull()
      }), { commits: "manual", pushes: "auto" }))

  test("a refusal surfaces verbatim", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-clone-")))
        gitIn(elsewhere)("clone", "--quiet", bare, ".")
        gitIn(elsewhere)("config", "user.email", "test@olai.invalid")
        gitIn(elsewhere)("config", "user.name", "olai tests")
        fs.writeFileSync(
          path.join(elsewhere, "house.olai"),
          HOUSE.replace('"order the cabinets"', '"order the cabinets"  // theirs'),
        )
        gitIn(elsewhere)("add", "-A")
        gitIn(elsewhere)("commit", "--quiet", "-m", "theirs")
        gitIn(elsewhere)("push", "--quiet", "origin", "main")

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        const edit = HOUSE.replace('"order the cabinets"', '"order the cabinets"  /* mine */')
        fixture.write("house.olai", edit)
        yield* fixture.ops.commit({ message: "mine" }, "web")

        const sent = yield* fixture.ops.push
        if (sent._tag === "Failed") {
          expect(sent.said).toContain("conflict")
          expect(sent.said).toContain("CONFLICT")
        }
        expect(fs.readFileSync(path.join(fixture.root, "house.olai"), "utf8"))
          .toContain(`"order"`)
        expect((yield* fixture.ops.git).paused).toBeNull()
      }), { commits: "manual", pushes: "auto" }))

  test("a diverged push integrates and lands, and reports what it took in", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-clone-")))
        gitIn(elsewhere)("clone", "--quiet", bare, ".")
        gitIn(elsewhere)("config", "user.email", "test@olai.invalid")
        gitIn(elsewhere)("config", "user.name", "olai tests")
        fs.writeFileSync(path.join(elsewhere, "theirs.md"), "from another clone\n")
        gitIn(elsewhere)("add", "-A")
        gitIn(elsewhere)("commit", "--quiet", "-m", "theirs")
        gitIn(elsewhere)("push", "--quiet", "origin", "main")

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.ops.commit({ message: "mine" }, "web")
        const before = fixture.settlements()

        const sent = yield* fixture.ops.push
        expect(sent).toEqual({
          _tag: "Pushed",
          upstream: "origin/main",
          commits: 1,
          integrated: 1,
        })
        expect(gitIn(bare)("log", "--format=%s", "-1", "main").trim())
          .toStartWith("olai:")
        expect(gitIn(bare)("log", "--format=%s", "main", "-2").trim().split("\n"))
          .toEqual(["olai: mine", "theirs"])
        expect(fs.readFileSync(path.join(fixture.root, "theirs.md"), "utf8"))
          .toBe("from another clone\n")
        expect((yield* fixture.ops.git).paused).toBeNull()
        expect(fixture.settlements()).toBeGreaterThan(before)
      })))

  test("commits off has nothing to push either", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const sent = yield* fixture.ops.push
        expect(sent).toEqual({ _tag: "Blocked", repo: { _tag: "Off" } })
      }), { commits: "off" }))

  test("a busy repository is refused with its reason rather than git's detached HEAD", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.remote()
        yield* conflicted(fixture)

        const sent = yield* fixture.ops.push
        expect(sent._tag).toBe("Blocked")
        expect(sent._tag === "Blocked" ? sent.repo._tag : "").toBe("Blocked")
        expect(sent._tag === "Blocked" && sent.repo._tag === "Blocked" ? sent.repo.reason : "")
          .toBe("merge")
      })))
})

test("a working tree git cannot survey is an error, not an empty one", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
      expect((yield* fixture.ops.pending).changes).toHaveLength(1)

      fs.rmSync(path.join(fixture.root, ".git"), { recursive: true, force: true })

      const both = yield* fixture.ops.status
      expect(both.pending.repo._tag).toBe("Unusable")
      expect(both.pending.repo._tag === "Unusable" ? both.pending.repo.said : "")
        .not.toBe("")
      expect(both.git).toMatchObject({ status: "error" })
      expect(both.pending.changes).toEqual([])
      expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Blocked")
    })))

describe("a repository that cannot take a commit", () => {
  test("says so instead of committing into a conflict", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* conflicted(fixture)

        const result = yield* fixture.ops.commit({}, "web")
        expect(result._tag).toBe("Blocked")
        expect(result._tag === "Blocked" ? result.repo._tag : "").toBe("Blocked")
        expect(subjects(fixture)[0]).not.toStartWith("olai:")
      })))
})

/**
 * git refuses every write while `.git/index.lock` exists and removes it only on
 * exits it controls, so a killed process leaves one behind for ever. `git status`
 * still answers with one in place: only the write verbs refuse.
 */
describe("the stale lock file", () => {
  const staleLock = (fixture: Fixture): string => {
    const at = path.join(fixture.root, ".git", "index.lock")
    fs.writeFileSync(at, "")
    const stamp = (Date.now() - 10 * 60_000) / 1000
    fs.utimesSync(at, stamp, stamp)
    return at
  }

  test("a refusal over a lock puts the file on the cell, and unlock removes it and clears it", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.refresh
        const lock = staleLock(fixture)

        const refused = yield* fixture.ops.commit({}, "web")
        expect(refused._tag).toBe("Failed")
        expect(refused._tag === "Failed" ? refused.lock?.since : undefined).toBeNumber()

        const before = yield* fixture.ops.git
        expect(before.status).toBe("error")
        expect(before.said).toContain("index.lock")
        expect(before.lock).not.toBe(null)

        const settlements = fixture.settlements()
        expect(yield* Effect.orDie(fixture.ops.unlock)).toEqual({ _tag: "Removed" })
        expect(fs.existsSync(lock)).toBe(false)
        yield* fixture.settled(settlements)
        const after = yield* fixture.ops.git
        expect(after.status).toBe("repo")
        expect(after.said).toBe(null)
        expect(after.lock).toBe(null)

        expect((yield* fixture.ops.commit({ message: "the lock is gone" }, "web"))._tag)
          .toBe("Committed")
        expect(subjects(fixture)[0]).toBe("olai: the lock is gone")

        expect(yield* Effect.orDie(fixture.ops.unlock)).toEqual({ _tag: "Absent" })
        expect((yield* fixture.ops.git).status).toBe("repo")
      })))

  test("unlock on a lock a git process may still be writing rewrites the age on the cell", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.refresh
        const lock = staleLock(fixture)
        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Failed")
        const before = yield* fixture.ops.git
        expect(before.lock?.since).toBeLessThan(Date.now() - 60_000)

        const fresh = (Date.now() - 1_000) / 1000
        fs.utimesSync(lock, fresh, fresh)
        const settlements = fixture.settlements()

        expect((yield* Effect.orDie(fixture.ops.unlock))._tag).toBe("Held")

        expect(fs.existsSync(lock)).toBe(true)
        expect((yield* fixture.ops.git).status).toBe("error")
        yield* fixture.settled(settlements)
        const after = yield* fixture.ops.git
        expect(after.lock?.since ?? 0).toBeGreaterThan(Date.now() - 10_000)
        expect(after.lock?.since ?? 0).toBeGreaterThan(before.lock?.since ?? 0)
      })))

  test("an unlock that could not remove the file fails, and clears nothing", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        if (typeof process.getuid === "function" && process.getuid() === 0) return
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.refresh
        const lock = staleLock(fixture)
        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Failed")

        const dir = path.dirname(lock)
        fs.chmodSync(dir, 0o500)
        const settlements = fixture.settlements()
        const failed = yield* Effect.exit(fixture.ops.unlock)
        fs.chmodSync(dir, 0o700)

        expect(Exit.isFailure(failed)).toBe(true)
        const why = Exit.isFailure(failed) ? Cause.squash(failed.cause) : undefined
        expect((why as Error | undefined)?.message ?? "").toContain("permission denied")
        expect(fs.existsSync(lock)).toBe(true)
        expect((yield* fixture.ops.git).status).toBe("error")
        expect((yield* fixture.ops.git).lock).not.toBe(null)
        expect(fixture.settlements()).toBe(settlements)
      })))

  test("unlock clears the pause the refusal left, so auto-commit is armed again", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.refresh
        const lock = staleLock(fixture)

        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Failed")
        const before = yield* fixture.ops.git
        expect(before.paused).not.toBe(null)
        expect(before.lock).not.toBe(null)

        expect((yield* Effect.orDie(fixture.ops.unlock))._tag).toBe("Removed")
        const after = yield* fixture.ops.git
        expect(after.paused).toBe(null)
        expect(after.lock).toBe(null)
        expect(after.status).toBe("repo")
      }), { commits: "auto" }))
})

describe("the agent's door", () => {
  test("a commit records which face asked for it", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "mcp"))
        const answered = yield* fixture.ops.commit(
          { message: "order the cabinets, at last" },
          "mcp",
        )
        expect(answered._tag).toBe("Committed")

        expect(subjects(fixture)[0]).toBe("olai: order the cabinets, at last")
        expect(
          fixture.git("log", "--format=%(trailers:key=X-Olai-Writer,valueonly)", "-1").trim(),
        ).toBe("mcp")
      })))
})

describe("commit: auto: the quiet window", () => {
  test("a write does not commit itself, and says what it is waiting for", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* Effect.orDie(
          fixture.ops.run({ op: "done", id: "order" }, "chat-agent"),
        )
        expect(subjects(fixture)).toEqual(["fixtures"])
        expect(applied.why).toContain("commit: auto")
        expect(applied.why).not.toContain("Commit button")
        expect((yield* fixture.ops.pending).wrote).toEqual([
          { writer: "chat-agent", ops: 1 },
        ])
      }), { commits: "auto", quiet: 40 }))

  test("a flurry of writes records itself as ONE commit, whoever wrote them", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "install" }, "mcp"))
        fixture.write("notes.md", "the cabinets are late\n")
        yield* fixture.refresh

        yield* Effect.forkScoped(fixture.ops.loop)
        const flurry = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(flurry)
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
        const pending = yield* fixture.ops.pending
        expect(pending.changes).toEqual([])
        expect(pending.others).toEqual([])
        expect(pending.wrote).toEqual([])
        expect(pending.last).toMatchObject({ writer: "auto" })
      }), { commits: "auto", quiet: 40 }))

  test("a survey that says nothing new does not push the window out", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.forkScoped(fixture.ops.loop)
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        const sweep = fixture.settlements()
        yield* fixture.observe
        for (let round = 0; round < 10; round++) {
          yield* fixture.observe
        }
        yield* fixture.settled(sweep)
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
        for (let round = 0; round < 10; round++) {
          yield* fixture.observe
        }
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
      }), { commits: "auto", quiet: 40 }))

  test("nothing is attempted while the repository is busy, and it records after", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.forkScoped(fixture.ops.loop)
        yield* conflicted(fixture)

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* fixture.observe
        expect(subjects(fixture)[0]).not.toStartWith("olai:")
        expect((yield* fixture.ops.git).paused).toBeNull()

        fixture.write("notes.md", "resolved\n")
        fixture.git("add", "notes.md")
        fixture.git("commit", "--quiet", "--no-edit")
        yield* fixture.refresh
        const afterMerge = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(afterMerge)
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
      }), { commits: "auto", quiet: 40 }))

  test("a commit git refuses stops the loop, says so on the cell, and Resume starts it", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.forkScoped(fixture.ops.loop)
        fixture.unident()

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        const refused = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(refused)

        const stopped = yield* fixture.ops.git
        expect(stopped.status).toBe("error")
        expect(stopped.paused).not.toBeNull()
        expect(fixture.settlements()).toBeGreaterThan(0)

        fixture.write("notes.md", "and another thing\n")
        yield* fixture.refresh
        yield* fixture.observe
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(0)

        fixture.reident()
        yield* fixture.ops.resume
        expect((yield* fixture.ops.git).paused).toBeNull()
        yield* fixture.ops.resume
        const resumed = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(resumed)
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
        expect((yield* fixture.ops.git).paused).toBeNull()
      }), { commits: "auto", quiet: 40 }))

  test("nothing records while a hold is out, and releasing it records what waited", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.forkScoped(fixture.ops.loop)
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))

        yield* Effect.scoped(Effect.gen(function*() {
          yield* fixture.ops.hold
          yield* Effect.orDie(fixture.ops.run({ op: "done", id: "install" }, "sleep"))
          yield* fixture.observe
          yield* Effect.sleep(160)
          expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(0)
        }))

        const released = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(released)
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
        expect((yield* fixture.ops.pending).wrote).toEqual([])
      }), { commits: "auto", quiet: 40 }))

  test("a second hold does not release the first's", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.forkScoped(fixture.ops.loop)
        yield* Effect.scoped(Effect.gen(function*() {
          yield* fixture.ops.hold
          yield* Effect.scoped(Effect.gen(function*() {
            yield* fixture.ops.hold
            yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "sleep"))
            yield* fixture.observe
          }))
          yield* Effect.sleep(120)
          expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(0)
        }))

        const released = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(released)
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
      }), { commits: "auto", quiet: 40 }))

  test("a hold DOES stop an agent's sweeping commit, and a named one still goes", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* Effect.scoped(Effect.gen(function*() {
          yield* fixture.ops.hold
          const swept = yield* fixture.ops.commit({}, "chat-agent")
          expect(swept._tag).toBe("Failed")
          expect(swept._tag === "Failed" ? swept.said : "").toContain("names no paths")
          expect((yield* fixture.ops.commit({ paths: ["house.olai"] }, "chat-agent"))._tag).toBe("Committed")
        }))
      }), { commits: "auto", quiet: 40 }))

  test("a hold does not stop a commit somebody asked for", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* Effect.scoped(Effect.gen(function*() {
          yield* fixture.ops.hold
          expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Committed")
        }))
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
      }), { commits: "auto", quiet: 40 }))
})

describe("push: auto", () => {
  test("a commit the AGENT asked for is pushed", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "mcp"))
        expect((yield* fixture.ops.commit({}, "mcp"))._tag).toBe("Committed")

        expect(gitIn(bare)("log", "--format=%s", "-1").trim()).toStartWith("olai:")
        expect((yield* fixture.ops.pending).unpushed?.commits).toBe(0)
      }), { commits: "manual", pushes: "auto" }))

  test("the quiet window's own commit is pushed, with no browser anywhere", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        yield* Effect.forkScoped(fixture.ops.loop)
        fixture.write("notes.md", "the cabinets are late\n")
        yield* fixture.refresh
        const pushed = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(pushed)
        while (true) {
          const n = fixture.settlements()
          if (subjects(fixture).filter((line) => line.startsWith("olai:")).length > 0) break
          yield* fixture.settled(n)
        }
        while (true) {
          const n = fixture.settlements()
          if ((yield* fixture.ops.pending).unpushed?.commits === 0) break
          yield* fixture.settled(n)
        }

        expect(gitIn(bare)("log", "--format=%s", "-1").trim()).toStartWith("olai:")
        expect((yield* fixture.ops.pending).unpushed?.commits).toBe(0)
      }), { commits: "auto", pushes: "auto", quiet: 40 }))

  test("an uncommitted edit in a path the upstream changed waits for its commit, and does not pause", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        const theirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-theirs-")))
        gitIn(theirs)("clone", "--quiet", bare, ".")
        gitIn(theirs)("config", "user.email", "them@example.com")
        gitIn(theirs)("config", "user.name", "them")
        fs.writeFileSync(
          path.join(theirs, "house.olai"),
          HOUSE.replace('"install them"', '"install them"  // theirs'),
        )
        gitIn(theirs)("add", "-A")
        gitIn(theirs)("commit", "--quiet", "-m", "theirs")
        gitIn(theirs)("push", "--quiet")

        fixture.write("notes.md", "the cabinets are late\n")
        fixture.git("add", "notes.md")
        fixture.git("commit", "--quiet", "-m", "olai: mine")

        const edit = HOUSE.replace('Kitchen remodel', 'Kitchen remodel // mine')
        fixture.write("house.olai", edit)
        yield* fixture.refresh

        const refused = yield* fixture.ops.push
        expect(refused._tag).toBe("Failed")
        const said = yield* fixture.ops.git
        expect(said.pushSaid).toContain("overlap")
        expect(said.pushSaid).toMatch(/nothing moved \(house\.olai\)/)
        expect(said.paused).toBeNull()

        yield* fixture.ops.commit({}, "auto")
        expect((yield* fixture.ops.git).pushSaid).toBeNull()
        expect((yield* fixture.ops.git).paused).toBeNull()
        expect((yield* fixture.ops.pending).unpushed?.commits).toBe(0)
        expect(gitIn(bare)("log", "--format=%s", "-1", "main").trim()).toStartWith("olai:")
      }), { commits: "auto", pushes: "auto", quiet: 40 }), { timeout: 20_000 })
  test("a conflict stops the loop, and the words name the file", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        yield* Effect.forkScoped(fixture.ops.loop)

        const theirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-theirs-")))
        gitIn(theirs)("clone", "--quiet", bare, ".")
        gitIn(theirs)("config", "user.email", "them@example.com")
        gitIn(theirs)("config", "user.name", "them")
        fs.writeFileSync(
          path.join(theirs, "house.olai"),
          HOUSE.replace('"order the cabinets"', '"order the cabinets"  // theirs'),
        )
        gitIn(theirs)("add", "-A")
        gitIn(theirs)("commit", "--quiet", "-m", "theirs")
        gitIn(theirs)("push", "--quiet")

        const edit = HOUSE.replace('"order the cabinets"', '"order the cabinets" // mine')
        fixture.write("house.olai", edit)
        yield* fixture.refresh
        yield* fixture.observe

        while (true) {
          const n = fixture.settlements()
          if ((yield* fixture.ops.git).paused !== null) break
          yield* fixture.settled(n)
        }
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
        const said = yield* fixture.ops.git
        expect(said.pushSaid).toContain("conflict")
        expect(said.pushSaid).toContain("CONFLICT")
        expect(said.pushSaid).toContain("house.olai")
        expect(said.status).toBe("repo")
        expect(said.said).toBeNull()
        expect(said.paused).not.toBeNull()
        expect(fs.readFileSync(path.join(fixture.root, "house.olai"), "utf8"))
          .not.toContain("<<<<<<<")

        try {
          fixture.git("merge", "origin/main", "--no-edit")
        } catch {
        }
        fixture.write(
          "house.olai",
          HOUSE.replace('"order the cabinets"', '"order the cabinets"  // resolved'),
        )
        fixture.git("add", "house.olai")
        fixture.git(
          "-c", "core.editor=true",
          "commit", "--no-edit",
        )
        fixture.git("push", "--quiet")
        yield* fixture.ops.resume
        expect((yield* fixture.ops.pending).unpushed?.commits).toBe(0)
        yield* fixture.observe
        expect((yield* fixture.ops.git).pushSaid).toBeNull()
        expect(gitIn(bare)("log", "--format=%s", "-3", "main").replace(/\n/g, " | "))
          .toContain("olai:")
        fs.rmSync(theirs, { recursive: true, force: true })
      }), { commits: "auto", pushes: "auto", quiet: 40 }))
  test("a fetch that fails is a refusal with words and a pause", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        fixture.write("notes.md", "the cabinets are late\n")
        fixture.git("add", "notes.md")
        fixture.git("commit", "--quiet", "-m", "olai: mine")

        const ghost = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ghost-"))), "absent")
        fixture.git("remote", "set-url", "origin", ghost)
        yield* fixture.refresh

        const sent = yield* fixture.ops.push
        expect(sent._tag).toBe("Failed")
        if (sent._tag === "Failed") expect(sent.said).toBeTruthy()
        const said = yield* fixture.ops.git
        expect(said.paused).toBeNull()
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
      }), { commits: "manual", pushes: "auto" }))

  test("two concurrent pushes make one integration", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.remote()
        fixture.write("notes.md", "the cabinets are late\n")
        fixture.git("add", "notes.md")
        fixture.git("commit", "--quiet", "-m", "olai: mine")
        yield* fixture.refresh

        const [a, b] = yield* Effect.all(
          [fixture.ops.push, fixture.ops.push],
          { concurrency: 2 },
        )
        expect(a._tag === "Pushed" || b._tag === "Pushed").toBe(true)
        expect(a._tag === "NothingToPush" || b._tag === "NothingToPush").toBe(true)
        expect((yield* fixture.ops.pending).unpushed?.commits).toBe(0)
      }), { commits: "manual", pushes: "auto" }))
})


describe("commit: off", () => {
  test("has nothing to say at all", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        const pending = yield* fixture.ops.pending
        expect(pending.repo).toEqual({ _tag: "Off" })
        expect(pending.changes).toEqual([])
        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Blocked")
      }), { commits: "off" }))
})

test("both faces commit the same tree and the same message, differing only in the trailer", async () => {
  const committedBy = (writer: "web" | "mcp", paths?: ReadonlyArray<string>) =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("notes.md", "edited by hand\n")
        fixture.write("later.md", "and this one stays waiting\n")
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, writer))
        yield* Effect.orDie(fixture.ops.run({ op: "doing", id: "install" }, writer))
        yield* Effect.orDie(
          fixture.ops.run({ op: "add", parent: "kitchen", title: "measure up" }, writer),
        )
        yield* Effect.orDie(
          fixture.ops.run(
            { op: "mirror", target: "order", parent: "kitchen", id: "now-order" },
            writer,
          ),
        )

        yield* fixture.refresh
        const outcome = yield* fixture.ops.commit(
          paths === undefined ? {} : { paths },
          writer,
        )
        expect(outcome._tag).toBe("Committed")

        return {
          tree: fixture.git("rev-parse", "HEAD^{tree}").trim(),
          subject: fixture.git("log", "-1", "--format=%s").trim(),
          body: fixture.git("log", "-1", "--format=%b"),
          trailer: fixture
            .git("log", "-1", "--format=%(trailers:key=X-Olai-Writer,valueonly)")
            .trim(),
          waiting: fixture.git("status", "--porcelain").trim(),
        }
      }))

  const web = await committedBy("web")
  const mcp = await committedBy("mcp")

  expect(mcp.tree).toBe(web.tree)

  expect(mcp.subject).toBe(web.subject)
  expect(mcp.subject).toStartWith("olai: ")
  expect(bodyWithoutTrailer(mcp.body)).toBe(bodyWithoutTrailer(web.body))
  expect(bodyWithoutTrailer(web.body)).toContain("done: order the cabinets")
  expect(web.subject).toContain("other files")
  expect(bodyWithoutTrailer(web.body)).toContain("untracked: notes.md")

  expect(web.trailer).toBe("web")
  expect(mcp.trailer).toBe("mcp")

  const picked = ["house.olai", "notes.md"] as const
  const webSome = await committedBy("web", picked)
  const mcpSome = await committedBy("mcp", picked)

  expect(mcpSome.tree).toBe(webSome.tree)
  expect(mcpSome.subject).toBe(webSome.subject)
  expect(bodyWithoutTrailer(mcpSome.body)).toBe(bodyWithoutTrailer(webSome.body))
  expect(webSome.subject).toContain("· 1 other file")
  expect(mcpSome.waiting).toBe(webSome.waiting)
  expect(webSome.waiting).toBe("?? later.md")
})

const bodyWithoutTrailer = (body: string): string =>
  body
    .split("\n")
    .filter((line) => !line.startsWith("X-Olai-Writer:"))
    .join("\n")
    .trim()

test("what a waiting write says names the door that caller actually has", () => {
  const ready = { _tag: "Ready", branch: "main" } as const

  expect(whyOf("manual", ready, null, "mcp")).toContain("the `commit` tool")
  expect(whyOf("manual", ready, null, "mcp")).not.toContain("Commit button")

  expect(whyOf("manual", ready, null, "web")).toContain("the Commit button")
  expect(whyOf("manual", ready, null, "web")).not.toContain("`commit` tool")

  expect(whyOf("manual", ready, null, "chat-agent")).toContain("`commit` tool")
  expect(whyOf("manual", ready, null, "chat-agent")).toContain("Commit button")

  for (const writer of Writer.literals) {
    const said = whyOf("manual", ready, null, writer) ?? ""
    expect(said).toStartWith("waiting to be committed")
    expect(said).not.toContain("could not")
    expect(said).not.toContain("refused")
  }

  const window = whyOf("auto", ready, null, "mcp")
  expect(window).toStartWith("waiting to be committed")
  expect(window).toContain("commit: auto")
  expect(window).not.toContain(COMMIT_TOOL)
  expect(window).not.toContain("Commit button")
})

test("a manual write on a busy repository says blocked with the reason, not waiting", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      fixture.git("checkout", "--quiet", "--detach", "HEAD")

      const applied = yield* Effect.orDie(
        fixture.ops.run({ op: "done", id: "order" }, "mcp"),
      )

      expect(fs.readFileSync(path.join(fixture.root, "house.olai"), "utf8"))
        .toContain(`"done"`)

      expect(applied.why).toContain("detached HEAD")
      expect(applied.why).toContain("finish that first")
      expect(applied.why).not.toContain("waiting to be committed")
      expect(applied.why).not.toContain(COMMIT_TOOL)
    })))

test("a manual write on a healthy repository still just says it is waiting", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* Effect.orDie(
        fixture.ops.run({ op: "done", id: "order" }, "mcp"),
      )
      expect(applied.why).toStartWith("waiting to be committed")
      expect(applied.why).toContain(COMMIT_TOOL)
    })))

describe("the one push a boot owes", () => {
  const diverge = (bare: string): void => {
    const theirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-theirs-")))
    gitIn(theirs)("clone", "--quiet", bare, ".")
    gitIn(theirs)("config", "user.email", "them@example.com")
    gitIn(theirs)("config", "user.name", "them")
    fs.writeFileSync(path.join(theirs, "theirs.md"), "somebody else's work\n")
    gitIn(theirs)("add", "-A")
    gitIn(theirs)("commit", "--quiet", "-m", "theirs")
    gitIn(theirs)("push", "--quiet")
    fs.rmSync(theirs, { recursive: true, force: true })
  }

  const unpushed = (fixture: Fixture): void => {
    fixture.write("notes.md", "the herb bed needs splitting\n")
    fixture.git("add", "-A")
    fixture.git("commit", "--quiet", "-m", "olai: earlier")
  }

  const unpushedConflicting = (fixture: Fixture): void => {
    fixture.write("house.olai", HOUSE.replace('"order the cabinets"', '"order the cabinets"  /* mine */'))
    fixture.git("add", "-A")
    fixture.git("commit", "--quiet", "-m", "olai: earlier")
  }

  const divergeConflicting = (bare: string): void => {
    const theirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-theirs-")))
    gitIn(theirs)("clone", "--quiet", bare, ".")
    gitIn(theirs)("config", "user.email", "them@example.com")
    gitIn(theirs)("config", "user.name", "them")
    fs.writeFileSync(
      path.join(theirs, "house.olai"),
      HOUSE.replace('"order the cabinets"', '"order the cabinets"  // theirs'),
    )
    gitIn(theirs)("add", "-A")
    gitIn(theirs)("commit", "--quiet", "-m", "theirs")
    gitIn(theirs)("push", "--quiet")
    fs.rmSync(theirs, { recursive: true, force: true })
  }

  test("a boot under push: auto on a diverged repository integrates and pushes", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        diverge(bare)
        unpushed(fixture)
        yield* fixture.refresh

        expect((yield* fixture.ops.git).pushSaid).toBeNull()

        yield* fixture.ops.catchUp

        expect(gitIn(bare)("log", "--format=%s", "-1", "main").trim()).toBe("olai: earlier")
        expect(fs.existsSync(path.join(fixture.root, "theirs.md"))).toBe(true)
        expect((yield* fixture.ops.git).pushSaid).toBeNull()
        expect((yield* fixture.ops.git).paused).toBeNull()
        expect(fixture.settlements()).toBeGreaterThan(0)
      }), { commits: "manual", pushes: "auto" }))

  test("a boot under push: auto re-earns the words, on the FIRST reading", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        divergeConflicting(fixture.remote())
        unpushedConflicting(fixture)
        yield* fixture.refresh

        expect((yield* fixture.ops.git).pushSaid).toBeNull()

        yield* fixture.ops.catchUp

        const said = yield* fixture.ops.git
        expect(said.pushSaid).toContain("conflict")
        expect(said.pushSaid).toContain("CONFLICT")
        expect(said.pushSaid).toContain("house.olai")
        expect(said.status).toBe("repo")
        expect(said.said).toBeNull()
        expect(fixture.settlements()).toBeGreaterThan(0)
      }), { commits: "manual", pushes: "auto" }))

  test("a boot under push: off attempts nothing at all", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        diverge(fixture.remote())
        unpushed(fixture)
        yield* fixture.refresh
        const quiet = fixture.settlements()

        yield* fixture.ops.catchUp

        expect((yield* fixture.ops.git).pushSaid).toBeNull()
        expect(fixture.settlements()).toBe(quiet)
      }), { commits: "manual", pushes: "off" }))

  test("a boot with nothing unshared says nothing, and does not stop the loop", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.remote()
        yield* fixture.refresh

        yield* fixture.ops.catchUp

        const said = yield* fixture.ops.git
        expect(said.pushSaid).toBeNull()
        expect(said.paused).toBeNull()
      }), { commits: "auto", pushes: "auto" }))
})

test("a boot says nothing about a branch that has no upstream at all", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      expect((yield* fixture.ops.pending).unpushed).toBeNull()

      yield* fixture.ops.catchUp

      const said = yield* fixture.ops.git
      expect(said.pushSaid).toBeNull()
      expect(said.paused).toBeNull()

      yield* Effect.forkScoped(fixture.ops.loop)
      fixture.write("notes.md", "the herb bed needs splitting\n")
      yield* fixture.refresh
      const boot = fixture.settlements()
      yield* fixture.observe
      yield* fixture.settled(boot)
      expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
    }), { commits: "auto", pushes: "auto", quiet: 40 }))

test("the Push button still hands over git's refusal about a missing upstream", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const sent = yield* fixture.ops.push
      expect(sent._tag).toBe("Failed")
      if (sent._tag === "Failed") expect(sent.said).not.toBe("")
    }), { commits: "manual", pushes: "off" }))


test("the git reading carries the decoded policy, including push defaults", () =>
  withRepo({ "house.olai": HOUSE }, fixture => Effect.gen(function*() {
    const { git } = yield* fixture.ops.status
    expect(git.status).toBe("repo")
    expect(git.policy).toEqual(DEFAULT_POLICY)
    expect(git.policy.push).toBeDefined()
  })))

test("move writes retain their own writer in pending edits and the commit ledger", async () => {
  await withRepo({ "house.olai": HOUSE }, fixture => Effect.gen(function*() {
    yield* Effect.orDie(fixture.ops.run({ op: "add", parent: "kitchen", title: "moved chat" }, "move"))
    yield* fixture.refresh
    expect((yield* fixture.ops.pending).wrote).toEqual([{ writer: "move", ops: 1 }])
    yield* fixture.ops.commit({}, "move")
    expect(fixture.git("log", "-1", "--format=%(trailers:key=X-Olai-Writer,valueonly)").trim()).toBe("move")
  }))
})
