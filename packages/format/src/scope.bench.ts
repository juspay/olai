/**
 * WHAT A SCOPED QUERY COSTS, before and after `perf-filter-scope` — both arms
 * in one run, on one corpus, on the reader's own machine.
 *
 * `file:` and `under:` used to be a PREDICATE run over the whole corpus, so
 * narrowing a search cost strictly more than not narrowing it: the walk was the
 * same walk, plus a comparison per record, plus — for `under:` — an ancestor
 * walk per record. Since the change they are a reading of the derivation's own
 * indexes, one file's records or one subtree descended
 * ({@link ./filter.ts}'s `inScopeOf`). That is a claim about COST and this is
 * the number for it.
 *
 * BOTH ARMS ARE IN THE TREE, which is what `./filter.bench.ts` says a pair of
 * figures has to be to be worth quoting: the "before" is the corpus walk kept
 * as the differential's reference implementation
 * ({@link ./scope.testlib.ts}'s `walkedMatching`), so a reader re-running this
 * gets both halves and can compare them on their own hardware rather than
 * taking one laptop's milliseconds on trust. The two are the SAME matcher over
 * the same derivation — `selecting` is the real one on both sides — so the only
 * difference between them is which records it was offered.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`). A timing that fails a lane on a busy
 * machine teaches nobody anything, and what the equivalence rests on is
 * `./scope.test.ts` — the same two walks, compared for their ANSWERS, in the
 * suite. Perf numbers are reported artifacts and never gates.
 *
 * WHAT IT MEASURES is four scopes over one vault, each asked the same short
 * list of queries: one file out of two hundred, a whole file's tree named by
 * its root, a small subtree deep inside one, and — as the control — no scope at
 * all, which is the same walk before and after and had better report as one.
 */

import { derive, type Derived } from "./derive.ts"
import { matching, parseFilter, type Scope } from "./filter.ts"
import { median, timed } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { walkedMatching } from "./scope.testlib.ts"

const FILES = 200
const PER_FILE = 100
/** How wide each level of a file's tree is, so a hundred records is a tree
 *  four levels deep rather than a root with ninety-nine children — which is
 *  the shape an `under:` scope is actually asked about. */
const FANOUT = 4

/** The day the relative words would count from. A constant: nothing here asks
 *  for one, and a clock in a benchmark measures a different question in
 *  January. */
const NOW = "2026-08-13T11:00:00-04:00"

/** What is asked of every scope. A word, a word in a note, a phrase, an `OR`
 *  and a mark — enough of the matcher that no arm is measuring one gate, and
 *  few enough that the whole run is seconds. */
const ASKED = ["kitchen", "walnut", `"a note about"`, "kitchen OR garden", "is:todo"]

/**
 * A VAULT THAT IS TREES: one root per file with a tree under it, records
 * carrying the fields the queries above select on.
 *
 * Built as records rather than as JSONL, for `./filter.bench.ts`'s reason — a
 * parse of twenty thousand lines is setup nobody is measuring — and nested,
 * which is the one thing that file's vault is not: every record in it is a root
 * with no parent at all, so an `under:` scope over it would be a scope holding
 * nothing.
 */
const vault = (): ReadonlyArray<Located> => {
  const records: Array<Located> = []
  for (let file = 0; file < FILES; file++) {
    const path = `vault/${file}.olai`
    for (let which = 0; which < PER_FILE; which++) {
      const id = `n${file}-${which}`
      records.push({
        file: path,
        line: which + 1,
        node: {
          id,
          ord: `a${which}`,
          // The tree: a record hangs under the one `FANOUT` places before it,
          // which makes a hundred records a tree about four levels deep with
          // four children at each node.
          ...(which === 0 ? {} : { parent: `n${file}-${Math.floor((which - 1) / FANOUT)}` }),
          title: `the ${which % 3 === 0 ? "kitchen" : "garden"} job number ${which} #home`,
          ...(which % 4 === 0 ? { desc: `a note about walnut and the budget ${which}` } : {}),
          ...(which % 5 === 0 ? { todo: true } : {}),
        },
      } as Located)
    }
  }
  return records
}

const set: Derived = derive(vault())

/** One arm: the same queries over the same scope, one walk each. */
const asking = (
  matched: typeof matching,
  scope: Scope,
): (() => void) =>
() => {
  for (const text of ASKED) matched(set, parseFilter(text, NOW), scope)
}

/** Five runs of each, the median reported — one laptop's variance is the
 *  reason this file quotes a RATIO and not a millisecond. */
const runs = (arm: () => void): number => {
  arm()
  return median(Array.from({ length: 5 }, () => timed(arm)))
}

const SCOPES: ReadonlyArray<readonly [string, Scope]> = [
  ["file: one of 200", { file: `vault/${Math.floor(FILES / 3)}.olai` }],
  ["under: a file's root", { under: `n${Math.floor(FILES / 3)}-0` }],
  ["under: a small subtree", { under: `n${Math.floor(FILES / 3)}-20` }],
  ["(no scope — control)", {}],
]

console.log(
  `${FILES * PER_FILE} records, ${FILES} files, ${ASKED.length} queries per arm`,
)
console.log(
  `${"scope".padEnd(24)}${"before".padStart(10)}${"after".padStart(10)}${"".padStart(4)}ratio` +
    `${"selected".padStart(11)}`,
)
for (const [what, scope] of SCOPES) {
  const before = runs(asking(walkedMatching, scope))
  const after = runs(asking(matching, scope))
  // WHAT EACH ARM SELECTED, printed beside the times rather than trusted: two
  // walks that answer different numbers of records are two walks nobody may
  // compare, and a narrowing that reported magnificently by answering nothing
  // is the failure this line is here to make visible. (`./scope.test.ts` is
  // where it is an assertion; here it is a reading.)
  const selected = ASKED.reduce(
    (count, text) => count + matching(set, parseFilter(text, NOW), scope).length,
    0,
  )
  const walked = ASKED.reduce(
    (count, text) => count + walkedMatching(set, parseFilter(text, NOW), scope).length,
    0,
  )
  console.log(
    `${what.padEnd(24)}${`${before.toFixed(1)}ms`.padStart(10)}` +
      `${`${after.toFixed(1)}ms`.padStart(10)}` +
      `${`${(before / after).toFixed(1)}×`.padStart(9)}` +
      `${`${selected}${selected === walked ? "" : ` ≠ ${walked}`}`.padStart(11)}`,
  )
}
