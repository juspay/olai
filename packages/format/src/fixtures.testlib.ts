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

import { derive } from "./derive.ts"
import type { OutlineError } from "./errors.ts"
import { unkept } from "./kinds.ts"
import type { Located } from "./node.ts"
import { parseOutline } from "./parse.ts"
import { assemble, type DecodedFile, type Outline, type OutlineSet } from "./set.ts"
import type { Reading } from "./validate.ts"

/** The default fixture file name. Named once so a test that cares about paths
 *  can say so, and one that does not need never mention it. */
export const FIXTURE_FILE = "a.olai"

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
  /** The BODIED files served alongside. A bare path is one whose text no test
   *  cares about; `[path, text]` is one whose text it does — and a file the set
   *  holds the PATH of and not the content ({@link unkept}, a `.html`) may only
   *  be named bare, because a load can never produce one carrying text. */
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
        const [file, said] = typeof document === "string" ? [document, ""] : document
        const bodyless = unkept(file)
        // THROWN, like an unparsable outline above and for the same reason: a
        // fixture that says a `.html` holds text is a test written against a
        // set nobody can serve, and quietly dropping the text would let it pass
        // for the wrong reason. The type cannot say this — the constraint is
        // between a path's SPELLING and a field — so the fixture says it.
        if (bodyless && said !== "") {
          throw new Error(
            `fixture \`${file}\` is a file the set holds the path of and not the ` +
              `content, so it cannot be given text: name it bare.`,
          )
        }
        return [
          file,
          Result.succeed<DecodedFile>({ file, text: bodyless ? null : said }),
        ] as const
      }),
      ...Object.entries(broken).map(
        ([file, contents]) => [file, Result.fail(failureOf(contents, file))] as const,
      ),
    ]),
  )

/**
 * A set and its derivation, paired the way {@link ./validate.ts}'s `Reading`
 * is — what the validator answers with and what the store publishes.
 *
 * Here rather than in a package above, for the reason {@link setOf} is: the
 * pairing is this package's, so a fixture that builds one by hand belongs where
 * the type is declared. Four such copies were living in two packages above
 * before this existed.
 *
 * It is the one thing no production caller does: `validate` makes the pair, and
 * a reader is handed it. A test that starts from TEXT is the one place the two
 * halves are put together deliberately.
 */
export const readingOf = (set: OutlineSet): Reading => ({
  set,
  derived: derive(set.nodes),
})

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

/**
 * A seeded pseudo-random source: Mulberry32, eight lines of arithmetic and one
 * seed.
 *
 * Here for the reason everything else in this module is here: two callers were
 * about to hold byte-identical copies of it. What it buys is that a GENERATED
 * corpus is a fixture like any other — the property test's five hundred rounds
 * and the browser's benchmark vault are both re-runnable, so a failure is a
 * case somebody can reproduce rather than one that happened once on a machine.
 * `Math.random` would make either of them a lottery whose losing tickets are
 * unprintable.
 */
export const seeded = (seed: number): (() => number) => {
  let at = seed >>> 0
  return () => {
    at = (at + 0x6D2B79F5) | 0
    let mixed = Math.imul(at ^ (at >>> 15), 1 | at)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

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

/**
 * A GENERATED VAULT: path → the file's JSONL, one directory's worth of
 * outlines with the shapes a real one has.
 *
 * Here rather than in either benchmark for {@link seeded}'s own reason, and
 * with a sharper edge on it: two benches quote figures about "the 1,000-file
 * vault" — what a frame costs a tab (`@olai/web`'s `deriving.bench.ts`) and
 * what a patch costs the patcher underneath it ({@link ../patch.bench.ts}) —
 * and two numbers about two different generated corpora are two numbers nobody
 * may compare. One generator is what makes them one vault.
 *
 * WHAT IT WRITES, and each of the shapes earns its place: a root per file with
 * its records under it, marks on about a third of them so blockedness has
 * something to answer, an `after` edge on a tenth so the ordering graph is not
 * empty, and — every twentieth record — a MIRROR pointing into the file before
 * this one, so a mark that flips reaches a file the delta never named and the
 * dirty set is not always one record. Paths are mostly flat, some nested, and
 * a few in a directory named after a file beside it: the pair the two readings
 * of path order used to disagree about.
 *
 * SEEDED, so the corpus is a fixture rather than a lottery, and the seed is a
 * parameter rather than a constant so a caller that wants a second, different
 * vault of the same shape can have one.
 */
export const vaultOf = (
  { files, records, seed = 20260817 }: {
    readonly files: number
    readonly records: number
    readonly seed?: number
  },
): ReadonlyMap<string, string> => {
  const random = seeded(seed)
  const corpus = new Map<string, string>()
  for (let at = 0; at < files; at++) {
    const path = pathOf(random, at)
    if (corpus.has(path)) continue
    corpus.set(path, fileOf(random, at, records))
  }
  return corpus
}

/** Paths a directory really holds — see {@link vaultOf}. Drawn from the same
 *  stream the records are, so the whole vault is one seed's answer. */
const pathOf = (random: () => number, at: number): string => {
  const roll = random()
  if (roll < 0.2) return `area${at % 20}/note${at}.olai`
  if (roll < 0.24) return `area${at % 20}.olai`
  return `note${at}.olai`
}

/** One file's JSONL: a root and its children, some marked, a few naming each
 *  other and a few standing for a record in the file before them. */
const fileOf = (random: () => number, at: number, records: number): string => {
  const lines: Array<string> = []
  const root = `f${at}r`
  lines.push(JSON.stringify({ id: root, ord: "a0", title: `file ${at}` }))
  for (let which = 1; which < records; which++) {
    const id = `f${at}n${which}`
    const record: Record<string, unknown> = {
      id,
      parent: root,
      ord: `a${which}`,
      title: `record ${which} of file ${at}`,
    }
    if (random() < 0.3) record["todo"] = true
    else if (random() < 0.15) record["done"] = true
    if (which > 1 && random() < 0.1) record["after"] = [`f${at}n${which - 1}`]
    // A placement pointing into the file before this one, so a mark that flips
    // reaches a file the frame never named.
    if (at > 0 && random() < 0.05) {
      lines.push(
        JSON.stringify({ id: `${id}m`, parent: root, ord: `b${which}`, mirror: `f${at - 1}n1` }),
      )
    }
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

/**
 * One record of a {@link vaultOf} file, retitled — the EDIT both benches make,
 * spelled once beside the generator whose titles it has to match.
 *
 * A benchmark's edit is not decoration: an arm that answered a frame it never
 * recomputed reports a magnificent number, and what catches that is reading the
 * new title back out of the arm's own answer. So the two halves — write it,
 * find it — have to agree about what was written, and the regex here is the
 * half that knows what {@link vaultOf} wrote.
 */
export const retitled = (text: string, title: string): string =>
  text.replace(/"title":"record 1 of file \d+"/, `"title":${JSON.stringify(title)}`)
