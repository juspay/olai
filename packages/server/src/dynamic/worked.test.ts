/**
 * THE DOC'S WORKED EXAMPLES, COMPILED — every half in
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
 * EVERY HALF ON THE PAGE, by the label the page puts over it.
 *
 * ANCHORED ON THE LABEL rather than on the language tag or the block's
 * position: the page has several `ts` blocks (a refusal quoted, the import list,
 * the compile check, a service catalog) and gains more as it is written to.
 * `` `server.ts`: `` is the doc's own name for the thing this is about, so a
 * section added above or below moves nothing here, and a RENAME of the label is
 * a loud failure rather than a test quietly compiling the wrong snippet.
 *
 * ALL OF THEM rather than the first, since 12d: the page carries two worked
 * examples — the morning agenda, which does something, and the swatch, which
 * draws something — and a reader who copies either is owed the same promise.
 * Taking the first match would have left the second example uncompiled from the
 * day it was written, which is the failure this file exists about.
 */
const halvesIn = (page: string, label: string): ReadonlyArray<string> => {
  const found = [...page.matchAll(
    new RegExp("`" + label + "`:\\n+```[a-z]*\\n([\\s\\S]*?)```", "g"),
  )].flatMap((hit) => (hit[1] === undefined ? [] : [hit[1]]))
  if (found.length === 0) {
    throw new Error(`docs/dynamic-plugins.md has no fenced block under \`${label}\`:`)
  }
  return found
}

const page = readFileSync(DOC, "utf8")

test("every server half on the page builds", async () => {
  const halves = halvesIn(page, "server.ts")
  // A FLOOR, so a page that lost its examples to a rewrite cannot pass by
  // having none: two worked examples, and the second one is the swatch.
  expect(halves.length).toBeGreaterThanOrEqual(2)
  for (const source of halves) {
    const built = await buildHalf("server", source)
    if (!built.ok) throw new Error(built.why)
    expect(built.ok).toBe(true)
  }
})

test("every browser half on the page builds", async () => {
  for (const source of halvesIn(page, "browser.tsx")) {
    const built = await buildHalf("browser", source)
    if (!built.ok) throw new Error(built.why)
    // ...and comes out bound, which is what a tab is handed.
    expect(built.text).toContain("__olai_plugin_modules")
    expect(built.text).not.toMatch(/^\s*import\s/m)
  }
})

/**
 * THE FIRST EXAMPLE NAMES THE JOURNAL'S KEY, and nothing else on the page says
 * so.
 *
 * It is the one fact a build cannot check: `serviceTag<Shape>("journal.agenda")`
 * with the word misspelled compiles, mounts, and leaves the row `waiting` for
 * ever on a key nobody offers — which reads exactly like a journal that is
 * switched off. The provider's own bench holds the other end of this string
 * (`olai-plugin-journal`'s `agenda.test.ts`).
 */
test("...and the morning agenda names the door it waits on", () => {
  const [morning] = halvesIn(page, "server.ts")
  expect(morning).toContain(`serviceTag<`)
  expect(morning).toContain(`"journal.agenda"`)
  // The delivery is the point of it: a reader copying this gets a plugin that
  // puts a sentence into a conversation, not one that computes one and drops it.
  expect(morning).toContain("deliveries.deliver")
})

/**
 * THE ONE WORD THAT WAS WRONG, pinned as itself.
 *
 * A build cannot see this: `props.value` on a face typed by nothing compiles
 * exactly as well as `context.entry.value` does. What is asserted is that the
 * example reads the slot's own shape — which is the fact a copy of it would
 * silently stop keeping.
 */
test("...and the swatch's face reads the chip's context rather than a bare value", () => {
  for (const face of halvesIn(page, "browser.tsx")) {
    expect(face).toContain("context.entry.value")
    expect(face).not.toContain("props.value")
  }
})
