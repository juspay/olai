/**
 * EVERY REAL TEXT THIS REPOSITORY HOLDS — each `.md` and each row's title and
 * note under `packages/tests/fixtures/`, and every page under `website/docs/`.
 *
 * What the guard's bounds are measured against (`./parse.bench.ts`) and what
 * the test that no real note is refused reads (`./read.test.ts`), so the two
 * cannot be about different texts. A body's frontmatter is taken off, as a
 * file's reader takes it off.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { proseIn } from "./frontmatter.ts"

const REPOSITORY = join(import.meta.dir, "../../..")

const filesUnder = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]
  )

/** One text, and where it came from — a path, and for a row, its id. */
export interface RealText {
  readonly from: string
  readonly text: string
}

/** Every row title and note of every fixture outline. A line that is not a
 *  record — the broken fixtures hold some on purpose — holds no row. */
export const fixtureRows = (): ReadonlyArray<RealText & { readonly field: "title" | "desc" }> =>
  filesUnder(join(REPOSITORY, "packages/tests/fixtures")).filter((file) => file.endsWith(".olai")).flatMap((file) =>
    readFileSync(file, "utf8").split("\n").flatMap((line) => {
      const record = recordOf(line)
      if (record === undefined) return []
      const from = `${relative(REPOSITORY, file)}#${typeof record["id"] === "string" ? record["id"] : ""}`
      const title = record["title"]
      const desc = record["desc"]
      return [
        ...(typeof title === "string" ? [{ from, text: title, field: "title" as const }] : []),
        ...(typeof desc === "string" ? [{ from, text: desc, field: "desc" as const }] : []),
      ]
    })
  )

const recordOf = (line: string): Readonly<Record<string, unknown>> | undefined => {
  try {
    const value: unknown = JSON.parse(line)
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : undefined
  } catch {
    return undefined
  }
}

/** Each of the guard's four hostile shapes (`./parse.ts`), `n` deep — the
 *  text the guard is measured and tested against. */
export const HOSTILE = {
  emphasis: (n: number): string => "_".repeat(n) + "word" + "_".repeat(n),
  cells: (n: number): string => "| a ".repeat(n) + "|\n" + "| --- ".repeat(n) + "|\n" + "| b ".repeat(n) + "|",
  quotes: (n: number): string => ">".repeat(n) + " x",
  lists: (n: number): string => Array.from({ length: n }, (_, at) => "  ".repeat(at) + "- a").join("\n"),
} as const

/** Every `.md` under the fixtures and the docs, its frontmatter taken off. */
export const realDocuments = (): ReadonlyArray<RealText> =>
  [join(REPOSITORY, "packages/tests/fixtures"), join(REPOSITORY, "website/docs")].flatMap((root) =>
    filesUnder(root).filter((file) => file.endsWith(".md")).map((file) => ({
      from: relative(REPOSITORY, file),
      text: proseIn(readFileSync(file, "utf8")),
    }))
  )

/** All of them. */
export const realTexts = (): ReadonlyArray<RealText> => [...fixtureRows(), ...realDocuments()]
