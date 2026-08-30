/**
 * The manual commit path, against a real repository and a real store.
 *
 * `changes.test.ts` proves what the comparison DECIDES and `message.test.ts`
 * what it is called; nothing here re-asserts either. What is only true end to
 * end is what this file is for:
 *
 *   - that a write lands on disk and WAITS — the whole point of the change;
 *   - that what is waiting is derived from git rather than counted, so an edit
 *     made behind olai's back is in it and a commit made behind olai's back
 *     takes it away;
 *   - that a busy repository refuses instead of committing into a conflict,
 *     which is the hole this feature was built to close;
 *   - that the WHOLE REPOSITORY is what is waiting — a `.md` edited by hand
 *     included, which is the bug `commit-whole-repo` was filed for — while a
 *     commit still names exactly the paths it was asked for and never touches
 *     git's index;
 *   - that push says what git said, whichever way it went.
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import { NO_KINDS, Writer } from "@olai/format"
import * as Store from "@olai/store"
import { describe, expect, test } from "bun:test"
import { Effect, type Scope } from "effect"

import { codecFor } from "./codec.ts"
import type { Store as OutlineStore } from "./deps.ts"
import { GIT_IDENT, GIT_IDENT_KEYS, gitIn, repoAt, writerOf } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"
import { COMMIT_TOOL, fixedPolicy, whyOf } from "./pending.ts"

/** The codec this suite validates through — the vocabulary of a build that
 *  composed no plugin, which is what every test in this package runs under
 *  ({@link ./codec.ts}'s `codecFor`, and `@olai/format`'s `NO_KINDS`). */
const codec = codecFor(NO_KINDS)

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  "",
].join("\n")

interface Fixture {
  readonly ops: Ops.Ops
  /** The REPOSITORY root. Every path a test writes and every `git` it runs is
   *  relative to this, which is what lets a served-subdirectory scenario write
   *  a file above the served root. */
  readonly root: string
  readonly git: (...argv: ReadonlyArray<string>) => string
  readonly write: (file: string, contents: string) => void
  /** Re-read the directory, so a change made behind olai's back is part of the
   *  revision the next question is answered against. */
  readonly refresh: Effect.Effect<void>
  /** Give the repository a bare clone as `origin`, with the branch tracking it,
   *  and answer with where that bare repository is. What a push scenario needs
   *  and nothing else does. */
  readonly remote: () => string
  /** How many times the ops layer said something about git had SETTLED — a
   *  commit, a push, a refusal of either, a stop cleared. What the publisher
   *  hangs the republish on, so a test can hold that a refusal really does
   *  reach a browser rather than waiting out the thirty-second sweep. */
  readonly settlements: () => number
  /** Wait until something has SETTLED since `from` — a commit, a push, a
   *  refusal. Snapshot `settlements()` before the action that should settle,
   *  then wait on that number, so a commit that lands before the wait is
   *  still seen. */
  readonly settled: (from: number) => Effect.Effect<void>
  /** Empty the ident, env included. Config alone is not enough: `GIT_AUTHOR_NAME=`
   *  beats `user.name`, which is how a fixture used to fail with `fatal: empty
   *  ident name` under a CI shell that had the variable empty rather than
   *  unset. */
  readonly unident: () => void
  /** Put the fixture ident back, env included. */
  readonly reident: () => void
  /** Hand the loop a survey, exactly as the server's publisher does — which is
   *  the only thing that arms the quiet window. */
  readonly observe: Effect.Effect<void>
}

const withRepo = <A>(
  files: Readonly<Record<string, string>>,
  /** Scoped, because a scenario about the quiet window forks the loop and
   *  wants it interrupted when the fixture goes — `Effect.scoped` below is
   *  what ends it, so no test has to remember a teardown. */
  use: (fixture: Fixture) => Effect.Effect<A, never, Scope.Scope>,
  options: {
    readonly commits?: "off" | "manual" | "auto"
    readonly pushes?: "off" | "auto"
    /** The quiet window this instance waits. Milliseconds, and short: the SPAN
     *  is a product decision (`@olai/format`'s `QUIET_MS`) and a test that waited
     *  it out would take fifteen seconds to prove a debounce. */
    readonly quiet?: number
    /** Which directory olai SERVES, relative to the repository root. Absent is
     *  the root itself, which is the ordinary case; `"docs"` is how olai serves
     *  this project's own plan, and the case where every path has two
     *  spellings. */
    readonly serve?: string
  } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-pending-")))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  // Product git inherits process.env. Local config does not win against an
  // empty `GIT_AUTHOR_NAME`, so the ident is pinned here for the whole
  // fixture and restored after — including on the empty-ident path, which
  // clears these itself for the window it is about.
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
    const ops = Ops.make({
      store,
      root: served,
      policy: fixedPolicy({
        commit: options.commits ?? "manual",
        push: options.pushes ?? null,
      }),
      ...(options.quiet === undefined ? {} : { quiet: options.quiet }),
      onSettled,
      context: { mint: () => "minted", now: () => "2026-08-10T09:00:00-04:00" },
    })
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

/**
 * Two branches that touch the same line, merged: the repository is left
 * mid-merge with `MERGE_HEAD` on disk, which is the state every refusal below
 * is about.
 *
 * The conflict is in a DOCUMENT rather than in an outline, and that is the case
 * worth testing: a person resolving a merge in one file while an agent goes on
 * writing outlines is exactly the situation where a commit would bury the
 * resolution. Conflicting an outline instead would leave it unparseable, so the
 * write under test could not land and the refusal would prove nothing.
 */
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
      // Expected: the merge conflicts, which is the state under test.
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
        // Nothing committed itself, and the op says what it is waiting for
        // rather than leaving a reader to infer it.
        expect(applied.why).toContain("--commit=manual")
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
        // Who asked is a decoration on that, and it is the one thing here that
        // is remembered rather than derived.
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
        // The writer nobody watched arrive: a line sent at `/mcp` from a
        // terminal or a script is neither the browser nor the panel's own
        // agent, so a trailer that said `web` would put it in the same bucket
        // as something somebody typed. The audit trail is the whole reason the
        // trailer exists.
        //
        // It was `capture` here, for the bespoke door that verb had, and a
        // `cli` for the socket that briefly replaced it. Both are gone: a
        // terminal is a client of `/mcp` now, so it writes under that door's
        // word rather than one of its own (`@olai/format`'s `Writer`).
        yield* Effect.orDie(
          fixture.ops.run({ op: "add", parent: "kitchen", title: "buy handles" }, "mcp"),
        )
        const pending = yield* fixture.ops.pending
        expect(pending.wrote).toEqual([{ writer: "mcp", ops: 1 }])

        yield* fixture.ops.commit({ message: "one captured line" }, "mcp")
        expect(writerOf(fixture.root)).toBe("mcp")
        // …and it reads back as a writer rather than as "writer not recorded",
        // which is what a hand-listed set of them would have answered.
        expect((yield* fixture.ops.pending).last).toMatchObject({ writer: "mcp" })
      })))

  test("what was last recorded is answered beside what is waiting", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // NEVER, which is not the same as "nothing waiting" and cannot be
        // derived from it: a directory olai has never committed in and one it
        // committed a second ago both have an empty pending list.
        expect((yield* fixture.ops.pending).last).toBe(null)

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* fixture.ops.commit({ message: "the cabinets are ordered" }, "chat-agent")

        const after = yield* fixture.ops.pending
        expect(after.changes).toEqual([])
        expect(after.last).toMatchObject({
          message: "olai: the cabinets are ordered",
          writer: "chat-agent",
        })

        // A person's own commit on top does not become olai's: the audit view
        // is what this reports on, not the repository's HEAD.
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
        // Somebody in vim. Nothing told olai; the probe found it, and the
        // comparison is against HEAD rather than against anything olai
        // remembers doing.
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
        // And nobody claims to have written it: the counter knows only about
        // ops, which is exactly why it may never be the source of truth.
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
        // No refresh, no write, nothing on the wire: the answer is git's, so
        // asking again is all it takes.
        expect((yield* fixture.ops.pending).changes).toEqual([])
      })))
})

describe("what is committed, and what is not", () => {
  /**
   * The bug this item was filed for, in one test: a `.md` edited by hand is
   * WAITING, and a commit records it.
   *
   * It used to be dropped one line after `git status` had already surveyed it,
   * because olai only listed the files it writes — so the panel said nothing was
   * pending while the working tree said otherwise. The rows are path-level and
   * that is the whole design: a text diff of a document is not something this
   * feature shows.
   */
  test("every other dirty file in the repository waits too, and is swept up", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("notes.md", "a document, which olai never writes\n")
        fixture.write("script.sh", "somebody else's work\n")
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        // The outline still has its node-level detail...
        expect(pending.changes).toHaveLength(1)
        expect(pending.outlines).toEqual([
          { file: "house.olai", path: "house.olai", how: "modified", from: null },
        ])
        // ... and the other two are rows, with what happened to each.
        expect([...pending.others].sort((a, b) => a.path.localeCompare(b.path)))
          .toEqual([
            { path: "notes.md", how: "untracked", from: null },
            { path: "script.sh", how: "untracked", from: null },
          ])
        // Which the composed message names, so the log says what the commit did.
        expect(pending.message).toContain("· 2 other files")
        expect(pending.message).toContain("untracked: notes.md")

        const done = yield* fixture.ops.commit({}, "web")
        expect(done._tag).toBe("Committed")
        // BOTH counts, because a commit can be all of one kind or all of the
        // other and "0 changes" would read as nothing having happened.
        expect(done._tag === "Committed" ? done.changes : -1).toBe(1)
        expect(done._tag === "Committed" ? done.others : -1).toBe(2)
        expect(fixture.git("status", "--porcelain").trim()).toBe("")
      })))

  /**
   * PIECEMEAL: exactly the paths that were picked, and the rest stays waiting
   * for a commit and a message of its own.
   *
   * And the property that makes it safe to offer at all: olai never touches
   * git's index, so a file somebody had staged by hand is still staged
   * afterwards, exactly as they left it.
   */
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

        // The commit named those two files and no others.
        expect(fixture.git("show", "--name-only", "--format=", "HEAD").trim().split("\n").sort())
          .toEqual(["house.olai", "notes.md"])
        // What was not picked is still waiting — and the hand-staged file is
        // still STAGED, which is the whole reason a selection is not an index.
        expect(fixture.git("status", "--porcelain").trim().split("\n").sort())
          .toEqual(["?? later.md", "A  mine.md"])

        const after = yield* fixture.ops.pending
        expect(after.changes).toEqual([])
        expect([...after.others].map((one) => one.path).sort())
          .toEqual(["later.md", "mine.md"])
      })))

  /** A path nobody is waiting on is a mistake, not a smaller commit. Committing
   *  "the rest of it" under a request that named something else is exactly the
   *  silent half-success this codebase refuses to ship. */
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
        // Nothing is claimed about what changed in it — the alternative would
        // be reporting every node in it as gone.
        expect(pending.changes).toEqual([])
      })))
})

/**
 * A rename somebody staged by hand, which is the one shape of hand-staged work
 * both faces of this feature got wrong at once.
 *
 * The reproduction is the human's own vault, the morning after the outline
 * extension changed: two files `git mv`-ed into the new spelling, then open the
 * panel. It read `<the old name> deleted` for each — a departure with nothing
 * joining it to the file that now holds those notes, and the new files nowhere
 * on screen — and pressing Commit answered
 * `fatal: pathspec '/home/srid/Vault/<the old name>' did not match any files`,
 * git's raw words wearing olai's name. The `commit` tool answered the same
 * fatal from a terminal, over a rename staged the same way.
 *
 * Both faces, one cause: the machinery read the working tree against HEAD and
 * never read the INDEX, so a rename arrived as two unrelated rows and the `add`
 * behind a commit was handed a path that exists only in HEAD.
 */
describe("a rename staged by hand", () => {
  /** The old side's content, so a rename between two SERVED outlines has nodes
   *  on both sides to be recognised across. */
  const KEPT = [
    `{"id":"kept","ord":"a0","title":"Kept for later"}`,
    "",
  ].join("\n")

  /** The WEB face. A document is not an outline, so the ARRIVING side is the
   *  only outline in this rename — which is the shape of the migration the
   *  human was doing when this was filed: a file olai did not serve becoming
   *  one it does. */
  test("reads as a rename in the panel, not as a deletion", () =>
    withRepo({ "house.olai": HOUSE, "Kept.md": KEPT }, (fixture) =>
      Effect.gen(function*() {
        fixture.git("mv", "Kept.md", "Kept.olai")
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        // ONE row, naming both sides. The arriving file is an outline olai
        // serves, so it is an outline row and it says where it came from.
        expect(pending.outlines).toEqual([
          {
            file: "Kept.olai",
            path: "Kept.olai",
            how: "renamed",
            from: "Kept.md",
          },
        ])
        // And the departing side is NOT a second row: it is not a file waiting
        // to be deleted, it is half of the rename above, and a tick of its own
        // would be a commit that lands the rename in two pieces.
        expect(pending.others).toEqual([])
        // And the log does not say a file was deleted either.
        expect(pending.message).not.toContain("deleted: Kept.md")
        // THE NODES, which is the other half of what the human was shown and
        // the half only THIS shape holds. Between two served outlines the old
        // side is a dirty outline in its own right, so HEAD's copy of it was
        // already in hand and the ids already matched across it — the two-row
        // bug was the whole of what was wrong there. Here the old side is a
        // file olai does not serve, so nothing fetched HEAD's copy of it at
        // all, and every node read as freshly created: three arrivals and a
        // `capture:` message, for a file where nothing happened but the name.
        expect(pending.changes).toEqual([
          {
            file: "Kept.olai",
            id: "kept",
            title: "Kept for later",
            fields: ["file"],
            sort: "moved",
          },
        ])
      })))

  /** The same rename between two files olai does NOT serve, where the row is
   *  path-level and the composed message is the only place it can be read.
   *  `renamed: notes.md` would be the word that refuses to say the interesting
   *  half, so the body names both. */
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

  /** The MCP face, and the fatal it leaked. */
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

  /**
   * The SWEEP semantics, which is where a half-fix would land somebody's
   * history in two pieces: a selection names the arriving side, because that is
   * the row the panel drew and the path `pending` published — and the commit
   * has to carry the departing half with it.
   */
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
        // What was not picked is still waiting, and nothing of the rename is
        // left behind in the working tree.
        expect(fixture.git("status", "--porcelain").trim()).toBe("?? later.md")
      })))

  /**
   * Between two SERVED outlines, where the node-level answer is available and
   * has to be the right one: the same nodes, in a different file.
   *
   * The committed side is HEAD's copy of the file it CAME FROM. Read against
   * HEAD's copy of the name it has now — which HEAD has never had — every node
   * in it reads as created, and a person is shown a screenful of arrivals for a
   * file nothing happened inside.
   */
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

  /**
   * The other half of the promise the `commit` tool already makes in as many
   * words — that hand-staged work is left undisturbed — read in the direction
   * nobody had checked: a file somebody staged is WAITING, visible, and
   * committable when it is picked.
   */
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

/**
 * Serving a SUBDIRECTORY of a repository, which is how olai serves this
 * project's own `docs/`.
 *
 * The human's bug, exactly: a dirty `README.md` at the repository root is
 * waiting, and it says so — where it used to be outside the survey's pathspec
 * and therefore invisible. An outline outside the served root is another file
 * too: olai does not serve it, so there is no working-side parse to compare
 * against, and a path-level row is the honest thing to show.
 */
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
          // The served outline, in BOTH spellings: the store's key and the
          // repository's own name for it.
          expect(pending.outlines).toEqual([
            { file: "house.olai", path: "docs/house.olai", how: "modified", from: null },
          ])
          expect([...pending.others].map((one) => one.path).sort())
            .toEqual(["README.md", "elsewhere.olai"])
          // And the node-level answer is about the EDIT, not about the two
          // spellings of the file it is in. `changesOf` reports a node whose
          // file differs as having moved, so the two sides of the comparison
          // have to be keyed in one namespace — key the committed side by the
          // repository's spelling while the working side keeps the store's, and
          // every node of every outline reads as `moved` the moment olai serves
          // a subdirectory. Nothing else in the suite was holding that.
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
          // And the commit olai just made is what it reports as last, even
          // though half of it lives outside the served directory.
          expect((yield* fixture.ops.pending).last).not.toBe(null)
        }),
      { serve: "docs" },
    ))

  /**
   * A rename from ABOVE the served root into it — the one shape where the side
   * a file came from has no served name at all.
   *
   * `git mv Notes.md docs/Notes.olai` is somebody moving their notes under the
   * directory olai serves, which is a thing people do on the day they start
   * using it. HEAD has the source as `Notes.md` and nothing else; asked for by
   * the served spelling there is nothing to ask FOR, so the committed side went
   * missing and every node in the file read as created. Repo-root-relative is
   * the one name both sides always have.
   */
  test("a rename from above the served root still reads against HEAD's own copy", () =>
    withRepo(
      { "docs/house.olai": HOUSE, "Notes.md": `{"id":"kept","ord":"a0","title":"Kept"}\n` },
      (fixture) =>
        Effect.gen(function*() {
          fixture.git("mv", "Notes.md", "docs/Notes.olai")
          yield* fixture.refresh

          const pending = yield* fixture.ops.pending
          expect(pending.outlines).toEqual([
            {
              file: "Notes.olai",
              path: "docs/Notes.olai",
              how: "renamed",
              // Repo-relative, because that is the only name a file one level
              // up HAS — and what the panel shortens only when it can.
              from: "Notes.md",
            },
          ])
          expect(pending.others).toEqual([])
          // Moved, not reborn: HEAD's `Notes.md` is the committed side.
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
          ).toBe("R100\tNotes.md\tdocs/Notes.olai")
        }),
      { serve: "docs" },
    ))

  /** The two namespaces cannot collide, which is why an outline carries its
   *  repository path at all: `docs/house.olai` and a root-level `house.olai`
   *  are two files, and a tick names exactly one of them. */
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
          // The served one is untouched and still waiting.
          expect((yield* fixture.ops.pending).outlines)
            .toEqual([{ file: "house.olai", path: "docs/house.olai", how: "modified", from: null }])
        }),
      { serve: "docs" },
    ))
})

/**
 * Push — the one verb this program has for sharing what it recorded, and the
 * human's own reason for it: "push is the only thing that makes me use CLI
 * outside of olai".
 */
describe("push", () => {
  test("what is unpushed is surveyed, and pushing sends it", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        // In sync: an upstream that has everything, which is a different fact
        // from having no upstream at all.
        expect((yield* fixture.ops.pending).unpushed)
          .toEqual({ upstream: "origin/main", commits: 0 })
        expect((yield* fixture.ops.push)._tag).toBe("NothingToPush")

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.ops.commit({ message: "the cabinets are ordered" }, "web")
        expect((yield* fixture.ops.pending).unpushed)
          .toEqual({ upstream: "origin/main", commits: 1 })

        const sent = yield* fixture.ops.push
        expect(sent).toEqual({ _tag: "Pushed", upstream: "origin/main", commits: 1 })
        expect(gitIn(bare)("log", "--format=%s", "-1", "main").trim())
          .toBe("olai: the cabinets are ordered")
        // ... and the panel stops offering to send it.
        expect((yield* fixture.ops.pending).unpushed)
          .toEqual({ upstream: "origin/main", commits: 0 })
      })))

  /** A branch with no upstream has nowhere to go, and that `null` is what keeps
   *  the panel from offering to guess a remote. */
  test("no upstream is not the same as nothing to push", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* fixture.ops.pending).unpushed).toBe(null)
      })))

  /**
   * A refusal comes back with git's own words, exactly as a refused commit
   * does — never silently, and never as a failed effect. This is the one thing
   * about pushing that a person cannot find out any other way from inside the
   * app.
   */
  test("a refusal surfaces verbatim", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        // The remote moves on without us, so the push is a non-fast-forward —
        // the refusal a person actually meets.
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

        const sent = yield* fixture.ops.push
        expect(sent._tag).toBe("Failed")
        // Git's own account, whole. What to do about it stays a conversation in
        // a terminal, and these are the words that start it.
        expect(sent._tag === "Failed" ? sent.said : "").toContain("rejected")
      })))

  test("commits off has nothing to push either", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const sent = yield* fixture.ops.push
        expect(sent).toEqual({ _tag: "Blocked", repo: { _tag: "Off" } })
      }), { commits: "off" }))

  /**
   * A BUSY repository refuses the push by naming what to finish, exactly as a
   * commit does.
   *
   * Mid-rebase there is no branch to push, so git's own answer is "you are not
   * currently on a branch" — true, and the less useful half of it. The panel
   * never offers the button in that state (a detached HEAD tracks nothing), so
   * this is what the agent's tool gets, and one rule serves both verbs.
   */
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

/**
 * A git that cannot survey the working tree says so, rather than reading as a
 * clean one.
 *
 * The pill would otherwise draw `✓ committed` over a repository nothing can be
 * read from, and the unpushed line would vanish — #108's silence, reached
 * through a different call. It arrives as the state that already exists for it,
 * carrying git's own words, so the header says `git error` and the panel
 * refuses to offer a commit.
 */
test("a working tree git cannot survey is an error, not an empty one", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
      expect((yield* fixture.ops.pending).changes).toHaveLength(1)

      // The repository taken out from under the handle olai already opened.
      fs.rmSync(path.join(fixture.root, ".git"), { recursive: true, force: true })

      // BOTH readings the publisher takes, from the one survey — the panel's
      // repository state and the header's own cell, which is what would have
      // drawn `✓ committed` over this.
      const both = yield* fixture.ops.status
      expect(both.pending.repo._tag).toBe("Unusable")
      expect(both.pending.repo._tag === "Unusable" ? both.pending.repo.said : "")
        .not.toBe("")
      expect(both.git).toMatchObject({ status: "error" })
      expect(both.pending.changes).toEqual([])
      // And nothing is offered into it.
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
        // An agent marking a node done mid-conflict used to swallow the
        // resolution; now the resolution is still there to be finished.
        expect(subjects(fixture)[0]).not.toStartWith("olai:")
      })))
})

describe("the agent's door", () => {
  /**
   * The trailer, which is the only permanent record of WHO.
   *
   * Git writes the repository's own name and email whoever asked, so without
   * this an agent's commits are indistinguishable from a person's — and that
   * would defeat the point of an audit trail of what the TOOL wrote. The writer
   * is decided by the composition root and passed in, never claimed by a caller
   * about itself.
   *
   * This is the verb; the TOOL that reaches it over MCP is
   * `packages/server/src/mcp/tools.test.ts`, which drives a real MCP client —
   * the tool table lives up there now, with the SDK.
   */
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

/**
 * `--commit=auto` — the QUIET WINDOW, which is what that flag now is.
 *
 * It used to be one commit per write, made inside the write gate. These are the
 * scenarios that replace it: nothing commits a write on its own any more, and
 * what records is a debounce over the whole repository that any writer moves.
 *
 * Every one of them runs a SHORT window (`quiet`), because the span is a
 * product decision and a test that waited fifteen seconds to prove a debounce
 * would be fifteen seconds long. `observe` is the server's publisher, called by
 * hand: the loop is armed by the arrival of a survey and by nothing else.
 */
describe("--commit=auto: the quiet window", () => {
  test("a write does not commit itself, and says what it is waiting for", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* Effect.orDie(
          fixture.ops.run({ op: "done", id: "order" }, "chat-agent"),
        )
        // The retirement, as an assertion: the old mode put this in the log
        // before `run` returned.
        expect(subjects(fixture)).toEqual(["fixtures"])
        // ... and it says what it IS waiting for, which is not a button.
        expect(applied.why).toContain("--commit=auto")
        expect(applied.why).not.toContain("Commit button")
        expect((yield* fixture.ops.pending).wrote).toEqual([
          { writer: "chat-agent", ops: 1 },
        ])
      }), { commits: "auto", quiet: 40 }))

  test("a flurry of writes records itself as ONE commit, whoever wrote them", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // Three writes by three different doors, and a file nobody wrote
        // through olai at all — which is the whole claim: the window watches
        // the DIRECTORY, so a `.md` saved in an editor lands in the same
        // commit as an agent's op.
        //
        // The loop starts AFTER the flurry. A 40ms window racing the writes
        // themselves is how this used to flake under load: each observe
        // re-armed, and when an op took longer than the window the flurry
        // landed as two commits. What is waiting is the commit, not a
        // multiple of the span.
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "install" }, "mcp"))
        fixture.write("notes.md", "the cabinets are late\n")
        yield* fixture.refresh

        yield* Effect.forkScoped(fixture.ops.loop)
        const flurry = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(flurry)
        // ONE, and it is the thing no amount of chrome can show.
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
        const pending = yield* fixture.ops.pending
        expect(pending.changes).toEqual([])
        expect(pending.others).toEqual([])
        // The sweep clears the counters, because it swept everything.
        expect(pending.wrote).toEqual([])
        // WHO: nobody pressed anything, so the trailer says so rather than
        // naming a browser that may not exist.
        expect(pending.last).toMatchObject({ writer: "auto" })
      }), { commits: "auto", quiet: 40 }))

  /**
   * The server's slow sweep, over and over, while nothing moves.
   *
   * A window re-armed on a reading that says nothing new is a window a
   * repository somebody is not writing to would never close — the sweep is
   * every thirty seconds and the span is fifteen, so it would close only in
   * the gaps and, on a busy directory, not at all.
   *
   * The surveys run while the window is armed; what we wait on is the commit
   * they must not prevent, not a multiple of the span. A second commit after
   * more of the same surveys is the window having been pushed out.
   */
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

        // The worst case the design names: nobody is watching, so a commit
        // here would bury a half-finished merge.
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* fixture.observe
        // The repository is not Ready, so the window does not arm — nothing
        // to wait out.
        expect(subjects(fixture)[0]).not.toStartWith("olai:")
        // A PAUSE rather than a stop: nothing was attempted, so nothing
        // refused, so there is nothing for anybody to resume.
        expect((yield* fixture.ops.git).paused).toBeNull()

        // ... and once the merge is finished, the same waiting work records.
        // `add` the one conflicted file and commit the INDEX, never `-a`: the
        // outline the agent wrote is in the working tree and not staged, and
        // sweeping it into the merge commit would be the test resolving the
        // very thing it is about to assert is still waiting.
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
        // An identity nobody set — git's own "Author identity unknown", the
        // failure people actually hit on a fresh machine or under a service
        // account. Every probe answers happily and every commit refuses, which
        // is the one failure a survey cannot see. Env as well as config:
        // empty `GIT_AUTHOR_NAME` beats `user.name`.
        fixture.unident()

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        const refused = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(refused)

        const stopped = yield* fixture.ops.git
        expect(stopped.status).toBe("error")
        expect(stopped.paused).not.toBeNull()
        // The republish is the half that was missing: the words reached the
        // server's memory and nothing told a browser for thirty seconds.
        expect(fixture.settlements()).toBeGreaterThan(0)

        // NOTHING GOES ROUND AGAIN. A second write, and the loop is still
        // where git left it — the window does not arm while paused.
        fixture.write("notes.md", "and another thing\n")
        yield* fixture.refresh
        yield* fixture.observe
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(0)

        // ... and Resume is the one way out. With the identity back, the same
        // waiting work records.
        fixture.reident()
        yield* fixture.ops.resume
        expect((yield* fixture.ops.git).paused).toBeNull()
        // ... and pressing it again is not an error, it is nothing: two people
        // looking at one directory can both press it.
        yield* fixture.ops.resume
        const resumed = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(resumed)
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
        expect((yield* fixture.ops.git).paused).toBeNull()
      }), { commits: "auto", quiet: 40 }))
})

/**
 * `--push=auto` — what a SETTLED commit does next.
 *
 * The flag used to govern the browsers and nothing else: the only trigger was
 * inside one tab's own `git.commit` callback, so a commit an agent made, or one
 * a headless serve made, was never pushed and the unpushed count grew with
 * nothing anywhere saying why. It is the server's now, and it follows every
 * commit olai makes by whichever door.
 */
describe("--push=auto", () => {
  test("a commit the AGENT asked for is pushed", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "mcp"))
        expect((yield* fixture.ops.commit({}, "mcp"))._tag).toBe("Committed")

        // On the remote, with nobody's browser involved at all.
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

  test("a push git refuses is remembered, drawn, and stops the loop", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const bare = fixture.remote()
        yield* Effect.forkScoped(fixture.ops.loop)

        // THE DIVERGENCE, which is what a single user with two machines meets:
        // somebody else moved the upstream, so the push is a non-fast-forward.
        // Nothing here pulls, rebases or forces.
        const theirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-theirs-")))
        gitIn(theirs)("clone", "--quiet", bare, ".")
        gitIn(theirs)("config", "user.email", "them@example.com")
        gitIn(theirs)("config", "user.name", "them")
        fs.writeFileSync(path.join(theirs, "theirs.md"), "somebody else's work\n")
        gitIn(theirs)("add", "-A")
        gitIn(theirs)("commit", "--quiet", "-m", "theirs")
        gitIn(theirs)("push", "--quiet")

        fixture.write("notes.md", "the cabinets are late\n")
        yield* fixture.refresh
        const diverged = fixture.settlements()
        yield* fixture.observe
        yield* fixture.settled(diverged)
        while (true) {
          const n = fixture.settlements()
          if ((yield* fixture.ops.git).pushSaid !== null) break
          yield* fixture.settled(n)
        }

        // The COMMIT stands — a refused push is not a rollback.
        expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
        const said = yield* fixture.ops.git
        // ... and the whole of `push-failure-invisible`: git's own words, on
        // the cell, where every tab reads them and a reload cannot lose them.
        expect(said.pushSaid).not.toBeNull()
        expect(said.pushSaid).toContain("reject")
        // The commit half is UNTOUCHED, which is why these are two fields: the
        // history is fine and the sharing is not, and one status could not say
        // both.
        expect(said.status).toBe("repo")
        expect(said.said).toBeNull()
        // ... and the loop is stopped, because piling more commits onto a
        // branch that has already diverged makes the resolution worse.
        expect(said.paused).not.toBeNull()

        fs.rmSync(theirs, { recursive: true, force: true })
      }), { commits: "auto", pushes: "auto", quiet: 40 }))
})

describe("--commit=off", () => {
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

/**
 * The two faces produce the SAME commit for the same pending set.
 *
 * HACKING.md's rule is that MCP and Web ops must be consistent and never
 * deviate, and this is that rule made checkable at the one place it would be
 * expensive to get wrong: what ends up permanently in somebody's history.
 * `olai web`'s button and the agent's `commit` tool are two callers of one `Ops.commit`
 * — but "two callers of one function" is an implementation detail that a
 * refactor can quietly end, and nothing else in the suite compares the two
 * outputs.
 *
 * So: the same fixture, the same edits, committed once as each face.
 *
 * IDENTICAL: the tree (the bytes recorded), the subject, and the body — the
 * per-node list, in order.
 *
 * DIFFERENT, and required to be: the `X-Olai-Writer` trailer. That is the whole
 * point of the trailer. Git records the repository's own name and email
 * whichever face asked, so without it an agent's commits are indistinguishable
 * from a person's, and an audit trail of what the tool wrote stops being one.
 * A test that asserted the two commits were byte-identical FULL STOP would be
 * asserting that bug.
 */
test("both faces commit the same tree and the same message, differing only in the trailer", async () => {
  /** One face's commit of one identical pending set. Two repositories rather
   *  than two commits in one, because the second commit in a repository has a
   *  different parent — and a tree comparison wants the two runs to differ in
   *  nothing but the writer. */
  const committedBy = (writer: "web" | "mcp", paths?: ReadonlyArray<string>) =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // A document nobody's op wrote, so the pending set has BOTH kinds of
        // row in it: the two faces have to agree about the other files too, and
        // about which of them a selection names.
        fixture.write("notes.md", "edited by hand\n")
        fixture.write("later.md", "and this one stays waiting\n")
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, writer))
        yield* Effect.orDie(fixture.ops.run({ op: "doing", id: "install" }, writer))
        yield* Effect.orDie(
          fixture.ops.run({ op: "add", parent: "kitchen", title: "measure up" }, writer),
        )
        // A MIRROR too, since #117: a placement is a different record shape
        // (`{id, parent, ord, mirror}`), and the comparison the composed
        // message is built from derives its field list from BOTH schemas. A
        // pending set holding only regular nodes would not exercise that.
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

  // The bytes recorded are the same bytes. This is the strong half: it catches
  // a face that staged a different set of files, or wrote them differently.
  expect(mcp.tree).toBe(web.tree)

  // And the message a person reads is the same message — composed from what
  // changed, which is derived from git and therefore cannot depend on who
  // asked.
  expect(mcp.subject).toBe(web.subject)
  expect(mcp.subject).toStartWith("olai: ")
  expect(bodyWithoutTrailer(mcp.body)).toBe(bodyWithoutTrailer(web.body))
  expect(bodyWithoutTrailer(web.body)).toContain("done: order the cabinets")
  // The other files are in it too, named the same way by both.
  expect(web.subject).toContain("other files")
  expect(bodyWithoutTrailer(web.body)).toContain("untracked: notes.md")

  // The one difference, and it is required rather than tolerated.
  expect(web.trailer).toBe("web")
  expect(mcp.trailer).toBe("mcp")

  /**
   * And the SELECTION is the same selection, which is the half `commit-whole-repo`
   * adds to this rule.
   *
   * The MCP tool grew a `paths` argument for exactly the reason the button has
   * checkboxes — HACKING.md's "MCP and Web ops must be consistent; never
   * deviate" — so the two faces committing the same three of five files have to
   * produce the same tree, the same message and the same leftovers. A face that
   * resolved a path differently would put a different file in somebody's history
   * permanently.
   */
  const picked = ["house.olai", "notes.md"] as const
  const webSome = await committedBy("web", picked)
  const mcpSome = await committedBy("mcp", picked)

  expect(mcpSome.tree).toBe(webSome.tree)
  expect(mcpSome.subject).toBe(webSome.subject)
  expect(bodyWithoutTrailer(mcpSome.body)).toBe(bodyWithoutTrailer(webSome.body))
  expect(webSome.subject).toContain("· 1 other file")
  // What was left out is still waiting, identically on both.
  expect(mcpSome.waiting).toBe(webSome.waiting)
  expect(webSome.waiting).toBe("?? later.md")
})

/** A commit body with the writer trailer taken off — everything the two faces
 *  must agree about, and nothing they must not. */
const bodyWithoutTrailer = (body: string): string =>
  body
    .split("\n")
    .filter((line) => !line.startsWith("X-Olai-Writer:"))
    .join("\n")
    .trim()

/**
 * The waiting sentence names the door the CALLER has.
 *
 * `Applied.why` rides the reply an agent reads, so telling an agent in a
 * terminal to press a Commit button sends it after a control it cannot reach —
 * the same mistake a terminal-only `--help` would make if the two faces shared one
 * sentence, and the same rule fixes both. The panel's agent keeps both doors
 * named, because it has the tool and a person with the button is watching.
 */
test("what a waiting write says names the door that caller actually has", () => {
  const ready = { _tag: "Ready", branch: "main" } as const

  expect(whyOf("manual", ready, null, "mcp")).toContain("the `commit` tool")
  expect(whyOf("manual", ready, null, "mcp")).not.toContain("Commit button")

  expect(whyOf("manual", ready, null, "web")).toContain("the Commit button")
  expect(whyOf("manual", ready, null, "web")).not.toContain("`commit` tool")

  // The panel's agent has both, and is told so.
  expect(whyOf("manual", ready, null, "chat-agent")).toContain("`commit` tool")
  expect(whyOf("manual", ready, null, "chat-agent")).toContain("Commit button")

  // Whichever door, it never reads as a fault: this is the feature working.
  // EVERY writer, read off the format's own list rather than a copy of it, so
  // a writer added there without a door here fails this line.
  for (const writer of Writer.literals) {
    const said = whyOf("manual", ready, null, writer) ?? ""
    expect(said).toStartWith("waiting to be committed")
    expect(said).not.toContain("could not")
    expect(said).not.toContain("refused")
  }

  // And the OTHER waiting mode names no door at all, which is the point of it:
  // under the quiet window there is nothing for this caller to press, and what
  // it is waiting for is the directory going quiet.
  const window = whyOf("auto", ready, null, "mcp")
  expect(window).toStartWith("waiting to be committed")
  expect(window).toContain("--commit=auto")
  expect(window).not.toContain(COMMIT_TOOL)
  expect(window).not.toContain("Commit button")
})

/**
 * A write on a BUSY repository says so — it does not say "waiting".
 *
 * The review's finding 5, and it is #108's lesson wearing manual mode's
 * clothes. "Waiting to be committed until the `commit` tool asks for one" is
 * true of an ordinary manual write and FALSE here: nothing the agent asks for
 * will sweep this until the rebase is finished, so the reply would be sending
 * it to call a tool that refuses, and the real reason would reach the person
 * reading the transcript only from that refusal.
 *
 * The write itself still lands. That is not negotiable and is asserted here
 * beside the sentence, because the whole point of the arrangement is that git
 * never fails a write — the correction is to what the reply SAYS, not to what
 * it does.
 */
test("a manual write on a busy repository says blocked with the reason, not waiting", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // Detached, the way an agent finds it when somebody is mid-bisect.
      fixture.git("checkout", "--quiet", "--detach", "HEAD")

      const applied = yield* Effect.orDie(
        fixture.ops.run({ op: "done", id: "order" }, "mcp"),
      )

      // The write LANDED.
      expect(fs.readFileSync(path.join(fixture.root, "house.olai"), "utf8"))
        .toContain(`"done"`)

      // And the reply names the state rather than promising a door that will
      // refuse. `on a detached HEAD`, not `mid-detached`, which is not English.
      expect(applied.why).toContain("detached HEAD")
      expect(applied.why).toContain("finish that first")
      expect(applied.why).not.toContain("waiting to be committed")
      expect(applied.why).not.toContain(COMMIT_TOOL)
    })))

/** The other half of the same correction: on a HEALTHY repository the sentence
 *  is still the ordinary waiting one, so this is a narrower answer rather than
 *  a louder one. */
test("a manual write on a healthy repository still just says it is waiting", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* Effect.orDie(
        fixture.ops.run({ op: "done", id: "order" }, "mcp"),
      )
      expect(applied.why).toStartWith("waiting to be committed")
      expect(applied.why).toContain(COMMIT_TOOL)
    })))

/**
 * WHAT A BOOT OWES — the human's ruling on the one fork the two reviews split
 * on (2026-08-22).
 *
 * Nothing about a refusal is remembered across a restart: the state file keeps
 * the policy and nothing else, so a fresh process starts with no stop and no
 * words. For the STOP that is the right shape — a restart is an operator's act,
 * and a pause written down is a blind retry's opposite with no way out that
 * survives either. For the WORDS on their own it is not, because
 * `olai.service` is `Restart=always`: a deploy would take `pushSaid` with it
 * and the chip would go back to `✓ committed · N unpushed` with the reason
 * nowhere, which is the whole of `push-failure-invisible` restored.
 *
 * So the words are RE-EARNED. One push at boot, under `--push=auto` and no
 * other mode, and whatever git says lands on the cell.
 */
describe("the one push a boot owes", () => {
  /** Somebody else moved the upstream, so every push from here is a
   *  non-fast-forward — the divergence a restarted service wakes up into. */
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

  /** A commit this directory has and the upstream does not — what a restarted
   *  service is holding, with nothing waiting to be committed at all. */
  const unpushed = (fixture: Fixture): void => {
    fixture.write("notes.md", "the herb bed needs splitting\n")
    fixture.git("add", "-A")
    fixture.git("commit", "--quiet", "-m", "olai: earlier")
  }

  test("a boot under --push=auto re-earns the words, on the FIRST reading", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        diverge(fixture.remote())
        unpushed(fixture)
        yield* fixture.refresh

        // Before the boot push: the cell has nothing to say about a refusal,
        // because nothing was remembered — which is the state grok's argument
        // is about, and it is only correct for the instant before this runs.
        expect((yield* fixture.ops.git).pushSaid).toBeNull()

        yield* fixture.ops.catchUp

        const said = yield* fixture.ops.git
        expect(said.pushSaid).toContain("reject")
        // The COMMIT half is untouched: the history is fine and the sharing is
        // not, which is why these are two fields.
        expect(said.status).toBe("repo")
        expect(said.said).toBeNull()
        // ... and a reader is told without waiting for the sweep: the push
        // republishes the way every other settled thing does.
        expect(fixture.settlements()).toBeGreaterThan(0)
      }), { commits: "manual", pushes: "auto" }))

  test("a boot under --push=off attempts nothing at all", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        diverge(fixture.remote())
        unpushed(fixture)
        yield* fixture.refresh
        const quiet = fixture.settlements()

        yield* fixture.ops.catchUp

        // A directory whose pushes are somebody's own button press has not
        // asked this process to make one. Nothing was attempted, so nothing
        // refused, so there is nothing on the cell and nobody was told.
        expect((yield* fixture.ops.git).pushSaid).toBeNull()
        expect(fixture.settlements()).toBe(quiet)
      }), { commits: "manual", pushes: "off" }))

  test("a boot with nothing unshared says nothing, and does not stop the loop", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.remote()
        yield* fixture.refresh

        yield* fixture.ops.catchUp

        // `push` owns "is there anything to send" — a branch already in sync
        // answers `NothingToPush` and writes nothing, which is why the boot arm
        // asks no second version of that question.
        const said = yield* fixture.ops.git
        expect(said.pushSaid).toBeNull()
        expect(said.paused).toBeNull()
      }), { commits: "auto", pushes: "auto" }))
})

/**
 * A BRANCH WITH NO UPSTREAM IS NOT A BRANCH THAT IS BEHIND, and the boot arm is
 * the one place that difference decides something.
 *
 * The Push BUTTON lets it through to git on purpose: a person who pressed it is
 * owed git's own words about the remote they have not set. A boot nobody asked
 * for is owed nothing of the kind — and if it let the same refusal through, the
 * loop of every `--commit=auto --push=auto` directory whose branch has never
 * been pushed would stop at every start, over a thing that is not wrong.
 */
test("a boot says nothing about a branch that has no upstream at all", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // No remote, so nothing to be behind: `unpushed` is `null` rather than
      // zero, which is a different fact and the one this arm reads.
      expect((yield* fixture.ops.pending).unpushed).toBeNull()

      yield* fixture.ops.catchUp

      const said = yield* fixture.ops.git
      expect(said.pushSaid).toBeNull()
      expect(said.paused).toBeNull()

      // ... and the loop it did not stop still records.
      yield* Effect.forkScoped(fixture.ops.loop)
      fixture.write("notes.md", "the herb bed needs splitting\n")
      yield* fixture.refresh
      const boot = fixture.settlements()
      yield* fixture.observe
      yield* fixture.settled(boot)
      expect(subjects(fixture).filter((line) => line.startsWith("olai:"))).toHaveLength(1)
    }), { commits: "auto", pushes: "auto", quiet: 40 }))

/** ... and the button still gets git's words about that same branch, which is
 *  the half the boot arm must not have changed. */
test("the Push button still hands over git's refusal about a missing upstream", () =>
  withRepo({ "house.olai": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const sent = yield* fixture.ops.push
      expect(sent._tag).toBe("Failed")
      if (sent._tag === "Failed") expect(sent.said).not.toBe("")
    }), { commits: "manual", pushes: "off" }))
