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
import { open, type Repo } from "./git.ts"

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
  Effect.flatMap(open(root), (git) =>
    git === null
      ? Effect.die(new Error(`${root} is not a work tree`))
      : use(git))

const asked = <A>(
  root: string,
  use: (git: Repo) => Effect.Effect<A>,
): Promise<A> => Effect.runPromise(asEffect(root, use))

test("a directory that is not a work tree opens as nothing", async () => {
  const { root } = loose()
  expect(await Effect.runPromise(open(root))).toBe(null)
})

test("a served subdirectory answers in ITS own path spelling", async () => {
  const { root } = repo()
  fs.mkdirSync(path.join(root, "notes"))
  fs.writeFileSync(path.join(root, "notes", "b.jsonl"), `{"id":"b","ord":"a0","title":"b"}\n`)

  // git prints `notes/b.jsonl`, because git speaks repo-relative paths. What
  // comes back is what the SERVED root calls it — which is the whole reason
  // the placement belongs to the handle rather than to a caller.
  expect(await asked(path.join(root, "notes"), (git) => git.dirty))
    .toEqual(["b.jsonl"])
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

test("dirty names every served file that moved, tracked or not", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  fs.writeFileSync(path.join(root, "new.jsonl"), `{"id":"n","ord":"a0","title":"n"}\n`)
  fs.writeFileSync(path.join(root, "notes.md"), "not an outline\n")

  const found = await asked(root, (git) => git.dirty)
  expect([...found].sort()).toEqual(["a.jsonl", "new.jsonl", "notes.md"])
})

test("the last commit is olai's own, never the repository's HEAD", async () => {
  const { root, file } = repo()
  const run = git(root)

  // Nothing of olai's yet, however many commits the person has made.
  expect(await asked(root, (git) => git.last("olai"))).toBe(null)

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

  const last = await asked(root, (git) => git.last("olai"))
  expect(last?.message).toBe("olai: one edit")
  expect(last?.writer).toBe("chat-agent")
  expect(last?.sha).toMatch(/^[0-9a-f]{40}$/)
  expect(last?.at).not.toBe("")
})

test("a commit carrying the prefix but no trailer has no writer, rather than a guessed one", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "olai: typed by a person")

  expect((await asked(root, (git) => git.last("olai")))?.writer).toBe(null)
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
