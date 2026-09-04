/**
 * THE DOC'S WORKED EXAMPLE, COMPILED — the two halves in
 * `docs/dynamic-plugins.md` read out of the file and put through the same call
 * the serve makes.
 *
 * ## Why the doc is the fixture rather than a copy of it
 *
 * Because the copy is what went wrong. The example told an author to write a
 * face taking `props.value`, and `outline.row.chip` hands a `ChipContext` whose
 * value is `context.entry.value` — so anybody following it got `undefined`, a
 * chip with no colour, and **nothing red anywhere**: it compiles, it mounts, the
 * row says `running`, and the square is invisible. A node agent building a
 * plugin on this branch found it by typechecking the halves before spending its
 * human's approval (juspay/olai#506).
 *
 * A test that held its own copy of the example would have compiled that copy
 * happily while the doc went on saying something else. So the fenced blocks are
 * READ, from the file a person reads, and put through `buildHalf` — the same
 * call `./runtime.ts` makes on a note in somebody's vault.
 *
 * ## What this does and does not prove
 *
 * It proves the example BUILDS: its imports are ones olai binds, its JSX
 * compiles, and the module that comes out has no imports left in it. It does not
 * prove the face draws the right thing — nothing short of a browser does — so
 * the shape the mistake had is pinned separately, as the one word that was
 * wrong.
 */

import { buildHalf } from "@olai/plugin-build"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** The page, from the tree rather than from a copy — four directories up, which
 *  is `packages/server/src/dynamic` to the root. */
const DOC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "docs", "dynamic-plugins.md")

/**
 * ONE HALF OF THE WORKED EXAMPLE, by the label the page puts over it.
 *
 * ANCHORED ON THE LABEL rather than on the language tag or the block's
 * position: the page has several `ts` blocks (a refusal quoted, the import list,
 * the compile check) and gains more as it is written to. `` `server.ts`: `` is
 * the doc's own name for the thing this is about, so a section added above or
 * below moves nothing here, and a RENAME of the label is a loud failure rather
 * than a test quietly compiling the wrong snippet.
 */
const halfIn = (page: string, label: string): string => {
  const found = new RegExp("`" + label + "`:\\n+```[a-z]*\\n([\\s\\S]*?)```").exec(page)
  if (found?.[1] === undefined) {
    throw new Error(`docs/dynamic-plugins.md has no fenced block under \`${label}\`:`)
  }
  return found[1]
}

const page = readFileSync(DOC, "utf8")

test("the doc's server half builds", async () => {
  const built = await buildHalf("server", halfIn(page, "server.ts"))
  expect(built.ok).toBe(true)
  if (built.ok) return
  throw new Error(built.why)
})

test("the doc's browser half builds", async () => {
  const built = await buildHalf("browser", halfIn(page, "browser.tsx"))
  expect(built.ok).toBe(true)
  if (!built.ok) throw new Error(built.why)
  // ...and comes out bound, which is what a tab is handed.
  expect(built.text).toContain("__olai_plugin_modules")
  expect(built.text).not.toMatch(/^\s*import\s/m)
})

/**
 * THE ONE WORD THAT WAS WRONG, pinned as itself.
 *
 * A build cannot see this: `props.value` on a face typed by nothing compiles
 * exactly as well as `context.entry.value` does. What is asserted is that the
 * example reads the slot's own shape — which is the fact a copy of it would
 * silently stop keeping.
 */
test("...and its face reads the chip's context rather than a bare value", () => {
  const face = halfIn(page, "browser.tsx")
  expect(face).toContain("context.entry.value")
  expect(face).not.toContain("props.value")
})
