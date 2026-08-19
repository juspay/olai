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
 * IT SERVES THE BENCHES TOO, and that is one concept rather than two: a
 * generated corpus, a seeded random source, a median and a clock are what makes
 * a MEASUREMENT re-runnable, which is the same thing that makes a fixture one.
 * The alternative was a second helper module beside this one, and the argument
 * against it is the argument for this one — `seeded` was moved here in the
 * first place because a test and a benchmark were about to hold byte-identical
 * copies of it.
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
 * what a patch costs the patcher underneath it ({@link ./patch.bench.ts}) —
 * and two numbers about two different generated corpora are two numbers nobody
 * may compare. One generator is what makes them one vault.
 *
 * WHAT IT WRITES, and each of the shapes earns its place: a root per file with
 * its records under it, marks on about a third of them so blockedness has
 * something to answer, an `after` edge on a tenth so the ordering graph is not
 * empty, and — every twentieth record — a MIRROR pointing into the file before
 * this one, so a mark that flips reaches a file the delta never named and the
 * dirty set is not always one record; a NOTE on every fifth record, with every
 * TENTH of them naming another record by its `@id`, so the derivation has prose
 * to read and the tag index is not an empty map both benches report nothing
 * about — which `./vault.test.ts` asserts of the size the benches run, because
 * the first spelling of this used a modulo that never fired; and `#tags` in the
 * titles ({@link titleTags}), because the index files BOTH sigils and a vault
 * whose titles hold none of the commoner one would measure the half nobody
 * writes. Paths are mostly flat, some nested, and a few in a
 * directory named after a file beside it: the pair the two readings of path
 * order used to disagree about.
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
      title: `record ${which} of file ${at}${titleTags(at, which)}`,
    }
    if (random() < 0.3) record["todo"] = true
    else if (random() < 0.15) record["done"] = true
    if (which > 1 && random() < 0.1) record["after"] = [`f${at}n${which - 1}`]
    // A NOTE on every fifth record, and every TENTH naming another by its
    // `@id` — because a vault whose records hold no prose at all measures none
    // of what a derivation does with prose. Without this the mention index is
    // an empty map in both benches: the corpus-wide note scan finds nothing and
    // the patcher’s re-file of it is free, so a new index prints as "costs
    // zero" when what it printed was "was never asked".
    //
    // TENTH RATHER THAN TWENTY-FIFTH, and the difference is the whole reason
    // `./vault.test.ts` exists: the default file holds twenty records, so
    // `which % 25` NEVER FIRED and the vault this comment described had 3,920
    // notes and not one `@` in it. The sentence was in the README beside the
    // numbers for a whole review cycle before grok derived the corpus and
    // counted. A fixture claim nothing asserts is a fixture claim that is
    // false.
    //
    // COUNTED rather than DRAWN, and that is not a style choice: every
    // `random()` call shifts the rest of this seeded stream, so drawing for the
    // note would have changed which files exist, which records they hold and
    // which of them are mirrors — renaming every figure the docs quote for
    // reasons that have nothing to do with notes. The vault is the one it has
    // always been, with prose added to it.
    if (which % 5 === 0) {
      record["desc"] = which % 10 === 0
        ? `a note about @f${at}n1 and what it is for`
        : `a note about #upkeep${at % 12} and what this is for`
    }
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
 * The `#tags` one record's title carries — a broad one on every third record
 * and a narrower one on every fifth, so a title sometimes holds two and most
 * hold one.
 *
 * WHY A VAULT NEEDS THEM: the index the benches print numbers about files what
 * prose says under BOTH sigils, and `#` is the one people write. A vault whose
 * titles hold only `@` measures the fold's cheap negative
 * (`derive.ts`'s `mayHoldTag`) rather than its walk, and would print a
 * corpus-wide tag walk as costing nothing — the same *was never asked*
 * `./vault.test.ts` was minted over. The shape is asserted there, at the size
 * the benches run.
 *
 * TWO VOCABULARIES rather than one, because a completion reading this index
 * ranks by how many records write a name: `#area0`..`#area19` are the names a
 * whole directory shares and `#topic0`..`#topic39` the ones a corner of it
 * does, so the ordering has something to order.
 *
 * COUNTED rather than DRAWN, exactly as the note above is and for its reason:
 * a `random()` call here would shift the rest of the seeded stream and rename
 * every figure the docs quote. Record 1 is deliberately left bare — it is the
 * one {@link retitled} rewrites, and a tag in it would make the benches' edit
 * an edit to the tag index as well as to a title.
 */
const titleTags = (at: number, which: number): string =>
  `${which % 3 === 0 ? ` #area${at % 20}` : ""}${
    which % 5 === 0 ? ` #topic${(at + which) % 40}` : ""
  }`

/**
 * One record of a {@link vaultOf} file, retitled to say it was edit `which` —
 * the EDIT both benches make, spelled once beside the generator whose titles it
 * has to match, and beside {@link retitledIn}, which is how it is read back.
 *
 * A benchmark's edit is not decoration: an arm that answered a frame it never
 * recomputed reports a magnificent number, and what catches that is reading the
 * new title back out of the arm's own answer. So the two halves — write it,
 * find it — have to agree about what was written, which is why they are one
 * pair here and not a regex in this module and a `startsWith` in each bench.
 */
export const retitled = (text: string, which: number): string => {
  const written = text.replace(/"title":"record 1 of file \d+"/, `"title":"${EDITED}${which}"`)
  // THROWN rather than handed back unchanged, like every other fixture in this
  // module: a no-op here is a benchmark whose edit edits nothing, and the arm
  // that catches it catches it one step later and blames the arm.
  if (written === text) {
    throw new Error(
      `fixture: this is not a \`vaultOf\` file — it holds no record to retitle:\n` +
        text.split("\n").slice(0, 3).map((line, index) => `  ${index + 1} | ${line}`).join("\n"),
    )
  }
  return written
}

/** Which edit {@link retitled} last wrote into one file's records, or
 *  `undefined` where an arm is still holding a revision that has not heard
 *  about any. The `EDITED` mark never leaves this module: a bench asks "which
 *  edit does this view say it is at" and compares that to the edit it made. */
export const retitledIn = (nodes: ReadonlyArray<Located>): number | undefined => {
  for (const at of nodes) {
    const title = (at.node as { readonly title?: string }).title
    if (title?.startsWith(EDITED) === true) return Number(title.slice(EDITED.length))
  }
  return undefined
}

/** What a retitled record's title starts with. Private, so the two halves above
 *  are the only way to write one or find one. */
const EDITED = "edited "

/**
 * The middle of a run's times, in milliseconds.
 *
 * Here for {@link seeded}'s reason once more, and this was the third copy about
 * to be written: `just bench`'s four legs each measure something different and
 * each read their times the same way. A MEDIAN rather than a mean or a minimum,
 * which is a decision the three of them have to share — a mean is dragged by
 * one scheduling hiccup, and a minimum is a number nobody else's machine
 * reproduces.
 */
export const median = (times: ReadonlyArray<number>): number =>
  [...times].sort((one, other) => one - other)[Math.floor(times.length / 2)] ?? 0

/** What `run` took, in milliseconds — `Bun.nanoseconds` because it is monotonic
 *  and because one clock across four legs is one fewer thing that can differ
 *  between two numbers somebody is comparing. A body that has to hand something
 *  back writes it to a binding it closes over; the clock stops before the
 *  binding is read. */
export const timed = (run: () => void): number => {
  const at = Bun.nanoseconds()
  run()
  return (Bun.nanoseconds() - at) / 1e6
}

/**
 * TWO ARMS OF ONE COMPARISON, warmed and then timed in alternating order —
 * the middle of every A/B `just bench` prints, spelled once.
 *
 * The alternation is the measurement rather than a flourish: two arms run one
 * after the other are two arms of a machine in two moods, and going second in a
 * round is worth more than some of the differences these legs are asked to see.
 * Warming first is the other half — one arm has to go first overall, and going
 * first means paying for a JIT the other one then finds warm.
 *
 * Here for {@link median}'s reason, at the moment it became true again: the
 * `taggedBy` branch added a third copy of these twelve lines to one file
 * ({@link ./patch.bench.ts}'s `beside` and `folds`), which is three places to
 * fix if what "compared fairly" means ever changes.
 *
 * `rounds` is the caller's, because how many a leg can afford is a fact about
 * what it is timing — a corpus-wide fold is not a map clone.
 */
export const alternating = (
  arms: readonly [() => unknown, () => unknown],
  rounds = 9,
): readonly [number, number] => {
  for (const arm of arms) timed(arm)
  const runs = Array.from({ length: rounds }, (_, round) => {
    const order = round % 2 === 0 ? [0, 1] : [1, 0]
    const times: Array<number> = []
    for (const which of order) times[which] = timed(arms[which as 0 | 1])
    return times
  })
  return [
    median(runs.map((round) => round[0] as number)),
    median(runs.map((round) => round[1] as number)),
  ]
}

/**
 * One arm's times, as the line every leg prints: median, mean, min and max.
 *
 * The third copy of this was about to be written too ({@link alternating}'s
 * note), and this one is worse to have three of: it is the SHAPE of every
 * number `just bench` reports and the READMEs quote, so a fourth column added
 * in one leg is a table that stops lining up with the others.
 *
 * `width` is the caller's because a leg's arm names are its own, and columns
 * that line up are the whole point of padding them.
 */
export const timesSaid = (
  name: string,
  times: ReadonlyArray<number>,
  width = 8,
): string => {
  const ms = (at: number) => `${at.toFixed(2)}ms`
  return `${name.padEnd(width)} median ${ms(median(times))}` +
    `, mean ${ms(times.reduce((one, other) => one + other, 0) / times.length)}` +
    `, min ${ms(Math.min(...times))}, max ${ms(Math.max(...times))}`
}
