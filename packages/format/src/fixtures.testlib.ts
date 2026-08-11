/**
 * The fixtures every test in this package is written against: JSONL text in,
 * exactly the records a real load produces out.
 *
 * Fixtures go through `parseOutline` rather than being written as record
 * literals, because line numbers are part of the answer — sibling ties break
 * on them, and every error names one — and a hand-built `Located` could carry
 * a line the file does not have. That makes a fixture something that can fail
 * to parse, and a fixture that failed to parse is a test measuring the wrong
 * phase. So it THROWS, and the diagnostic is the point: which file, which
 * line, what the parser said, and the text as it was handed over. Four test
 * files used to each grow their own copy of this; one copy is what keeps that
 * diagnostic worth reading.
 *
 * Nothing here has tests of its own — it is a helper module, not a suite, and
 * `bun test` collects only `*.test.ts`.
 */

import { Result } from "effect"

import type { OutlineError } from "./errors.ts"
import type { Located } from "./node.ts"
import { parseOutline } from "./parse.ts"
import { assemble, type DecodedFile, type Outline, type OutlineSet } from "./set.ts"

/** The default fixture file name. Named once so a test that cares about paths
 *  can say so, and one that does not need never mention it. */
export const FIXTURE_FILE = "a.jsonl"

/** One file's worth of JSONL, parsed — or a diagnostic good enough to fix the
 *  fixture without opening the parser. */
export const outlineOf = (contents: string, file = FIXTURE_FILE): Outline => {
  const parsed = parseOutline(file, contents)
  if (Result.isFailure(parsed)) throw new Error(unparsable(file, contents, parsed.failure))
  return parsed.success
}

/** The located records of one file, in file order. */
export const nodesOf = (
  contents: string,
  file = FIXTURE_FILE,
): ReadonlyArray<Located> => outlineOf(contents, file).nodes

/**
 * Several files' worth, put through the real assembly: the files found, their
 * nodes flattened into one list (every `Located` already names its own file),
 * the documents served alongside, and any file that did not parse.
 *
 * It calls `assemble` rather than building the struct, so a test of the
 * validator is judging the same shape a load produces — a second, hand-written
 * assembly here is how a fixture ends up proving something about itself.
 */
export const setOf = (
  files: Record<string, string>,
  /** The `.md` files served alongside. A bare path is a document whose text no
   *  test cares about; `[path, text]` is one whose text it does. */
  documents: ReadonlyArray<string | readonly [file: string, text: string]> = [],
  broken: Record<string, string> = {},
): OutlineSet =>
  assemble(
    new Map<string, Result.Result<DecodedFile, ReadonlyArray<OutlineError>>>([
      ...Object.entries(files).map(
        ([file, contents]) =>
          [file, Result.succeed<DecodedFile>(outlineOf(contents, file))] as const,
      ),
      ...documents.map((document) => {
        const [file, text] = typeof document === "string" ? [document, ""] : document
        return [file, Result.succeed<DecodedFile>({ file, text })] as const
      }),
      ...Object.entries(broken).map(
        ([file, contents]) => [file, Result.fail(failureOf(contents, file))] as const,
      ),
    ]),
  )

/** One file's worth of JSONL that must NOT parse, and the errors it produces —
 *  the other half of the fixture contract above: a fixture meant to stand in
 *  for an unreadable file has to actually be one. */
export const failureOf = (
  contents: string,
  file = FIXTURE_FILE,
): ReadonlyArray<OutlineError> => {
  const parsed = parseOutline(file, contents)
  if (Result.isSuccess(parsed)) {
    throw new Error(
      `fixture \`${file}\` parses, so it cannot stand in for a file that does not:\n` +
        contents.split("\n").map((line, index) => `  ${index + 1} | ${line}`).join("\n"),
    )
  }
  return parsed.failure
}

/**
 * Run `body` as if this machine were in `zone`.
 *
 * Anything about a LOCAL time that is asserted in the runner's own zone is
 * asserted nowhere: a CI lane is UTC, and under UTC a function that had
 * dropped local time entirely — `toISOString`, the exact regression
 * `../stamp.ts` is written against — satisfies every assertion about offsets
 * and days, because local IS UTC there. So the zone is named by the test
 * rather than inherited from whoever is running it.
 *
 * Bun reads `process.env.TZ` at `Date` construction, so a date built inside
 * `body` is in `zone`. RESTORING matters and is why this is a helper rather
 * than two lines at a call site: `bun test` shares one process across every
 * file, so a zone left set here is a zone every later suite silently runs in.
 *
 * The restore ASSIGNS and never deletes, which is not a style choice. Deleting
 * the variable stops Bun honouring any further change to it for the rest of
 * the process — the zone sticks at whatever was set last, and the second call
 * here would run in the first one's zone (measured, not guessed: after a
 * `delete`, setting `TZ` to three different zones in turn moved the offset not
 * at all). So a runner that had no `TZ` is restored to the zone it resolves
 * to, which is the same clock it started with under a name.
 */
export const inZone = (zone: string, body: () => void): void => {
  const was = process.env["TZ"] ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  process.env["TZ"] = zone
  try {
    body()
  } finally {
    process.env["TZ"] = was
  }
}

/** What {@link ../stamp.ts}'s `stampOf` writes: an ISO datetime, to the
 *  second, carrying its zone. Here rather than in the test that proves it,
 *  because three suites in two packages assert the same promise about a value
 *  they did not mint — the format's, the planner's and the ops layer's — and
 *  three regexes would be three chances to go on passing against a shape the
 *  mint had stopped writing. */
export const STAMP_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/

/** Several files' worth of records, flat — the shape every rule and every walk
 *  wants, for the tests that need no set around them. */
export const nodesOfFiles = (
  files: Record<string, string>,
): ReadonlyArray<Located> => setOf(files).nodes

const unparsable = (
  file: string,
  contents: string,
  errors: ReadonlyArray<OutlineError>,
): string =>
  [
    `fixture \`${file}\` does not parse, so this test is not testing what it means to:`,
    ...errors.map((error) => `  ${error.file}:${error.line} ${error.code}: ${error.message}`),
    "as written:",
    ...contents.split("\n").map((line, index) => `  ${index + 1} | ${line}`),
  ].join("\n")
