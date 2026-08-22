/**
 * What a query costs THE MATCHER on a large vault — a WORD, with and without
 * the fold it keeps per record, and a DATE CLAUSE, which touches none of that
 * machinery and walks the set anyway.
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
 * A THIRD ARM measures the other hot line, and its own note ({@link DATED})
 * says why it could not be a fourth keystroke of the first two: `within` is
 * reached by a `date:` clause and by nothing a word does, so the fold arms
 * above ran past it blind. It arrived with the durations, which changed that
 * line twice.
 *
 * The vault is generated rather than read, so the number is reproducible and
 * says what it is a number about: {@link NODES} nodes over {@link PER_FILE}-row
 * files, two thirds of them carrying a note, all of them carrying a tag — the
 * shape that makes the tag path (a global regex per title) the fold's own worst
 * case — and all of them STAMPED, which is what gives the date arm something to
 * compare against.
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

/** ...and the MOMENT the date arm counts a duration from — the same day with a
 *  clock face on it, for `TODAY`'s reason one unit smaller. */
const NOW = `${TODAY}T11:00:00-04:00`

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
      // THE STAMPS, so the date arm below has something to compare. Spread
      // across a fortnight and carrying a real clock face and offset, because
      // what {@link DATED} measures is a comparison against the value's own
      // width — a corpus of bare days would answer a narrower question than
      // the one a vault actually asks.
      created: `2026-08-${String((at % 14) + 1).padStart(2, "0")}T0${
        at % 10
      }:12:44-04:00`,
      changed: `2026-08-${String((at % 14) + 1).padStart(2, "0")}T1${
        at % 10
      }:02:00-04:00`,
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

/**
 * THE OTHER HOT LINE, which the word arms above cannot see at all: `within`,
 * the per-node comparison every `date:` / `created:` / `changed:` clause is
 * answered by.
 *
 * It is a separate arm because it is a separate question. The fold is about
 * scanning TEXT, and a query of operators alone folds nothing — so a date
 * clause walks every node of the set and touches none of the machinery the two
 * arms above measure. Until this existed the file had no number for the line
 * the durations changed, which is how a comparison got quietly slower once
 * (it sliced per bound) and quietly faster again (it stopped): both were
 * invisible to `just bench`.
 *
 * FOUR SHAPES, because the widths are what the comparison turns on — a bare
 * day bound against a stamp, a two-ended relative span, a duration's moment,
 * and a range mixing a day word with one. Each is one clause over the whole
 * set, and none of them names a word, so what is timed is the walk and the
 * comparison and nothing else.
 *
 * WHAT IT CAUGHT, on one machine, over the four clauses below:
 *
 *     slicing each value to its bound's width   23.3ms — 5.82ms each
 *     comparing the whole value                 18.9ms — 4.73ms each
 *
 * The first is what `within` did for one commit, when durations made a bound
 * something other than ten characters wide and the obvious answer was to cut
 * the value to match. The second is the same semantics with no allocation at
 * all — ISO text is a prefix ordering, so the cut was buying a comparison the
 * comparison already made (`../src/filter.ts`'s `within` has the algebra).
 *
 * ONLY THE SECOND LINE IS RE-RUNNABLE, and saying so is the same discipline
 * the note at the foot of this file applies to a heap delta it could not stand
 * behind. The slicing form is not in the tree: it was measured by restoring it
 * for one run and then thrown away, so the PAIR is a record of a decision and
 * the ARM is the number. A reader re-running this gets the second line and a
 * different figure for it — grok read 3.54ms each on its machine against the
 * 4.73 here — which is exactly why the file's rule is that the ratio is the
 * claim and the milliseconds are one laptop's. What survives re-running is the
 * comparison a reader can make themselves: a date clause against the warm
 * word-scan arm above it, on their own hardware, in the same run.
 */
const DATED = ["created:2026-08-07", "changed:this-week", "changed:1h", "created:yesterday..3h"]

const datedOver = (set: Derived): void => {
  for (const query of DATED) matching(set, parseFilter(query, NOW))
}

datedOver(warm)
const dated = Array.from({ length: 5 }, () => timed(() => datedOver(warm)))

/** One arm's median, and what it works out to per query. The COUNT is an
 *  argument because the arms no longer ask the same number of them — seven
 *  keystrokes of a word, four shapes of a date clause. */
const say = (
  what: string,
  runs: ReadonlyArray<number>,
  asked: number,
  each: string,
): void => {
  const ms = median(runs)
  console.log(
    `${what.padEnd(6)} ${ms.toFixed(1)}ms over ${asked} ${each} ` +
      `— ${(ms / asked).toFixed(2)}ms each`,
  )
}

console.log(`${NODES} nodes, ${Math.ceil(NODES / PER_FILE)} files`)
say("cold", cold, TYPED.length, "keystrokes")
say("warm", hot, TYPED.length, "keystrokes")
say("dated", dated, DATED.length, "date clauses")

// WHAT THE FOLD HOLDS is the other half of the trade, and it is deliberately
// NOT reported here: a heap delta around a `Bun.gc(true)` pair answered 0.0MB
// for a structure that cannot be smaller than its own strings, which is a
// measurement saying more about when a heap is walked than about what is on it.
// A number nobody can stand behind is worse than the shape, and the shape is
// exact: four folded fields per node a query has reached, held for as long as
// the record is.
