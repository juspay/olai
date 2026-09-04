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
 * IT READS THE BROKEN FILES NOW, not a verdict, and that is the per-file ruling
 * of 2026-08-29 arriving here: a broken outline does not stop the set loading,
 * so what is wrong with a served directory rides on the FILES and the errors
 * cell is left saying the one thing it is really about — a directory nobody
 * could read. Both sources go into ONE reading (`troubleIn`), which is what
 * decides between the two sentences — so the precedence between them is asked
 * here rather than left to the order of two arms in the markup.
 *
 * The SWEEP at the end is the other half of the same promise: the surfaces
 * entitled to enumerate are the ones whose whole job is enumerating, and this
 * file is not one of them.
 */

import {
  type BrokenFile,
  NOTHING_WRONG,
  type OutlineError,
  type Summary,
  verdictOf,
} from "@olai/format"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

import { BANNER_FILES, SAID, type Trouble, troubleIn } from "./banner.ts"

/** The reading, for the ordinary case: files this tab knows are broken over a
 *  directory the server is reading fine. */
const filesFace = (broken: ReadonlyMap<string, BrokenFile>): Trouble => {
  const trouble = troubleIn(broken, NOTHING_WRONG)
  if (trouble === null) throw new Error("expected the broken files to be trouble")
  return trouble
}

/** The afternoon, as a fixture: one file, `many` rows, every one of them real
 *  (`bad-prop` is what a `roster` declaration refuses) — as the set carries it,
 *  which is one `broken` entry per file. */
const flood = (file: string, many: number): ReadonlyMap<string, BrokenFile> =>
  broken([{
    file,
    errors: Array.from({ length: many }, (_, at): OutlineError => ({
      file,
      line: at + 1,
      code: "bad-prop",
      message:
        `\`agent\` holds "claude-opus", which \`roster\` does not declare (row ${at})`,
    })),
  }])

/** The map a tab holds — keyed by path, in whatever order the heads arrived,
 *  which is exactly what the banner has to sort for itself. */
const broken = (files: ReadonlyArray<BrokenFile>): ReadonlyMap<string, BrokenFile> =>
  new Map(files.map((one) => [one.file, one]))

test("135 rows in one file draw one line, and the line is a count", () => {
  const face = filesFace(flood("orchestrator/lanes.olai", 135)).face
  expect(face.files).toEqual([
    { file: "orchestrator/lanes.olai", state: "invalid", count: 135 },
  ])
  expect(face.total).toBe(135)
})

// THE PAYLOAD DOES NOT GROW. Said of the serialised value, because that is what
// a rendering can reach: two verdicts about the same file differ in the banner
// by their COUNTS and by nothing else, whether the file has five findings or a
// hundred and thirty-five.
//
// A digit delta is deliberately NOT the assertion. `135` is four characters
// longer than `5` twice over, and a test that pins the four would go on passing
// over a face that had started carrying something and go red over a fixture
// that changed its numbers — a coincidence standing where the teeth belong.
// What is asserted is the structure: the two faces are the same value with the
// counts taken out, and nothing a row carries is anywhere in it.
test("the banner's payload is bounded regardless of the row count", () => {
  const countless = (face: Summary) => ({
    ...face,
    total: 0,
    files: face.files.map((one) => ({ ...one, count: 0 })),
  })
  const few = filesFace(flood("lanes.olai", 5)).face
  const many = filesFace(flood("lanes.olai", 135)).face
  expect(countless(many)).toEqual(countless(few))
  expect(JSON.stringify(many)).not.toContain("claude-opus")
  expect(JSON.stringify(many)).not.toContain("message")
})

test("more broken files than the clamp are counted, not listed", () => {
  const files = Array.from({ length: BANNER_FILES + 3 }, (_, at) => `f${at}.olai`)
  const face = filesFace(
    broken(files.map((file): BrokenFile => ({
      file,
      errors: [{
        file,
        line: 1,
        code: "duplicate-id",
        message: "already the id of another node",
      }],
    }))),
  ).face
  expect(face.files).toHaveLength(BANNER_FILES)
  expect(face.more).toBe(3)
})

// IN PATH ORDER, whatever order the heads arrived in — the banner reads down
// the directory the way the sidebar beside it does, and the map it is handed is
// a fold of delta frames rather than a listing.
test("the files are named in path order, not in arrival order", () => {
  const face = filesFace(
    broken(["notes/zed.olai", "attic.olai", "notes/alpha.olai"].map((file) => ({
      file,
      errors: [{ file, line: 1, code: "duplicate-id" as const, message: "twice" }],
    }))),
  ).face
  expect(face.files.map((one) => one.file))
    .toEqual(["attic.olai", "notes/alpha.olai", "notes/zed.olai"])
})

/** The other thing that can be wrong: the directory itself would not open. */
const WENT_AWAY = verdictOf([{
  file: ".",
  line: 0,
  code: "unreadable-directory" as const,
  message: "ENOENT — the served directory is not there",
}])

// The lede's OTHER mood, and the reason it is read off the verdict rather than
// written as a fact: a directory that could not be READ has nothing wrong with
// its files, and telling somebody whose mount went away to fix their outlines
// is worse than the silence this banner replaced.
test("a directory that could not be read is the banner's other sentence", () => {
  const gone = troubleIn(new Map(), WENT_AWAY)
  expect(gone?.kind).toBe("gone")
  expect(SAID[gone!.face.files[0]!.state]).toBe("could not be read")
  // …and a directory full of broken files is NOT that sentence: those pages are
  // live, and telling their reader they are looking at an old copy would be the
  // one thing this banner must never say.
  expect(filesFace(flood("lanes.olai", 3)).kind).toBe("files")
})

/**
 * THE PRECEDENCE, asked once and answered here.
 *
 * A tab's broken map is a fold of frames the server sent WHILE it could still
 * read the directory, so over one that has gone away those entries are the last
 * thing that was true. Naming them would send a reader to go and fix files
 * nobody can currently see. It used to be the order of two arms inside the
 * markup; it is a value now, and the `gone` arm carries no per-file face for a
 * component to draw by mistake.
 */
test("a directory that went away outranks the files it left behind", () => {
  const trouble = troubleIn(flood("lanes.olai", 3), WENT_AWAY)
  expect(trouble?.kind).toBe("gone")
  expect(trouble?.face.files.map((one) => one.file)).toEqual(["."])
})

test("nothing wrong is no banner at all", () => {
  expect(troubleIn(new Map(), NOTHING_WRONG)).toBeNull()
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
 *
 * A THIRD ENTITLED CALLER WENT WITH THE PANEL and is not on this list any more:
 * the chat's `Refusal.tsx`, which draws the rows a write gate judged for the
 * person whose write it refused — not a banner over anybody's page, which is
 * why it was ever allowed. It is `olai-plugin-chat`'s file now and reaches
 * `Rows` through `@olai/web/client/errors/Report.tsx`, so this walk of
 * `src/client/` cannot see it. What must not follow it out is the CLAIM: the
 * rows are exported to every package that draws in this app, and a fourth
 * caller over there floods a page exactly as a fourth caller here would. The
 * same sweep over the panel's tree, where that one file is the whole list, is
 * in `packages/plugins/chat/src/browser/claims.test.ts`.
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
  ].sort())
})
