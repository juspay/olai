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
 * A patch returns a NEW `Derived`; every map it changes is cloned first and
 * every array or set inside one it changes is rebuilt, so the view a reader is
 * already holding never moves under them. What is not touched is shared, which
 * is the whole economy of the thing.
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
  byLine,
  byOrd,
  derive,
  type Derived,
  type Filing,
  follow,
  type InTheWay,
  nameInto,
  type Naming,
  nodeNamed,
  storedMarker,
} from "./derive.ts"
import { isMirror, type Located, type Status, targetsOf } from "./node.ts"

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
  return patched(derived, delta, grouped) ?? derive(grouped.nodes)
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
  const { byFile, nodes, touched } = grouped
  if (touched.size === 0) return derived

  // DUPLICATE IDS, and this is the whole of how they are told apart: `byId`
  // keeps the first claim, so one entry per record is exactly "nobody claimed
  // an id twice". An index that had to REMEMBER the losers so a deletion could
  // promote one is the tax the design doc names, and it is not paid here: a
  // corpus with a duplicate in it is a corpus the validator refuses anyway, so
  // the patcher hands those back to `derive` rather than growing a shape for
  // them.
  if (derived.byId.size !== derived.nodes.length) return undefined
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

  // One step per index, in the order each needs the last: who claims which id,
  // what hangs under what, what names what, what everything resolves to, the
  // ordering graph, and what cannot start yet.
  const byId = ids(edit, nodes, claimed)
  const children = containment(edit)
  const namedBy = namings(edit, nodes)
  const { status, mirrorsOf, dirty } = resolutions(edit, byId)
  const { after, edgesTo, rewritten } = orderings(edit, { byId, mirrorsOf, namedBy }, dirty)
  const blocked = blockage(edit, { byId, status, after, edgesTo }, dirty, rewritten)

  return { nodes, byId, children, status, after, blocked, byFile, mirrorsOf, edgesTo, namedBy }
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
 * What hangs under what — {@link Derived.children} across the edit.
 *
 * `parent` is same-file by the format, so a file's records ARE its children
 * keys — but a set the validator has condemned can say otherwise, and this runs
 * over those too. So a key is rebuilt from what is left of it plus what
 * arrived, never from an assumption about where its members live.
 */
const containment = (
  edit: Edit,
): ReadonlyMap<string, ReadonlyArray<Located>> => {
  const children = new Map(edit.before.children)
  const arriving = Map.groupBy(
    edit.incoming.filter((at) => at.node.parent !== undefined),
    (at) => at.node.parent as string,
  )
  const parents = new Set<string>(arriving.keys())
  for (const at of edit.outgoing) {
    if (at.node.parent !== undefined) parents.add(at.node.parent)
  }
  for (const key of parents) {
    const own = [
      ...(edit.before.children.get(key) ?? []).filter((at) => !edit.touched.has(at.file)),
      ...(arriving.get(key) ?? []),
    ].sort(bySibling)
    if (own.length === 0) children.delete(key)
    else children.set(key, own)
  }
  return children
}

/** The delta applied to the grouping, and the flat list that falls out of it —
 *  the one part of the answer that is the same whether this is patched or
 *  rebuilt, so it is computed once and handed to whichever runs. */
interface Regrouped {
  readonly byFile: ReadonlyMap<string, ReadonlyArray<Located>>
  readonly nodes: ReadonlyArray<Located>
  /** Every file the delta named, whether it gained records, lost them or went
   *  away — the one question every step below asks about a record's file. */
  readonly touched: ReadonlySet<string>
}

const regrouped = (derived: Derived, delta: SetDelta): Regrouped => {
  const byFile = new Map(derived.byFile)
  const touched = new Set<string>()
  // Whether the KEY SET moved, and therefore whether the map's own order has to
  // be made again: a file that was already there keeps its place when it is
  // re-set, and one that arrives is appended — which for a path that sorts
  // first would put the corpus in an order no assembly produces.
  let reordered = false
  for (const file of delta.removes) {
    touched.add(file)
    if (byFile.delete(file)) reordered = true
  }
  for (const [file, entry] of delta.upserts) {
    touched.add(file)
    // Sorted rather than trusted, exactly as `derive` sorts the same list: the
    // promise is about what the index MEANS — the records in the order they are
    // on disk — and not about the order a frame happened to carry them in.
    const own = [...entry.nodes].sort(byLine)
    if (own.length === 0) reordered = byFile.delete(file) || reordered
    else {
      if (!byFile.has(file)) reordered = true
      byFile.set(file, own)
    }
  }
  const ordered = reordered
    ? new Map([...byFile].sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0)))
    : byFile
  return { byFile: ordered, nodes: [...ordered.values()].flat(), touched }
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

/** Corpus order, as a comparator: which file, then which line. The order
 *  `assemble` puts a set in, and the order every index below files its members
 *  in — spelled once here because three of them promise it. */
const byCorpus = (a: Located, b: Located): number =>
  a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1

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
 *  delta never named can move when a mirror somewhere else changes. */
const namedIn = (
  byId: ReadonlyMap<string, Located>,
): ((id: string) => string) => (id) => nodeNamed({ byId }, id)?.node.id ?? id

/**
 * Who claims which id now.
 *
 * REBUILT when the id set moved, patched when it did not, and the difference is
 * about ORDER rather than about cost: a `Map` re-set at a key keeps that key's
 * place, but a deleted one loses it and an added one goes to the end — and this
 * map is READ IN ORDER, by the did-you-mean behind every unknown-target error
 * ({@link ./suggest.ts} walks `byId.keys()`). A patch that reordered it would
 * be the same file suggesting a different id depending on how the reader got
 * there, which is exactly the kind of answer this project refuses to have two
 * of. A keystroke moves no ids, so the rebuild is what a creation costs and not
 * what typing does.
 */
const ids = (
  edit: Edit,
  nodes: ReadonlyArray<Located>,
  claimed: ReadonlySet<string>,
): ReadonlyMap<string, Located> => {
  const left = edit.outgoing.some((at) => !claimed.has(at.node.id))
  const arrived = edit.incoming.some((at) => !edit.before.byId.has(at.node.id))
  if (left || arrived) {
    const byId = new Map<string, Located>()
    for (const at of nodes) if (!byId.has(at.node.id)) byId.set(at.node.id, at)
    return byId
  }
  const byId = new Map(edit.before.byId)
  for (const at of edit.incoming) byId.set(at.node.id, at)
  return byId
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
 * a key it touched, so checking those is checking all of them.
 */
const namings = (
  edit: Edit,
  nodes: ReadonlyArray<Located>,
): ReadonlyMap<string, ReadonlyArray<Naming>> => {
  const arriving = new Map<string, Array<Filing>>()
  for (const at of edit.incoming) nameInto(arriving, at)

  const keys = new Set<string>(arriving.keys())
  for (const at of edit.outgoing) for (const [, target] of targetsOf(at.node)) keys.add(target)

  let shape = false
  const rewritten = new Map<string, ReadonlyArray<Naming>>()
  for (const key of keys) {
    const held = edit.before.namedBy.get(key)
    const own = [
      ...(held ?? []).filter((naming) => !edit.touched.has(naming.at.file)),
      ...(arriving.get(key) ?? []),
    ].sort((one, other) => byCorpus(one.at, other.at))
    if (elsewhere(held?.[0]?.at, own[0]?.at)) shape = true
    // A key with nothing left naming it is a key that goes away, which is a
    // key-order change and therefore a rebuild — never an empty list stored
    // where `derive` would have had no key at all.
    if (own.length > 0) rewritten.set(key, own)
  }
  if (shape) {
    const namedBy = new Map<string, Array<Filing>>()
    for (const at of nodes) nameInto(namedBy, at)
    return namedBy
  }
  const namedBy = new Map(edit.before.namedBy)
  for (const [key, own] of rewritten) namedBy.set(key, own)
  return namedBy
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

  const status = new Map(edit.before.status)
  const mirrorsOf = new Map(edit.before.mirrorsOf)
  /** The keys of `mirrorsOf` a dirty mirror left or joined — every one of them
   *  has to be made again, and no other one has moved. */
  const shown = new Set<string>()
  /** Which dirty mirrors land where NOW, collected on the way past so the
   *  rebuild below is a lookup rather than a second walk of the dirty set per
   *  key. */
  const landing = new Map<string, Array<Located>>()
  const before = { byId: edit.before.byId }
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
    const found = at === undefined ? undefined : follow({ byId }, at)
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

  return { status, mirrorsOf, dirty }
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

  const after = new Map(edit.before.after)
  const edgesTo = new Map(edit.before.edgesTo)
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

  return { after, edgesTo, rewritten: keys }
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

  const blocked = new Map(edit.before.blocked)
  for (const key of keys) {
    blocked.delete(key)
    const found = blockageAt(view, key)
    if (found !== undefined) blocked.set(found.at, found.waiting)
  }
  return blocked
}
