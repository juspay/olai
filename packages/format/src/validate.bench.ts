import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, type Derived } from "./derive.ts"
import {
  median,
  nodesOf,
  outlineOf,
  retitled,
  settled,
  timed,
  vaultOf,
} from "./fixtures.testlib.ts"
import { incrementally, type Ledger } from "./incremental.ts"
import type { OutlineError } from "./errors.ts"
import { type Verdict, verdictOf } from "./verdict.ts"
import { bodiedDocument, type Document } from "./document.ts"
import type { Located } from "./node.ts"
import { patched, type SetDelta } from "./patch.ts"
import { byPath } from "./paths.ts"
import {
  danglingIn,
  markdownPaths,
  reportAfterCycles,
  reportDeclarations,
  reportDuplicateIds,
  reportMirrorCycles,
  reportOf,
  reportParentCycles,
  reportParents,
  reportPropValues,
  reportUnknownTargets,
} from "./rules.ts"
import { assemble, type OutlineSet } from "./set.ts"
import { declarationsOf, NO_KINDS, type Typed } from "./typing.ts"
import { Result } from "effect"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const EDITS = Number(process.env["OLAI_BENCH_EDITS"] ?? 40)
const DOCS = Number(process.env["OLAI_BENCH_DOCS"] ?? 500)

const corpus = settled(vaultOf({ files: FILES, records: RECORDS }))
const paths = [...corpus.keys()].sort(byPath)

const documents = Array.from({ length: DOCS }, (_, at) => `doc/note${at}.md`)

const decoded = new Map<string, Result.Result<Document, Verdict>>([
  ...paths.map(
    (file) =>
      [file, Result.succeed<Document>(outlineOf(corpus.get(file) as string, file))] as const,
  ),
  ...documents.map(
    (file) => [file, Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, file, "# note"))] as const,
  ),
])

const setOfHeld = (): OutlineSet => assemble(TEST_CLAIMS, decoded)

const fileFor = (which: number): string => paths[which % paths.length] as string

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

const whole = (set: OutlineSet, view: Derived): ReadonlyArray<OutlineError> => {
  const errors: Array<OutlineError> = []
  const all = view.nodes
  const known = markdownPaths(set)
  const declarations = declarationsOf(view, NO_KINDS)
  const typed: Typed = { declarations, derived: view, documents: known, kinds: NO_KINDS }
  reportDuplicateIds(all, view, errors)
  reportParents(all, view, errors)
  reportParentCycles(all, view, errors)
  reportUnknownTargets(danglingIn(view), view, errors)
  reportAfterCycles(all, view, errors)
  reportMirrorCycles(all, view, errors)
  reportDeclarations(view, NO_KINDS, errors)
  reportPropValues(all, typed, errors)
  return errors
}

const runs = (arm: () => void): number => {
  arm()
  return median(Array.from({ length: 5 }, () => timed(arm)))
}

const row = (what: string, edits: ReadonlyArray<Edit>): void => {
  restore()
  let set = setOfHeld()
  let view = derive(TEST_CLAIMS, recordsIn(set))
  let ledger: Ledger = {
    errors: whole(set, view),
    known: markdownPaths(set),
    typing: declarationsOf(view, NO_KINDS),
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
      incrementally(set, before, held, edit.delta, view, NO_KINDS)
    })
    both += runs(() => {
      whole(set, view)
      incrementally(set, before, held, edit.delta, view, NO_KINDS)
    })
    const said = whole(set, view)
    const narrowed = incrementally(set, before, held, edit.delta, view, NO_KINDS)
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
    ledger = { errors: said, known: markdownPaths(set), typing: declarationsOf(view, NO_KINDS) }
  }
  const many = edits.length
  console.log(
    `${what.padEnd(26)}${`${(full / many).toFixed(2)}ms`.padStart(10)}` +
      `${`${(narrow / many).toFixed(2)}ms`.padStart(11)}` +
      `${`${(full / Math.max(narrow, 1e-9)).toFixed(1)}×`.padStart(9)}` +
      `${`${(both / many).toFixed(2)}ms`.padStart(18)}` +
      `${`${walked}/${many}`.padStart(11)}`,
  )
}

const spelling = (error: OutlineError): string =>
  `${error.file}:${error.line} ${error.code} ${error.message}`

const recordsIn = (set: OutlineSet): ReadonlyArray<Located> =>
  set.documents.flatMap((document) => (document.holds === "nodes" ? document.nodes : []))

const restore = (): void => {
  decoded.clear()
  for (const file of paths) {
    decoded.set(file, Result.succeed<Document>(outlineOf(corpus.get(file) as string, file)))
  }
  for (const file of documents) {
    decoded.set(file, Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, file, "# note")))
  }
}

restore()
const first = derive(TEST_CLAIMS, recordsIn(setOfHeld()))
console.log(
  `${first.nodes.length} records, ${paths.length} outlines, ${documents.length} documents,` +
    ` ${EDITS} edits per row`,
)
console.log(
  `${"edit".padEnd(26)}${"full".padStart(10)}${"narrowed".padStart(11)}${"ratio".padStart(9)}` +
    `${"both (the soak)".padStart(18)}${"walked".padStart(11)}`,
)
row("a keystroke", KEYSTROKES)
row("an edge added", EDGES)
row("a document deleted", DELETIONS)
