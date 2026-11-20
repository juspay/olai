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

const filesFace = (broken: ReadonlyMap<string, BrokenFile>): Trouble => {
  const trouble = troubleIn(broken, NOTHING_WRONG)
  if (trouble === null) throw new Error("expected the broken files to be trouble")
  return trouble
}

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

const broken = (files: ReadonlyArray<BrokenFile>): ReadonlyMap<string, BrokenFile> =>
  new Map(files.map((one) => [one.file, one]))

test("135 rows in one file draw one line, and the line is a count", () => {
  const face = filesFace(flood("orchestrator/lanes.olai", 135)).face
  expect(face.files).toEqual([
    { file: "orchestrator/lanes.olai", state: "invalid", count: 135 },
  ])
  expect(face.total).toBe(135)
})

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

const WENT_AWAY = verdictOf([{
  file: ".",
  line: 0,
  code: "unreadable-directory" as const,
  message: "ENOENT — the served directory is not there",
}])

test("a directory that could not be read is the banner's other sentence", () => {
  const gone = troubleIn(new Map(), WENT_AWAY)
  expect(gone?.kind).toBe("gone")
  expect(SAID[gone!.face.files[0]!.state]).toBe("could not be read")
  expect(filesFace(flood("lanes.olai", 3)).kind).toBe("files")
})

test("a directory that went away outranks the files it left behind", () => {
  const trouble = troubleIn(flood("lanes.olai", 3), WENT_AWAY)
  expect(trouble?.kind).toBe("gone")
  expect(trouble?.face.files.map((one) => one.file)).toEqual(["."])
})

test("nothing wrong is no banner at all", () => {
  expect(troubleIn(new Map(), NOTHING_WRONG)).toBeNull()
})

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
    "errors/Page.tsx",
    "errors/Broken.tsx",
  ].sort())
})
