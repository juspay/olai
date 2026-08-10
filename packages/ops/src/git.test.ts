/**
 * A git that says no is a LINE, never a failed write.
 *
 * The bytes are on disk and the browser has already seen them by the time the
 * hook runs, so turning git's refusal into a failed op would be a lie about
 * what happened. What the reader gets instead is `committed: false` and a log
 * line — which makes the shape of that line the whole of what this module
 * reports, and therefore worth holding: a stable message, and git's own words
 * as a FIELD rather than interpolated into the sentence.
 */

import { collector, findSaid } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { commit, isWorkTree } from "./git.ts"

/** A directory with a file in it and no repository anywhere it can reach —
 *  `/tmp` is not itself a work tree, and `commit` never walks upwards. */
const loose = (): { readonly root: string; readonly file: string } => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-"))
  const file = path.join(root, "a.jsonl")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"a"}\n`)
  return { root, file }
}

test("a directory that is not a work tree is not one", async () => {
  const { root } = loose()
  expect(await Effect.runPromise(isWorkTree(root))).toBe(false)
})

test("git refusing is a warning with git's own words in a field, and a false", async () => {
  const { file, root } = loose()
  const { layer, said } = collector()

  const committed = await Effect.runPromise(
    commit({ root, paths: [file], message: "capture: a" }).pipe(Effect.provide(layer)),
  )

  // Never fails the write, and never claims to have committed.
  expect(committed).toBe(false)

  const warned = findSaid(said, "could not stage the write")
  expect(warned?.level).toBe("Warn")
  // The message is the stable half; what git actually said varies, so it is an
  // annotation — greppable by field rather than by substring, which is the
  // whole reason it is not in the sentence.
  expect(String(warned?.annotations.said)).not.toBe("")
  expect(warned?.message).not.toContain("fatal")
})

// Nothing to write, nothing to say: an op that produced no files must not spawn
// git at all, let alone report a refusal.
test("no paths is not a commit and not a line", async () => {
  const { root } = loose()
  const { layer, said } = collector()

  const committed = await Effect.runPromise(
    commit({ root, paths: [], message: "capture: a" }).pipe(Effect.provide(layer)),
  )

  expect(committed).toBe(false)
  expect(said).toEqual([])
})
