/**
 * The boot sweep, against a real directory.
 *
 * `@olai/format`'s `migrate.test.ts` proves the RECORDS: every mark, instant,
 * date and edge survives, over a generated corpus. This proves the other half,
 * which is everything that touches a disk — which files are found, what is
 * rewritten, what is left exactly as it was, and that a second start does
 * nothing at all.
 *
 * It is worth its own file because the e2e suite cannot cover it. Every fixture
 * the suite seeds is already in the props shape, so the sweep is a no-op on
 * every one of the 593 scenarios: the path that actually writes to somebody's
 * vault would have had no test at all, which is the worst thing for a step that
 * runs once, unattended, over files nobody has a second copy of.
 */

import { expect, test } from "bun:test"
import { NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { migrateDirectory } from "./migrate.ts"

/** A directory holding `files`, and its path. Real, because what is under test
 *  is the walk and the rename. */
const directoryOf = (files: Readonly<Record<string, string>>): string => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-props-")))
  for (const [name, text] of Object.entries(files)) {
    const at = path.join(root, name)
    fs.mkdirSync(path.dirname(at), { recursive: true })
    fs.writeFileSync(at, text)
  }
  return root
}

const sweep = (root: string) =>
  Effect.runPromise(migrateDirectory(root).pipe(Effect.provide(NodeServices.layer)))

const read = (root: string, name: string): string =>
  fs.readFileSync(path.join(root, name), "utf8")

test("a vault in the old shape is rewritten, whole, on the first start", async () => {
  const root = directoryOf({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen","doing":"2026-08-01"}\n` +
      `{"id":"demo","parent":"kitchen","ord":"a0","title":"demo","done":true,"after":["kitchen"]}\n`,
    "notes/garden.olai": `{"id":"herbs","ord":"a0","title":"herbs","todo":"2026-08-11"}\n`,
  })

  const result = await sweep(root)
  expect(result.migrated.slice().sort()).toEqual(["house.olai", "notes/garden.olai"])
  expect(result.left).toEqual([])

  // Rewritten through the format's own writer: canonical field order, canonical
  // key order inside the map, one trailing newline.
  expect(read(root, "house.olai")).toBe(
    `{"id":"kitchen","ord":"a0","title":"kitchen","props":{"status":"doing","since":"2026-08-01"}}\n` +
      `{"id":"demo","parent":"kitchen","ord":"a0","title":"demo","props":{"status":"done","after":["kitchen"]}}\n`,
  )
  // A NESTED outline is found, which is the walk being the store's own rather
  // than a flat listing somebody wrote for this step.
  expect(read(root, "notes/garden.olai")).toBe(
    `{"id":"herbs","ord":"a0","title":"herbs","props":{"status":"todo","since":"2026-08-11"}}\n`,
  )
})

/** The second start, and the whole of what makes the sweep safe to leave in the
 *  boot path for ever: it is not remembering anything. */
test("the second start rewrites nothing, and says nothing", async () => {
  const root = directoryOf({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen","doing":true}\n`,
  })

  await sweep(root)
  const after = read(root, "house.olai")
  const stamp = fs.statSync(path.join(root, "house.olai")).mtimeMs

  const second = await sweep(root)
  expect(second.migrated).toEqual([])
  expect(second.left).toEqual([])
  expect(read(root, "house.olai")).toBe(after)
  // Not merely the same bytes — the file was never opened for writing. A sweep
  // that rewrote every outline with identical content on every boot would make
  // the whole vault dirty in git each time somebody started olai.
  expect(fs.statSync(path.join(root, "house.olai")).mtimeMs).toBe(stamp)
})

/**
 * The crash window, from the other side.
 *
 * The sweep stages every rewrite and then renames them one by one, so a crash
 * between two renames leaves a directory with some files in each shape. That is
 * a real window and the module says so; what makes it survivable is this — the
 * next start reads the FILES rather than a memory of what it did, so it
 * finishes the job and leaves what already landed alone. Recovery is the
 * ordinary path rather than a repair mode, which is why there is no journal.
 */
test("a directory caught half-way across is finished by the next start", async () => {
  const root = directoryOf({
    // Already renamed before the crash.
    "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen","props":{"status":"doing"}}\n`,
    // Still waiting for theirs.
    "shed.olai": `{"id":"shelf","ord":"a0","title":"shelf","done":"2026-08-01"}\n`,
    "notes/garden.olai": `{"id":"herbs","ord":"a0","title":"herbs","todo":true}\n`,
  })
  const landed = read(root, "house.olai")
  const stamp = fs.statSync(path.join(root, "house.olai")).mtimeMs

  const result = await sweep(root)
  expect(result.migrated.slice().sort()).toEqual(["notes/garden.olai", "shed.olai"])
  expect(read(root, "house.olai")).toBe(landed)
  // Not rewritten with identical bytes — not opened for writing at all, so the
  // recovery costs nothing in the vault's git history either.
  expect(fs.statSync(path.join(root, "house.olai")).mtimeMs).toBe(stamp)
  expect(read(root, "shed.olai")).toContain(`"props":{"status":"done","since":"2026-08-01"}`)
})

/**
 * A file it cannot carry across keeps every byte, and the rest of the directory
 * still goes.
 *
 * Per-FILE rather than all-or-nothing across the directory, and that is the
 * right grain: a file is migrated whole or not at all because a half-converted
 * file is one no reader has a rule for, but one bad line in `pantry.olai` is no
 * reason to leave `house.olai` in a shape the running binary cannot read.
 */
test("a record that cannot be carried across leaves its file alone, and only its file", async () => {
  const root = directoryOf({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen","doing":true}\n`,
    "pantry.olai": `{"id":"a","ord":"a0","title":"a","done":true}\n` +
      `{"id":"b","ord":"a1","title":"b","done":true,"doing":"2026-08-10"}\n`,
  })
  const pantry = read(root, "pantry.olai")

  const result = await sweep(root)
  expect(result.migrated).toEqual(["house.olai"])
  expect(result.left).toHaveLength(1)
  expect(result.left[0]?.file).toBe("pantry.olai")
  expect(result.left[0]?.why[0]?.line).toBe(2)
  expect(result.left[0]?.why[0]?.why).toContain("`done` and `doing`")

  // Byte for byte, including the record on line 1 that WOULD have migrated: the
  // file is the unit, so the human sees exactly what they wrote when they go to
  // fix line 2.
  expect(read(root, "pantry.olai")).toBe(pantry)
  expect(read(root, "house.olai")).toContain(`"props":{"status":"doing"}`)
})

/** Documents and anything else are not outlines and are not touched — the walk
 *  claims what `fileKind` claims and nothing else, which is the same answer the
 *  store is about to give about the same directory. */
test("a document is not an outline, and is left where it is", async () => {
  const root = directoryOf({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen","doing":true}\n`,
    "notes.md": `# a note\n\n{"id":"not","ord":"a0","title":"a record","done":true}\n`,
    "stray.txt": `{"id":"nor","ord":"a0","title":"this","done":true}\n`,
  })
  const note = read(root, "notes.md")
  const stray = read(root, "stray.txt")

  const result = await sweep(root)
  expect(result.migrated).toEqual(["house.olai"])
  expect(read(root, "notes.md")).toBe(note)
  expect(read(root, "stray.txt")).toBe(stray)
})

/** An empty directory is a directory with nothing to do, rather than an error
 *  or a file minted to prove the step ran. */
test("a directory with no outlines is nothing to do", async () => {
  const result = await sweep(directoryOf({}))
  expect(result).toEqual({ migrated: [], left: [] })
})
