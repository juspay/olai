/**
 * THE SPLICE AGAINST THE REBUILD IT REPLACED.
 *
 * {@link ./patch.ts}'s `spliced` is an exchange: a key an edit touches used to
 * be copied out whole and sorted again, and is now spliced — the touched files'
 * members taken out of the list that stood, the arriving ones put in at the
 * position the order puts them. The claim is not that the new answer is a good
 * one; it is that it is the SAME ONE, for every key of every index, every time.
 * So what holds it is a differential with the OLD REBUILD standing as the
 * reference arm ({@link rebuilt}, which is that expression verbatim), and a
 * comparison that reads both the SET and the ORDER of what each arm answers.
 *
 * IT IS ITS OWN FILE and not another case in `./patch.test.ts`, because it is
 * the other shape of test. That file compares two WHOLE VIEWS and has no
 * opinion about how either was reached; this one holds one function to one
 * expression over cases harvested from real edits, and can therefore be run
 * against a splice that is WRONG — which is the second half of the gate.
 *
 * THE MUTATION PROOF is that second half, and without it the differential above
 * is a suite that would go on passing over a splice that placed every arrival
 * one position off. So the same cases are run through {@link misplacing}, which
 * is the merge with its one decision — where does an arriving member go — made
 * wrong three ways: one position late, one position early, and before the
 * members it compares equal to rather than after them. Each must be CAUGHT.
 *
 * THE THIRD OF THOSE IS NOT REACHABLE FROM A REAL INDEX, and finding that out
 * is the reason it is written down. Corpus order ties only inside one file,
 * a surviving member is in a file the delta did not name and an arriving one is
 * in a file it did — so the two sides of every real splice are totally ordered
 * against each other and the tie rule decides nothing. That is asserted rather
 * than argued ({@link TIED}), and the rule is held to the rebuild's answer by a
 * pair of keys written by hand over a comparator that ties everything: it is
 * what a stable sort said, and an index filed under something coarser would make
 * it load-bearing overnight.
 *
 * THE CASES ARE REAL and are harvested rather than invented: a generated corpus
 * and an edit over it ({@link ./corpora.testlib.ts}, the same generator both
 * other differentials in this package run on), and THE REAL VAULT — the
 * orchestrator's own, at the revision this repository pins (`OSS_OLAI_VAULT`)
 * — which is where the popular keys are: a tag with sixty members, a
 * day with seventy-eight, a parent with seventeen children — and where a key's
 * members really do span files nobody touched. What a case holds is what the
 * view held for that key, what the touched files put back under it, and what
 * `derive` says the answer is; the third of those is what makes the reference
 * arm credible rather than merely old, and is asserted on its own
 * ({@link grounded}).
 *
 * AND THE KEYS ARE COUNTED BY SHAPE, because a differential that never reached
 * an insertion at the head of a list, a key going away or a key being born
 * would agree with itself in the easy middle and say nothing. The floors below
 * are what say those corners were in the run.
 */

import { expect, test } from "bun:test"

import { type Corpus, corpusOf, deltaOf, editOf } from "./corpora.testlib.ts"
import { byCorpus, derive, type Derived } from "./derive.ts"
import { decodedOf, recordsOf, seeded } from "./fixtures.testlib.ts"
import { fileKind } from "./kinds.ts"
import type { Located } from "./node.ts"
import { bySibling, patched, spliced, touchedBy } from "./patch.ts"
import { pinnedVault, vaultAt } from "./scope.testlib.ts"
import { assemble } from "./set.ts"

// ── the two arms ───────────────────────────────────────────────────────

/** One key's members across an edit, however they are reached — the shape both
 *  arms have, so the differential can be handed either. */
type Splice = <T>(
  held: ReadonlyArray<T>,
  arriving: ReadonlyArray<T>,
  left: (one: T) => boolean,
  order: (one: T, other: T) => number,
) => ReadonlyArray<T>

/**
 * THE REFERENCE ARM: the key rebuilt, which is what {@link ./patch.ts}'s
 * `refiled` held before `perf-key-resort` — what survives the touched files,
 * then whatever arrived, sorted.
 *
 * A PRIVATE COPY, kept here for the reason `./patch.bench.ts` keeps its `cloned`
 * and its `mentionOnlyInto`: a before/after the tree cannot run is a claim
 * nobody can check. It is one expression and it is the whole of what the
 * splice replaced, down to the stable sort the tie rule leans on.
 */
const rebuilt: Splice = (held, arriving, left, order) =>
  [...held.filter((one) => !left(one)), ...arriving].sort(order)

/** The three ways a merge can put an arriving member in the wrong place, which
 *  between them are the mutation proof — see this file's own note.
 *
 *  `before the equals` is not an off-by-one: it is the tie rule read backwards,
 *  which a corpus whose comparator never ties cannot tell from the right one. */
type Wrong = "one late" | "one early" | "before the equals"

/**
 * THE SPLICE WITH ITS ONE DECISION MADE WRONG — the arm the differential has to
 * catch, or it is not a differential.
 *
 * A LINEAR MERGE rather than a binary search, deliberately: what is under test
 * is WHERE an arrival goes and not how the place is found, so a mutant that
 * broke the search would be proving something about this file's own arithmetic.
 * The place is walked to and then nudged, which is the mistake a person writing
 * this by hand actually makes.
 */
const misplacing = (how: Wrong): Splice => <T>(
  held: ReadonlyArray<T>,
  arriving: ReadonlyArray<T>,
  left: (one: T) => boolean,
  order: (one: T, other: T) => number,
): ReadonlyArray<T> => {
  const kept = held.filter((one) => !left(one))
  const coming = [...arriving].sort(order)
  const own: Array<T> = []
  let from = 0
  for (const one of coming) {
    let to = from
    while (to < kept.length && order(kept[to] as T, one) <= 0) to++
    if (how === "one late" && to < kept.length) to++
    if (how === "one early" && to > from) to--
    if (how === "before the equals") {
      while (to > from && order(kept[to - 1] as T, one) === 0) to--
    }
    for (let at = from; at < to; at++) own.push(kept[at] as T)
    own.push(one)
    from = to
  }
  for (let at = from; at < kept.length; at++) own.push(kept[at] as T)
  return own
}

// ── what a case is ─────────────────────────────────────────────────────

/** The two orders an arrivals list can reach a splice in. The patcher hands it
 *  the FOLD'S order, which is the delta's own and is nobody's promise — so
 *  every case is run both as the fold filed it and shuffled, and the two arms
 *  must not be told apart by either. */
const ARRIVALS = ["as filed", "shuffled"] as const
type Arrivals = (typeof ARRIVALS)[number]

/** ONE KEY OF ONE INDEX ACROSS ONE EDIT, with the types erased: what a case
 *  hands out is the members PRINTED, so four indexes holding four member shapes
 *  are one list of comparisons. */
interface Case {
  /** The index and the key, for a failure somebody has to act on. */
  readonly what: string
  /** What one splice answers for this key, printed member by member. */
  readonly ran: (splice: Splice, arrivals: Arrivals) => ReadonlyArray<string>
  /** ...and what `derive` itself holds for it after the edit, which is what
   *  {@link grounded} holds the reference arm to. Absent for the cases written
   *  by hand below, which are about the function's contract and have no
   *  derivation behind them. */
  readonly derived: ReadonlyArray<string> | undefined
  /** How many members the key ends up with — a case's size, for the floors. */
  readonly members: number
  /** How many (surviving member, arriving member) pairs this key's own order
   *  cannot tell apart — which is what makes the tie rule visible, and is zero
   *  for every case a real index produces ({@link TIED}). */
  readonly tied: number
  /** WHICH CORNER this case is, which is what the floors below are counted off:
   *  a key born, a key emptied, an insert at the head or at the tail of a list
   *  that has one, and a key whose members span files where only some were
   *  touched. */
  readonly shape: ReadonlySet<Shape>
}

type Shape = "born" | "emptied" | "first" | "last" | "cross-file" | "moved" | "popular"

/** A member printed WHOLE — the place and the record both, because a comparison
 *  about order that read only places would wave through an arm that put the
 *  right file:line there carrying the wrong record. Every member shape of the
 *  four re-filed indexes is plain data, so one line does all four.
 *
 *  REMEMBERED PER MEMBER, which is what keeps this suite a second rather than
 *  ten: five arms are run over every case and each of them prints the same
 *  entries again, so the printing — not the splicing — is what a naive run
 *  spends nearly all of its time on. The members are the view's own objects and
 *  the view outlives the run, so the table is keyed on them and empties itself. */
const PRINTED = new WeakMap<object, string>()

const said = (one: unknown): string => {
  if (typeof one !== "object" || one === null) return JSON.stringify(one)
  const found = PRINTED.get(one)
  if (found !== undefined) return found
  const printed = JSON.stringify(one)
  PRINTED.set(one, printed)
  return printed
}

/**
 * Every key of ONE index that this edit could have moved, as cases.
 *
 * THE ARRIVALS ARE TAKEN OUT OF THE ORACLE rather than folded again: what the
 * touched files put under a key is exactly the members of the DERIVED after-list
 * that sit in a touched file. So this harness never spells `derive`'s folds a
 * second time — which is the drift `./patch.ts` factored those folds out to
 * stop, and it would be a strange thing for the file testing that discipline to
 * break.
 */
const casesIn = <T>(
  index: string,
  before: ReadonlyMap<string, ReadonlyArray<T>>,
  after: ReadonlyMap<string, ReadonlyArray<T>>,
  touched: ReadonlySet<string>,
  at: (one: T) => Located,
  order: (one: Located, other: Located) => number,
  random: () => number,
  into: Array<Case>,
): void => {
  const left = (one: T): boolean => touched.has(at(one).file)
  const inOrder = (one: T, other: T): number => order(at(one), at(other))
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const held = before.get(key) ?? []
    const landed = after.get(key) ?? []
    const arriving = landed.filter(left)
    // A key no touched file reached is a key the patcher never opens, and a
    // case whose two arms are both "the list that stood" proves nothing.
    if (arriving.length === 0 && !held.some(left)) continue
    const stirred = shuffled(arriving, random)
    let tied = 0
    for (const one of arriving) {
      for (const other of held) if (!left(other) && inOrder(other, one) === 0) tied++
    }
    const shape = new Set<Shape>()
    if (held.length === 0) shape.add("born")
    if (landed.length === 0) shape.add("emptied")
    if (arriving.length > 0 && held.some(left)) shape.add("moved")
    if (landed.length >= 20) shape.add("popular")
    if (arriving.length > 0 && landed.length > arriving.length) {
      if (left(landed[0] as T)) shape.add("first")
      if (left(landed[landed.length - 1] as T)) shape.add("last")
      if (new Set(landed.map((one) => at(one).file)).size > 1) shape.add("cross-file")
    }
    into.push({
      what: `${index} \`${key}\``,
      ran: (splice, arrivals) =>
        splice(held, arrivals === "shuffled" ? stirred : arriving, left, inOrder).map(said),
      derived: landed.map(said),
      members: landed.length,
      tied,
      shape,
    })
  }
}

/** The arrivals in an order nothing promised — see {@link ARRIVALS}. */
const shuffled = <T>(from: ReadonlyArray<T>, random: () => number): ReadonlyArray<T> => {
  const own = [...from]
  for (let at = own.length - 1; at > 0; at--) {
    const other = Math.floor(random() * (at + 1))
    const held = own[at] as T
    own[at] = own[other] as T
    own[other] = held
  }
  return own
}

/** Every key of ALL FOUR re-filed indexes across one edit. The projections and
 *  the orders are the ones {@link ./patch.ts} files each index with — `children`
 *  by the format's sibling order and the other three by corpus order — and
 *  `bySibling` is imported rather than spelled, so a tie rule that moved would
 *  move this differential with it. */
const casesFor = (
  before: Derived,
  after: Derived,
  touched: ReadonlySet<string>,
  random: () => number,
  into: Array<Case>,
): void => {
  const over = <T>(
    index: string,
    of: (view: Derived) => ReadonlyMap<string, ReadonlyArray<T>>,
    at: (one: T) => Located,
    order: (one: Located, other: Located) => number,
  ): void => casesIn(index, of(before), of(after), touched, at, order, random, into)
  over("children", (view) => view.children, (one) => one, bySibling)
  over("namedBy", (view) => view.namedBy, (one) => one.at, byCorpus)
  over("taggedBy", (view) => view.taggedBy, (one) => one, byCorpus)
  over("byDay", (view) => view.byDay, (one) => one.at, byCorpus)
}

// ── the differential ───────────────────────────────────────────────────

interface Divergence {
  readonly what: string
  /** Whether the two arms disagree about WHICH members the key holds, or only
   *  about the order it holds them in. Both are failures and they are told
   *  apart because they are different bugs. */
  readonly how: "set" | "order"
  readonly arrivals: Arrivals
  readonly found: string
  readonly reference: string
}

const divergences = (splice: Splice, cases: ReadonlyArray<Case>): ReadonlyArray<Divergence> => {
  const found: Array<Divergence> = []
  for (const one of cases) {
    for (const arrivals of ARRIVALS) {
      const mine = one.ran(splice, arrivals)
      const theirs = one.ran(rebuilt, arrivals)
      if (mine.join("\n") === theirs.join("\n")) continue
      found.push({
        what: one.what,
        // WHICH members, or only in which ORDER — asked once a divergence is
        // already found, because it costs two sorts and every case but a
        // failing one is answered by the comparison above.
        how: [...mine].sort().join("\n") === [...theirs].sort().join("\n") ? "order" : "set",
        arrivals,
        found: shortly(mine),
        reference: shortly(theirs),
      })
    }
  }
  return found
}

/** THE REFERENCE ARM ITSELF, held to the derivation — because a differential
 *  against an arm nobody checked is two implementations of the same mistake.
 *  It is asked of the arrivals AS FILED, which is the order a rebuild really
 *  had them in. */
const grounded = (cases: ReadonlyArray<Case>): ReadonlyArray<string> =>
  cases.filter((one) =>
    one.derived !== undefined &&
    one.ran(rebuilt, "as filed").join("\n") !== one.derived.join("\n")
  ).map((one) => one.what)

/** A key's members, short enough for a failure message to be read. */
const shortly = (members: ReadonlyArray<string>): string => {
  const said = members.join(" | ")
  return said.length > 400 ? `${said.slice(0, 400)}… (${members.length} members)` : said
}

// ── where the cases come from ──────────────────────────────────────────

/**
 * A corpus as a view of it — and the DECODE CACHED, which is the probe's own
 * discipline borrowed for a reason of this file's own.
 *
 * Every case here needs two views of one directory, and this file asks for a
 * hundred and twenty of them over the pinned vault. Re-reading its outlines each time
 * spends thirteen milliseconds parsing files no revision touched, which is a
 * suite that measures the parser to test a splice. A file whose text has not
 * moved decodes once and its records are the very objects the last revision
 * held, which is also what a probe hands the validator
 * ({@link ./incremental.testlib.ts} says the same thing where it is not an
 * optimisation but a requirement).
 */
const viewOf = (corpus: Corpus): Derived =>
  derive(recordsOf(assemble(
    new Map(Object.entries(corpus).map(([file, text]) => [file, decoded(file, text)])),
  )))

type Decoded = ReturnType<typeof decodedOf> extends Map<string, infer V> ? V : never

const HELD = new Map<string, Decoded>()

const decoded = (file: string, text: string): Decoded => {
  const key = `${file}\0${text}`
  const found = HELD.get(key)
  if (found !== undefined) return found
  const parsed = decodedOf({ [file]: text }).get(file) as Decoded
  HELD.set(key, parsed)
  return parsed
}

const ROUNDS = 300

/** Every key of every index across a generated corpus and a generated edit over
 *  it — the small, awkward sets: duplicate ids, foreign parents, records that
 *  swap lines, a file that goes away. */
const generated = (): ReadonlyArray<Case> => {
  const random = seeded(20260825)
  const found: Array<Case> = []
  for (let round = 0; round < ROUNDS; round++) {
    const { files: before, used } = corpusOf(random)
    const after = editOf(random, before, used)
    casesFor(viewOf(before), viewOf(after), touchedBy(deltaOf(before, after)), random, found)
  }
  return found
}

/** THE REAL VAULT, read as the set it is — the outlines only, since a `.md`
 *  beside them holds no records and the patcher never sees one. A generated
 *  corpus is a corpus somebody designed; what this has that no generator draws
 *  is keys people really grew ({@link ./scope.testlib.ts}'s `vaultAt` argues it
 *  at length). It was this repository's `docs/` until the board moved out, and
 *  is the PINNED vault now — `pinnedVault`, off `OSS_OLAI_VAULT`, which throws
 *  by name rather than handing this file an empty corpus to be vacuous over. */
const REAL = ((): Corpus => {
  const outlines: Corpus = {}
  for (const [file, text] of vaultAt(pinnedVault())) {
    if (fileKind(file) === "outline") outlines[file] = text
  }
  return outlines
})()

const TYPED = 60

/**
 * The real vault, TYPED IN: one record of one outline gets a character in front
 * of its title, revision after revision.
 *
 * NOT `./incremental.testlib.ts`'s `edited`, and the difference is the whole
 * point of this arm. That one REPLACES a title, which takes any `#tag` in it
 * off the record — so a popular key loses a member and gains nothing, and an
 * INSERTION into a long list is never exercised. A keystroke keeps the record
 * on every key it was on, which is exactly the edit `perf-key-resort` is about:
 * typing in a file that mentions `#deferral` re-files all sixty of them.
 */
const typing = (random: () => number): ReadonlyArray<Corpus> => {
  const files = Object.keys(REAL)
  const stream: Array<Corpus> = []
  let held = REAL
  // DRAWN UNTIL IT HAS ITS REVISIONS rather than drawn a fixed number of times:
  // a record with no title is a placement, and skipping one without replacing
  // the draw would make the stream's LENGTH a fact about which lines the seed
  // happened to land on — which the run below asserts against.
  while (stream.length < TYPED) {
    const file = files[Math.floor(random() * files.length)] as string
    const lines = (held[file] as string).split("\n").filter((line) => line !== "")
    if (lines.length === 0) continue
    const which = Math.floor(random() * lines.length)
    const record = JSON.parse(lines[which] as string) as Record<string, unknown>
    const title = record["title"]
    if (typeof title !== "string") continue
    record["title"] = `x${title}`
    lines[which] = JSON.stringify(record)
    const next: Corpus = { ...held, [file]: lines.join("\n") }
    stream.push(next)
    held = next
  }
  return stream
}

const real = (): ReadonlyArray<Case> => {
  const random = seeded(20260825)
  const found: Array<Case> = []
  let before = REAL
  let view = viewOf(before)
  for (const after of typing(random)) {
    const next = viewOf(after)
    casesFor(view, next, touchedBy(deltaOf(before, after)), random, found)
    before = after
    view = next
  }
  return found
}

/** Every case a real edit over a real index produced. */
const HARVESTED = [...generated(), ...real()]

// ── the one corner no index can reach ──────────────────────────────────

/**
 * A KEY WHOSE ORDER CANNOT TELL THE TWO SIDES APART — written by hand, because
 * no index in this package produces one and the rule it exercises is still the
 * rule.
 *
 * The four orders a re-filing uses all end in the corpus, and corpus order ties
 * only INSIDE ONE FILE (`./derive.ts`'s `byCorpus`: same file, same line). A
 * surviving member is one in a file the delta did not name and an arriving one
 * is in a file it did, so the two can never be in the same file and can never
 * tie — which is asserted of every harvested case below rather than left to a
 * reader to work out. The tie rule in {@link ./patch.ts}'s `placeFor` is
 * therefore not load-bearing TODAY, and is written and tested anyway: it is
 * what the rebuild's stable sort said, an index ordered by something coarser
 * (a day, a name) would make it visible immediately, and the failure it would
 * cause then is a silent reordering rather than a crash.
 *
 * So the comparator here is a coarse one — the LINE alone, with the file
 * ignored — and every member ties with every other. What each arm answers is
 * then entirely a statement about where an arrival goes among its equals.
 */
const TIED: ReadonlyArray<Case> = ((): ReadonlyArray<Case> => {
  interface Row {
    readonly file: string
    readonly line: number
    readonly mark: string
  }
  const left = (one: Row): boolean => one.file === "touched.org"
  /** The file ignored ON PURPOSE — see above. */
  const byLineAlone = (one: Row, other: Row): number => one.line - other.line
  const written = (
    what: string,
    held: ReadonlyArray<Row>,
    arriving: ReadonlyArray<Row>,
    shape: ReadonlyArray<Shape>,
  ): Case => ({
    what,
    ran: (splice) => splice(held, arriving, left, byLineAlone).map(said),
    derived: undefined,
    members: held.filter((one) => !left(one)).length + arriving.length,
    tied: arriving.length * held.filter((one) => !left(one)).length,
    shape: new Set(shape),
  })
  const stood = (file: string, mark: string): Row => ({ file, line: 1, mark })
  return [
    written(
      "written `every member ties, nothing leaves`",
      [stood("a.org", "stood first"), stood("b.org", "stood second")],
      [stood("touched.org", "arrived")],
      ["last"],
    ),
    written(
      "written `every member ties, one leaves from the middle`",
      [
        stood("a.org", "stood first"),
        stood("touched.org", "left"),
        stood("b.org", "stood second"),
      ],
      [stood("touched.org", "arrived")],
      ["moved", "last"],
    ),
  ]
})()

const CASES = [...HARVESTED, ...TIED]

/** How many cases of one corner the run found. */
const many = (shape: Shape): number => CASES.filter((one) => one.shape.has(shape)).length

// ── the gate ───────────────────────────────────────────────────────────

test("a spliced key is the key the rebuild built, member for member and in order", () => {
  expect(divergences(spliced, CASES)).toEqual([])
})

test("...and the rebuild it is compared against is what `derive` itself holds", () => {
  expect(grounded(CASES)).toEqual([])
})

test("the run reached the corners a splice can only be wrong at", () => {
  // NOT A COUNT FOR ITS OWN SAKE. A differential over keys that only ever
  // gained a member in the middle of a list would agree with itself everywhere
  // and say nothing about the head, the tail, a key being born or one going
  // away — which are the four places an insertion is decided differently.
  // The figures are what the run found as this is written; the floors are what
  // fails when a generator or a vault stops reaching one of them.
  //
  // 7,918 cases: 493 keys born, 383 emptied, 6,923 with members leaving AND
  // arriving, 1,185 inserting at the head of a list that already had one, 1,137
  // at the tail, 2,760 spanning files where only some were touched, and 481 on
  // keys holding twenty members or more — the largest of them 78.
  expect(CASES.length).toBeGreaterThan(2000)
  for (const shape of ["born", "emptied", "moved", "first", "last", "cross-file"] as const) {
    expect([shape, many(shape) > 100]).toEqual([shape, true])
  }
  // The popular key is the whole subject of the item, and the generated corpora
  // cannot reach it — five files of a few records each never grow one. It is
  // the real vault's contribution and it is asserted separately for that:
  // a floor met by generated rounds alone would go on passing over a vault
  // this harness had stopped reading.
  expect(CASES.filter((one) => one.shape.has("popular") && one.shape.has("moved")).length)
    .toBeGreaterThan(100)
  expect(Math.max(...CASES.map((one) => one.members))).toBeGreaterThan(50)
})

test("a splice landing one position off is caught, in both directions", () => {
  // THE MUTATION PROOF. Without it the two assertions above are a suite that
  // would go on passing over a splice that put every arriving member in the
  // wrong place — the differential would be comparing two arms that agree
  // because neither was ever asked anything hard.
  for (const how of ["one late", "one early"] as const) {
    const found = divergences(misplacing(how), CASES)
    expect([how, found.length > 100]).toEqual([how, true])
    // ...and it is caught as an ORDER divergence, which is what an off-by-one
    // IS: the same members, one of them in the wrong place. A mutant that
    // failed the set comparison would be a mutant that dropped something, and
    // would be proving a different thing.
    expect([how, found.every((one) => one.how === "order")]).toEqual([how, true])
  }
})

test("a splice that puts an arrival before the members it ties with is caught", () => {
  // THE TIE RULE — the third way the one decision can be made wrong, and the
  // one no harvested case can catch. It is only visible where the order cannot
  // tell a survivor from an arrival, which the four real orders never do
  // ({@link TIED} next door says why), so what catches it is the pair of keys
  // written by hand over a comparator that ties everything.
  const found = divergences(misplacing("before the equals"), CASES)
  expect([...new Set(found.map((one) => one.what))])
    .toEqual(TIED.map((one) => one.what) as never)
  expect(found.every((one) => one.how === "order")).toBe(true)
})

test("no key a real index produces can tie a survivor with an arrival", () => {
  // THE REASON the case above had to be written rather than found, asserted
  // rather than argued: corpus order ties only inside ONE FILE, a survivor is
  // in a file the delta did not name and an arrival is in one it did, so the
  // two sides of every real splice are totally ordered against each other.
  //
  // It is here so that the day an index is filed under something coarser — or
  // files two entries for one record under one key from two DIFFERENT files —
  // this fails and points at the rule that has just become load-bearing,
  // instead of that rule going quietly untested for the second time.
  expect(HARVESTED.reduce((held, one) => held + one.tied, 0)).toBe(0)
})

// ── and the same claim at the view ─────────────────────────────────────

test("the patched view is the derived view over the real vault", () => {
  // THE SPLICE WIRED IN, over the directory the popular keys are actually in.
  // `./patch.test.ts` is the oracle in general and runs on generated corpora;
  // what this adds is the one corpus with a sixty-member tag and a
  // seventy-eight-record day in it, which is where a key rebuilt the wrong way
  // has the most room to be wrong.
  const random = seeded(20260826)
  let before = REAL
  let view = viewOf(before)
  let folded = 0
  for (const after of typing(random)) {
    const next = patched(view, deltaOf(before, after))
    // A run that DECLINED would be this test comparing two rebuilds, which is
    // the vacuous pass `./patch.test.ts` counts declines to stop.
    expect([folded, next !== undefined]).toEqual([folded, true])
    same(next as Derived, viewOf(after))
    folded++
    before = after
    view = next as Derived
  }
  // The chain really compounded — every revision patched onto the one before
  // it, sixty deep.
  expect(folded).toBe(TYPED)
})

/** The four re-filed indexes and the readings carried beside the day index,
 *  compared the way each is READ: `byDay`'s keys and `namedBy`'s in order,
 *  because the calendar steps the one and the validator walks the other; the
 *  members of every key in order, because that is the promise the splice keeps.
 */
const same = (found: Derived, oracle: Derived): void => {
  for (const index of ["children", "namedBy", "taggedBy", "byDay"] as const) {
    expect([index, entries(found[index])]).toEqual([index, entries(oracle[index])])
  }
  expect([...found.byDay.keys()]).toEqual([...oracle.byDay.keys()])
  expect([...found.namedBy.keys()]).toEqual([...oracle.namedBy.keys()])
  expect([...found.owedByDay]).toEqual([...oracle.owedByDay])
  expect(found.days).toEqual(oracle.days as never)
}

const entries = (map: ReadonlyMap<string, ReadonlyArray<unknown>>): ReadonlyArray<string> =>
  [...map].map(([key, own]) => `${key}\n${own.map(said).join("\n")}`).sort()
