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
import type { OutlineError, OutlineSet } from "@olai/format"
import * as Store from "@olai/store"
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { codec } from "./codec.ts"
import { gitIn, repoAt } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"
import { COMMIT_TOOL, whyOf } from "./pending.ts"

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
}

const withRepo = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Effect.Effect<A, never>,
  options: {
    readonly commits?: "off" | "manual" | "auto"
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

  return Effect.gen(function*() {
    const store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>> = yield* Store.make({
      root: served,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const ops = Ops.make({
      store,
      root: served,
      commits: options.commits ?? "manual",
      context: { mint: () => "minted", now: () => "2026-08-10T09:00:00-04:00" },
    })
    return yield* use({
      ops,
      root,
      git,
      write,
      remote,
      refresh: Effect.orDie(store.refresh),
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
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
        // Nothing committed itself, and the op says so rather than claiming a
        // commit that did not happen.
        expect(applied.committed).toBe(false)
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
          { file: "house.olai", path: "house.olai", how: "modified" },
        ])
        // ... and the other two are rows, with what happened to each.
        expect([...pending.others].sort((a, b) => a.path.localeCompare(b.path)))
          .toEqual([
            { path: "notes.md", how: "untracked" },
            { path: "script.sh", how: "untracked" },
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
            { file: "house.olai", path: "docs/house.olai", how: "modified" },
          ])
          expect([...pending.others].map((one) => one.path).sort())
            .toEqual(["README.md", "elsewhere.olai"])

          expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Committed")
          expect(fixture.git("status", "--porcelain").trim()).toBe("")
          // And the commit olai just made is what it reports as last, even
          // though half of it lives outside the served directory.
          expect((yield* fixture.ops.pending).last).not.toBe(null)
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
            .toEqual([{ file: "house.olai", path: "docs/house.olai", how: "modified" }])
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

describe("--commit=auto", () => {
  test("a write that committed itself is not also reported as waiting", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* Effect.orDie(
          fixture.ops.run({ op: "done", id: "order" }, "chat-agent"),
        )
        expect(applied.committed).toBe(true)

        // The counter answers "how many ops have not been committed yet", and
        // this one has. Counting it left a clean tree reporting `chat agent 1`
        // for work that was already in the log — which is not the staleness the
        // design allows: the counter may be wrong after a RESTART, never after
        // a successful commit of its own.
        const pending = yield* fixture.ops.pending
        expect(pending.changes).toEqual([])
        expect(pending.wrote).toEqual([])
        expect(pending.last).toMatchObject({
          message: "olai: done: order the cabinets",
          writer: "chat-agent",
        })
      }), { commits: "auto" }))

  test("a busy repository is declined, and the write still lands", () =>
    withRepo({ "house.olai": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* conflicted(fixture)

        // The worst case the design names: nobody is watching, so an op that
        // committed here would bury a half-finished merge.
        const applied = yield* Effect.orDie(
          fixture.ops.run({ op: "done", id: "order" }, "chat-agent"),
        )
        expect(applied.committed).toBe(false)
        expect(subjects(fixture)[0]).not.toStartWith("olai:")

        // ... and because it did NOT commit, it is waiting, and says so.
        expect((yield* fixture.ops.pending).wrote).toEqual([
          { writer: "chat-agent", ops: 1 },
        ])
      }), { commits: "auto" }))
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
 * `olai web`'s button and `olai mcp`'s tool are two callers of one `Ops.commit`
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
 * the same mistake `olai mcp --help` would make if the two faces shared one
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
  for (const writer of ["web", "mcp", "chat-agent"] as const) {
    const said = whyOf("manual", ready, null, writer) ?? ""
    expect(said).toStartWith("waiting to be committed")
    expect(said).not.toContain("could not")
    expect(said).not.toContain("refused")
  }

  // And a mode that commits has nothing to explain.
  expect(whyOf("auto", ready, null, "mcp")).toBeUndefined()
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
      expect(applied.committed).toBe(false)
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
