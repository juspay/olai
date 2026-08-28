/**
 * The view PATCHED rather than rebuilt: one file's records swapped for
 * another's, and only what actually depended on them computed again.
 *
 * {@link ./derive.ts}'s `derive` answers everything about a set from scratch,
 * and it is what a keystroke used to cost — the whole corpus walked, indexed,
 * resolved and ordered so that one title could change. This is the same answer
 * reached the other way: the previous {@link Derived}, plus what moved, gives
 * the next one. The dirty set for a title edit is one record, so the cost is
 * what the edit touched rather than what the directory holds
 * (`https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/model-indices.md`, direction C).
 *
 * THE ORACLE IS THE SPEC, and it is not a figure of speech: for any set and any
 * delta, `patch(derive(before), delta)` must be the view `derive(after)` is,
 * and `./patch.test.ts` is a property test over generated corpora and generated
 * deltas that says so. Nothing here is allowed to be a second reading of the
 * format — every rule this file needs it imports from the module that owns it
 * (sibling order, the naming fold, mirror resolution, blockedness), and what it
 * adds is only WHICH of them to run again.
 *
 * IT MAY DECLINE. A case this patcher cannot answer cheaply and exactly — a
 * duplicate id, a delta that leaves nothing of the old view standing — falls
 * back to a full `derive`, which is always right. Correctness by the oracle,
 * speed by the common case: the alternative is a patcher that guesses at the
 * hard corners, and a wrong view is worse than a slow one.
 *
 * COPY ON WRITE, because revisions must stay atomic ({@link Derived}'s own
 * note: the nodes travel WITH their indexes so nobody can mix two revisions).
 * A patch returns a NEW `Derived`; nothing it is handed is written to, and
 * every array or set inside one it changes is rebuilt, so the view a reader is
 * already holding never moves under them. What is not touched is shared, which
 * is the whole economy of the thing.
 *
 * AND THE COPY IS A LAYER WHERE THE READERS ALLOW ONE. Every index used to be
 * CLONED for that — eleven `new Map`s per patch, one entry copied per key in
 * the directory, which is a copy-on-write that costs what the directory holds
 * inside a function whose whole claim is that it costs what the edit touched.
 * Seven of them are LAYERED now ({@link ./overlay.ts}): the entries this edit
 * changed and the keys it dropped, over the map the last patch left standing.
 * Same answers, same size, same key order, same everything a reader can ask —
 * and the old view goes on being answered by the map it was given, which is the
 * property the clone was for.
 *
 * WHICH SEVEN IS DECIDED BY THE INDEX'S READERS AND NOTHING ELSE, and every one
 * of the eleven says which it is at the call ({@link ./overlay.ts}'s `Read`).
 * An index asked BY KEY — `byId.get(id)`, `status.get(id)`, the four others
 * every drawn row spends — pays a layer one small lookup on the way past and
 * saves the corpus. An index read WHOLE — `namedBy` by the validator,
 * `taggedBy` by tag completion, `byDay` by the agenda and the calendar,
 * `byFile` by whoever wants the corpus flat — would pay that lookup once per
 * entry on every walk, which costs more than the clone it saved, so those four
 * stay clones. `./patch.bench.ts` prints both halves of that trade.
 *
 * AND THE CORPUS IS NOT FLATTENED HERE AT ALL. {@link Derived.nodes} is
 * {@link Derived.byFile} read the other way — the same records, never a second
 * copy — and a patch that BUILT it paid one array per record in the directory
 * for a reading none of its own work asks for. The view this hands back builds
 * it when somebody asks and not before, which on a keystroke is never: the two
 * index steps that can want it decline to patch first, and the validator above
 * spends it once where it used to flatten the set a second time to check this
 * one against ({@link ./validate.ts}'s `isSet`).
 *
 * AND A TOUCHED KEY IS SPLICED, NOT REBUILT. Every step above is bounded by
 * what the edit touched, and one line used not to be: a key an edit reached was
 * copied whole and sorted again, so typing in any file that mentions `#kitchen`
 * re-sorted every `#kitchen` record in the directory. What a key costs now is
 * the members the touched files take out of it and a binary search per member
 * they put back ({@link spliced}), which is the same bound as everything else
 * here — and it is bought with the order the indexes already promise, so it is
 * the derivation's own answer reached without asking for it twice.
 *
 * WHAT IT ASSUMES ABOUT ITS INPUT, said out loud because it is not checked: the
 * view it is handed is one of an ASSEMBLED set — files in path order, records
 * in line order within a file ({@link ./set.ts}'s `assemble`) — and the records
 * an upsert carries are that file's own. That is the order every published set
 * has, and the order this answers in; a view derived from some other order is
 * not wrong here, it is simply not the set this describes. THE INDEXES ARE THE
 * SAME ASSUMPTION one level on, and the splice is what spends it: a key's
 * members are in the order that index promises them in, and its day tallies are
 * its day buckets counted.
 */

import {
  blockageAt,
  byCorpus,
  byLine,
  byOrd,
  derive,
  type Derived,
  type Filing,
  type Index,
  follow,
  type InTheWay,
  nameInto,
  type Naming,
  byDayKey,
  nodeNamed,
  owingOn,
  parentInto,
  READ,
  tagInto,
} from "./derive.ts"
import {
  isMirror,
  type Located,
  type LocatedRegular,
  type Status,
  storedMarker,
} from "./node.ts"
import { type Dated, dateInto } from "./occasion.ts"
import { type Editable, overlay } from "./overlay.ts"
import { byPath } from "./paths.ts"

/**
 * One file's records, as the delta carries them.
 *
 * Structural, and deliberately the SMALLEST reading of the wire's own entry:
 * `@olai/surface`'s `OutlineEntry` carries a revision and a parse failure
 * beside its nodes, and satisfies this by having the field this needs. So the
 * frame a browser receives and the files a probe re-decoded are handed to one
 * function without either end repackaging anything — and this package, which is
 * the floor the wire spec stands on, still names nothing above it.
 */
export interface FileNodes {
  readonly nodes: ReadonlyArray<Located>
}

/**
 * What changed, in the one vocabulary this system already says it in: Surface's
 * collection-delta frame — `{upserts, removes}`, keyed by file.
 *
 * The server knows which files a probe tick moved and the browser is SENT that
 * same frame, so both ends call this patcher with one input type and nothing
 * new is invented for the occasion.
 *
 * The two lists are applied in order, removes first, then upserts in the order
 * they are written: a file named twice ends as the last word about it says. An
 * upsert carrying NO records leaves the file holding nothing, which is what
 * {@link Derived.byFile} spells as absence.
 */
export interface SetDelta {
  readonly upserts: ReadonlyArray<readonly [file: string, entry: FileNodes]>
  readonly removes: ReadonlyArray<string>
}

/**
 * The next view: patched where that is exact, rebuilt where it is not.
 *
 * The one function two callers use — the validator, which judges a write
 * against it, and (slice 4) the browser, which folds the frames it is already
 * receiving into the view it is already holding. A patcher written twice would
 * be the counterexample to `derive`'s own argument, which is that the validator
 * and the view share one interpretation of the format.
 */
export const patch = (derived: Derived, delta: SetDelta): Derived => {
  const grouped = regrouped(derived, delta)
  return patched(derived, delta, grouped) ?? derive(flattened(grouped.byFile))
}

/**
 * The INCREMENTAL answer, or `undefined` when this patcher declines to give
 * one — {@link patch} with the fallback taken off, so a test can tell the two
 * apart.
 *
 * A patcher that quietly rebuilt everything would satisfy the oracle perfectly
 * and buy nothing, and there would be no way to see it happening. This is how
 * the property test says "and it really was patched".
 */
export const patched = (
  derived: Derived,
  delta: SetDelta,
  grouped: Regrouped = regrouped(derived, delta),
): Derived | undefined => {
  const { byFile, touched } = grouped
  if (touched.size === 0) return derived

  // DUPLICATE IDS, and this is the whole of how they are told apart — see
  // {@link claimsAreUnique}, which is this line and the paragraph that argues
  // it, published because the incremental validator's duplicate-id rule is
  // that same fact read forwards.
  if (!claimsAreUnique(derived)) return undefined
  // Nothing of the old view is left to patch ONTO — a `git pull` that rewrote
  // the directory, a first load with nothing behind it, a one-file set whose
  // one file changed. Patching is about what stays standing, and when nothing
  // does, the work below is a rebuild with bookkeeping on top.
  if (!some(derived.byFile.keys(), (file) => !touched.has(file))) return undefined

  const edit: Edit = {
    before: derived,
    touched,
    outgoing: recordsIn(derived.byFile, touched),
    incoming: recordsIn(byFile, touched),
  }

  // The delta's own claims, checked against each other and against what stayed
  // standing. With the old view duplicate-free and the survivors untouched,
  // this is the whole proof that the new one is duplicate-free too.
  const claimed = new Set<string>()
  for (const at of edit.incoming) {
    const id = at.node.id
    if (claimed.has(id)) return undefined
    claimed.add(id)
    const held = derived.byId.get(id)
    if (held !== undefined && !touched.has(held.file)) return undefined
  }

  // THE CORPUS READ FLAT, when somebody asks and not before. It is
  // {@link Derived.nodes}, and it is {@link Derived.byFile} read the other way
  // — the same records, never a second copy of them — so a patch that BUILT it
  // paid one array per record in the directory for a reading none of the work
  // below ever asks for. Three things can want it: the two index steps that
  // decline to patch and rebuild instead, which a keystroke does not reach, and
  // a caller above.
  //
  // A CALLER ABOVE USUALLY DOES, and the saving is not that nobody asks. The
  // validator reads it once per write, for the five rules that walk the records
  // ({@link ./validate.ts}) — what it stopped doing is flattening the SET a
  // second time to check this view was about it. So a validated write builds
  // the list once where it built two and walked both, and a patch whose view
  // nobody reads flat builds none. Memoised, so asking twice is asking once.
  //
  // AND THOSE FIVE RULES WANT AN ARRAY rather than a walk of the grouping,
  // which {@link Derived.nodes} carries the measurement for: not building it at
  // all costs those readers more than building it costs this writer.
  let flat: ReadonlyArray<Located> | undefined
  const nodes = (): ReadonlyArray<Located> => (flat ??= flattened(byFile))

  // One step per index, in the order each needs the last: who claims which id,
  // what hangs under what, what names what, what everything resolves to, the
  // ordering graph, and what cannot start yet.
  const byId = ids(edit, nodes, claimed)
  const children = containment(edit)
  const namedBy = namings(edit, nodes)
  const taggedBy = taggings(edit)
  const journal = dating(edit)
  const { status, mirrorsOf, dirty } = resolutions(edit, byId)
  const { after, edgesTo, rewritten } = orderings(edit, { byId, mirrorsOf, namedBy }, dirty)
  const blocked = blockage(edit, { byId, status, after, edgesTo }, dirty, rewritten)

  return {
    get nodes() {
      return nodes()
    },
    byId,
    children,
    status,
    after,
    blocked,
    byFile,
    mirrorsOf,
    edgesTo,
    namedBy,
    taggedBy,
    ...journal,
  }
}

/**
 * ONE EDIT, from both sides: the view it is against, which files it named, and
 * the records those files held and hold now.
 *
 * The four travel together because every step below asks about all of them —
 * what a key kept is "what is left of it once the touched files are out", and
 * what it gains is "whatever arrived". Threading them one by one made each
 * signature a list of the same four things in a different order, which is the
 * shape a fifth would silently be left out of.
 */
interface Edit {
  readonly before: Derived
  readonly touched: ReadonlySet<string>
  /** What the touched files held, and what they hold now — in the delta's own
   *  order, which nothing reads: every index that promises an order sorts what
   *  it files. */
  readonly outgoing: ReadonlyArray<Located>
  readonly incoming: ReadonlyArray<Located>
}

/**
 * ONE REVERSE INDEX, RE-FILED across the edit — the shape four of the steps
 * below ARE, written once.
 *
 * `children`, `namedBy`, `taggedBy` and `byDay` are four different questions
 * about a corpus and ONE question about a patch. What a key keeps is whatever
 * of it is not in a TOUCHED FILE; what it gains is whatever arrived; the two
 * run together in the order that index promises its members in; and a key left
 * holding nothing GOES AWAY rather than standing empty where `derive` would
 * have had no key at all. That last line is the one another copy gets wrong —
 * the oracle compares what a map HOLDS and not only what it answers — and it
 * had been written out five times before the sixth arrived, which is the count
 * the house rule said would force this (`https://github.com/juspay/oss.olai/tree/master/olai/roadmap`).
 *
 * WHAT EACH INDEX STILL SAYS FOR ITSELF IS ITS FOLD, and it says it ONCE.
 * `derive` owns what a record files into an index — {@link parentInto},
 * {@link nameInto}, {@link tagInto}, {@link dateInto} — and this asks that one
 * function of BOTH SIDES of the edit: over what arrived to get the members, and
 * over what left to get the keys they held. So the patcher runs the rebuild's
 * own rule rather than a second reading of it, in the direction where a second
 * reading is easiest to write and hardest to see ({@link ./occasion.ts}'s
 * `dateInto` makes that argument for the index that first needed it). A caller
 * hands over one fold, not a pair of them free to disagree about which keys
 * this edit could have moved.
 *
 * THE ENTRY IS PROJECTED BACK OUT to a {@link Located} rather than required to
 * be one: three of the four hold a record and one holds a naming beside the
 * fields it names with. Both questions this asks of an entry are about its
 * PLACE — which file is it in, and where in the corpus does it sort — so one
 * projection answers both, and no index has to be reshaped to be re-filed.
 *
 * NOTHING TOUCHED, NOTHING CLONED. An edit naming no key of an index hands back
 * the map that stood, and the view being built shares it with the view it
 * patched — copy-on-write at the index rather than only at its values, which is
 * this file's own economy applied one level up. It is what a keystroke in an
 * outline that tags nothing and schedules nothing already paid for `taggedBy`
 * and `byDay` ({@link ./patch.bench.ts} prints what one clone of each index
 * costs), and now what a keystroke in an outline of plain rows pays for
 * `children` and `namedBy` too.
 */
interface Refiled<T> {
  readonly map: ReadonlyMap<string, ReadonlyArray<T>>
  /** Whether a key APPEARED or WENT AWAY, so a map that promises an order over
   *  its keys has to be sorted again — `byDay` is the one of the four that
   *  does, exactly as {@link regrouped} sorts `byFile`'s. */
  readonly rekeyed: boolean
  /** WHICH KEYS this edit could have moved — the arriving records' and the
   *  departing ones', which is every key of this index a file the delta named
   *  can have reached. Empty when the edit named none, in which case
   *  {@link Refiled.map} IS the map that stood.
   *
   *  Spent by ONE caller ({@link dating}): {@link Derived.owedByDay} is
   *  {@link Derived.byDay} counted, so the days whose counts can have changed
   *  are exactly the days whose buckets were re-filed — and collecting them a
   *  second time from the delta would be a second spelling of what a record
   *  puts on a day, which is the drift the shared fold exists to stop. */
  readonly keys: ReadonlySet<string>
  /** WHAT ARRIVED at each of those keys and WHAT LEFT them — the two folds this
   *  ran, handed on rather than thrown away.
   *
   *  Spent by the same one caller ({@link owing}), and for the reason
   *  {@link Refiled.keys} is: a day's tally is its members counted, so the
   *  DIFFERENCE between the two sides is the difference in the tally, and a
   *  step that asked the delta for it again would be a second spelling of what
   *  a record puts on a day. Both are empty when the edit named no key. */
  readonly arriving: ReadonlyMap<string, ReadonlyArray<T>>
  readonly departing: ReadonlyMap<string, ReadonlyArray<T>>
  /** Whether any key's FIRST member sits somewhere else now. A key sits where
   *  the record that opens it sits in a map a single walk of the corpus built,
   *  so this is what `namedBy` rebuilds for. Strictly wider than
   *  {@link rekeyed}: a key that appears or empties moved its head by
   *  definition. */
  readonly headMoved: boolean
}

const refiled = <K extends Listed, Filed extends Member<K> = Member<K>>(
  edit: Edit,
  index: K,
  filing: {
    /** What a record puts in this index — `derive`'s own fold, run here over
     *  both sides of the edit. `Filed` is what it files, which is the entry
     *  while it is still being built ({@link Filing} against {@link Naming})
     *  where an index has two spellings of one shape. */
    readonly into: (filed: Map<string, Array<Filed>>, at: Located) => void
    /** Where an entry IS — the file its survival is judged by, and the place it
     *  is ordered on. */
    readonly at: (one: Member<K>) => Located
    /**
     * The order this index promises its members in: corpus order for three of
     * the four, and the format's sibling order for `children`.
     *
     * A FIFTH INDEX REGISTERS ITS ORDER IN THE DIFFERENTIAL, and this is the
     * place that says so because it is the place its author is standing. What
     * {@link spliced} costs is bought with this comparator, and what proves the
     * splice is `./splice.test.ts` — but that harness names the indexes it
     * covers BY HAND (`casesFor`), while {@link Listed} is structural: a new
     * client of this function compiles in with no cases, no corner floors and
     * no mutation proof, and every assertion over there goes on passing while
     * saying nothing about it. So an index added here is added there, as its
     * `(at, order)` pair.
     *
     * AND WHAT THE PAIR HAS TO DECLARE IS ITS TIES. The splice places an
     * arriving member AFTER every member it compares equal to, which is what
     * the rebuild's stable sort did — and that rule decides nothing for the
     * four here, because each of their orders ends in {@link byCorpus} and a
     * tie there means one file and one line, while a survivor and an arrival
     * are never in one file. The differential asserts exactly that of every key
     * it is handed, so an order that CAN tie the two sides — one keyed on a day,
     * a name, a path alone — trips that assertion the moment its cases are
     * registered, and is a silent reordering if they never are.
     */
    readonly order?: (one: Located, other: Located) => number
  },
): Refiled<Member<K>> => {
  const { into, at, order = byCorpus } = filing
  const before = edit.before[index] as ReadonlyMap<string, ReadonlyArray<Member<K>>>
  const arriving = new Map<string, Array<Filed>>()
  for (const one of edit.incoming) into(arriving, one)
  // The DEPARTING side goes through the SAME fold, for its KEYS, and the
  // entries it files are thrown away. What a record puts in an index is one
  // rule, and a second spelling of it here to collect keys from would be
  // exactly the drift the folds are factored out to stop — and the price is
  // named rather than left to be discovered: a fold mints an entry per key it
  // touches where a bare key walk minted none, so collecting the departing keys
  // costs roughly twice what it did. It is bounded by the TOUCHED FILE's
  // records, never by the corpus, which is the only bound this file promises.
  const departing = new Map<string, Array<Filed>>()
  for (const one of edit.outgoing) into(departing, one)

  const keys = new Set<string>(arriving.keys())
  for (const key of departing.keys()) keys.add(key)
  if (keys.size === 0) {
    return { map: before, keys, arriving, departing, rekeyed: false, headMoved: false }
  }

  /** Where a key's members START, which is where the key itself sits in a map
   *  the corpus was walked once to build. */
  const head = (own: ReadonlyArray<Member<K>> | undefined): Located | undefined => {
    const first = own?.[0]
    return first === undefined ? undefined : at(first)
  }
  /** Wrapped ONCE, above the loop that spends it, for the reason {@link namedIn}
   *  is: this is handed to a splice per touched key, and a closure minted inside
   *  would be one throwaway per key rather than one per index. */
  const inOrder = (one: Member<K>, other: Member<K>): number => order(at(one), at(other))
  /** Which of a key's standing members this edit TAKES OUT: the ones in a file
   *  the delta named, whose records the arriving side is re-filing. Wrapped once
   *  for {@link inOrder}'s reason. */
  const departed = (one: Member<K>): boolean => edit.touched.has(at(one).file)

  const map = carrying(edit.before, index) as unknown as Editable<
    string,
    ReadonlyArray<Member<K>>
  >
  let rekeyed = false
  let headMoved = false
  for (const key of keys) {
    const held = before.get(key)
    // SPLICED into the list that stood rather than copied out of it and sorted
    // again — the one line this whole index step costs per touched key, and
    // {@link spliced} is where the promise it leans on is argued.
    const own = spliced(held ?? NOTHING, arriving.get(key) ?? NOTHING, departed, inOrder)
    // One true answer settles it, and three of the four callers never ask.
    if (!headMoved && elsewhere(head(held), head(own))) headMoved = true
    if (filedAt(map, key, own, own.length > 0)) rekeyed = true
  }
  return { map: map.sealed(), keys, arriving, departing, rekeyed, headMoved }
}

/**
 * ONE KEY'S MEMBERS ACROSS THE EDIT — spliced into the list that stood, never
 * copied out of it and sorted again.
 *
 * THE LIST IT IS HANDED IS ALREADY IN THE ORDER IT PROMISES, and that is a
 * promise this file is entitled to spend rather than a hope: corpus order is
 * what every reverse index here MEANS ({@link ./derive.ts}'s `byCorpus` says so
 * beside the indexes it orders), so it is what a rebuild leaves behind and what
 * the patch before this one handed on. So what an edit does to a key is a
 * SPLICE — the touched files' members leave from wherever they sat, the
 * arriving ones go in where the order puts them — and every other member of
 * that key is already where it belongs.
 *
 * WHAT IT REPLACES was a copy and a re-sort of the WHOLE key: `n log n`
 * comparisons over every member a key holds to move the two or three a
 * keystroke touched. `#kitchen` holds a member per record in the directory that
 * mentions it, and typing in any one of those files re-sorted all of them —
 * inside a function whose whole claim is that it costs what the edit touched
 * and not what the directory holds (`perf-key-resort`; the header's bound
 * covered the folds above this and not this line).
 *
 * WHAT IT COSTS INSTEAD is one pass over the members to take the departing ones
 * out, and a BINARY SEARCH per arriving one to find where it goes — `k log n`
 * comparisons of a comparator that compares two paths, where `k` is the touched
 * files' records. The ARRAY is still built entry by entry and that is not a cost
 * this can take off: the list a reader is already holding must not move under
 * them ({@link patched}'s copy-on-write), so a new revision needs a new array
 * whatever it is filled from. What it can take off is every comparison but the
 * ones the edit really needs.
 *
 * TIES ARE THE REBUILD'S TIES, which is what makes this exchangeable for it
 * rather than merely equal on the easy cases. `Array.prototype.sort` is stable,
 * and the rebuild sorted the survivors followed by the arrivals — so a survivor
 * came before an arrival it compares equal to, and equal arrivals stayed in the
 * order the fold filed them. Here an arrival is placed AFTER every member it
 * compares equal to ({@link placeFor}) and the arrivals are sorted among
 * themselves by the same stable sort, which is the same answer reached from the
 * other side. `./splice.test.ts` is the differential that holds the two arms to
 * it, with that rebuild standing as the reference arm.
 *
 * AND HALF OF THAT RULE IS NOT REACHABLE TODAY, which the differential found
 * out and is worth having written down: a survivor is in a file the delta did
 * not name and an arrival is in one it did, while every order these four
 * indexes use ties only INSIDE ONE FILE — so no real key can put an arrival
 * beside a member it cannot be told apart from, and the placement would answer
 * the same either way. It is written the rebuild's way regardless, and held to
 * the rebuild's way by a pair of keys that suite writes by hand over a
 * comparator that ties everything: an index filed under something coarser would
 * make this line load-bearing overnight, and what it would cause then is a
 * silent reordering rather than anything that fails.
 *
 * IT MAY HAND BACK WHAT IT WAS GIVEN — the list that stood, when the edit took
 * nothing out of this key and put nothing in it; the arrivals, when nothing of
 * the key survived. That is {@link refiled}'s own economy one level down, and it
 * is safe for the reason that one is: what this hands back is stored and never
 * written to, so a key nothing moved does not pay a copy of itself.
 *
 * EXPORTED FOR THE DIFFERENTIAL and for nothing else. What holds it to the
 * rebuild is a property test over generated keys and over the members a real
 * directory's indexes hold, and a differential that could not call this
 * function would have to keep a second copy of it to test.
 */
export const spliced = <T>(
  /** The key's members as the view that is being patched holds them — in
   *  `order`, which is the assumption above and is not checked. */
  held: ReadonlyArray<T>,
  /** What the touched files put under this key now, in whatever order the fold
   *  filed them, which is the delta's and is nobody's promise. */
  arriving: ReadonlyArray<T>,
  /** Whether a standing member is one the edit takes out. */
  left: (one: T) => boolean,
  order: (one: T, other: T) => number,
): ReadonlyArray<T> => {
  const kept = surviving(held, left)
  if (arriving.length === 0) return kept
  const coming = arriving.length > 1 ? [...arriving].sort(order) : arriving
  if (kept.length === 0) return coming
  const own: Array<T> = []
  let from = 0
  for (const one of coming) {
    const to = placeFor(kept, one, order, from)
    for (let at = from; at < to; at++) own.push(kept[at] as T)
    own.push(one)
    // The arrivals are in order, so their places are too: the next one cannot
    // go anywhere this one did not reach, and the search after it starts here.
    from = to
  }
  for (let at = from; at < kept.length; at++) own.push(kept[at] as T)
  return own
}

/** A key's members with the departing ones taken out, IN THE ORDER THEY WERE —
 *  which is the whole of why a removal needs no sort: taking members out of a
 *  sorted list leaves a sorted list.
 *
 *  Nothing is copied until something actually leaves, so a key that only GAINED
 *  members is handed its own list straight back and {@link spliced} splices into
 *  that. It is the case a growing tag is in on most edits. */
const surviving = <T>(held: ReadonlyArray<T>, left: (one: T) => boolean): ReadonlyArray<T> => {
  let gone = -1
  for (let at = 0; at < held.length; at++) {
    if (left(held[at] as T)) {
      gone = at
      break
    }
  }
  if (gone < 0) return held
  const kept = held.slice(0, gone)
  for (let at = gone + 1; at < held.length; at++) {
    const one = held[at] as T
    if (!left(one)) kept.push(one)
  }
  return kept
}

/**
 * WHERE AN ARRIVING MEMBER GOES: the first index of `within` that sorts AFTER
 * it, by binary search, at or past `from`.
 *
 * PAST THE EQUALS rather than before them, which is the rebuild's tie said out
 * loud ({@link spliced} argues it, and says why no key of these four indexes
 * can currently ask): the rebuild this stands in for sorted the survivors
 * followed by the arrivals with a stable sort, so an arrival sits after every
 * member it cannot be told apart from.
 *
 * `from` is what makes a key's arrivals cost `k log n` rather than `k` searches
 * of the whole list — they are sorted, so each one's place is at or past the
 * last one's. {@link ./derive.ts}'s `dayAt` is the same search over the day
 * line, and is not this one: that answers where a day WOULD go among strings,
 * this answers where a member goes among members.
 */
const placeFor = <T>(
  within: ReadonlyArray<T>,
  one: T,
  order: (a: T, b: T) => number,
  from: number,
): number => {
  let low = from
  let high = within.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (order(within[middle] as T, one) > 0) high = middle
    else low = middle + 1
  }
  return low
}

/**
 * A key holds what it has, or GOES AWAY when it has nothing — never an empty
 * list stored where `derive` would have had no key at all.
 *
 * It is the one line every re-filing in this file has to get right, and the
 * reason it is a function is that two of them do it: {@link refiled} above, for
 * the four reverse indexes, and {@link regrouped} below, for the map of files
 * the delta itself rewrites. The oracle compares what a map HOLDS and not only
 * what it answers, so an empty list left standing is a failure rather than a
 * harmless one — which is exactly the kind of rule that must not have two
 * spellings free to drift.
 *
 * WHAT IT ANSWERS is whether the KEY SET moved: a key that arrives is added and
 * one that empties goes away, while a key re-set keeps its place. That is the
 * whole of what a map whose keys are READ IN ORDER has to be sorted again for,
 * which is {@link inKeyOrder} next door.
 */
const filedAt = <V extends {}>(
  map: Editable<string, V>,
  key: string,
  own: V,
  /** Whether the key has anything at all — a LIST with members for the four
   *  re-filed indexes and for the grouping, a count above zero for the day's
   *  owed tally ({@link owing}). Asked at the call rather than of the value,
   *  because "nothing" is a different shape per index and the RULE — a key
   *  holding nothing goes away — is the same one, which is what this function
   *  is for. */
  holds: boolean,
): boolean => holds ? map.set(key, own) : map.delete(key)

/**
 * A map whose KEYS are read in an order, put back in it — and only when the key
 * set moved, which is the economy of the thing: a key that was already there
 * kept its place when it was re-set, so an edit that neither added nor emptied
 * one is already in the order a sort would leave it in.
 *
 * Two maps here promise an order over their keys for a reason that is not the
 * corpus's — `byFile` by path ({@link regrouped}) and `byDay` by day
 * ({@link dating}) — and each was spelling this line for itself.
 */
const inKeyOrder = <V>(
  map: ReadonlyMap<string, V>,
  moved: boolean,
  order: (one: string, other: string) => number,
): ReadonlyMap<string, V> =>
  moved ? new Map([...map].sort(([one], [other]) => order(one, other))) : map

/** The answer for a key that is left holding nothing: ONE list, shared —
 *  `derive`'s own `NO_TAGS` move, for the removes {@link regrouped} files. */
const NOTHING: ReadonlyArray<never> = []

/**
 * What hangs under what — {@link Derived.children} across the edit.
 *
 * `parent` is same-file by the format, so a file's records ARE its children
 * keys — but a set the validator has condemned can say otherwise, and this runs
 * over those too. So a key is rebuilt from what is left of it plus what
 * arrived, never from an assumption about where its members live, which is
 * {@link refiled}'s rule and the reason this is a call rather than a loop.
 *
 * Nothing reads these keys in order and nothing here has a shape to rebuild, so
 * this is the one of the four that spends neither axis.
 *
 * It is also the one of the four that is LAYERED rather than cloned, and for
 * the reason that decides all eleven: what asks this index asks it for a key —
 * `children.get(id)`, per row a page draws, per parent a rollup counts — and
 * nothing in the tree walks it whole. Its three neighbours below are each
 * walked entry by entry somewhere, so each stays a map.
 */
const containment = (
  edit: Edit,
): ReadonlyMap<string, ReadonlyArray<Located>> =>
  refiled(edit, "children", {
    into: parentInto,
    at: (one) => one,
    order: bySibling,
  }).map

/** The delta applied to the grouping — the one part of the answer that is the
 *  same whether this is patched or rebuilt, so it is computed once and handed
 *  to whichever runs.
 *
 *  It used to carry the FLAT LIST beside the grouping, built here so that both
 *  arms had it. Neither arm needs it: the rebuild flattens what it is given
 *  ({@link flattened}) and the patch hands the reading on unbuilt, so what was
 *  a corpus-sized allocation on every write is now one the writer never makes. */
interface Regrouped {
  readonly byFile: ReadonlyMap<string, ReadonlyArray<Located>>
  /** Every file the delta named, whether it gained records, lost them or went
   *  away — the one question every step below asks about a record's file. */
  readonly touched: ReadonlySet<string>
}

const regrouped = (derived: Derived, delta: SetDelta): Regrouped => {
  const byFile = carrying(derived, "byFile")
  const touched = touchedBy(delta)
  // Whether the KEY SET moved, and therefore whether the map's own order has to
  // be made again: a file that was already there keeps its place when it is
  // re-set, and one that arrives is appended — which for a path that sorts
  // first would put the corpus in an order no assembly produces.
  let reordered = false
  // A file that GOES AWAY and a file upserted holding NOTHING are one case, and
  // {@link filedAt} is where they become one: absence is how {@link
  // Derived.byFile} spells an empty file, so a remove and an empty upsert are
  // the same word said twice.
  for (const file of delta.removes) {
    if (filedAt(byFile, file, NOTHING, false)) reordered = true
  }
  for (const [file, entry] of delta.upserts) {
    // Sorted rather than trusted, exactly as `derive` sorts the same list: the
    // promise is about what the index MEANS — the records in the order they are
    // on disk — and not about the order a frame happened to carry them in.
    const own = [...entry.nodes].sort(byLine)
    if (filedAt(byFile, file, own, own.length > 0)) reordered = true
  }
  // WALKED WHOLE, and this is the index every whole-corpus reading goes
  // through — {@link flattened} below, tag completion's file walk, the pin
  // shelf's. It is also the smallest of the eleven per record it accounts for:
  // one entry per FILE against one per record, so the clone it pays is a
  // thousandth of the corpus rather than the whole of it. Both halves of that
  // were MEASURED before this stayed a clone rather than after: the clone and
  // the flat read together are 0.174ms on the bench vault, and a layer and the
  // same read through it are 0.241ms — the walk costs more than the copy it
  // saves, which is {@link ./overlay.ts}'s sealing rule arriving at the one
  // index where the two are close enough to have to be timed.
  const ordered = inKeyOrder(byFile.sealed(), reordered, byPath)
  return { byFile: ordered, touched }
}

/**
 * The corpus read FLAT — {@link Derived.nodes} — from the grouping that holds
 * it.
 *
 * Not a second copy of the records and never was ({@link Derived.byFile} says
 * so from the other side): the same objects, run together in the order every
 * assembled set is in, which is path order across files and line order within
 * one. It is a function rather than something a patch keeps because a patch
 * that keeps it pays one array per record in the directory for a reading its
 * own work never asks — {@link patched} spends this at most once, and on a
 * keystroke not at all.
 */
const flattened = (
  byFile: ReadonlyMap<string, ReadonlyArray<Located>>,
): ReadonlyArray<Located> => [...byFile.values()].flat()

/** How many records the corpus holds, without building the list of them. */
const countIn = (byFile: ReadonlyMap<string, ReadonlyArray<Located>>): number => {
  let held = 0
  for (const own of byFile.values()) held += own.length
  return held
}

/**
 * ONE OF THE VIEW'S INDEXES, OPENED FOR WRITING across this edit — the map and
 * the word that decides how it is carried, read off ONE key.
 *
 * The table says how each index is read ({@link ./derive.ts}'s `READ`) and
 * {@link ./overlay.ts} takes that word at the call that makes the writer, so
 * every one of the eleven steps below would otherwise spell the same name
 * twice — `overlay(edit.before.status, READ.status)` — with nothing stopping
 * the two halves naming different indexes. Here they cannot: there is one name.
 */
const carrying = <K extends Index>(
  before: Derived,
  index: K,
): Editable<string, Values<K>> =>
  overlay(before[index] as unknown as ReadonlyMap<string, Values<K>>, READ[index])

/**
 * What an index of {@link Derived} holds per key.
 *
 * IT RESOLVES TO `never` FOR A VALUE THAT COULD BE `undefined`, which is the
 * whole reason this is not `V & {}`. {@link ./overlay.ts} reads `undefined` as
 * "the layer does not hold this key", and says its `V extends {}` is
 * load-bearing rather than decorative — so an index whose values could be
 * `undefined` must not be able to reach {@link carrying} at all. Intersecting
 * the guard on would have STRIPPED that case instead of refusing it, and the
 * symptom would be a key answering with the map underneath's stale value.
 */
type Values<K extends Index> = Derived[K] extends ReadonlyMap<string, infer V>
  ? undefined extends V ? never : V
  : never

/** The indexes that hold a LIST per key, which is what {@link refiled} re-files
 *  — derived from {@link Derived} rather than listed, so it is one more thing
 *  the shape says instead of a comment. */
type Listed = { [K in Index]: Values<K> extends ReadonlyArray<unknown> ? K : never }[Index]

/** One member of such a list — what a key of that index holds one of. */
type Member<K extends Listed> = Values<K> extends ReadonlyArray<infer E> ? E : never

/**
 * WHETHER EVERY ID IS CLAIMED ONCE — the gate {@link patched} opens on, and the
 * whole of the duplicate-id rule's answer over a view that got through it.
 *
 * `byId` keeps the first claim, so one entry per record is exactly "nobody
 * claimed an id twice". An index that had to REMEMBER the losers so a deletion
 * could promote one is the tax the design doc names, and it is not paid here: a
 * corpus with a duplicate in it is a corpus the validator refuses anyway, so
 * the patcher hands those back to `derive` rather than growing a shape for
 * them.
 *
 * ASKED OF THE GROUPING rather than of the flat list beside it, which is the
 * same number and is in hand: reading `derived.nodes` here would force a view's
 * flat list into existence for a length, which is exactly the corpus-sized
 * allocation a patch exists not to make. So this is `O(files)`, which is why
 * {@link ../incremental.ts} can afford to ask it again rather than take the
 * patcher's word for it.
 */
export const claimsAreUnique = (derived: Derived): boolean =>
  derived.byId.size === countIn(derived.byFile)

/** Every file a delta NAMED, whether it gained records, lost them or went away
 *  — the one question {@link regrouped} and the incremental validator both ask
 *  of a delta, so it is one function rather than two loops that agree today. */
export const touchedBy = (delta: SetDelta): ReadonlySet<string> => {
  const touched = new Set<string>()
  for (const file of delta.removes) touched.add(file)
  for (const [file] of delta.upserts) touched.add(file)
  return touched
}

/** The records of every named file, run together. Exported for the incremental
 *  validator, which asks it of both sides of an edit — the records the touched
 *  files gave up and the ones they brought in. */
export const recordsIn = (
  byFile: ReadonlyMap<string, ReadonlyArray<Located>>,
  files: ReadonlySet<string>,
): ReadonlyArray<Located> => {
  const found: Array<Located> = []
  for (const file of files) found.push(...(byFile.get(file) ?? []))
  return found
}

/** Whether any member answers — a walk that stops at the first one, where a
 *  spread would have built an array of every path in the directory to ask an
 *  existence question about one. */
const some = <T>(over: Iterable<T>, asked: (one: T) => boolean): boolean => {
  for (const one of over) if (asked(one)) return true
  return false
}

/** Whether two records are at different places in the corpus — including the
 *  case where one of them is not there at all. A place rather than a record,
 *  because a rewritten file hands back records that are equal to the ones it
 *  replaced and never the same objects. */
const elsewhere = (one: Located | undefined, other: Located | undefined): boolean =>
  one?.file !== other?.file || one?.line !== other?.line

/**
 * Sibling order, with the tie `derive` leaves to its input made explicit.
 *
 * {@link byOrd} is the format's own order and this is not a second one: what it
 * adds is the last tie-break, which `derive` gets for free from a stable sort
 * over a corpus-ordered list and a patcher — merging records that arrive from
 * two directions — has to say. Two records with the same `ord` on the same line
 * are in different files by definition, and corpus order is where the rebuilt
 * view puts them.
 *
 * Exported for the differential, which holds {@link spliced} to the rebuild it
 * replaced over every key of all four indexes ({@link ./splice.test.ts}).
 * {@link ./derive.ts} exports {@link byCorpus} to this file in the same words
 * and for the same reason: a harness that spelled the comparator itself would
 * be a second opinion about the tie, and the tie is the one thing the splice
 * has to say out loud that the rebuild got from a stable sort.
 */
export const bySibling = (a: Located, b: Located): number => byOrd(a, b) || byCorpus(a, b)

/** What an id NAMES in a view — {@link Derived.after}'s own canonicalisation,
 *  asked of one side of the edit or the other. It is why an edge in a file the
 *  delta never named can move when a mirror somewhere else changes.
 *
 *  The index the walk reads is wrapped ONCE, outside the returned function:
 *  this is asked per target of every changed record and per key of every
 *  disturbed edge, and a `{byId}` minted inside would be one throwaway object
 *  per question. */
const namedIn = (
  byId: ReadonlyMap<string, Located>,
): ((id: string) => string) => {
  const view = { byId }
  return (id) => nodeNamed(view, id)?.node.id ?? id
}

/**
 * Who claims which id now.
 *
 * REBUILT when a key could have changed PLACES, patched when none could, and
 * the difference is about order rather than about cost. A `Map` re-set at a key
 * keeps that key's place, but a deleted one loses it and an added one goes to
 * the end — and this map is READ IN ORDER, by the did-you-mean behind every
 * unknown-target error ({@link ./suggest.ts} walks `byId.keys()` and promises
 * that ties go to the first candidate offered, so that two readings of one set
 * suggest the same id). A patch that reordered it would be the same bytes on
 * disk suggesting a different id depending on how the reader got there.
 *
 * WHICH IS NOT THE SAME QUESTION AS "did the id set change", and that was the
 * bug grok found on review: a key sits where the record that claims it sits, so
 * the ids can be exactly the ones they were and the ORDER still move — two
 * lines swapped inside one file, or a node moved to a file further down the
 * corpus with nothing minted or dropped, which is what an archive or a
 * cross-file move is. Both kept the old order and both were returned rather
 * than declined. So the test is about PLACES: an id whose claim now sits at a
 * different `file:line` than the record that held it, or an id nothing claims
 * any more. Arriving ids are the same test — nothing held them, so they are
 * elsewhere by definition.
 *
 * A keystroke moves no record's place (a rewritten file re-emits the same
 * records on the same lines), so the rebuild is what a structural edit costs
 * and not what typing does.
 */
const ids = (
  edit: Edit,
  nodes: () => ReadonlyArray<Located>,
  claimed: ReadonlySet<string>,
): ReadonlyMap<string, Located> => {
  const left = edit.outgoing.some((at) => !claimed.has(at.node.id))
  const moved = edit.incoming.some((at) => elsewhere(edit.before.byId.get(at.node.id), at))
  if (left || moved) {
    const byId = new Map<string, Located>()
    for (const at of nodes()) if (!byId.has(at.node.id)) byId.set(at.node.id, at)
    return byId
  }
  // A LAYER over the map that stood, rather than a clone of it: with no key
  // added, moved or dropped, what this edit changed is a value per arriving
  // record, and the other twenty thousand are the map's own answers still
  // ({@link ./overlay.ts}, which is where the trade is argued and measured).
  const byId = carrying(edit.before, "byId")
  for (const at of edit.incoming) byId.set(at.node.id, at)
  return byId.sealed()
}

/**
 * What names what, raw — {@link Derived.namedBy} carried across the edit.
 *
 * Rebuilt when the key ORDER moved, for {@link ids}' reason and one of its own:
 * the validator walks this map to report every id nothing declares
 * ({@link ./validate.ts}'s `checkTargets`), and two findings at one site with
 * one code come out in the order the corpus first named those ids. A patched
 * map that had appended a key would reorder that pair — the same file, two
 * reports, in an order that depended on history rather than on the file.
 *
 * A key sits where the record that FIRST names it sits, so the question is not
 * whether the key set moved but whether any first namer did — a key can keep
 * its members and still change places when the record at the head of its list
 * is replaced by one further down the corpus. Every key this edit could move is
 * a key it touched, so checking those is checking all of them. It is
 * {@link refiled}'s `headMoved`, and this is the only one of the four indexes
 * that spends it: the re-filing is the same rule next door and what differs is
 * what each promises about its keys.
 */
const namings = (
  edit: Edit,
  nodes: () => ReadonlyArray<Located>,
): ReadonlyMap<string, ReadonlyArray<Naming>> => {
  const { map, headMoved } = refiled(edit, "namedBy", {
    into: nameInto,
    at: (naming) => naming.at,
  })
  // A key that MOVED — including one that appeared and one that went away,
  // both of which move a head by definition — is a key-order change, and this
  // is the index that has to answer in the order one walk of the corpus would
  // have left. So the walk is taken, over the same fold, and the re-filed map
  // is what the edit cost to find that out.
  if (!headMoved) return map
  const namedBy = new Map<string, Array<Filing>>()
  for (const at of nodes()) nameInto(namedBy, at)
  return namedBy
}

/**
 * What prose tagged what — {@link Derived.taggedBy} carried across the edit.
 *
 * The same {@link refiled} call as {@link namings} above with the rebuild taken
 * OFF, and the missing half is the whole difference between the two indexes:
 * nothing reads these keys in order, so a key that arrives at the end of the map
 * or leaves a hole in it changes no answer, and there is nothing to rebuild the
 * map to preserve. What IS promised is each key's members in corpus order,
 * which is what the shared sort keeps.
 *
 * Every key this edit can move is a key it TOUCHED — a tag the arriving records
 * write, or one the departing records wrote — because a record in a file the
 * delta never named cannot have changed its prose.
 */
const taggings = (edit: Edit): ReadonlyMap<string, ReadonlyArray<LocatedRegular>> =>
  // NOTHING WROTE A TAG, and {@link refiled} is where that is answered: with no
  // key on either side the map that stood IS the answer and no clone is paid at
  // all. It fires on a file whose records tag nothing — rarer since this index
  // gained `#`, which is the sigil people actually write, and the reason the
  // clone's cost is a number this branch had to measure rather than assume
  // ({@link ./patch.bench.ts}).
  refiled(edit, "taggedBy", {
    into: tagInto,
    at: (one) => one,
  }).map

/**
 * What lands on what day — {@link Derived.byDay} carried across the edit.
 *
 * {@link taggings} above with a key ORDER to keep — {@link refiled}'s `rekeyed`
 * — which is the whole of the difference: nothing reads a tag's keys in order,
 * and three readings spend this index's ({@link Derived.byDay}). So a day the
 * edit ADDS or EMPTIES re-sorts the keys, exactly as {@link regrouped} re-sorts
 * `byFile`'s when a file arrives or goes away — and the edits that neither add
 * nor empty a day, which is nearly all of them, move members inside keys that
 * are already in place and pay nothing for the promise.
 *
 * Every day this edit can move is a day it TOUCHED — one the arriving records
 * land on, or one the departing records were on — because a record in a file the
 * delta never named cannot have changed its dates.
 *
 * BOTH SIDES GO THROUGH {@link dateInto} — {@link refiled} runs it over what
 * arrived and over what left — and this is the index whose fold made that the
 * rule for all four: what a record puts on a day is ONE rule (a mirror files
 * nothing, what was put away files nothing, two fields and not three), and a
 * second spelling of it to collect keys from would be exactly the drift the
 * fold is factored out to stop.
 */
const dating = (edit: Edit): Journal => {
  // NOTHING ON EITHER SIDE CARRIED A DATE, and {@link refiled} answers that the
  // same way it does next door: the map that stood IS the answer and no clone
  // is paid at all — a keystroke in an outline nobody scheduled anything in,
  // which is most outlines.
  const moved = refiled(edit, "byDay", {
    into: dateInto,
    at: (one) => one.at,
  })
  // Whether the KEYS moved is the only thing that costs the sort. A day that
  // gains or loses a record is not that; a day that appears or empties is.
  const byDay = inKeyOrder(moved.map, moved.rekeyed, byDayKey)
  return {
    byDay,
    owedByDay: owing(edit, moved),
    // THE DAY LINE IS THE KEYS, so it is remade exactly when they moved — the
    // same one edit in many that pays for the sort above, and never a keystroke
    // in a scheduled outline that merely retitled a row. Carried by REFERENCE
    // otherwise: the array a reader was handed is the array the next view has,
    // which is what `byDay` itself gets from {@link refiled} one line up.
    days: moved.rekeyed ? [...byDay.keys()] : edit.before.days,
  }
}

/** {@link Derived.byDay} and the two readings carried BESIDE it, which one step
 *  answers because they are one question: what the edit did to the journal. */
interface Journal {
  readonly byDay: ReadonlyMap<string, ReadonlyArray<Dated>>
  readonly owedByDay: ReadonlyMap<string, number>
  readonly days: ReadonlyArray<string>
}

/**
 * How much each day OWES — {@link Derived.owedByDay} carried across the edit.
 *
 * COUNTED OUT OF WHAT MOVED, never out of the bucket. A day's tally is
 * {@link owingOn} of that day's members, and the members that changed are the
 * ones {@link refiled} took out and put in — so the tally moves by exactly
 * `owingOn(arrived) - owingOn(left)`, and the survivors, which are all the rest
 * of the day, are counted by the number the last view already carried. It is
 * {@link spliced}'s discipline said about a COUNT rather than a list, and the
 * same cost it takes off: a busy day is one a decade of habit has put a hundred
 * records on, and recounting it because a keystroke landed on one of them is
 * the corpus paid for what the edit touched (`perf-key-resort`).
 *
 * IT IS THE ONE STEP HERE THAT SPENDS AN INDEX'S OWN PROMISE ABOUT ANOTHER, and
 * it is said out loud because it is not checked: `owedByDay` IS `byDay` counted
 * (`./derive.ts` builds them in one walk and this file keeps them together), so
 * a view whose two disagreed would have this carry the disagreement forward
 * rather than recount its way out of it. That is the same class of assumption
 * as the corpus order {@link spliced} leans on, and the same thing holds both:
 * the oracle compares the whole view, both indexes in it.
 *
 * ITS OWN KEY SET, and therefore its own sort. A day drops out of THIS index
 * the moment its last unfinished task is finished, while the day itself stays
 * in `byDay` holding the `done` that finished it — so `rekeyed` next door is
 * the wrong question and this asks its own.
 *
 * AND NOTHING IS OPENED UNTIL A TALLY ACTUALLY MOVES, which is the difference
 * between "the edit touched a day" and "the edit changed what a day owes".
 * Those are not the same edit and the second is much the rarer: retitling a row
 * in an outline that holds scheduled work re-files every day that outline is
 * on, and none of their tallies is any different afterwards. This index is read
 * WHOLE, so opening it is a clone — of the days that owe something, which on a
 * vault with a decade of habit behind it is the interesting number — and an
 * edit that recounts its way back to the same answers pays none of it and hands
 * on the map that stood.
 */
const owing = (
  edit: Edit,
  moved: Pick<Refiled<Dated>, "keys" | "arriving" | "departing">,
): ReadonlyMap<string, number> => {
  const { keys, arriving, departing } = moved
  // NO DAY TOUCHED, so no tally can have moved: the map that stood is the
  // answer, uncloned and handed straight on — {@link refiled}'s own economy, and
  // the reason this step asks it for the keys rather than for a flag.
  if (keys.size === 0) return edit.before.owedByDay
  const before = edit.before.owedByDay
  let map: Editable<string, number> | undefined
  let rekeyed = false
  for (const key of keys) {
    // ABSENCE IS ZERO on both sides, which is what makes the comparison below
    // the whole answer: a day that owed nothing and owes nothing has no key
    // here either way, so there is nothing to write and nothing to delete.
    const held = before.get(key) ?? 0
    const owed = held - owingOn(departing.get(key) ?? NOTHING) +
      owingOn(arriving.get(key) ?? NOTHING)
    if (owed === held) continue
    map ??= carrying(edit.before, "owedByDay")
    // A NEGATIVE TALLY IS THIS STEP'S ONE NEW FAILURE SHAPE, and it is named
    // rather than guarded (pi, on this PR). The recount this replaced could not
    // go below zero by construction — it counted a list — while a DIFFERENCE
    // can, if the carried tally and the day's members ever disagree about what
    // that day owes, and `owed > 0` would then file the day as owing nothing
    // rather than as wrong. It cannot happen over a view this file's own
    // assumption holds for (the header: the tallies ARE the buckets counted),
    // and what would catch it is the oracle rather than a throw here — a
    // patcher that threw on a keystroke is a worse answer than a patcher that
    // declines, and this step has no decline to give.
    if (filedAt(map, key, owed, owed > 0)) rekeyed = true
  }
  return map === undefined ? before : inKeyOrder(map.sealed(), rekeyed, byDayKey)
}

/**
 * What every record RESOLVES TO, recomputed for the records that could have
 * moved — {@link Derived.status} and {@link Derived.mirrorsOf}, which `derive`
 * builds in one walk and this rebuilds over one dirty set.
 *
 * THE DIRTY SET IS A CLOSURE, and {@link Derived.namedBy} is what makes it
 * findable. A mirror shows whatever its chain ends at, so a record that changed
 * disturbs every mirror whose chain passes THROUGH it — a mirror of a mirror of
 * the edited node, in a file this delta never mentioned. `mirrorsOf` answers
 * the same question one hop too late: it files a chain under the node it ENDS
 * at, so a chain that has stopped ending there is filed where the answer no
 * longer is. The raw index is filed by what records SAY, which is one hop of
 * the mirror graph read backwards, and walking it to a fixed point is the whole
 * of "what did this reach" — including the two cases the canonical index cannot
 * hold: a chain that dangled and now resolves, and one that closed a loop and
 * now does not.
 */
const resolutions = (
  edit: Edit,
  byId: ReadonlyMap<string, Located>,
): {
  readonly status: ReadonlyMap<string, Status>
  readonly mirrorsOf: ReadonlyMap<string, ReadonlySet<string>>
  readonly dirty: ReadonlySet<string>
} => {
  /** One hop backwards, in the OLD graph and in what the delta brought: a
   *  record that points AT this id with `mirror`. The union of the two is a
   *  superset of what really moved, and a superset only costs recomputation. */
  const arriving = new Map<string, Array<string>>()
  for (const at of edit.incoming) {
    if (!isMirror(at.node)) continue
    const shown = arriving.get(at.node.mirror)
    if (shown === undefined) arriving.set(at.node.mirror, [at.node.id])
    else shown.push(at.node.id)
  }

  const dirty = new Set<string>()
  const pending: Array<string> = []
  const wake = (id: string): void => {
    if (dirty.has(id)) return
    dirty.add(id)
    pending.push(id)
  }
  for (const at of edit.outgoing) wake(at.node.id)
  for (const at of edit.incoming) wake(at.node.id)
  while (pending.length > 0) {
    const id = pending.pop() as string
    for (const naming of edit.before.namedBy.get(id) ?? []) {
      if (naming.fields.includes("mirror")) wake(naming.at.node.id)
    }
    for (const mirror of arriving.get(id) ?? []) wake(mirror)
  }

  const status = carrying(edit.before, "status")
  const mirrorsOf = carrying(edit.before, "mirrorsOf")
  /** The keys of `mirrorsOf` a dirty mirror left or joined — every one of them
   *  has to be made again, and no other one has moved. */
  const shown = new Set<string>()
  /** Which dirty mirrors land where NOW, collected on the way past so the
   *  rebuild below is a lookup rather than a second walk of the dirty set per
   *  key. */
  const landing = new Map<string, Array<Located>>()
  const before = { byId: edit.before.byId }
  // Wrapped once for the same reason `before` is, and it was not: this walk is
  // one pass per dirty record.
  const now = { byId }
  for (const id of dirty) {
    // Unfiled from where it WAS before it is filed where it is: the two are
    // different keys exactly when the chain moved, which is the case this
    // whole walk exists for.
    const was = edit.before.byId.get(id)
    if (was !== undefined && isMirror(was.node)) {
      const found = follow(before, was)
      if (found.kind === "found") shown.add(found.shows.node.id)
    }
    const at = byId.get(id)
    const found = at === undefined ? undefined : follow(now, at)
    const mark = found?.kind === "found" ? storedMarker(found.shows.node) : undefined
    // Set rather than deleted-and-set where there is still a mark, so a key
    // whose value did not change keeps its place in the map.
    if (mark === undefined) status.delete(id)
    else status.set(id, mark)
    if (at === undefined || !isMirror(at.node) || found?.kind !== "found") continue
    shown.add(found.shows.node.id)
    const others = landing.get(found.shows.node.id)
    if (others === undefined) landing.set(found.shows.node.id, [at])
    else others.push(at)
  }

  // Each of those keys made again from its members: a set REBUILT rather than
  // added to, because it is shared with the view a reader is still holding, and
  // because its members are in corpus order — which an insertion at the end
  // would say nothing about.
  for (const id of shown) {
    const members = [
      ...[...(mirrorsOf.get(id) ?? [])]
        .filter((mirror) => !dirty.has(mirror))
        .map((mirror) => byId.get(mirror) as Located),
      ...(landing.get(id) ?? []),
    ].sort(byCorpus)
    if (members.length === 0) mirrorsOf.delete(id)
    else mirrorsOf.set(id, new Set(members.map((at) => at.node.id)))
  }

  return { status: status.sealed(), mirrorsOf: mirrorsOf.sealed(), dirty }
}

/**
 * The ordering graph across the edit — {@link Derived.after} and
 * {@link Derived.edgesTo}, both made again for the keys the edit disturbed.
 *
 * A key is rebuilt from its CONTRIBUTORS rather than adjusted, because the two
 * readings of an edge are ordered promises and an adjustment cannot keep them:
 * a node's own `after` in the order it writes them, then whatever `blocks` it
 * from elsewhere in corpus order. Who contributes to a key is a lookup rather
 * than a scan — the record that IS the key, and whatever named the key or any
 * mirror standing at it — which is what the two reverse indexes are for.
 *
 * IT IS THE ONE RULE THIS FILE RE-SPELLS, and {@link ./derive.ts}'s `orderings`
 * says so from the other side. One pass over every record and one pass per
 * disturbed key are different loops over the same rule, and neither can be
 * written as the other without paying the corpus. What holds them together is
 * the oracle: the property test compares both maps whole, so a change to that
 * walk which this one does not follow fails rather than drifts.
 */
const orderings = (
  edit: Edit,
  view: {
    readonly byId: ReadonlyMap<string, Located>
    readonly mirrorsOf: ReadonlyMap<string, ReadonlySet<string>>
    readonly namedBy: ReadonlyMap<string, ReadonlyArray<Naming>>
  },
  dirty: ReadonlySet<string>,
): {
  readonly after: ReadonlyMap<string, ReadonlyArray<string>>
  readonly edgesTo: ReadonlyMap<string, ReadonlySet<string>>
  /** The keys this made again — what blockedness has to be asked about next,
   *  handed over rather than found again by comparing two maps, which is the
   *  corpus-sized walk this whole file exists to stop doing. */
  readonly rewritten: ReadonlySet<string>
} => {
  const { byId, mirrorsOf, namedBy } = view
  const namedBefore = namedIn(edit.before.byId)
  const namedNow = namedIn(byId)

  const keys = new Set<string>()
  // A record that changed re-writes the key it IS, and moves whatever its own
  // fields land on — on both sides of the edit, since an edge that left has to
  // be taken off the key it used to be filed under.
  for (const at of [...edit.outgoing, ...edit.incoming]) {
    if (isMirror(at.node)) continue
    keys.add(at.node.id)
    for (const target of [...(at.node.after ?? []), ...(at.node.blocks ?? [])]) {
      keys.add(namedBefore(target))
      keys.add(namedNow(target))
    }
  }
  // An id that MEANS something else now moves every edge written AT it, in
  // whatever file wrote it: the source's own list changes, and the key its
  // `blocks` lands on changes with it. A mirror chain that moved is why `after`
  // is canonical at all, and this is where that is paid for.
  for (const id of dirty) {
    if (namedBefore(id) === namedNow(id)) continue
    keys.add(namedBefore(id))
    keys.add(namedNow(id))
    for (
      const naming of [...(edit.before.namedBy.get(id) ?? []), ...(namedBy.get(id) ?? [])]
    ) {
      if (naming.fields.includes("after") || naming.fields.includes("blocks")) {
        keys.add(naming.at.node.id)
      }
    }
  }

  /** Every record that names this key with `field` — through the key itself,
   *  and through every mirror standing at it, which is the same
   *  canonicalisation `after` is written in. A key that names something ELSE is
   *  a mirror with a chain that resolves, and nothing is ever filed under one:
   *  the edge belongs to the node at the end of it. */
  const contributors = (
    key: string,
    field: "after" | "blocks",
  ): ReadonlyArray<Located> => {
    const found: Array<Located> = []
    const written = [...(mirrorsOf.get(key) ?? [])]
    if (namedNow(key) === key) written.push(key)
    for (const id of written) {
      for (const naming of namedBy.get(id) ?? []) {
        if (naming.fields.includes(field) && !found.includes(naming.at)) found.push(naming.at)
      }
    }
    return found.sort(byCorpus)
  }

  const after = carrying(edit.before, "after")
  const edgesTo = carrying(edit.before, "edgesTo")
  for (const key of keys) {
    const own = byId.get(key)
    const mine = own === undefined || isMirror(own.node) ? undefined : own.node
    const waits: Array<string> = []
    for (const target of mine?.after ?? []) {
      const to = namedNow(target)
      if (!waits.includes(to)) waits.push(to)
    }
    for (const at of contributors(key, "blocks")) {
      if (!waits.includes(at.node.id)) waits.push(at.node.id)
    }
    if (waits.length === 0) after.delete(key)
    else after.set(key, waits)

    const sources = new Set(contributors(key, "after").map((at) => at.node.id))
    for (const target of mine?.blocks ?? []) sources.add(namedNow(target))
    if (sources.size === 0) edgesTo.delete(key)
    else edgesTo.set(key, sources)
  }

  return { after: after.sealed(), edgesTo: edgesTo.sealed(), rewritten: keys }
}

/**
 * What cannot start yet, for the nodes an edit could have changed the answer
 * for — {@link Derived.blocked} across the patch.
 *
 * TWO WAYS a key gets here, and they are the two ends of an arrow. Its own
 * edges moved, which is every key {@link orderings} rewrote. Or something it
 * was waiting on changed its mark, was archived or went away — and who was
 * waiting on THAT is the question {@link Derived.edgesTo} exists to answer as a
 * lookup rather than a walk of the corpus.
 */
const blockage = (
  edit: Edit,
  view: Pick<Derived, "byId" | "status" | "after" | "edgesTo">,
  dirty: ReadonlySet<string>,
  rewritten: ReadonlySet<string>,
): ReadonlyMap<string, ReadonlyArray<InTheWay>> => {
  const keys = new Set<string>(rewritten)
  for (const id of dirty) {
    keys.add(id)
    for (const source of edit.before.edgesTo.get(id) ?? []) keys.add(source)
    for (const source of view.edgesTo.get(id) ?? []) keys.add(source)
  }

  const blocked = carrying(edit.before, "blocked")
  for (const key of keys) {
    blocked.delete(key)
    const found = blockageAt(view, key)
    if (found !== undefined) blocked.set(found.at, found.waiting)
  }
  return blocked.sealed()
}
