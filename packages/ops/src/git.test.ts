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
import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { commit, dirty, place, type Placement, show, state } from "./git.ts"

/** A directory with a file in it and no repository anywhere it can reach —
 *  `/tmp` is not itself a work tree, and nothing here walks upwards past it. */
const loose = (): { readonly root: string; readonly file: string } => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-")))
  const file = path.join(root, "a.jsonl")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"a"}\n`)
  return { root, file }
}

const git = (root: string) => (...argv: ReadonlyArray<string>): string =>
  execFileSync("git", argv, { cwd: root, encoding: "utf8" })

/** The same directory, with a repository and one commit in it. */
const repo = (): { readonly root: string; readonly file: string } => {
  const made = loose()
  const run = git(made.root)
  run("init", "--quiet", "--initial-branch", "main")
  run("config", "user.email", "test@olai.invalid")
  run("config", "user.name", "olai tests")
  run("add", "-A")
  run("commit", "--quiet", "-m", "fixtures")
  return made
}

/** Every git question below is asked of a placement, so this is the prologue
 *  they share: place the directory, or fail the test saying it is not one. */
const asked = <A>(
  root: string,
  use: (placed: Placement) => Effect.Effect<A>,
): Promise<A> =>
  Effect.runPromise(
    Effect.flatMap(place(root), (placed) =>
      placed === null
        ? Effect.die(new Error(`${root} is not a work tree`))
        : use(placed)),
  )

const placedOf = (root: string): Promise<Placement | null> =>
  Effect.runPromise(place(root))

test("a directory that is not a work tree has no placement", async () => {
  const { root } = loose()
  expect(await placedOf(root)).toBe(null)
})

test("a served subdirectory knows what it is called from the repository root", async () => {
  const { root } = repo()
  fs.mkdirSync(path.join(root, "notes"))
  fs.writeFileSync(path.join(root, "notes", "b.jsonl"), `{"id":"b","ord":"a0","title":"b"}\n`)

  const placed = await placedOf(path.join(root, "notes"))
  expect(placed?.prefix).toBe("notes/")
  // And the served-root-relative name is what comes back out, not the
  // repo-relative one git printed.
  expect(await asked(path.join(root, "notes"), (at) => dirty(path.join(root, "notes"), at, () => true)))
    .toEqual(["b.jsonl"])
})

test("a clean repository on a branch is ready", async () => {
  const { root } = repo()
  expect(await asked(root, (at) => state(root, at))).toEqual({ _tag: "Ready", branch: "main" })
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

  const repoState = await asked(root, (at) => state(root, at))
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("merge")
})

test("a detached HEAD is blocked, in git's own words", async () => {
  const { root } = repo()
  const run = git(root)
  run("checkout", "--quiet", "--detach", "HEAD")

  const repoState = await asked(root, (at) => state(root, at))
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("detached")
  expect(repoState._tag === "Blocked" ? repoState.said : "").not.toBe("")
})

test("dirty names the served files that moved, filtered by the caller", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  fs.writeFileSync(path.join(root, "new.jsonl"), `{"id":"n","ord":"a0","title":"n"}\n`)
  fs.writeFileSync(path.join(root, "notes.md"), "not an outline\n")

  const found = await asked(root, (at) =>
    dirty(root, at, (name) => name.endsWith(".jsonl")))
  expect([...found].sort()).toEqual(["a.jsonl", "new.jsonl"])
})

test("show is HEAD's copy, and null for a file HEAD has never had", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  expect(await asked(root, (at) => show(root, at, "a.jsonl")))
    .toBe(`{"id":"a","ord":"a0","title":"a"}\n`)
  expect(await asked(root, (at) => show(root, at, "never.jsonl"))).toBe(null)
})

test("git refusing is a warning with git's own words in a field, and a Failed", async () => {
  const { file, root } = loose()
  const { layer, said } = collector()

  const done = await Effect.runPromise(
    commit({ root, paths: [file], message: "olai: a" }).pipe(Effect.provide(layer)),
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

  const done = await Effect.runPromise(
    commit({ root, paths: [file], message: "olai: one edit\n\nX-Olai-Writer: web\n" }),
  )
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
