/**
 * A git that says no is a LINE and an ANSWER, never a failed write.
 *
 * The bytes are on disk and the browser has already seen them by the time the
 * hook runs, so turning git's refusal into a failed op would be a lie about
 * what happened. What the reader gets instead is `committed: false` — and, for
 * a while, nothing else: every cause collapsed into that one boolean and git's
 * own words went to the server log, where somebody reading a browser never sees
 * them. So what this module owes a caller is now two values rather than a
 * boolean, and these tests are about telling the causes APART:
 *
 *   - a directory that is not a repository is `none`, which is information;
 *   - a git that cannot be run is `error`, which is a fault, and the two must
 *     never be the same word;
 *   - a commit with nothing to record is `nothing`, which is ordinary, and must
 *     never be drawn as a failure;
 *   - a commit git refuses — the identity nobody set is the real case — is
 *     `refused`, carrying what git said.
 *
 * Against real git in real temp directories, because what is being asserted is
 * how git behaves, and a fake one would only assert what we already believe.
 */

import { collector, findSaid } from "@olai/log/testlib"
import { execFileSync } from "node:child_process"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { commit, probe, why } from "./git.ts"

/** A directory with a file in it and no repository anywhere it can reach —
 *  `/tmp` is not itself a work tree, and `commit` never walks upwards. */
const loose = (): { readonly root: string; readonly file: string } => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-"))
  const file = path.join(root, "a.jsonl")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"a"}\n`)
  return { root, file }
}

const git = (root: string, ...argv: ReadonlyArray<string>): void => {
  execFileSync("git", argv, { cwd: root, stdio: "ignore" })
}

/** The same directory, with a repository around it and an identity to commit
 *  under. `identity: false` leaves the identity EMPTY, which is git's own
 *  "Author identity unknown" — the failure a person actually hits on a fresh
 *  machine or a service account, reproduced without depending on what the
 *  developer running this happens to have in their global config. */
const repo = (
  options: { readonly identity?: boolean } = {},
): { readonly root: string; readonly file: string } => {
  const made = loose()
  git(made.root, "init", "--quiet")
  git(made.root, "config", "user.email", options.identity === false ? "" : "test@olai.invalid")
  git(made.root, "config", "user.name", options.identity === false ? "" : "olai tests")
  return made
}

// ── what git makes of the directory ────────────────────────────────────

test("a directory that is not a work tree is `none`, and that is not an error", async () => {
  const { root } = loose()
  expect(await Effect.runPromise(probe(root))).toEqual({ status: "none", said: null })
})

test("a work tree is a work tree", async () => {
  const { root } = repo()
  expect(await Effect.runPromise(probe(root))).toEqual({ status: "repo", said: null })
})

test("a bare repository is `none`: there is nowhere for the files to be", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-bare-"))
  git(root, "init", "--quiet", "--bare")
  expect(await Effect.runPromise(probe(root))).toEqual({ status: "none", said: null })
})

/**
 * The half of the bug this state exists for.
 *
 * Every way of failing to ANSWER the question used to be `false`, which the
 * caller read as "not a repository" — so a service with no git on its PATH, and
 * a repository git refuses to use (dubious ownership is the one people hit),
 * both told the reader their notes were not under version control. Anything git
 * says that is not its own "not a git repository" is a fault, and it arrives
 * with what git said.
 */
test("a git that cannot answer is an error carrying its words, not `none`", async () => {
  const { root } = loose()
  fs.rmSync(root, { recursive: true, force: true })

  const state = await Effect.runPromise(probe(root))
  expect(state.status).toBe("error")
  expect(state.said).not.toBe("")
  expect(why(state)).toContain(state.said ?? "")
})

// ── what happens to one write's files ──────────────────────────────────

test("a work tree commits, and says nothing about why not", async () => {
  const { root, file } = repo()
  const outcome = await Effect.runPromise(commit({ root, paths: [file], message: "capture: a" }))
  expect(outcome).toEqual({ kind: "committed" })
  expect(why(outcome)).toBeUndefined()
})

/**
 * The identity nobody set: the real case, and the one the human's own vault
 * could have been in. It must reach the reader as git's own paragraph rather
 * than as a boolean — and it must not fail the write, which is what the caller
 * ({@link ./ops.test.ts}) asserts on the other side of this.
 */
test("a commit git refuses is `refused`, with what git said", async () => {
  const { root, file } = repo({ identity: false })
  const { layer, said } = collector()

  const outcome = await Effect.runPromise(
    commit({ root, paths: [file], message: "capture: a" }).pipe(Effect.provide(layer)),
  )

  expect(outcome.kind).toBe("refused")
  const words = outcome.kind === "refused" ? outcome.said : ""
  expect(words).toContain("identity")
  // A reader gets git's own words, not a shrug.
  expect(why(outcome)).toContain(words)

  const warned = findSaid(said, "the write was not committed")
  expect(warned?.level).toBe("Warn")
  // The message is the stable half; what git actually said varies, so it is an
  // annotation — greppable by field rather than by substring, which is the
  // whole reason it is not in the sentence.
  expect(String(warned?.annotations.said)).toContain("identity")
  expect(warned?.message).not.toContain("fatal")
})

/**
 * The ordinary outcome that must never be drawn as a fault: a write that
 * produced the bytes that were already there. git exits non-zero for it just as
 * it does for a refusal, which is exactly why this is decided by asking the
 * index rather than by reading a message.
 */
test("a write with nothing to record is `nothing`, not a refusal", async () => {
  const { root, file } = repo()
  const { layer, said } = collector()

  await Effect.runPromise(commit({ root, paths: [file], message: "capture: a" }))
  const again = await Effect.runPromise(
    commit({ root, paths: [file], message: "capture: a" }).pipe(Effect.provide(layer)),
  )

  expect(again).toEqual({ kind: "nothing" })
  expect(why(again)).toContain("nothing to commit")
  // Not a warning: nothing went wrong, and a log that cried here would be a log
  // nobody believes when something does.
  expect(said.filter((line) => line.level === "Warn")).toEqual([])
})

test("a git that will not stage is a refusal with git's own words", async () => {
  const { root, file } = repo()
  // A lock another process is holding — the one refusal a caller cannot fix by
  // trying again, and the shape of every staging failure.
  fs.writeFileSync(path.join(root, ".git", "index.lock"), "")
  const { layer, said } = collector()

  const outcome = await Effect.runPromise(
    commit({ root, paths: [file], message: "capture: a" }).pipe(Effect.provide(layer)),
  )

  expect(outcome.kind).toBe("refused")
  expect(outcome.kind === "refused" ? outcome.said : "").toContain("index.lock")

  const warned = findSaid(said, "could not stage the write")
  expect(warned?.level).toBe("Warn")
  expect(String(warned?.annotations.said)).not.toBe("")
  expect(warned?.message).not.toContain("fatal")
})

// Nothing to write, nothing to say: an op that produced no files must not spawn
// git at all, let alone report a refusal.
test("no paths is not a commit and not a line", async () => {
  const { root } = loose()
  const { layer, said } = collector()

  const outcome = await Effect.runPromise(
    commit({ root, paths: [], message: "capture: a" }).pipe(Effect.provide(layer)),
  )

  expect(outcome).toEqual({ kind: "nothing" })
  expect(said).toEqual([])
})

// ── the sentence a reader gets ─────────────────────────────────────────

/** Every answer that is not a commit owes the reader a reason, and every one of
 *  them names its own cause: the four states and the three outcomes are seven
 *  different pieces of news, and "not committed" is not one of them. */
test("every uncommitted outcome says why, in its own words", () => {
  expect(why({ status: "off", said: null })).toContain("--no-commit")
  expect(why({ status: "none", said: null })).toContain("not a git work tree")
  expect(why({ status: "error", said: "fatal: whatever" })).toContain("fatal: whatever")
  expect(why({ status: "repo", said: null })).toBeUndefined()
  expect(why({ kind: "committed" })).toBeUndefined()
  expect(why({ kind: "nothing" })).toContain("nothing to commit")
  expect(why({ kind: "refused", said: "fatal: nope" })).toContain("fatal: nope")
})
