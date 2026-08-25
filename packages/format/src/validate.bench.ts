/**
 * WHAT VALIDATION COSTS A WRITE — the whole-corpus rules against the narrowed
 * ones, and the price of running both.
 *
 * Five of the six whole-set rules walk every record in the directory on every
 * write (roadmap `perf-validate-incremental`), and `./incremental.ts` is the
 * other way to reach the same verdict. This is the number for it, and the
 * THIRD ARM is the honest one: until the flip, a write pays BOTH validators, so
 * what this change costs today is printed beside what it will buy.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), for the reason every bench in this
 * package is: a timing that fails a lane on a busy machine teaches nobody
 * anything, and what the equivalence rests on is `./incremental.test.ts` — the
 * two arms compared for their VERDICTS, over generated edit sequences and over
 * this repository's own vault, in the suite. Perf numbers are reported
 * artifacts and never gates.
 *
 * ONE THING HERE DOES FAIL THE RUN, and it is not a timing: if the two arms
 * reach a different verdict the ratio between them means nothing, so the row
 * throws rather than printing. Same rule as `./scope.bench.ts` and
 * `./dates.bench.ts`, and it is the one shape a flattering ratio takes — a
 * narrowing that reported magnificently by answering nothing. A run where the
 * narrowing DECLINED would flatter it the same way, so a decline throws too.
 *
 * THREE EDITS, because the narrowing's whole claim is that the shape of the
 * edit decides the cost:
 *
 *   - a KEYSTROKE — one record's title rewritten, which is the overwhelmingly
 *     common write and the one that leaves the graph exactly where it was. No
 *     cycle walk, no document walk, nothing proportional to the directory;
 *   - an EDGE — one record gaining an `after`, which moves the ordering graph
 *     and buys the corpus back: all three cycle walks run, exactly as the full
 *     validator runs them. The row that says what this did NOT buy;
 *   - a DOCUMENT DELETED — one `.md` leaving, which is the other fallback: a
 *     `doc` that resolved may not any more and there is no index from a
 *     resolved path back to the records that name it.
 *
 * THE LAST COLUMN says how many of the row's edits made the narrowing walk the
 * corpus for SOME rule, and it conflates two fallbacks that cost nothing like
 * each other — which the rows themselves then tell apart. An edge added walks
 * the three cycle graphs and buys back the whole of what the narrowing saved;
 * a document deleted walks the records asking each one whether it has a `doc`,
 * which is a tenth of a millisecond over twenty thousand of them. Both are
 * `walked: true`; only one of them is a row that says "this did not help".
 *
 * BOTH ARMS RUN OVER ONE VIEW, patched from the last one exactly as a write
 * gate's is. That is deliberate: the patcher's own cost is `./patch.bench.ts`'s
 * subject and measuring it again here would put the same milliseconds on both
 * sides of a comparison that is not about it. What is timed is the RULES —
 * which records each arm was offered, and what it did with them.
 *
 * The vault is generated (`./fixtures.testlib.ts`'s `vaultOf`), the same one
 * `./patch.bench.ts` and `./vocabulary.bench.ts` run, with `.md` documents put
 * in beside the outlines: a directory holding none measures `markdownPaths` —
 * a walk of every document, which the full arm pays per write and the narrowed
 * one carries — at zero. Size it with OLAI_BENCH_FILES / OLAI_BENCH_RECORDS /
 * OLAI_BENCH_EDITS / OLAI_BENCH_DOCS.
 */

import { derive, type Derived } from "./derive.ts"
import {
  median,
  nodesOf,
  outlineOf,
  retitled,
  timed,
  vaultOf,
} from "./fixtures.testlib.ts"
import { incrementally, type Ledger } from "./incremental.ts"
import type { OutlineError } from "./errors.ts"
import { bodiedDocument, type Document } from "./document.ts"
import type { Located } from "./node.ts"
import { patched, type SetDelta } from "./patch.ts"
import { byPath } from "./paths.ts"
import {
  danglingIn,
  markdownPaths,
  reportAfterCycles,
  reportDocs,
  reportDuplicateIds,
  reportMirrorCycles,
  reportOf,
  reportParentCycles,
  reportParents,
  reportUnknownTargets,
} from "./rules.ts"
import { assemble, type OutlineSet } from "./set.ts"
import { declarationsOf } from "./typing.ts"
import { Result } from "effect"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const EDITS = Number(process.env["OLAI_BENCH_EDITS"] ?? 40)
const DOCS = Number(process.env["OLAI_BENCH_DOCS"] ?? 500)

// ── the directory ──────────────────────────────────────────────────────

/**
 * The vault, with the placements that point at nothing taken out.
 *
 * `vaultOf` writes a mirror into a file naming a record of the file BEFORE it,
 * and skips a file whose generated path collides with one already written — so
 * a handful of those mirrors name a file the directory does not hold. That is
 * fine for the benches this vault was built for (`derive` and the patcher both
 * answer over sets the validator condemns), and it is fatal here: a directory
 * with one finding in it is a directory nobody publishes, so the narrowing
 * would decline on every edit and both arms would be timed doing nothing.
 */
const settled = (held: ReadonlyMap<string, string>): ReadonlyMap<string, string> => {
  const declared = new Set<string>()
  for (const text of held.values()) {
    for (const line of text.split("\n")) {
      if (line !== "") declared.add(String((JSON.parse(line) as { id: string }).id))
    }
  }
  return new Map(
    [...held].map(([file, text]) => [
      file,
      text
        .split("\n")
        .filter((line) => {
          if (line === "") return false
          const record = JSON.parse(line) as { readonly mirror?: string }
          return record.mirror === undefined || declared.has(record.mirror)
        })
        .join("\n"),
    ]),
  )
}

const corpus = settled(vaultOf({ files: FILES, records: RECORDS }))
const paths = [...corpus.keys()].sort(byPath)

/** The `.md` files beside the outlines. Nothing points at them and that is the
 *  point: `markdownPaths` walks every document in the directory whether or not
 *  a single `doc` names one, which is the corpus-sized reading the full arm
 *  makes that has nothing to do with records. */
const documents = Array.from({ length: DOCS }, (_, at) => `doc/note${at}.md`)

/** Decoded once. Parsing is not what either arm measures, and a decode inside a
 *  timed window would put the same `JSON.parse` on both sides of a comparison
 *  that is not about it. */
const decoded = new Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>>([
  ...paths.map(
    (file) =>
      [file, Result.succeed<Document>(outlineOf(corpus.get(file) as string, file))] as const,
  ),
  ...documents.map(
    (file) => [file, Result.succeed<Document>(bodiedDocument(file, "# note"))] as const,
  ),
])

const setOfHeld = (): OutlineSet => assemble(decoded)

// ── the edits ──────────────────────────────────────────────────────────

/** Which file an edit rewrites. Successive edits land on different files, which
 *  is the harsher case for everything the patcher carries forward. */
const fileFor = (which: number): string => paths[which % paths.length] as string

/**
 * One record gaining an `after` that names its file's ROOT — a change to the
 * ORDERING GRAPH, and therefore the edit the narrowing has to buy the corpus
 * back for.
 *
 * The root and not the line above, which is what this reached for first: a
 * `vaultOf` file puts a MIRROR in front of a record now and then, an edge
 * naming a placement is an edge to the node standing there, and pointing at
 * one is how a bench fixture writes a loop it did not mean to. The root is a
 * plain record with no edges of its own, so the graph this makes is a DAG and
 * the set stays one the validator accepts.
 */
const edged = (text: string, file: string): string => {
  const lines = text.split("\n").filter((line) => line !== "")
  const root = (JSON.parse(lines[0] as string) as Record<string, unknown>)["id"]
  const at = lines.findIndex((line) =>
    line.includes(`"title"`) && line.includes(`"parent"`) && !line.includes(`"after"`)
  )
  if (at < 1) throw new Error(`fixture: no record in ${file} to give an edge to`)
  const record = JSON.parse(lines[at] as string) as Record<string, unknown>
  lines[at] = JSON.stringify({ ...record, after: [root] })
  return lines.join("\n")
}

/** What an edit IS, in the vocabulary the wire already speaks. `documents` is
 *  the one shape that is not an outline moving: a `.md` leaving the set. */
interface Edit {
  readonly apply: () => void
  readonly delta: SetDelta
}

const outlineEdit = (file: string, text: string): Edit => {
  const records = nodesOf(text, file)
  return {
    apply: () => {
      decoded.set(file, Result.succeed<Document>(outlineOf(text, file)))
    },
    delta: { upserts: [[file, { nodes: records }]], removes: [] },
  }
}

const documentEdit = (file: string): Edit => ({
  apply: () => {
    decoded.delete(file)
  },
  delta: { upserts: [], removes: [file] },
})

const KEYSTROKES: ReadonlyArray<Edit> = Array.from({ length: EDITS }, (_, which) => {
  const file = fileFor(which)
  return outlineEdit(file, retitled(corpus.get(file) as string, which))
})

const EDGES: ReadonlyArray<Edit> = Array.from({ length: EDITS }, (_, which) => {
  const file = fileFor(which)
  return outlineEdit(file, edged(corpus.get(file) as string, file))
})

const DELETIONS: ReadonlyArray<Edit> = documents
  .slice(0, Math.min(EDITS, documents.length))
  .map(documentEdit)

// ── the run ────────────────────────────────────────────────────────────

/** The full validator's rules over a whole view — `./validate.ts`'s body with
 *  the derivation and the answer taken off, which is what one write pays
 *  today. */
const whole = (set: OutlineSet, view: Derived): ReadonlyArray<OutlineError> => {
  const errors: Array<OutlineError> = []
  const all = view.nodes
  const known = markdownPaths(set)
  reportDuplicateIds(all, view, errors)
  reportParents(all, view, errors)
  reportParentCycles(all, view, errors)
  reportUnknownTargets(danglingIn(view), view, errors)
  reportAfterCycles(all, view, errors)
  reportMirrorCycles(all, view, errors)
  reportDocs(all, known, errors)
  return errors
}

/** Five runs of each, the median reported — one laptop's variance is the reason
 *  this file quotes a RATIO as well as a millisecond. */
const runs = (arm: () => void): number => {
  arm()
  return median(Array.from({ length: 5 }, () => timed(arm)))
}

/** One row: an edit shape, driven edit after edit over a view carried forward,
 *  with the two arms timed over each view and held to the same verdict. */
const row = (what: string, edits: ReadonlyArray<Edit>): void => {
  // A FRESH DIRECTORY per row, because the rows edit it: a row that ran after
  // the document deletions would be measuring a set with five hundred fewer
  // files in it, under the previous row's name.
  restore()
  let set = setOfHeld()
  let view = derive(recordsIn(set))
  let ledger: Ledger = {
    errors: whole(set, view),
    known: markdownPaths(set),
    typing: declarationsOf(view),
  }
  if (ledger.errors.length > 0) {
    throw new Error(
      `the generated vault does not validate, so neither arm is measuring a ` +
        `write anybody could make:\n  ${reportOf(set, ledger.errors).slice(0, 3).map((one) =>
          `${one.file}:${one.line} ${one.message}`
        ).join("\n  ")}`,
    )
  }
  let full = 0
  let narrow = 0
  let both = 0
  let walked = 0
  for (const edit of edits) {
    const before = view
    const held = ledger
    edit.apply()
    set = setOfHeld()
    const next = patched(before, edit.delta)
    if (next === undefined) {
      throw new Error(
        `${what}: the patcher declined, so this row would be timing two ` +
          `rebuilds under the narrowing's name`,
      )
    }
    view = next
    full += runs(() => {
      whole(set, view)
    })
    narrow += runs(() => {
      incrementally(set, before, held, edit.delta, view)
    })
    both += runs(() => {
      whole(set, view)
      incrementally(set, before, held, edit.delta, view)
    })
    // THE TWO ARMS ANSWERED THE SAME THING, or the milliseconds above are about
    // nothing. A decline is the same failure wearing a different face — it
    // would report the narrowing as free by having it do nothing at all, and it
    // says which door it turned back at.
    const said = whole(set, view)
    const narrowed = incrementally(set, before, held, edit.delta, view)
    if (typeof narrowed === "string") {
      throw new Error(
        `${what}: the narrowing declined (${narrowed}) — the row above it is ` +
          `the full validator timed against a function that did nothing`,
      )
    }
    if (narrowed.walked) walked++
    const one = reportOf(set, said).map(spelling)
    const other = reportOf(set, narrowed.ledger.errors).map(spelling)
    if (one.length !== other.length || one.some((line, at) => line !== other[at])) {
      throw new Error(
        `${what}: the two arms reached different verdicts, so the ratio above ` +
          `is meaningless until they agree (./incremental.test.ts):\n` +
          `  full:        ${one.join(" | ") || "(accepted)"}\n` +
          `  incremental: ${other.join(" | ") || "(accepted)"}`,
      )
    }
    ledger = { errors: said, known: markdownPaths(set), typing: declarationsOf(view) }
  }
  const many = edits.length
  console.log(
    `${what.padEnd(26)}${`${(full / many).toFixed(2)}ms`.padStart(10)}` +
      `${`${(narrow / many).toFixed(2)}ms`.padStart(11)}` +
      `${`${(full / Math.max(narrow, 1e-9)).toFixed(1)}×`.padStart(9)}` +
      `${`${(both / many).toFixed(2)}ms`.padStart(15)}` +
      `${`${walked}/${many}`.padStart(11)}`,
  )
}

const spelling = (error: OutlineError): string =>
  `${error.file}:${error.line} ${error.code} ${error.message}`

/** The set flattened — `./validate.ts`'s own first line for a rebuild, spelled
 *  here because that one is private to the validator and this file is timing
 *  what comes after it. */
const recordsIn = (set: OutlineSet): ReadonlyArray<Located> =>
  set.documents.flatMap((document) => (document.kind === "outline" ? document.nodes : []))

/** Put the directory back the way the rows expect to find it. */
const restore = (): void => {
  decoded.clear()
  for (const file of paths) {
    decoded.set(file, Result.succeed<Document>(outlineOf(corpus.get(file) as string, file)))
  }
  for (const file of documents) {
    decoded.set(file, Result.succeed<Document>(bodiedDocument(file, "# note")))
  }
}

restore()
const first = derive(recordsIn(setOfHeld()))
console.log(
  `${first.nodes.length} records, ${paths.length} outlines, ${documents.length} documents,` +
    ` ${EDITS} edits per row`,
)
console.log(
  `${"edit".padEnd(26)}${"full".padStart(10)}${"narrowed".padStart(11)}${"ratio".padStart(9)}` +
    `${"both (today)".padStart(15)}${"walked".padStart(11)}`,
)
row("a keystroke", KEYSTROKES)
row("an edge added", EDGES)
row("a document deleted", DELETIONS)
