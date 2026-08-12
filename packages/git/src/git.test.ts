/**
 * The plumbing, against real repositories.
 *
 * Two things are worth holding here and neither is "git works". The first is
 * the SHAPE OF A REFUSAL: a git that says no is a line and never a failed
 * write, so the message has to be stable and git's own words have to ride it as
 * a FIELD rather than interpolated into the sentence. The second is
 * {@link state}, which is new — nothing used to ask whether the repository was
 * mid-merge, mid-rebase or on a detached HEAD before committing, and an agent
 * marking a node done in the middle of a conflict could swallow a resolution.
 * A blocked repository is the one answer that cannot be tested by reading the
 * code, so it is tested by putting a repository in that state.
 */

import { collector, findSaid } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { gitIn as git, repoAt } from "./fixtures.testlib.ts"
import { type Audit, open, type Repo } from "./git.ts"

/** The audit convention the packages above this one actually use, so what the
 *  tests read back is what olai writes — handed in, because which prefix and
 *  which trailer a caller signs with is exactly what this package does not
 *  know. */
const OLAI: Audit = { prefix: "olai", trailer: "X-Olai-Writer" }

/** A directory with a file in it and no repository anywhere it can reach —
 *  `/tmp` is not itself a work tree, and nothing here walks upwards past it. */
const loose = (): { readonly root: string; readonly file: string } => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-")))
  const file = path.join(root, "a.jsonl")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"a"}\n`)
  return { root, file }
}

/** The same directory, with a repository and one commit in it. */
const repo = (): { readonly root: string; readonly file: string } => {
  const made = loose()
  repoAt(made.root)
  return made
}

/** Every question below is asked of a repository, so this is the prologue they
 *  share: open the directory, or fail the test saying it is not one. */
const asEffect = <A>(
  root: string,
  use: (git: Repo) => Effect.Effect<A>,
): Effect.Effect<A> =>
  Effect.flatMap(open(root), (opening) =>
    opening._tag !== "Opened"
      ? Effect.die(new Error(`${root} is not a work tree: ${opening._tag}`))
      : use(opening.repo))

const asked = <A>(
  root: string,
  use: (git: Repo) => Effect.Effect<A>,
): Promise<A> => Effect.runPromise(asEffect(root, use))

test("a directory that is not a work tree opens as NoRepo, which is not an error", async () => {
  const { root } = loose()
  expect(await Effect.runPromise(open(root))).toEqual({ _tag: "NoRepo" })
})

test("a bare repository is NoRepo: there is nowhere for the files to be", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-bare-"))
  git(root)("init", "--quiet", "--bare")
  expect(await Effect.runPromise(open(root))).toEqual({ _tag: "NoRepo" })
})

/**
 * The distinction #108 was filed for, and the one this socket must never give
 * back.
 *
 * Every way of failing to ANSWER the question used to be the same `null`, which
 * a caller read as "not a repository" — so a service with no git on its PATH,
 * and a repository git refuses to use (dubious ownership is the one people
 * actually hit), both told the reader their notes were not under version
 * control. Anything git says that is not its own "not a git repository" is
 * `Unusable`, and it arrives with what git said.
 */
test("a git that cannot answer is Unusable carrying its words, not NoRepo", async () => {
  const { root } = loose()
  fs.rmSync(root, { recursive: true, force: true })

  const opening = await Effect.runPromise(open(root))
  expect(opening._tag).toBe("Unusable")
  if (opening._tag !== "Unusable") throw new Error("unreachable")
  expect(opening.said).not.toBe("")
})

/**
 * The three spellings, from a served SUBDIRECTORY — where they are three
 * different strings and the difference matters.
 *
 * git prints `notes/b.jsonl`, because git speaks repo-relative paths. What
 * comes back also says what the SERVED root calls it, and where it is on disk,
 * which is the whole reason the placement belongs to the handle rather than to
 * a caller.
 */
test("a dirty file answers in all three spellings, from a served subdirectory", async () => {
  const { root } = repo()
  fs.mkdirSync(path.join(root, "notes"))
  fs.writeFileSync(path.join(root, "notes", "b.jsonl"), `{"id":"b","ord":"a0","title":"b"}\n`)

  const served = path.join(root, "notes")
  expect((await asked(served, (git) => git.dirty)).files).toEqual([
    {
      path: "notes/b.jsonl",
      served: "b.jsonl",
      at: path.join(served, "b.jsonl"),
      how: "untracked",
    },
  ])
  expect(await asked(served, (git) => Effect.succeed(git.served))).toBe("notes/")
})

/**
 * The bug this whole item was filed for: serving `docs/` and editing a
 * `README.md` one level up said nothing was waiting.
 *
 * A file OUTSIDE the served directory comes back with `served: null`, which is
 * exactly the news a caller needs — it is dirty, and olai does not serve it, so
 * nothing above can have anything to say about what is in it.
 */
test("a served subdirectory still sees the dirt above it, marked as outside", async () => {
  const { root } = repo()
  fs.mkdirSync(path.join(root, "notes"))
  fs.writeFileSync(path.join(root, "notes", "b.jsonl"), `{"id":"b","ord":"a0","title":"b"}\n`)
  fs.writeFileSync(path.join(root, "README.md"), "edited by hand\n")

  const found = (await asked(path.join(root, "notes"), (git) => git.dirty)).files
  expect(found.map((one) => [one.path, one.served]).sort()).toEqual([
    ["README.md", null],
    ["notes/b.jsonl", "b.jsonl"],
  ])
})

/** The porcelain XY letters, which were surveyed and thrown away one line
 *  later. Every arm, in one repository, because the collapse of X and Y is a
 *  decision rather than an accident. */
test("dirty keeps how each file moved", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(path.join(root, "gone.jsonl"), `{"id":"g","ord":"a0","title":"g"}\n`)
  fs.writeFileSync(path.join(root, "moved.md"), "to be renamed\n")
  run("add", "-A")
  run("commit", "--quiet", "-m", "more fixtures")

  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  fs.rmSync(path.join(root, "gone.jsonl"))
  fs.renameSync(path.join(root, "moved.md"), path.join(root, "landed.md"))
  fs.writeFileSync(path.join(root, "fresh.md"), "brand new\n")
  fs.writeFileSync(path.join(root, "staged.md"), "added to the index by hand\n")
  run("add", "staged.md")
  // A rename git only sees once both halves are staged.
  run("add", "-A", "moved.md", "landed.md")

  const how = new Map(
    (await asked(root, (git) => git.dirty)).files.map((one) => [one.path, one.how]),
  )
  expect(how.get("a.jsonl")).toBe("modified")
  expect(how.get("gone.jsonl")).toBe("deleted")
  expect(how.get("fresh.md")).toBe("untracked")
  expect(how.get("staged.md")).toBe("added")
  // A rename names both sides, and both are kept: the new one as what it is,
  // the old one as a file that has left — a commit of this rename has to carry
  // both halves or it lands as an unrelated add.
  expect(how.get("landed.md")).toBe("renamed")
  expect(how.get("moved.md")).toBe("deleted")
})

test("a clean repository on a branch is ready", async () => {
  const { root } = repo()
  expect(await asked(root, (git) => git.state)).toEqual({ _tag: "Ready", branch: "main" })
})

test("a repository mid-merge says so rather than committing", async () => {
  const { root, file } = repo()
  const run = git(root)
  run("checkout", "--quiet", "-b", "other")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"other"}\n`)
  run("commit", "--quiet", "-am", "other")
  run("checkout", "--quiet", "main")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"main"}\n`)
  run("commit", "--quiet", "-am", "main")
  // A conflicting merge leaves MERGE_HEAD behind, which is the whole point.
  try {
    run("merge", "other")
  } catch {
    // Expected: the merge conflicts, and that is the state under test.
  }

  const repoState = await asked(root, (git) => git.state)
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("merge")
})

test("a detached HEAD is blocked, in git's own words", async () => {
  const { root } = repo()
  const run = git(root)
  run("checkout", "--quiet", "--detach", "HEAD")

  const repoState = await asked(root, (git) => git.state)
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("detached")
  expect(repoState._tag === "Blocked" ? repoState.said : "").not.toBe("")
})

// EVERY served file that moved, including the ones that are not outlines:
// which of them matter is a statement about the format, and this module has
// none of that in it.
// A conflicting rebase leaves `rebase-merge` behind, and it also detaches
// HEAD — which is exactly why the markers are read BEFORE the branch is asked
// for. Reported as "detached", this would be true and useless: the thing to do
// about it is `git rebase --continue`, not `git checkout`.
test("a repository mid-rebase says rebase, not detached", async () => {
  const { root, file } = repo()
  const run = git(root)
  run("checkout", "--quiet", "-b", "other")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"other"}\n`)
  run("commit", "--quiet", "-am", "other")
  run("checkout", "--quiet", "main")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"main"}\n`)
  run("commit", "--quiet", "-am", "main")
  run("checkout", "--quiet", "other")
  try {
    run("rebase", "main")
  } catch {
    // Expected: the rebase stops on the conflict, which is the state under test.
  }

  const repoState = await asked(root, (git) => git.state)
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("rebase")
})

test("a repository mid-cherry-pick says so", async () => {
  const { root, file } = repo()
  const run = git(root)
  run("checkout", "--quiet", "-b", "other")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"other"}\n`)
  run("commit", "--quiet", "-am", "other")
  run("checkout", "--quiet", "main")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"main"}\n`)
  run("commit", "--quiet", "-am", "main")
  try {
    run("cherry-pick", "other")
  } catch {
    // Expected: it conflicts, leaving CHERRY_PICK_HEAD.
  }

  const repoState = await asked(root, (git) => git.state)
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("cherry-pick")
})

test("dirty names every file that moved, tracked or not", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  fs.writeFileSync(path.join(root, "new.jsonl"), `{"id":"n","ord":"a0","title":"n"}\n`)
  fs.writeFileSync(path.join(root, "notes.md"), "not an outline\n")

  const found = await asked(root, (git) => git.dirty)
  expect(found.files.map((one) => one.path).sort())
    .toEqual(["a.jsonl", "new.jsonl", "notes.md"])
  // Nothing to push to, which is not the same as nothing to push — a
  // repository nobody has given a remote has nowhere for a branch to go.
  expect(found.upstream).toBe(null)
})

/**
 * How far ahead of its upstream the branch is, off the header line the status
 * call is already printing — one subprocess for both halves of "what is not
 * recorded, and what is not shared".
 */
test("dirty says where the branch stands against its upstream", async () => {
  const { root, file } = repo()
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-remote-"))
  git(bare)("init", "--quiet", "--bare")
  const run = git(root)
  run("remote", "add", "origin", bare)
  run("push", "--quiet", "--set-upstream", "origin", "main")

  const level = await asked(root, (git) => git.dirty)
  expect(level.upstream).toEqual({ name: "origin/main", ahead: 0 })

  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("commit", "--quiet", "-am", "one of mine")
  expect((await asked(root, (git) => git.dirty)).upstream)
    .toEqual({ name: "origin/main", ahead: 1 })

  // And pushing it is one verb with nothing to decide: the current branch, to
  // the upstream it already has.
  const sent = await asked(root, (git) => git.push)
  expect(sent._tag).toBe("Pushed")
  expect((await asked(root, (git) => git.dirty)).upstream)
    .toEqual({ name: "origin/main", ahead: 0 })
  expect(git(bare)("log", "--format=%s", "-1", "main").trim()).toBe("one of mine")
})

/**
 * A push that git refuses comes back with git's own words, exactly as a refused
 * commit does. Never a failed effect, and never a silent nothing — this is the
 * one thing about pushing a person cannot find out any other way from inside
 * the app.
 */
test("a push git refuses is an answer carrying its words", async () => {
  const { root } = repo()
  const { layer, said } = collector()

  const sent = await Effect.runPromise(
    asEffect(root, (git) => git.push).pipe(Effect.provide(layer)),
  )
  expect(sent._tag).toBe("Refused")
  // A branch with no upstream and no remote: git says so, at length, and what
  // it says is what a reader is shown.
  expect(sent.said).not.toBe("")

  const warned = findSaid(said, "the branch was not pushed")
  expect(warned?.level).toBe("Warn")
  expect(String(warned?.annotations.said)).not.toBe("")
})

test("the last commit is olai's own, never the repository's HEAD", async () => {
  const { root, file } = repo()
  const run = git(root)

  // Nothing of olai's yet, however many commits the person has made.
  expect(await asked(root, (git) => git.last(OLAI))).toBe(null)

  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  await asked(root, (git) =>
    git.commit({
      paths: [file],
      message: "olai: one edit\n\nX-Olai-Writer: chat-agent\n",
    }))
  // ... and a person's commit on top of it does not become olai's.
  fs.writeFileSync(path.join(root, "b.jsonl"), `{"id":"b","ord":"a0","title":"b"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "mine, by hand")

  const last = await asked(root, (git) => git.last(OLAI))
  expect(last?.message).toBe("olai: one edit")
  expect(last?.trailer).toBe("chat-agent")
  expect(last?.sha).toMatch(/^[0-9a-f]{40}$/)
  expect(last?.at).not.toBe("")
})

/** A commit carrying the prefix and no trailer comes back with an EMPTY one,
 *  rather than a guess — and rather than a `null` this file would have had to
 *  invent a vocabulary to justify. What "no writer recorded" means is decided
 *  one package up, which is the whole of the classification that moved out. */
test("a commit carrying the prefix but no trailer has an empty one", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "olai: typed by a person")

  expect((await asked(root, (git) => git.last(OLAI)))?.trailer).toBe("")
})

/** And a trailer nothing here recognises is NOT filtered out: an unknown
 *  writer is news, and the classification that turns it into `null` is the
 *  caller's — this file hands over what git printed. */
test("an unrecognised trailer arrives verbatim rather than swallowed", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "olai: from elsewhere\n\nX-Olai-Writer: some-other-tool\n")

  expect((await asked(root, (git) => git.last(OLAI)))?.trailer).toBe("some-other-tool")
})

test("show is HEAD's copy, and null for a file HEAD has never had", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  expect(await asked(root, (git) => git.show("a.jsonl")))
    .toBe(`{"id":"a","ord":"a0","title":"a"}\n`)
  expect(await asked(root, (git) => git.show("never.jsonl"))).toBe(null)
})

test("git refusing is a warning with git's own words in a field, and a Failed", async () => {
  const { root } = repo()
  // A path git will not stage, because it is not in this repository at all.
  // What is under test is the SHAPE of the refusal rather than this particular
  // way of provoking one — a commit runs after the bytes are already on disk
  // and on screen, so every way git can say no has to come back as an answer.
  const outside = loose().file
  const { layer, said } = collector()

  const done = await Effect.runPromise(
    asEffect(root, (git) => git.commit({ paths: [outside], message: "olai: a" }))
      .pipe(Effect.provide(layer)),
  )

  // Never fails the write, and never claims to have committed.
  expect(done._tag).toBe("Failed")

  const warned = findSaid(said, "could not stage the write")
  expect(warned?.level).toBe("Warn")
  // The message is the stable half; what git actually said varies, so it is an
  // annotation — greppable by field rather than by substring, which is the
  // whole reason it is not in the sentence.
  expect(String(warned?.annotations.said)).not.toBe("")
  expect(warned?.message).not.toContain("fatal")
})

test("a commit is the named paths, the message, and the sha it made", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  fs.writeFileSync(path.join(root, "untouched.jsonl"), `{"id":"u","ord":"a0","title":"u"}\n`)

  const done = await asked(root, (git) =>
    git.commit({ paths: [file], message: "olai: one edit\n\nX-Olai-Writer: web\n" }))
  expect(done._tag).toBe("Committed")
  expect(done._tag === "Committed" ? done.sha : "").toMatch(/^[0-9a-f]{40}$/)

  const run = git(root)
  expect(run("log", "--format=%s", "-1").trim()).toBe("olai: one edit")
  expect(run("log", "--format=%(trailers:key=X-Olai-Writer,valueonly)", "-1").trim())
    .toBe("web")
  // The file nobody named is still untracked: only the paths given are ever
  // staged, because a served directory is a working tree with other work in it.
  expect(run("status", "--porcelain").trim()).toBe("?? untouched.jsonl")
})
