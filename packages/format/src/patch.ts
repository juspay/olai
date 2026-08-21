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
 * (`docs/brainstorming/model-indices.md`, direction C).
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
 * WHAT IT ASSUMES ABOUT ITS INPUT, said out loud because it is not checked: the
 * view it is handed is one of an ASSEMBLED set — files in path order, records
 * in line order within a file ({@link ./set.ts}'s `assemble`) — and the records
 * an upsert carries are that file's own. That is the order every published set
 * has, and the order this answers in; a view derived from some other order is
 * not wrong here, it is simply not the set this describes.
 */

import {
  blockageAt,
  byCorpus,
  byLine,
  byOrd,
  derive,
  type Derived,
  type Filing,
  follow,
  type InTheWay,
  nameInto,
  type Naming,
  byDayKey,
  nodeNamed,
  parentInto,
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
import { type Editable, overlay, type Read } from "./overlay.ts"
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

  // DUPLICATE IDS, and this is the whole of how they are told apart: `byId`
  // keeps the first claim, so one entry per record is exactly "nobody claimed
  // an id twice". An index that had to REMEMBER the losers so a deletion could
  // promote one is the tax the design doc names, and it is not paid here: a
  // corpus with a duplicate in it is a corpus the validator refuses anyway, so
  // the patcher hands those back to `derive` rather than growing a shape for
  // them.
  //
  // ASKED OF THE GROUPING rather than of the flat list beside it, which is the
  // same number and is in hand: reading `derived.nodes` here would be this
  // patch forcing the PREVIOUS one's flat list into existence for a length,
  // which is exactly the corpus-sized allocation the view below stopped making.
  if (derived.byId.size !== countIn(derived.byFile)) return undefined
  // Nothing of the old view is left to patch ONTO — a `git pull` that rewrote
  // the directory, a first load with nothing behind it, a one-file set whose
  // one file changed. Patching is about what stays standing, and when nothing
  // does, the work below is a rebuild with bookkeeping on top.
  if (![...derived.byFile.keys()].some((file) => !touched.has(file))) return undefined

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
  // paid one array per record in the directory for a reading its own work never
  // needs. Three things here can want it, and on a keystroke none of them does:
  // the two index steps that decline to patch and rebuild instead, and a caller
  // above. So it is a thunk, memoised, spent at most once per patch.
  let flat: ReadonlyArray<Located> | undefined
  const nodes = (): ReadonlyArray<Located> => (flat ??= flattened(byFile))

  // One step per index, in the order each needs the last: who claims which id,
  // what hangs under what, what names what, what everything resolves to, the
  // ordering graph, and what cannot start yet.
  const byId = ids(edit, nodes, claimed)
  const children = containment(edit)
  const namedBy = namings(edit, nodes)
  const taggedBy = taggings(edit)
  const byDay = dating(edit)
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
    byDay,
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
 * the house rule said would force this (`docs/roadmap/`).
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
  /** Whether any key's FIRST member sits somewhere else now. A key sits where
   *  the record that opens it sits in a map a single walk of the corpus built,
   *  so this is what `namedBy` rebuilds for. Strictly wider than
   *  {@link rekeyed}: a key that appears or empties moved its head by
   *  definition. */
  readonly headMoved: boolean
}

const refiled = <T, Filed extends T = T>(
  edit: Edit,
  before: ReadonlyMap<string, ReadonlyArray<T>>,
  filing: {
    /** What a record puts in this index — `derive`'s own fold, run here over
     *  both sides of the edit. `Filed` is what it files, which is the entry
     *  while it is still being built ({@link Filing} against {@link Naming})
     *  where an index has two spellings of one shape. */
    readonly into: (filed: Map<string, Array<Filed>>, at: Located) => void
    /** Where an entry IS — the file its survival is judged by, and the place it
     *  is ordered on. */
    readonly at: (one: T) => Located
    /** The order this index promises its members in: corpus order for three of
     *  the four, and the format's sibling order for `children`. */
    readonly order?: (one: Located, other: Located) => number
    /** How this index is READ, which is what decides whether it is layered or
     *  cloned across the edit ({@link ./overlay.ts}). It is a fact about the
     *  index's own readers, so it is stated by the caller that knows them. */
    readonly read: Read
  },
): Refiled<T> => {
  const { into, at, order = byCorpus, read } = filing
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
  if (keys.size === 0) return { map: before, rekeyed: false, headMoved: false }

  /** Where a key's members START, which is where the key itself sits in a map
   *  the corpus was walked once to build. */
  const head = (own: ReadonlyArray<T> | undefined): Located | undefined => {
    const first = own?.[0]
    return first === undefined ? undefined : at(first)
  }
  /** Wrapped ONCE, above the loop that spends it, for the reason {@link namedIn}
   *  is: this is handed to a sort per touched key, and a closure minted inside
   *  would be one throwaway per key rather than one per index. */
  const inOrder = (one: T, other: T): number => order(at(one), at(other))

  const map = overlay(before)
  let rekeyed = false
  let headMoved = false
  for (const key of keys) {
    const held = before.get(key)
    const own = [
      ...(held ?? []).filter((one) => !edit.touched.has(at(one).file)),
      ...(arriving.get(key) ?? []),
    ].sort(inOrder)
    // One true answer settles it, and three of the four callers never ask.
    if (!headMoved && elsewhere(head(held), head(own))) headMoved = true
    if (filedAt(map, key, own)) rekeyed = true
  }
  return { map: map.sealed(read), rekeyed, headMoved }
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
const filedAt = <V>(
  map: Editable<string, ReadonlyArray<V>>,
  key: string,
  own: ReadonlyArray<V>,
): boolean => {
  if (own.length === 0) return map.delete(key)
  const minted = !map.has(key)
  map.set(key, own)
  return minted
}

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
  refiled(edit, edit.before.children, {
    into: parentInto,
    at: (one) => one,
    order: bySibling,
    read: "by key",
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
  const byFile = overlay(derived.byFile)
  const touched = new Set<string>()
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
    touched.add(file)
    if (filedAt(byFile, file, NOTHING)) reordered = true
  }
  for (const [file, entry] of delta.upserts) {
    touched.add(file)
    // Sorted rather than trusted, exactly as `derive` sorts the same list: the
    // promise is about what the index MEANS — the records in the order they are
    // on disk — and not about the order a frame happened to carry them in.
    if (filedAt(byFile, file, [...entry.nodes].sort(byLine))) reordered = true
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
  const ordered = inKeyOrder(byFile.sealed("whole"), reordered, byPath)
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

/** The records of every named file, run together. */
const recordsIn = (
  byFile: ReadonlyMap<string, ReadonlyArray<Located>>,
  files: ReadonlySet<string>,
): ReadonlyArray<Located> => {
  const found: Array<Located> = []
  for (const file of files) found.push(...(byFile.get(file) ?? []))
  return found
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
 */
const bySibling = (a: Located, b: Located): number => byOrd(a, b) || byCorpus(a, b)

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
  // Read BY KEY — `byId.get(id)` is what every production caller asks, and the
  // one whole-index reader wants its keys, which a layer walks without a
  // lookup per entry (`./suggest.ts`'s did-you-mean).
  const byId = overlay(edit.before.byId)
  for (const at of edit.incoming) byId.set(at.node.id, at)
  return byId.sealed("by key")
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
  const { map, headMoved } = refiled(edit, edit.before.namedBy, {
    into: nameInto,
    at: (naming) => naming.at,
    // WALKED WHOLE, so it is cloned rather than layered: the validator reads
    // every entry of this map on every write ({@link ./validate.ts}'s
    // `checkTargets`), and a walk through a layer's generator costs more per
    // entry than the clone it would save.
    read: "whole",
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
  refiled(edit, edit.before.taggedBy, {
    into: tagInto,
    at: (one) => one,
    // WALKED WHOLE by tag completion, which reads every key and every member to
    // rank them (`./vocabulary.ts`) — {@link namings}' reason, one index over.
    read: "whole",
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
const dating = (edit: Edit): ReadonlyMap<string, ReadonlyArray<Dated>> => {
  // NOTHING ON EITHER SIDE CARRIED A DATE, and {@link refiled} answers that the
  // same way it does next door: the map that stood IS the answer and no clone
  // is paid at all — a keystroke in an outline nobody scheduled anything in,
  // which is most outlines.
  const { map, rekeyed } = refiled(edit, edit.before.byDay, {
    into: dateInto,
    at: (one) => one.at,
    // WALKED WHOLE by the agenda's two directions and the calendar's month
    // (`./dates.ts`, `./agenda.ts`), and by the sort below whenever a day
    // appeared or emptied — {@link namings}' reason again.
    read: "whole",
  })
  // Whether the KEYS moved is the only thing that costs the sort. A day that
  // gains or loses a record is not that; a day that appears or empties is.
  return inKeyOrder(map, rekeyed, byDayKey)
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

  // LAYERED, both of them, for the reason every by-key index here is: what asks
  // `status` asks it per row drawn and per edge judged, and `mirrorsOf` per node
  // a backlink walk situates — neither is walked whole anywhere in the tree.
  const status = overlay(edit.before.status)
  const mirrorsOf = overlay(edit.before.mirrorsOf)
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

  return { status: status.sealed("by key"), mirrorsOf: mirrorsOf.sealed("by key"), dirty }
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

  // LAYERED for {@link resolutions}' reason: both readings of the ordering graph
  // are asked per node — what is this waiting on, who is waiting on this — and
  // the validator's acyclicity check walks the RECORDS, not these maps.
  const after = overlay(edit.before.after)
  const edgesTo = overlay(edit.before.edgesTo)
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

  return {
    after: after.sealed("by key"),
    edgesTo: edgesTo.sealed("by key"),
    rewritten: keys,
  }
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

  // LAYERED, and it is the smallest of the six: nearly nothing is blocked, so
  // the map is short and what an edit writes to it is shorter. Asked per row a
  // page draws and per node a page zooms to, never walked.
  const blocked = overlay(edit.before.blocked)
  for (const key of keys) {
    blocked.delete(key)
    const found = blockageAt(view, key)
    if (found !== undefined) blocked.set(found.at, found.waiting)
  }
  return blocked.sealed("by key")
}
