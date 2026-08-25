/**
 * WHAT AN ANSWER READ, AND WHETHER THE NEXT REVISION COULD HAVE MOVED IT.
 *
 * A standing view — the page in front of somebody, the filter over it, the
 * calendar's dots, what is owed, the move picker's preview — is a pure function
 * of one {@link Reading} and the question asked of it. The server re-reads
 * every one of them on every published revision, and nearly every revision
 * leaves nearly every one of them exactly where it was: a keystroke in one
 * outline is not news about a page two files away, and it is not news about the
 * dots on a month at all. Until this module the only way to find that out was
 * to BUILD the answer again and compare it, which saves the frame and never the
 * work (roadmap `perf-streams-per-tab`).
 *
 * This is the other way round: run the answer once over a RECORDING view of the
 * reading, keep what it read, and ask the next revision whether any of it
 * moved. A `false` means rebuild. A `true` means the answer is the one already
 * in hand — not "probably", but by the same argument a pure function is pure:
 *
 *   AN ANSWER IS A FUNCTION OF WHAT IT READ. If every read the run made
 *   answers with the same value at the next revision, the run takes the same
 *   branches, makes the same reads and produces the same value. Induction over
 *   the reads, and the only thing it asks of the caller is that the answer be a
 *   function of the reading, the request and the clock — which is what
 *   `@olai/ops`' query layer is ({@link ./validate.ts}'s `Reading` is the whole
 *   of the state, and nothing below it is written to).
 *
 * WHICH DIRECTION THE MISTAKES GO is the whole of why this is safe to have. A
 * tape that is too WIDE — it recorded a read the answer did not really
 * depend on — costs a rebuild that was not needed, which is what every revision
 * cost before. A tape that is too NARROW is a wrong page, so every read that
 * is not exactly recorded is recorded conservatively:
 *
 *   - a lookup that found NOTHING is a read like any other, and it is the one a
 *     naive dependency set forgets. A page that asked `byId.get(x)` and was
 *     told nothing depends on that nothing: the revision where a record starts
 *     claiming `x` changes what it draws. `undefined` is taped and compared
 *     like any other value;
 *   - a WALK of an index is not taped key by key. It is recorded as a
 *     dependency on the WHOLE index, and the next revision is asked whether
 *     that index still says the same thing ({@link carriedIndex}) — which is
 *     stricter than the walk needed (a walk that broke early is held against
 *     entries it never reached) and cheap, because the comparison is one
 *     per index per revision and every question shares it;
 *   - the {@link Derived.nodes} flat reading is one value, compared as one;
 *   - the SET's two arrays are read whole by everything that touches them, so
 *     they are compared whole ({@link carriedSet}) — element identity first,
 *     and the FACE's own equivalence for the one element a revision moved, so a
 *     keystroke that left a file's name, links, tags and props alone is not a
 *     reason to redraw every open page.
 *
 * WHAT IT IS NOT: a cache. Nothing here holds an answer, decides when to reuse
 * one or knows what a question is. It hands out a view and answers one question
 * about it, and `@olai/ops`' `standing.ts` is where the answers live and where
 * the reuse is decided.
 *
 * IT HANDS THE FORMAT A DIFFERENT OBJECT, which is the one thing a reader has
 * to know about it. The view is a fresh `Derived` per run, with a taping map in
 * place of each index — same answers, same order, same everything a reader can
 * ask — so anything that keyed a memo on the DERIVATION's identity would miss
 * on it (`./vocabulary.ts`'s `counted` is the only one in the tree, and no
 * standing view asks it). The maps below are not `Map`s either; every reader of
 * an index in this package takes a `ReadonlyMap`, which is what they are.
 */

import { type Derived, type Index, READ } from "./derive.ts"
import { Face } from "./document.ts"
import type { BrokenFile, OutlineSet } from "./set.ts"
import type { Reading } from "./validate.ts"
import { Schema } from "effect"

/** Every index of a derivation, by name — {@link READ} read for its keys,
 *  which is exhaustive by that table's type. An index added to `Derived` gets
 *  a row there or the package does not compile, and it is taped here without
 *  anybody remembering to say so. */
const INDEXES = Object.keys(READ) as ReadonlyArray<Index>

/**
 * …and every field of a derivation that is NOT an index, which today is the two
 * LISTS: the flat reading of the corpus and the days in order.
 *
 * IT IS EXHAUSTIVE BY THE TYPE, and that is the whole reason it is a table
 * rather than two names written into the view below. A view built from
 * {@link READ} alone covers the maps and silently DROPS everything else — a
 * field added to `Derived` would read as `undefined` through the taping view,
 * so an answer that spent it would throw or, worse, quietly answer about
 * nothing. That is not hypothetical: `perf-agenda-history-walk` added
 * {@link Derived.days} while this was written against the maps alone, and the
 * calendar's binary search met an `undefined` array the moment the two met.
 * `Exclude<keyof Derived, Index>` is what makes the next one a typecheck
 * failure here instead.
 */
const LISTS: { readonly [K in Exclude<keyof Derived, Index>]: null } = {
  nodes: null,
  days: null,
}

/** A value read out of an index, or the absence of one — taped as it stands.
 *  `undefined` IS a value here (see the header's second bullet). */
type Held = unknown

/**
 * WHAT ONE RUN READ. Opaque to its caller: the only two things anybody does
 * with one is take it off a run ({@link taping}) and ask whether it still
 * holds ({@link stillHolds}).
 */
export interface Tape {
  /** index → the keys this run asked for, and what each one answered with. */
  readonly keyed: Map<Index, Map<string, Held>>
  /** The indexes this run walked, in any of the ways a map can be walked. */
  readonly walked: Set<Index>
  /** The LISTS it asked for — each is one value and is held against one
   *  comparison ({@link LISTS}). */
  readonly lists: Set<keyof typeof LISTS>
  /** Whether it read the served files, and whether it read the broken ones. */
  documents: boolean
  broken: boolean
}

/**
 * ONE INDEX, TAPING WHAT IT IS ASKED.
 *
 * A class rather than a `Proxy`, and it is not only about speed: a proxy over a
 * `Map` has to rebind every method to the target it forwards to, and a reader
 * that reached one this file had not thought about would silently get the
 * UNTAPED answer — a tape too narrow, which is the one direction that is a
 * wrong page. Every member of `ReadonlyMap` is written out here, so a way of
 * reading a map that is not taped does not typecheck.
 *
 * THE WALKS ARE NOT TAPED ENTRY BY ENTRY. Each of the five ways to walk a map
 * marks the index as walked and hands the underlying walk straight over — see
 * the header's third bullet for why that is the conservative choice and not a
 * shortcut.
 */
class Taped<V> implements ReadonlyMap<string, V> {
  /** This index's own row of the tape, filed the moment the wrapper is made.
   *  Held here rather than looked up per read: an answer that situates a
   *  thousand rows makes several thousand keyed reads, and finding the row
   *  again on each of them is a lookup per read of the answer's own size. */
  private readonly own: Map<string, Held>

  constructor(
    private readonly of: ReadonlyMap<string, V>,
    private readonly which: Index,
    private readonly tape: Tape,
  ) {
    const held = tape.keyed.get(which)
    if (held === undefined) {
      this.own = new Map<string, Held>()
      tape.keyed.set(which, this.own)
    } else this.own = held
  }

  /** The one place a keyed read is written down — both verbs go through it, and
   *  both tape the VALUE, so a `has` that was answered `false` is held against
   *  the revision where the key arrives. */
  private taped(key: string): V | undefined {
    const held = this.of.get(key)
    this.own.set(key, held)
    return held
  }

  get(key: string): V | undefined {
    return this.taped(key)
  }

  has(key: string): boolean {
    this.taped(key)
    return this.of.has(key)
  }

  get size(): number {
    this.tape.walked.add(this.which)
    return this.of.size
  }

  forEach(
    each: (value: V, key: string, map: ReadonlyMap<string, V>) => void,
    self?: unknown,
  ): void {
    this.tape.walked.add(this.which)
    this.of.forEach(each, self)
  }

  keys(): MapIterator<string> {
    this.tape.walked.add(this.which)
    return this.of.keys()
  }

  values(): MapIterator<V> {
    this.tape.walked.add(this.which)
    return this.of.values()
  }

  entries(): MapIterator<[string, V]> {
    this.tape.walked.add(this.which)
    return this.of.entries()
  }

  [Symbol.iterator](): MapIterator<[string, V]> {
    this.tape.walked.add(this.which)
    return this.of[Symbol.iterator]()
  }
}

/**
 * A reading that TAPES what is asked of it, and the tape.
 *
 * The set is handed over as it stands — its two members are arrays, they are
 * read whole by everything that reads them at all, and wrapping them would buy
 * a granularity nobody spends ({@link carriedSet} is what answers for them).
 * What is wrapped is the derivation, index by index.
 *
 * EVERY FIELD OF THE DERIVATION IS STOOD IN FOR — the maps by a taping wrapper
 * ({@link INDEXES}) and the lists by a getter ({@link LISTS}) — and both lists
 * are exhaustive by the type rather than by memory. A view that covered only
 * what somebody thought of would answer `undefined` for the rest, which is a
 * missing table dressed as an empty one.
 */
export const taping = (
  at: Reading,
): { readonly reading: Reading; readonly tape: Tape } => {
  const tape: Tape = {
    keyed: new Map(),
    walked: new Set(),
    lists: new Set(),
    documents: false,
    broken: false,
  }
  const view: Record<string, unknown> = {}
  // ONE WRAPPER PER INDEX THE ANSWER ACTUALLY NAMES, minted on the way past and
  // kept: most of the five read two or three of the eleven, and the two
  // cheapest — a month of the calendar, a move picker's preview — read exactly
  // one. Eleven allocations to answer a question that costs a fifth of a
  // millisecond is a tax on the arm this module exists to make cheaper.
  //
  // ENUMERABLE, like the fields they stand in for: a view whose tables were
  // hidden from a spread would be a `Derived` that quietly lost eleven of its
  // thirteen fields the first time somebody copied one.
  for (const which of INDEXES) {
    let held: Taped<unknown> | undefined
    Object.defineProperty(view, which, {
      enumerable: true,
      get: () =>
        held ??= new Taped(at.derived[which] as ReadonlyMap<string, unknown>, which, tape),
    })
  }
  // …and the LISTS, which are one value each and are taped as one. Getters for
  // the reason the wrappers above are lazy and then some: on a patched view
  // {@link Derived.nodes} is built the first time somebody asks, so a view that
  // read its own fields while building itself would flatten the corpus on the
  // way past — one array per record in the directory, per answer, for a reading
  // most answers never ask for.
  for (const which of Object.keys(LISTS) as ReadonlyArray<keyof typeof LISTS>) {
    Object.defineProperty(view, which, {
      enumerable: true,
      get: () => {
        tape.lists.add(which)
        return at.derived[which]
      },
    })
  }
  const set: OutlineSet = {
    get documents() {
      tape.documents = true
      return at.set.documents
    },
    get broken() {
      tape.broken = true
      return at.set.broken
    },
  }
  return { reading: { set, derived: view as unknown as Derived }, tape }
}

/**
 * COULD THIS REVISION HAVE MOVED THAT ANSWER? — the whole point of the module,
 * and the one question anything outside it asks.
 *
 * `false` is always safe and says nothing more than "go and look". `true` is a
 * claim, and it is the claim the header argues: every read the run made answers
 * the same way at `now`, so the run would produce the value it already
 * produced.
 *
 * The keyed reads are answered one lookup each and cost what the answer's own
 * reads cost, without the folding, sorting and shaping around them. The three
 * WHOLE comparisons underneath — an index, the served files, the broken ones —
 * are memoised on the revision pair, so a directory with ten open tabs on five
 * questions pays each of them once.
 */
export const stillHolds = (tape: Tape, was: Reading, now: Reading): boolean => {
  if (was === now) return true
  for (const which of tape.lists) {
    if (!carriedList(was.derived, now.derived, which)) return false
  }
  if (tape.documents && !carriedSet(was.set, now.set).documents) return false
  if (tape.broken && !carriedSet(was.set, now.set).broken) return false
  for (const which of tape.walked) {
    if (!carriedIndex(was.derived, now.derived, which)) return false
  }
  for (const [which, own] of tape.keyed) {
    const index = now.derived[which] as ReadonlyMap<string, unknown>
    for (const [key, held] of own) if (!carried(held, index.get(key))) return false
  }
  return true
}

/**
 * WHETHER TWO REVISIONS SAY THE SAME THING AT ONE PLACE.
 *
 * Identity first, because that is what the patcher promises and what nearly
 * every answer here is: a revision carries forward every value it did not
 * write, so an untouched record, an untouched key's members and an untouched
 * index are the same objects (`./patch.ts`'s copy-on-write, and
 * `./overlay.ts`'s "a sealing that was never written to hands back `base`").
 *
 * The two containers are compared one level down because that is exactly one
 * level further than the patcher carries: a key it re-files gets a NEW array
 * (or set) holding whatever of its old members survived, so a list that lost
 * nothing is a new object over the same records. Anything deeper than that is
 * left alone — a member that is not the same object is a record that was
 * re-decoded, and re-deciding whether two records mean the same thing here
 * would be this module holding an opinion about the format.
 */
const carried = (was: unknown, now: unknown): boolean => {
  if (was === now) return true
  if (Array.isArray(was) && Array.isArray(now)) {
    return was.length === now.length && was.every((one, at) => one === now[at])
  }
  if (was instanceof Set && now instanceof Set) {
    if (was.size !== now.size) return false
    for (const one of was) if (!now.has(one)) return false
    return true
  }
  return false
}

/** What one revision pair was found to have carried — filled in as questions
 *  ask, so a comparison nobody needs is never made. */
interface Carried {
  readonly against: Derived
  readonly indexes: Map<Index, boolean>
  /** The two LISTS, which are not indexes and one of which is the largest
   *  single thing here — absent until somebody's tape has asked for one. */
  readonly lists: Map<keyof typeof LISTS, boolean>
}

/** Keyed on the PREVIOUS derivation, holding what it was last compared
 *  against: every open question at one revision revalidates against the same
 *  pair, so the second one to ask pays nothing. Weak, so a revision nobody
 *  holds any more takes its comparisons with it. */
const comparedIndexes = new WeakMap<Derived, Carried>()

/**
 * Whether a whole index says what it said — the answer a WALK is held against.
 *
 * ONE COMPARISON PER INDEX PER REVISION PAIR, however many questions walked it:
 * the calendar's month, the agenda's two directions and what a browser is owed
 * all walk `byDay`, and they are three questions about one map.
 *
 * KEY ORDER IS PART OF IT, and deliberately: two of these maps promise an order
 * their readers spend (`Derived.byDay` by day, `Derived.byFile` by path), and a
 * walk that saw the same pairs in a different order is a walk that could have
 * produced a different answer. Comparing the two walks in step says both things
 * at once and costs one pass.
 */
const carriedIndex = (was: Derived, now: Derived, which: Index): boolean => {
  const held = comparing(was, now)
  const answered = held.indexes.get(which)
  if (answered !== undefined) return answered
  const same = sameIndex(
    was[which] as ReadonlyMap<string, unknown>,
    now[which] as ReadonlyMap<string, unknown>,
  )
  held.indexes.set(which, same)
  return same
}

/**
 * Whether one of the LISTS says what it said — memoised beside the indexes and
 * for a sharper version of their reason.
 *
 * {@link Derived.nodes} is one array per record in the directory, so an answer
 * that walks the corpus and is re-validated per revision per question would pay
 * the corpus again per question. It is also the reading a patched view builds
 * LAZILY, so asking it here can be the thing that builds it — exactly right
 * when a tape asked for it, and a corpus-sized allocation for nothing on a tape
 * that did not, which is why this runs only for the lists a tape names.
 */
const carriedList = (was: Derived, now: Derived, which: keyof typeof LISTS): boolean => {
  const held = comparing(was, now)
  const answered = held.lists.get(which)
  if (answered !== undefined) return answered
  const same = carried(was[which], now[which])
  held.lists.set(which, same)
  return same
}

/** The pair's row, minted on first ask — {@link comparedIndexes}' one writer. */
const comparing = (was: Derived, now: Derived): Carried => {
  const held = comparedIndexes.get(was)
  if (held !== undefined && held.against === now) return held
  const fresh: Carried = { against: now, indexes: new Map(), lists: new Map() }
  comparedIndexes.set(was, fresh)
  return fresh
}

const sameIndex = (
  was: ReadonlyMap<string, unknown>,
  now: ReadonlyMap<string, unknown>,
): boolean => {
  if (was === now) return true
  if (was.size !== now.size) return false
  const walk = now[Symbol.iterator]()
  for (const [key, held] of was) {
    const other = walk.next()
    if (other.done === true) return false
    if (other.value[0] !== key) return false
    if (!carried(held, other.value[1])) return false
  }
  return true
}

/** The set half of {@link Carried}, memoised the same way and for the same
 *  reason: every open page reads the served files, and they are one directory. */
interface CarriedSet {
  readonly against: OutlineSet
  readonly documents: boolean
  readonly broken: boolean
}

const comparedSets = new WeakMap<OutlineSet, CarriedSet>()

/**
 * Whether the served files and the broken ones say what they said.
 *
 * NEITHER ARRAY IS CARRIED — `assemble` builds both per revision — so identity
 * would answer `false` every time and this check would be the whole feature
 * turned off. What IS carried is the ELEMENTS: a file nothing touched decodes
 * to the object it already decoded to, because the store re-reads only what
 * moved. So the comparison is element identity, with one fallback:
 *
 * THE FACE'S OWN EQUIVALENCE for an element that moved, which is the honest
 * comparison rather than a lenient one. Every reader of this array takes a
 * `ReadonlyArray<Face>` — that is the type the format hands the page and the
 * narrowing — so what a reader can possibly have read is a `Face`'s fields, and
 * the schema's equivalence is exactly that question asked in full. A document
 * whose BODY changed and whose face did not is a file whose name, links, tags
 * and properties are where they were, and no page reading is a function of the
 * bytes underneath.
 */
const carriedSet = (was: OutlineSet, now: OutlineSet): CarriedSet => {
  const held = comparedSets.get(was)
  if (held !== undefined && held.against === now) return held
  const fresh: CarriedSet = {
    against: now,
    documents: sameFaces(was.documents, now.documents),
    broken: sameBroken(was.broken, now.broken),
  }
  comparedSets.set(was, fresh)
  return fresh
}

const sameFace: (a: Face, b: Face) => boolean = Schema.toEquivalence(Face)

const sameFaces = (was: ReadonlyArray<Face>, now: ReadonlyArray<Face>): boolean => {
  if (was === now) return true
  if (was.length !== now.length) return false
  return was.every((one, at) => one === now[at] || sameFace(one, now[at] as Face))
}

/** The broken files, compared for the reason above and by the same rule. They
 *  are usually none at all, which is what makes this the cheapest of the three
 *  and the one that never needs an equivalence: a broken file's entry is minted
 *  where the file is decoded, so an untouched one is the object it was. */
const sameBroken = (
  was: ReadonlyArray<BrokenFile>,
  now: ReadonlyArray<BrokenFile>,
): boolean => {
  if (was === now) return true
  if (was.length !== now.length) return false
  return was.every((one, at) => one === now[at])
}
