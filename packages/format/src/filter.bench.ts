/**
 * What a keystroke costs THE MATCHER on a large vault, with and without the
 * fold it keeps per record.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), which is why it exists at all: the
 * fold landed with two milliseconds quoted in a comment and a reviewer asked,
 * correctly, where the numbers came from (#228, grok). A benchmark nothing runs
 * is a benchmark that rots, and a number nobody can re-run is a number nobody
 * can check. Deliberately not part of `just check`, for `./patch.bench.ts`'s
 * reason: a timing that fails a lane on a busy machine teaches nobody
 * anything.
 *
 * WHAT IT MEASURES is one word typed one character at a time — seven queries
 * over one derivation, which is what the chat composer's `@` list and the
 * browser's filter over a page each ask per keystroke ({@link matching}). The
 * fold is the thing under test, so the two arms differ in exactly one way —
 * whether the records a keystroke walks are ones an earlier keystroke folded:
 *
 *   - `warm` — the records are the ones the previous keystroke already folded,
 *     which is every keystroke after the first over an unchanged file;
 *   - `cold` — a fresh derivation per KEYSTROKE, so every node is folded every
 *     time. It is what the first word of a session costs, and it is what every
 *     keystroke cost before the fold existed.
 *
 * `derive` is outside the timed window in both arms: it is the work the tab has
 * already done before anybody types, and leaving it in was the mistake that
 * made an early measurement of this understate the fold by half.
 *
 * The vault is generated rather than read, so the number is reproducible and
 * says what it is a number about: {@link NODES} nodes over {@link PER_FILE}-row
 * files, two thirds of them carrying a note, all of them carrying a tag — the
 * shape that makes the tag path (a global regex per title) the fold's own worst
 * case.
 */

import { derive, type Derived } from "./derive.ts"
import { matching, parseFilter } from "./filter.ts"
import { median, timed } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"

const NODES = 20_000
const PER_FILE = 200

/** The day the relative words would count from. A constant: nothing here asks
 *  for one, and a clock in a benchmark is a benchmark that measures a different
 *  question in January. */
const TODAY = "2026-08-13"

/** Somebody typing one word into the box, one character at a time. */
const TYPED = ["k", "ki", "kit", "kitc", "kitch", "kitche", "kitchen"]

const vault = (): ReadonlyArray<Located> =>
  Array.from({ length: NODES }, (_, at) => ({
    file: `vault/${Math.floor(at / PER_FILE)}.olai`,
    line: (at % PER_FILE) + 1,
    node: {
      id: `n${at}`,
      ord: `a${at}`,
      title: `the ${at % 7 === 0 ? "kitchen" : "garden"} job number ${at} #home`,
      ...(at % 3 === 0
        ? { desc: `a note about brass and the budget, number ${at}` }
        : {}),
    },
  })) as ReadonlyArray<Located>

const typedOver = (set: Derived): void => {
  for (const query of TYPED) matching(set, parseFilter(query, TODAY))
}

const warm = derive(vault())
// Once through, so the arm below measures the fold being READ rather than
// written — which is the whole distinction between the two.
typedOver(warm)

// A FRESH DERIVATION PER KEYSTROKE, which is the only honest way to ask what a
// keystroke costs unfolded: one derivation for the whole run would fold on the
// first character and answer the other six out of the cache, reporting a sixth
// of the cost as if it were the whole of it. The sets are built outside the
// timed window for the same reason `derive` is.
const cold = Array.from({ length: 5 }, () => {
  const fresh = TYPED.map(() => derive(vault()))
  return timed(() => {
    TYPED.forEach((query, at) => {
      matching(fresh[at] as Derived, parseFilter(query, TODAY))
    })
  })
})
const hot = Array.from({ length: 5 }, () => timed(() => typedOver(warm)))

const say = (what: string, runs: ReadonlyArray<number>): void => {
  const ms = median(runs)
  console.log(
    `${what.padEnd(6)} ${ms.toFixed(1)}ms over ${TYPED.length} keystrokes ` +
      `— ${(ms / TYPED.length).toFixed(2)}ms each`,
  )
}

console.log(`${NODES} nodes, ${Math.ceil(NODES / PER_FILE)} files`)
say("cold", cold)
say("warm", hot)

// WHAT THE FOLD HOLDS is the other half of the trade, and it is deliberately
// NOT reported here: a heap delta around a `Bun.gc(true)` pair answered 0.0MB
// for a structure that cannot be smaller than its own strings, which is a
// measurement saying more about when a heap is walked than about what is on it.
// A number nobody can stand behind is worse than the shape, and the shape is
// exact: four folded fields per node a query has reached, held for as long as
// the record is.
