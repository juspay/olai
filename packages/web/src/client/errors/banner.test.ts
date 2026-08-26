/**
 * THE FLOOD, PINNED — red-first, on the fixture that produced it.
 *
 * 2026-08-25, sighted by the human with `git.md` open: `orchestrator/lanes.olai`
 * was failing typed-property validation with about 135 rows, and the last-good
 * banner at the top of EVERY page inlined the full enumeration. The selected
 * page's own content was still there below, but the banner ran longer than a
 * screen, so every page opened on a wall of another file's errors
 * (`last-good-banner-flood`).
 *
 * What this asks is the two halves separately. The BOUND is the format's and
 * has its own suite (`@olai/format`'s `verdict.test.ts`); what is only true
 * here is that this banner's clamp is on top of it and that the payload the
 * banner draws does not grow with the row count — asserted against the VALUE
 * rather than against the markup, because a row that never reaches the reading
 * is a row no rendering can put on screen.
 *
 * The SWEEP at the end is the other half of the same promise: the surfaces
 * entitled to enumerate are the two whose whole job is enumerating, and this
 * file is not one of them.
 */

import { type OutlineError, verdictOf } from "@olai/format"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

import { BANNER_FILES, bannerFace, SAID, wentAway } from "./banner.ts"

/** The afternoon, as a fixture: one file, `many` rows, every one of them real
 *  (`bad-prop` is what a `roster` declaration refuses). */
const flood = (file: string, many: number) =>
  verdictOf(
    Array.from({ length: many }, (_, at): OutlineError => ({
      file,
      line: at + 1,
      code: "bad-prop",
      message:
        `\`agent\` holds "claude-opus", which \`roster\` does not declare (row ${at})`,
    })),
  )

test("135 rows in one file draw one line, and the line is a count", () => {
  const face = bannerFace(flood("orchestrator/lanes.olai", 135))
  expect(face.files).toEqual([
    { file: "orchestrator/lanes.olai", state: "invalid", count: 135 },
  ])
  expect(face.total).toBe(135)
})

// THE PAYLOAD DOES NOT GROW. Said of the serialised value, because that is what
// a rendering can reach: two verdicts about the same file differ in the banner
// by a number, whether the file has five findings or a hundred and thirty-five.
test("the banner's payload is bounded regardless of the row count", () => {
  const few = JSON.stringify(bannerFace(flood("lanes.olai", 5)))
  const many = JSON.stringify(bannerFace(flood("lanes.olai", 135)))
  // The only thing that grew is the two numbers — the per-file count and the
  // total — from one digit to three. Twenty-seven times the findings, four more
  // characters on the wire to the reader.
  expect(many.length - few.length).toBe(4)
  expect(many).not.toContain("claude-opus")
  expect(many).not.toContain("message")
})

test("more broken files than the clamp are counted, not listed", () => {
  const files = Array.from({ length: BANNER_FILES + 3 }, (_, at) => `f${at}.olai`)
  const face = bannerFace(
    verdictOf(
      files.map((file): OutlineError => ({
        file,
        line: 1,
        code: "duplicate-id",
        message: "already the id of another node",
      })),
    ),
  )
  expect(face.files).toHaveLength(BANNER_FILES)
  expect(face.more).toBe(3)
})

// The lede's OTHER mood, and the reason it is read off the verdict rather than
// written as a fact: a directory that could not be READ has nothing wrong with
// its files, and telling somebody whose mount went away to fix their outlines
// is worse than the silence this banner replaced.
test("a directory that could not be read is the banner's other sentence", () => {
  const gone = bannerFace(
    verdictOf([{
      file: ".",
      line: 0,
      code: "unreadable-directory",
      message: "ENOENT — the served directory is not there",
    }]),
  )
  expect(wentAway(gone)).toBe(true)
  expect(SAID[gone.files[0]!.state]).toBe("could not be read")
  expect(wentAway(bannerFace(flood("lanes.olai", 3)))).toBe(false)
})

/**
 * NOBODY ELSE ENUMERATES — the sweep, in the house tradition.
 *
 * `./Report.tsx` draws rows and `./Rows` is how one file's are drawn; the two
 * surfaces entitled to reach them are the ones whose whole promise is that
 * nothing is summarised away — the error PAGE, which is what a reader gets
 * when there is no tree at all, and the one BROKEN outline's own pane. A third
 * caller is how the flood came back.
 *
 * It reads the sources rather than the types because that is the shape of the
 * mistake: the rows are still on the verdict, still reachable, and still right
 * to draw in the two places above.
 */
test("only the error page and a broken outline's own pane draw the rows", () => {
  const here = path.dirname(new URL(import.meta.url).pathname)
  const client = path.dirname(here)
  const drawn: Array<string> = []
  const walk = (at: string): void => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        if (entry.name.includes(".test.")) continue
        const text = fs.readFileSync(full, "utf8")
        if (/^import .*from ".*Report\.tsx"$/m.test(text)) {
          drawn.push(path.relative(client, full))
        }
      }
    }
  }
  walk(client)
  expect(drawn.sort()).toEqual([
    // The whole page: the set never loaded, so this IS the product.
    "errors/Page.tsx",
    // One outline's own place, in the tree's stead.
    "errors/Broken.tsx",
    // A refused WRITE, in the chat panel — the rows the gate judged, shown to
    // the person whose write they refused. Not a banner over anybody's page.
    "chat/Refusal.tsx",
  ].sort())
})
