/**
 * What the tag completion costs per derivation: the index read against the
 * corpus walks it replaced.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), and this one is the whole reason the
 * roadmap item behind it (`mentions-index-one-sigil`, filed at PR #237) was
 * DEFERRED rather than taken there: the payoff was a different feature's
 * performance, unmeasured, against a wider index on the derive hot path. A
 * number nobody can re-run is a number nobody can check, so the before and the
 * after are arms of one run rather than two paragraphs.
 *
 * IT MEASURES THE SAME THING FROM THE OTHER SIDE OF THE WIRE now. The reading
 * ran in the browser, once per published frame, until `vault-in-browser`'s PR 2
 * moved it beside the index it reads ({@link ./vocabulary.ts}); it now runs on
 * the server, once per settled keystroke of a tag being typed, memoised per
 * derivation. Which side pays has changed and the arms have not: it is the same
 * index read against the same corpus walks, over the same generated vault, so
 * the numbers this printed before the move and the numbers it prints after are
 * about one function.
 *
 * THREE ARMS over one generated vault (`./fixtures.testlib.ts`'s `vaultOf`, the
 * SAME corpus `./patch.bench.ts` runs on, so this leg's numbers and the
 * patcher's are about one directory):
 *
 *   - `index` — {@link vocabularyOf}, which reads `Derived.taggedBy`: the keys of a
 *     map and the length of each entry, with the trash taken off;
 *   - `walk` — the SAME ANSWER derived from the corpus instead: every node of
 *     the set, `titleParts` over its title and its note, one vote per record.
 *     This is the honest A/B, because two arms that answer different lists are
 *     two numbers nobody may divide;
 *   - `titles` — the walk AS IT LITERALLY STOOD before `taggedBy`: titles
 *     only, a vote per tag PART. It is here because `walk` is not what the file
 *     said, and a ratio quoted against a reconstruction that does more work
 *     than the code it stands for is a flattering ratio. It answers a
 *     DIFFERENT, smaller list — the count it found is printed beside it so
 *     nobody reads the three numbers as three ways to the same answer.
 *
 * THE FIRST TWO MUST ANSWER THE SAME VALUE, and that is asserted before
 * anything is timed. It is what stops this being a benchmark of an arm that
 * answers nothing: the fast one could "win" by returning an empty list and the
 * comparison would still print. `titles` is deliberately outside that guard,
 * and is the one arm whose answer is checked for being SMALLER instead.
 *
 * The reconstructions live here for the reason `patch.bench.ts` keeps the
 * id-map clone it replaced: a before/after the harness cannot print is exactly
 * the unreproducible laptop sample these legs exist to retire.
 *
 * A FRESH DERIVED PER MEASUREMENT, because `vocabularyOf` holds one answer per
 * derivation in a `WeakMap` and the question is what a NEW REVISION costs. A
 * shallow copy of the view is a new key over the same indexes, which is exactly
 * what a server is left holding when one file changes.
 */

import {
  derive,
  type Derived,
  mayHoldTag,
  tagText,
  titleParts,
} from "./derive.ts"
import {
  median,
  recordsOf,
  runtimeSaid,
  setOf,
  timed,
  timesSaid,
  vaultOf,
} from "./fixtures.testlib.ts"
import { isLeftoverArchive, isMirror, isTrashed } from "./node.ts"
import { type TagUse, vocabularyOf } from "./vocabulary.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
/** How many times each arm is asked, each on a view it has not seen. */
const ROUNDS = Number(process.env["OLAI_BENCH_ROUNDS"] ?? 20)

/** The vault, through the REAL assembly (`setOf`) rather than a flatten written
 *  here: path order is a promise of the format's own, and a bench that spells
 *  it again is a bench that can come to measure a corpus in an order no app
 *  holds. */
const view = derive(recordsOf(setOf(Object.fromEntries(vaultOf({ files: FILES, records: RECORDS })))))

/** One row of the vocabulary, built the way both walks below build one —
 *  they differ in what they walk, never in what they answer with. */
const rowFor = (sigil: TagUse["sigil"], name: string, count: number): TagUse => ({
  sigil,
  name,
  folded: name.toLowerCase(),
  count,
})

const ranked = (counts: ReadonlyMap<string, TagUse>): ReadonlyArray<TagUse> =>
  [...counts.values()].sort((one, other) =>
    other.count - one.count || one.name.localeCompare(other.name)
  )

/**
 * The vocabulary walked out of the corpus, held to the INDEX's rules so that
 * this arm and the index arm are two ways to one answer.
 *
 * A record's title AND its note, and one vote per record — neither of which the
 * walk this replaced spelled ({@link titlesOnly} is that one). This is the arm the
 * published ratio is against, because a comparison is only a comparison when
 * both sides answer the same question.
 */
const walked = (derived: Derived): ReadonlyArray<TagUse> => {
  const counts = new Map<string, TagUse>()
  for (const located of derived.nodes) {
    if (
      isMirror(located.node) || isTrashed(located.file) ||
      isLeftoverArchive(located.file)
    ) continue
    const voted = new Set<string>()
    for (const text of [located.node.title, located.node.desc]) {
      // The format's own cheap negative first, exactly as the walk had it:
      // `titleParts` runs a global regex and most prose holds no sigil at all.
      if (text === undefined || !mayHoldTag(text)) continue
      for (const part of titleParts(text)) {
        if (part.kind !== "tag") continue
        const key = tagText(part)
        if (voted.has(key)) continue
        voted.add(key)
        const before = counts.get(key)
        counts.set(key, before === undefined ? rowFor(part.sigil, part.tag, 1) : {
          ...before,
          count: before.count + 1,
        })
      }
    }
  }
  return ranked(counts)
}

/**
 * ...and the walk as the browser ACTUALLY held it before `taggedBy`: titles only,
 * a vote per tag part rather than per record.
 *
 * It answers a smaller list than either arm above — a tag written only in a
 * note was not in the vocabulary at all — so it is timed beside them and
 * compared with neither. What it is for is the one thing {@link walked} cannot
 * say: how much of the saving is the index, and how much is that the arm
 * standing in for the old code was asked to do more than the old code did.
 */
const titlesOnly = (derived: Derived): ReadonlyArray<TagUse> => {
  const counts = new Map<string, TagUse>()
  for (const located of derived.nodes) {
    if (
      isMirror(located.node) || isTrashed(located.file) ||
      isLeftoverArchive(located.file)
    ) continue
    if (!mayHoldTag(located.node.title)) continue
    for (const part of titleParts(located.node.title)) {
      if (part.kind !== "tag") continue
      const key = tagText(part)
      const before = counts.get(key)
      counts.set(key, before === undefined ? rowFor(part.sigil, part.tag, 1) : {
        ...before,
        count: before.count + 1,
      })
    }
  }
  return ranked(counts)
}

/** A view the arm under test has never been handed: the same indexes under a
 *  new identity, which is what `vocabularyOf`'s per-derivation memo keys on. */
const fresh = (): Derived => ({ ...view })

const arms = { index: vocabularyOf, walk: walked, titles: titlesOnly } as const

// THE SAME ANSWER for the two that must have one, asserted before anything is
// timed — see the header. A benchmark whose fast arm answers a shorter list is
// not a benchmark.
const spelling = (tags: ReadonlyArray<TagUse>): string =>
  tags.map((tag) => `${tag.sigil}${tag.name} ${tag.count}`).join("\n")
const found = spelling(arms.index(fresh()))
const walkFound = spelling(arms.walk(fresh()))
if (found !== walkFound) {
  throw new Error(
    "the index and the equivalent walk disagree about the set's tags, so neither" +
      ` number means anything:\n  index: ${found.split("\n").length} tags` +
      `\n  walk:  ${walkFound.split("\n").length}`,
  )
}
const tags = view.taggedBy.size
if (tags < 2) throw new Error(`the vault holds ${tags} tags — this measures nothing`)
/** What the arm outside the guard answers, which must be SMALLER — a
 *  title-only reading of a corpus whose notes hold tags cannot be the whole
 *  vocabulary, and if it ever is, this vault stopped saying what it is for
 *  (`@olai/format`'s `vault.test.ts` is the fence for that). */
const titlesFound = arms.titles(fresh()).length
if (titlesFound >= tags) {
  throw new Error(
    `the title-only arm found ${titlesFound} of ${tags} tags — it is supposed to` +
      ` miss the ones only a note writes`,
  )
}

const run = (name: keyof typeof arms): ReadonlyArray<number> => {
  const arm = arms[name]
  // Warmed, then measured, for `patch.bench.ts`'s reason: one of three arms has
  // to go first, and going first means paying for a JIT the others find warm.
  for (let round = 0; round < 3; round++) arm(fresh())
  return Array.from({ length: ROUNDS }, () => {
    const derived = fresh()
    return timed(() => {
      arm(derived)
    })
  })
}

console.log(
  `vault: ${view.byFile.size} files, ${view.nodes.length} records, ${tags} tags` +
    ` in the index — the completion asked ${ROUNDS} times\n` +
    `${runtimeSaid()}\n`,
)
const timings = new Map(
  (["index", "walk", "titles"] as const).map((name) => [name, run(name)]),
)
for (const [name, times] of timings) console.log(timesSaid(name, times, 7))
console.log(
  `\nthe index against the walk that answers the same ${tags} tags:` +
    ` ${
      (median(timings.get("walk") as ReadonlyArray<number>) /
        median(timings.get("index") as ReadonlyArray<number>)).toFixed(1)
    }×` +
    ` — and against the title-only walk this replaced, which answered ${titlesFound}:` +
    ` ${
      (median(timings.get("titles") as ReadonlyArray<number>) /
        median(timings.get("index") as ReadonlyArray<number>)).toFixed(1)
    }×`,
)
