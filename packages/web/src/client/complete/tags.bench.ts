/**
 * What the tag completion costs per derivation: the index read against the
 * corpus walk it replaced.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), and this one is the whole reason the
 * roadmap item behind it (`mentions-index-one-sigil`, filed at PR #237) was
 * DEFERRED rather than taken there: the payoff was a different feature's
 * performance, unmeasured, against a wider index on the derive hot path. A
 * number nobody can re-run is a number nobody can check, so the before and the
 * after are two arms of one run rather than two paragraphs.
 *
 * TWO ARMS over one generated vault (`@olai/format/testlib`'s `vaultOf`, the
 * SAME corpus `deriving.bench.ts` and `packages/format/src/patch.bench.ts` run
 * on, so all three legs' numbers are about one directory):
 *
 *   - `walk` — the vocabulary derived from the corpus, which is what this file
 *     did before the index: every node of the set, `titleParts` over the prose
 *     of each. It is kept HERE, as a reconstruction, for the reason
 *     `patch.bench.ts` keeps the id-map clone it replaced — a before/after the
 *     harness cannot print is exactly the unreproducible laptop sample these
 *     legs exist to retire.
 *   - `index` — {@link tagsOf}, which reads `Derived.taggedBy`: the keys of a
 *     map and the length of each entry, with the archive taken off.
 *
 * THE TWO ARMS MUST ANSWER THE SAME VALUE, and that is asserted before either
 * is timed. It is what stops this being a benchmark of an arm that answers
 * nothing: the fast one here could "win" by returning an empty list, and the
 * comparison would still print. So the walk is written to the index's own
 * rules — a record's title AND its note, one vote per record, mirrors out,
 * archive out — and the two answers are compared whole.
 *
 * A FRESH DERIVED PER MEASUREMENT, because `tagsOf` holds one answer per
 * derivation in a `WeakMap` and the question is what a NEW frame costs. A
 * shallow copy of the view is a new key with the same indexes, which is exactly
 * what the tab is handed when one file moves.
 */

import { derive, type Derived, isArchived, isMirror, mayHoldTag, titleParts } from "@olai/format"
import { median, nodesOf, timed, vaultOf } from "@olai/format/testlib"

import { sortByPath } from "../paths.ts"
import { type Tag, tagsOf } from "./tags.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
/** How many times each arm is asked, each on a view it has not seen. */
const ROUNDS = Number(process.env["OLAI_BENCH_ROUNDS"] ?? 20)

const corpus = vaultOf({ files: FILES, records: RECORDS })
const view = derive(
  sortByPath(corpus.keys()).flatMap((file) => nodesOf(corpus.get(file) as string, file)),
)

/**
 * The vocabulary walked out of the corpus — this module as it was, held to the
 * index's rules so the two arms are comparable.
 *
 * ONE VOTE PER RECORD, which the old walk did not spell (it counted a title's
 * parts, so a title writing one tag twice counted twice) — the index files a
 * record once and the widget's own docs always said "how many nodes carry it",
 * so the walk is written to the answer both are supposed to give.
 */
const walked = (derived: Derived): ReadonlyArray<Tag> => {
  const counts = new Map<string, Tag>()
  for (const located of derived.nodes) {
    if (isMirror(located.node) || isArchived(located.file)) continue
    const said = new Set<string>()
    for (const text of [located.node.title, located.node.desc ?? ""]) {
      // The format's own cheap negative first, exactly as the walk had it:
      // `titleParts` runs a global regex and most prose holds no sigil at all.
      if (!mayHoldTag(text)) continue
      for (const part of titleParts(text)) {
        if (part.kind !== "tag") continue
        const key = `${part.sigil}${part.tag}`
        if (said.has(key)) continue
        said.add(key)
        const before = counts.get(key)
        counts.set(
          key,
          before === undefined
            ? { sigil: part.sigil, name: part.tag, folded: part.tag.toLowerCase(), count: 1 }
            : { ...before, count: before.count + 1 },
        )
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** A view the arm under test has never been handed: the same indexes under a
 *  new identity, which is what `tagsOf`'s per-derivation memo keys on. */
const fresh = (): Derived => ({ ...view })

const arms = {
  walk: (derived: Derived) => walked(derived),
  index: (derived: Derived) => tagsOf(derived),
} as const

// THE SAME ANSWER, asserted before anything is timed — see the header. A
// benchmark whose fast arm answers a shorter list is not a benchmark.
const said = (tags: ReadonlyArray<Tag>): string =>
  tags.map((tag) => `${tag.sigil}${tag.name} ${tag.count}`).join("\n")
const answers = Object.fromEntries(
  Object.entries(arms).map(([name, arm]) => [name, said(arm(fresh()))]),
)
if (answers["walk"] !== answers["index"]) {
  throw new Error(
    "the two arms disagree about the set's tags, so neither number means anything:\n" +
      `walk said ${answers["walk"]?.split("\n").length} tags,` +
      ` index said ${answers["index"]?.split("\n").length}`,
  )
}
const tags = (answers["index"] as string).split("\n").length
if (tags < 2) throw new Error(`the vault holds ${tags} tags — this measures nothing`)

const run = (name: keyof typeof arms): void => {
  const arm = arms[name]
  // Warmed, then measured, for `patch.bench.ts`'s reason: one of two arms has
  // to go first, and going first means paying for a JIT the other finds warm.
  for (let round = 0; round < 3; round++) arm(fresh())
  const times = Array.from({ length: ROUNDS }, () => {
    const derived = fresh()
    return timed(() => {
      arm(derived)
    })
  })
  const say = (ms: number) => `${ms.toFixed(2)}ms`
  console.log(
    `${name.padEnd(6)} median ${say(median(times))}` +
      `, mean ${say(times.reduce((one, other) => one + other, 0) / times.length)}` +
      `, min ${say(Math.min(...times))}, max ${say(Math.max(...times))}`,
  )
}

console.log(
  `vault: ${corpus.size} files, ${view.nodes.length} records, ${tags} tags,` +
    ` ${view.taggedBy.size} keys in the index — the completion asked ${ROUNDS} times\n` +
    `runtime: ${
      process.versions.bun !== undefined ? `bun ${process.versions.bun}` : `node ${process.version}`
    }\n`,
)
run("walk")
run("index")
