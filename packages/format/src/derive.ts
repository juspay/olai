/**
 * Everything the format computes rather than stores.
 *
 * A title's `#tags`, the order of siblings, the subtree a mirror stands for,
 * how far along a parent's task children have got: none of it is on disk, all
 * of it is derived here, and it is derived ONCE. {@link derive} builds the
 * indexes; {@link rowsOf} turns them into the shape a reader sees. The
 * validator and the browser both call these — that is the point. A view that
 * rebuilt the tree itself would be a second interpretation of the format, free
 * to disagree with the one that decides whether the file is legal at all.
 *
 * STATUS IS NOT ONE OF THEM, and that is the whole of the 2026-08-11 decision.
 * A parent's status used to be computed from its children, which read outline
 * containment (notes under an item) as task decomposition (subtasks) and made
 * every parent-of-tasks a task by structure — the `open` default one level up,
 * with nobody having said so. A mark is a stored fact on the node that carries
 * it, leaf or parent, and the only thing children add up to here is
 * {@link progressOf}, which is an annotation and feeds nothing.
 *
 * Every walk is cycle-safe. The validator rejects a set whose parents or
 * mirrors close a loop, so these functions should never meet one — but they
 * also run against sets it has already condemned (a browser draws the outline
 * beside the errors), and a renderer that hangs is a worse way to learn about
 * a bug than a marked stub.
 *
 * {@link derive} IS THE ORACLE, since slice 3 of `model-indices`: a validation
 * that follows another one patches the previous view instead of building a new
 * one ({@link ./patch.ts}), and what says the two are the same value is a
 * property test over generated corpora and generated deltas. So this file is
 * still the definition of what a view of a set IS — the patcher is an
 * optimisation held to it, and every rule it needs it calls here rather than
 * spelling again.
 */

import { Schema } from "effect"

import {
  isArchived,
  isMirror,
  isRegular,
  type Located,
  type LocatedRegular,
  MARKS,
  type Node,
  type Status,
  type TargetField,
  targetsOf,
} from "./node.ts"
import { byPath } from "./paths.ts"

/** What a node's checkbox shows, re-exported rather than declared: it is one
 *  of `./node.ts`'s {@link MARKS}, and it lives beside that list because it is
 *  a fact about what a RECORD may carry. Here because every derivation below
 *  answers in it, and a consumer of a walk should not have to learn which
 *  module minted the word. */
export { Status } from "./node.ts"

/**
 * A set of nodes and everything computed from it.
 *
 * The nodes travel WITH their indexes rather than beside them. Two parameters
 * would let a caller pass one revision's nodes against another's indexes —
 * a live store, with two revisions in flight, makes a real possibility — and
 * the symptom would be a plausible tree rather than a failure.
 */
export interface Derived {
  readonly nodes: ReadonlyArray<Located>
  /** id → the record that claims it. FIRST claim wins, which is the same rule
   *  the validator's duplicate-id error uses: the second claim is the mistake,
   *  so the first is what every other reference means. */
  readonly byId: ReadonlyMap<string, Located>
  /** parent id → its children, in sibling order. */
  readonly children: ReadonlyMap<string, ReadonlyArray<Located>>
  /** id → the mark it stores, for the nodes that carry one — a mirror standing
   *  for whatever its target stores, since that is what it shows. PARTIAL over
   *  `nodes`, and that is the answer rather than a gap in it: a node missing
   *  from this map is a plain bullet, because nobody marked it. */
  readonly status: ReadonlyMap<string, Status>
  /** The node an edge holds up → the ids it must come after: the ORDERING
   *  graph, with `blocks` normalised into it. One graph, because two rules ask
   *  about the same edges — the validator's acyclicity check and the
   *  blockedness below — and a second normalisation of `blocks` would be a
   *  second graph free to disagree with the first.
   *
   *  IN TERMS OF NODES at both ends, mirrors resolved, so `x after b` and
   *  `a blocks m` are one edge when `m` is a mirror of `x` — and a loop that
   *  closes through a placement is a loop. An id nothing declares stays as
   *  written, because an unknown target is the validator's to name. */
  readonly after: ReadonlyMap<string, ReadonlyArray<string>>
  /** id → what is standing in its way. PARTIAL like `status`, and non-empty
   *  wherever it is present: absence is the answer for everything that can
   *  start, which is nearly every node. Keyed by the node itself, so a mirror
   *  asks this of what it SHOWS exactly as it asks for its status.
   *
   *  ORDERED, and promised so rather than left to fall out: a node's own
   *  `after` in the order it writes them, then whatever `blocks` it from
   *  elsewhere in file order. Every reader says them in that order — the label
   *  a row's mark carries, the tip beside it, the list on the node's page —
   *  and a promise is what keeps that from shuffling when an unrelated file
   *  gains an edge. */
  readonly blocked: ReadonlyMap<string, ReadonlyArray<InTheWay>>
  /**
   * file → the records written in it, in LINE order — the order they are on
   * disk, which is the order a writer re-emits them in.
   *
   * The set stays flat ({@link ./set.ts}); this is the same records read the
   * other way, not a second copy of them. It is here rather than in a helper
   * beside `Derived` because a grouping of one revision's nodes handed to a
   * reader holding another's is a plausible answer about the wrong corpus —
   * the same reason `nodes` travels with its indexes at all. Every question
   * that used to be a filter over the whole set — what does this outline hold,
   * which of its records are roots, what does a page draw — is a lookup here,
   * and asking it stopped costing the corpus.
   *
   * A file holding nothing is ABSENT rather than mapped to an empty list, and
   * so is a file that did not parse: which files EXIST is the set's answer
   * ({@link ./set.ts}'s `files`), never this map's, and `?? []` is how every
   * reader here already spells nothing.
   *
   * It DOES claim every by-file grouping in the tree, which it did not when it
   * shipped. Two of them — `publishedOf` in `@olai/server` and the pending walk
   * in `@olai/ops` — were parked here as staying, because each held an
   * `OutlineSet` and never derived, and reaching for this would have meant
   * building a whole derivation to group a corpus. Since slice 2 a snapshot
   * carries the derivation beside the set ({@link ./validate.ts}'s `Reading`),
   * so both hold one, both read this, and the reason they were parked for is
   * gone rather than outweighed.
   */
  readonly byFile: ReadonlyMap<string, ReadonlyArray<Located>>
  /**
   * node id → the mirrors STANDING FOR it: {@link follow} read backwards.
   *
   * CHAINS FOLLOWED, which is what makes it the reverse of that walk rather
   * than of the `mirror` field — a mirror of a mirror of `x` shows `x`, so `x`
   * is where it is filed, and the record in the middle collects nothing. A
   * chain that dangles or closes a loop shows no node and is filed nowhere,
   * exactly as {@link Derived.status} leaves it out.
   *
   * The question it answers is the one a scan answers today: what else does
   * this node's mark reach? A placement three files away shows a status it
   * does not store, and nothing but a walk of the whole set could find it.
   *
   * A SET, in corpus order, and the container is the promise: what asks this
   * wants to know WHICH records to look at again, and a record filed twice is
   * still one record to look at. `after` next door holds each target once too
   * (#203), but it stays an ARRAY because its order is a promise a reader
   * spends — the one blocker a row has room for is the first of that list —
   * while nothing reads these two in order. Membership is the whole answer
   * here, so the container says so.
   */
  readonly mirrorsOf: ReadonlyMap<string, ReadonlySet<string>>
  /**
   * id → the nodes whose ordering edges LAND on it: {@link Derived.after} read
   * backwards.
   *
   * In terms of nodes at both ends for the same reason `after` is, and by the
   * same act: the canonicalisation happens before either map gets a key, so
   * the forward reading and the reverse one cannot disagree about whether two
   * records mean one edge.
   *
   * What it answers is the half {@link Derived.blocked} cannot be asked: that
   * index says what a node is waiting on, and this says who was waiting on IT
   * — which is what has to be looked at again when its mark flips. A SET for
   * the reason {@link Derived.mirrorsOf} is one, in `after`'s own promised
   * order.
   */
  readonly edgesTo: ReadonlyMap<string, ReadonlySet<string>>
  /**
   * id → the records that NAME it, and the fields they name it with:
   * {@link targetsOf} read backwards, in corpus order.
   *
   * RAW, and that is the point of it being a third reverse index rather than a
   * reading of the two above. Those two are about MEANING — a mirror chain
   * followed to its end, `blocks` normalised into `after` — and they are what a
   * recomputation follows. This one is about what the records SAY, which is
   * what a refusal has to quote: an `after` naming a placement is named at the
   * placement, and `see` (which no derivation reads at all) is named here too.
   * Answering "does anything still point at this record" out of the canonical
   * maps would miss all three, and it is the question the ops layer asks before
   * it takes a record away.
   */
  readonly namedBy: ReadonlyMap<string, ReadonlyArray<Naming>>
  /**
   * A tag AS WRITTEN → the records that write it, in a title or a note, in
   * corpus order: {@link writtenTags} read backwards.
   *
   * BOTH SIGILS, ONE INDEX, and the key carries which: `@herbs` and `#herbs`
   * are two keys, never one. That is the format's own rule read backwards —
   * `#topic` and `@person` are two namespaces over one alphabet
   * ({@link titleTagRe}) — and it is what lets the two readers of this index
   * ask their own question of it without either one filtering for the other.
   * Backlinks want the `@` half ({@link ./backlinks.ts}); the browser's tag
   * completion wants the whole vocabulary and the sigil it was written with
   * (`web/src/client/complete/tags.ts`). Sigil-stripped keys would collide the
   * two namespaces and make both questions unanswerable from here.
   *
   * KEYED BY THE TAG rather than by a node, and that is the whole of why this
   * index can be patched at all. `@alice` and `@order` are the same thing to a
   * title; what makes the second a REFERENCE is that some record claims the id
   * `order`, which is a question about a different index and is asked at the
   * READ ({@link ./backlinks.ts}). Were existence asked here, minting a node
   * would have to walk every note in the directory to find the mentions that
   * had just become references, and dropping one would have to walk them again
   * — a corpus-wide pass per capture, inside an index whose whole claim is that
   * an edit costs what it touched.
   *
   * ONE ENTRY PER RECORD, so a node writing `@order` in its title and again in
   * its note is one entry rather than two — {@link Naming}'s rule next door,
   * kept for the same reader: what asks this wants to know WHICH records to
   * draw, and a record is one record however often it says the word. It is also
   * what makes the completion's count a count of NODES rather than of
   * occurrences, which is what that widget always claimed to say.
   *
   * A MIRROR IS NEVER IN IT — and that is in the TYPE rather than in this
   * sentence: a placement has no title and no note of its own, so it has no
   * prose to tag anything with, and a reader of this index should not have to
   * re-narrow what the fold already proved. ({@link Derived.namedBy} next door
   * stays `Located` because `mirror` IS one of the fields it files.)
   *
   * THE ARCHIVE IS IN IT, like every other index here: what is put away is left
   * out at the READ (both readers do, each in its own words), because an index
   * that knew about `Archive.olai` would be the format's storage rule wired
   * into a fold that is about what prose says.
   *
   * SOME KEYS CAN NEVER BECOME REFERENCES, and that is a decision rather than
   * an oversight. Every `#topic` is one, and so is `@work/olai`: a tag's
   * alphabet takes `/` so that `#work/olai` is one tag, and an id's
   * ({@link ID_SHAPE}) does not. They are left in: filtering by id SHAPE at the
   * fold would be this index knowing about ids, which is exactly what keying it
   * by the written tag exists to avoid — and since the completion asks this
   * index for the whole vocabulary, the keys that are nobody's id are half of
   * what it is FOR.
   *
   * NOTHING READS THE KEYS IN ORDER, unlike the three indexes above, and the
   * patcher spends exactly that — it adds and drops keys in place rather than
   * rebuilding the map to keep an order nobody promised. The VALUES are ordered
   * and promised so: a reader listing what refers to a node says them in the
   * order the directory holds them.
   */
  readonly taggedBy: ReadonlyMap<string, ReadonlyArray<LocatedRegular>>
}

/**
 * A record that names an id, and the fields it names it with — one entry per
 * RECORD, so a node naming the same id twice (`after` it and `see` it) is one
 * dependent with two fields rather than two dependents.
 *
 * The fields come in {@link targetsOf}'s declaration order, without repeats:
 * `after: ["b", "b"]` is one relation written twice, and a reader listing it
 * twice would be reporting the file's shape rather than what it means.
 *
 * `TargetField` rather than `string`, because the format owns that list and an
 * open type here would be a second, wider vocabulary for it — the same thing
 * {@link targetsOf} exists to stop one level down.
 */
export interface Naming {
  readonly at: Located
  readonly fields: ReadonlyArray<TargetField>
}

/**
 * One entry of {@link Derived.namedBy} while it is still being built — the
 * fields are pushed into as the record's own list is read, and the map is
 * handed out `ReadonlyArray` once the walk is over.
 */
export interface Filing {
  readonly at: Located
  readonly fields: Array<TargetField>
}

/**
 * One record's namings, filed into `namedBy` — the WHOLE of how that index is
 * built, in one place.
 *
 * Asked once per record, and nearly every record names nothing, which is why
 * {@link targetsOf} answers that with a shared empty list.
 *
 * A record naming one id with two fields is ONE dependent carrying both, and
 * the entry to add the second field to is the LAST one — entries are appended
 * as the walk reaches each record, so an entry already filed by the record in
 * hand can only be the one on the end. That is what makes the fold free: no
 * per-record scratch map, no search.
 *
 * It is a function rather than a loop body because a SECOND walk files records
 * into this index now — the patcher's, over the records one changed file
 * brought in ({@link ./patch.ts}) — and the folding rule above is exactly the
 * kind of thing two spellings drift on: one of them would go on filing a record
 * that names an id twice as two dependents, and the ops layer's refusals would
 * quote a file that says something else.
 */
export const nameInto = (
  namedBy: Map<string, Array<Filing>>,
  located: Located,
): void => {
  for (const [field, target] of targetsOf(located.node)) {
    const naming = namedBy.get(target)
    const held = naming?.[naming.length - 1]
    if (held?.at === located) {
      if (!held.fields.includes(field)) held.fields.push(field)
    } else if (naming === undefined) {
      namedBy.set(target, [{ at: located, fields: [field] }])
    } else {
      naming.push({ at: located, fields: [field] })
    }
  }
}

/**
 * Every tag this record WRITES, AS WRITTEN (`#topic`, `@person`), title first
 * and then the note, in the order it wrote them — {@link targetsOf}'s shape for
 * the prose half of a reference, and the whole of the vocabulary a set uses.
 *
 * THE SIGIL IS PART OF THE ANSWER ({@link tagText}), because it is part of what
 * was written: `@herbs` and `#herbs` are two tags in every reader of this
 * format, and a fold that dropped the sigil would hand its index two meanings
 * under one key. It is what {@link Derived.taggedBy} is keyed by.
 *
 * A record tagging nothing — which is most of them — allocates nothing, for
 * {@link targetsOf}'s own reason: this is asked of every node in the directory
 * to build a reverse index, and the guard is two `indexOf` per string. A mirror
 * has no prose at all and answers the same empty list.
 *
 * A NOTE IS READ AS TEXT, and that is a decision rather than an omission. The
 * note is markdown, and the browser that draws it declines to style a tag
 * inside a code span or a link (`web/src/client/markdown/tags.ts`) — but this
 * package is the floor the validator stands on and it holds no markdown
 * parser, so deciding what a reference IS out of one would put a parser under
 * the write gate. What the record SAYS is the honest answer here, and it is the
 * answer `filter.ts`'s tag facet already gives about the same text.
 *
 * WHERE THAT PARTS from the browser RUNS BOTH WAYS, and one inherited rule
 * decides every case: {@link titleTagRe} claims `@` only where a WORD STARTS.
 * A tight ```@herbs``` is a mention on neither side — an ACCIDENT of that rule
 * rather than knowledge, since a backtick does not open a word and nothing here
 * has to know what a code span is. A space inside that span, a fenced or
 * indented block (a newline opens a word), and a link's text are mentions here
 * and styled nowhere. And `*@herbs*` is the reverse: not a mention here, drawn
 * as a tag there, because the client walks into `em` and `strong`. So "the bias
 * is toward showing more" is NOT a safe thing to say, and the docs said a
 * narrower thing than the truth twice before `./backlinks.test.ts` pinned every
 * row of it (docs/format.md's References carries the table).
 */
export const writtenTags = (node: Node): ReadonlyArray<string> => {
  if (isMirror(node)) return NO_TAGS
  const title = writtenTagsIn(node.title)
  const note = node.desc === undefined ? NO_TAGS : writtenTagsIn(node.desc)
  // Three answers rather than one concat, and each shares a list the caller
  // does not own: most records say nothing at all, and of the ones that do,
  // most say it in one of the two places. Statements rather than a nested
  // ternary — the same three arms, read top to bottom.
  if (note.length === 0) return title
  if (title.length === 0) return note
  return [...title, ...note]
}

/** The answer for prose that tags nothing: ONE list, shared. */
const NO_TAGS: ReadonlyArray<string> = []

/**
 * The tags of one string, as written — {@link titleParts}, kept.
 *
 * THROUGH THAT WALK rather than through a second one over {@link titleTagRe},
 * which is what this was: where a tag starts and stops is one function's
 * answer, and a private loop here would be a fourth reader of that alphabet
 * spelling its own boundaries. The argument for the loop is that it allocates
 * neither the prose between the tags nor the written form (a match IS one);
 * measured over a 1,144-character note it was 23.0µs against 23.8µs, and
 * RE-MEASURED over the whole bench vault when this index gained the commoner
 * sigil — where the walk is the largest single cost in a rebuild and the case
 * for a private loop would have been strongest — it is 21.05ms against
 * 22.17ms. Five per cent, twice, because the cost is the regex and not the
 * parts. It is not worth a second reading of what a tag is.
 *
 * The cheap negative is {@link mayHoldTag}, which is the guard for a walk that
 * wants both sigils — and this one does, since the index behind it is the
 * whole of what prose tagged rather than one namespace of it.
 */
const writtenTagsIn = (text: string): ReadonlyArray<string> => {
  if (!mayHoldTag(text)) return NO_TAGS
  let found: Array<string> | undefined
  for (const part of titleParts(text)) {
    if (part.kind === "tag") (found ??= []).push(tagText(part))
  }
  return found ?? NO_TAGS
}

/**
 * One record's tags, filed into `taggedBy` — the whole of how that index is
 * built, in one place, for {@link nameInto}'s reason: the patcher runs this
 * same fold over the records one changed file brought in
 * ({@link ./patch.ts}), and a second spelling of the once-per-record rule is a
 * second spelling free to drift from this one.
 *
 * The entry to leave alone is the LAST one, exactly as next door: entries are
 * appended as the walk reaches each record, so an entry already filed by the
 * record in hand can only be the one on the end.
 */
export const tagInto = (
  taggedBy: Map<string, Array<LocatedRegular>>,
  located: Located,
): void => {
  // The narrowing the index's type promises, done once at the fold: a mirror
  // writes no prose, so this drops nothing that {@link writtenTags} would not
  // have answered empty for anyway.
  if (!isRegular(located)) return
  for (const tag of writtenTags(located.node)) {
    const held = taggedBy.get(tag)
    if (held === undefined) taggedBy.set(tag, [located])
    else if (held[held.length - 1] !== located) held.push(located)
  }
}

export const derive = (nodes: ReadonlyArray<Located>): Derived => {
  // `Map.groupBy` is the language's own group-by-key, and grouping by file is
  // exactly that — a hand-rolled accumulator here would be a second spelling
  // of a built-in (the same note #198 took). The three tables below are not
  // that shape: one keeps the FIRST claim rather than every one, one skips the
  // records with no key at all, one keys a record by every id it names and one
  // by every tag its prose writes — so they share one walk, since none of them
  // reads what another builds and splitting them is four passes to ask four
  // things about a record already in hand.
  const byFile = Map.groupBy(nodes, (located) => located.file)

  const byId = new Map<string, Located>()
  const children = new Map<string, Array<Located>>()
  const namedBy = new Map<string, Array<{ at: Located; fields: Array<TargetField> }>>()
  const taggedBy = new Map<string, Array<LocatedRegular>>()

  for (const located of nodes) {
    if (!byId.has(located.node.id)) byId.set(located.node.id, located)

    const parent = located.node.parent
    if (parent !== undefined) {
      const siblings = children.get(parent)
      if (siblings === undefined) children.set(parent, [located])
      else siblings.push(located)
    }

    nameInto(namedBy, located)
    tagInto(taggedBy, located)
  }

  // Sorted rather than trusted: a set assembled file by file already arrives
  // this way (and `Map.groupBy` keeps encounter order), but the promise is
  // about what the index MEANS — the records in the order they are on disk —
  // not about how the caller happened to build the list it handed over.
  for (const own of byFile.values()) own.sort(byLine)
  // `ord` is a fractional index over base62, so plain string comparison IS the
  // sort; file order breaks ties rather than leaving them to the engine.
  for (const siblings of children.values()) siblings.sort(byOrd)

  const { status, mirrorsOf } = resolutions(nodes, byId)
  const { after, edgesTo } = orderings(byId, nodes)
  return {
    nodes,
    byId,
    children,
    status,
    after,
    blocked: blockage(byId, status, after),
    byFile,
    mirrorsOf,
    edgesTo,
    namedBy,
    taggedBy,
  }
}

/** The order the records are on disk — {@link Derived.byFile}'s promise, and
 *  the only comparator here that is not about meaning. Exported for the
 *  patcher, which sorts ONE file's arriving records into the same promise
 *  rather than re-deciding what disk order is. */
export const byLine = (a: Located, b: Located): number => a.line - b.line

/**
 * CORPUS ORDER, as a comparator: which file ({@link byPath}), then which line.
 *
 * The order `assemble` puts a set in, and the order every reverse index here
 * promises its members in. It is one comparator rather than one per asker
 * because three of them promise that order — {@link Derived.namedBy},
 * {@link Derived.taggedBy} and the reading over both
 * ({@link ./backlinks.ts}) — and because reaching for the format's own path
 * order rather than comparing two strings is what makes a file and the
 * directory beside it come out where a rebuilt view puts them.
 *
 * Here rather than in {@link ./patch.ts}, where it was written: the patcher is
 * an optimisation held to this module's answers, so an order the INDEXES
 * promise belongs beside the indexes.
 */
export const byCorpus = (a: Located, b: Located): number =>
  a.file === b.file ? a.line - b.line : byPath(a.file, b.file)

/**
 * One file's records, in the order they are written.
 *
 * A WRITER's question, answered here because the answer is an index read now
 * rather than a filter: a write re-emits the whole file, so it needs the
 * records in the order they are on disk, which is exactly what
 * {@link Derived.byFile} promises. It moved out of `./write.ts` with its
 * argument — a flat list of every node in the directory used to be all it had
 * to work from, and a writer touching one outline walked the corpus for it.
 *
 * `Pick`, so a caller building one file's records has no reason to hold a
 * whole derivation — and so the day a patcher hands over a partial view, this
 * says which part of it it reads.
 */
export const nodesOf = (
  derived: Pick<Derived, "byFile">,
  file: string,
): ReadonlyArray<Located> => derived.byFile.get(file) ?? []

/**
 * Sibling order, as the format defines it: `ord` is a fractional index over
 * base62, so plain string comparison IS the sort, and file order breaks ties
 * rather than leaving them to the engine.
 *
 * Exported because a WRITER needs it too — placing a node among its siblings is
 * the same question a reader asks, and a second comparator would be a second
 * definition of sibling order free to disagree with the one the validator and
 * the view use.
 */
export const byOrd = (a: Located, b: Located): number =>
  a.node.ord === b.node.ord ? a.line - b.line : a.node.ord < b.node.ord ? -1 : 1

/**
 * The records that share a parent, in sibling order — or the roots of one file
 * when `parent` is absent.
 *
 * A MIRROR is a sibling here, even though it is never a counted child: it
 * occupies a place in the row, and this question is about places. That is the
 * difference from {@link countedChildren}, which is about obligations.
 */
export const siblingsOf = (
  derived: Derived,
  file: string,
  parent: string | undefined,
): ReadonlyArray<Located> =>
  parent === undefined
    // The file's own records, not the corpus: the roots of one outline used to
    // cost a walk of every node in the directory, and this is asked on every
    // draw, every structural edit and every undo. Through {@link nodesOf}
    // rather than the index directly, so "what does this outline hold" has one
    // spelling here and at the writers. `filter` hands back a fresh array, so
    // the sort never reorders the index itself.
    ? nodesOf(derived, file)
      .filter((located) => located.node.parent === undefined)
      .sort(byOrd)
    : (derived.children.get(parent) ?? []).filter((located) => located.file === file)

/** The children that count as a node's own. A mirror is a second view of a
 *  node, not a second obligation, so it never counts — which is what {@link
 *  progressOf} rolls up and what a reader listing "what is under this" means. */
const counted = (
  children: ReadonlyMap<string, ReadonlyArray<Located>>,
  id: string,
): ReadonlyArray<LocatedRegular> =>
  // The format own guard, so what comes back IS the regular records rather
  // than a list every caller has to assert about — and so that this and the
  // backlinks reading narrow through one predicate rather than two spellings
  // of it (`./node.ts`).
  (children.get(id) ?? []).filter(isRegular)

export const countedChildren = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> => counted(derived.children, id)

/**
 * What every record RESOLVES TO, read both ways in one walk.
 *
 * Forwards it is the status: the mark a node stores, and nothing else. A
 * mirror stands for its target's, because that is what it shows — which for a
 * plain bullet is nothing. That is the ONLY hop, and it is a placement
 * question rather than a rollup: {@link follow} already answers it, cycle-safe,
 * for a set the validator has condemned as well as for one it has not.
 *
 * Backwards it is {@link Derived.mirrorsOf}: the same {@link follow} answer
 * filed under the node it landed on. One walk rather than two, and not only
 * for the cost — a second walk would be a second chance to disagree about
 * where a chain ends, and a mirror filed under one node while it shows another
 * is exactly the stale placement this index exists to find.
 */
const resolutions = (
  nodes: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
): {
  readonly status: ReadonlyMap<string, Status>
  readonly mirrorsOf: ReadonlyMap<string, ReadonlySet<string>>
} => {
  const index = { byId }
  const status = new Map<string, Status>()
  const mirrorsOf = new Map<string, Set<string>>()
  for (const located of nodes) {
    const found = follow(index, located)
    if (found.kind !== "found") continue
    const mark = storedMarker(found.shows.node)
    if (mark !== undefined) status.set(located.node.id, mark)
    // Only a MIRROR stands for something: a regular record resolves to itself,
    // and filing it under its own id would say every node mirrors itself.
    if (!isMirror(located.node)) continue
    const mirrors = mirrorsOf.get(found.shows.node.id)
    if (mirrors === undefined) mirrorsOf.set(found.shows.node.id, new Set([located.node.id]))
    else mirrors.add(located.node.id)
  }
  return { status, mirrorsOf }
}

/** What a record claims about itself, which IS its status — and `undefined`
 *  for one claiming nothing, the one spelling of absence this module has. Read
 *  in {@link MARKS} order, which is precedence: the three are mutually
 *  exclusive on disk, so it only decides what a set the validator has already
 *  condemned looks like. */
export const storedMarker = (node: LocatedRegular["node"]): Status | undefined =>
  MARKS.find((mark) => node[mark] !== undefined)

/**
 * Whether a mark is work that is NOT finished — the ONE spelling of it.
 *
 * Every rule in this system that asks "is there still something to do here"
 * asks exactly this: what blocks ({@link inPlay}), what a branch holds
 * ({@link unfinishedWithin}), and — one package up — what an arriving subtree
 * or capture brings with it. {@link inPlay}'s own note already warned that two
 * spellings would be two chances to disagree about what unfinished work is,
 * and there were four.
 *
 * A TYPE GUARD rather than a boolean, because the rule is a fact about the
 * value and {@link InTheWay} already says so in its type: what is in the way
 * is `Exclude<Status, "done">`. `undefined` — a node nobody marked — is not
 * unfinished work; it is not work. The trap this is written against is
 * spelling it `mark !== "done"`, which reads every plain bullet as something
 * outstanding.
 */
export const unfinished = (
  mark: Status | undefined,
): mark is Exclude<Status, "done"> => mark !== undefined && mark !== "done"

/**
 * The children of a node that are TASKS, each with the mark that makes it one.
 *
 * What a row's rollup is made of ({@link progressOf}, an annotation) and the
 * first level of what {@link unfinishedWithin} walks — one decision about what
 * counts as a task under a node, so a second walk over the same edges cannot
 * disagree about whether a bullet is one.
 *
 * Only the node's own children, because a ROLLUP is about the row it sits on:
 * `3/5` beside a title counts the five things drawn under it, not the fifty
 * below those. The gate that has to see the whole branch descends through this
 * one level at a time ({@link unfinishedWithin}) rather than being handed a
 * deep count here. And never a mirror, which is a second view of a node rather
 * than a second obligation.
 */
const tasksUnder = (
  derived: Derived,
  id: string,
): ReadonlyArray<{ readonly at: LocatedRegular; readonly status: Status }> =>
  counted(derived.children, id).flatMap((at) => {
    const status = derived.status.get(at.node.id)
    return status === undefined ? [] : [{ at, status }]
  })

/**
 * How far along the tasks under a node have got — an ANNOTATION.
 *
 * A parent showing `3/5` is telling the reader something the rows below it
 * already say, in one glance. It is not a status: it does not decide whether
 * the node is hidden ({@link withoutDone} reads the stored mark), it does not
 * block anything, and no write is refused because of it. That separation is
 * the point — rollup as a status is what made a parent a task nobody had
 * called one.
 *
 * `undefined` when nothing under it is a task — there is no progress to show
 * rather than progress of zero.
 */
export const Progress = Schema.Struct({
  done: Schema.Int,
  total: Schema.Int,
})
export type Progress = typeof Progress.Type

export const progressOf = (derived: Derived, id: string): Progress | undefined => {
  const tasks = tasksUnder(derived, id)
  if (tasks.length === 0) return undefined
  // Counted in place rather than filtered: this runs once per drawn row, and
  // the answer is two integers.
  let done = 0
  for (const task of tasks) {
    if (task.status === "done") done += 1
  }
  return { done, total: tasks.length }
}

/**
 * Every task in a node's SUBTREE that is not done — what a `done` on it would
 * be a claim about, and what done-hiding would take off the screen with it.
 *
 * A bullet is never among them: it is not a task, so there is nothing under it
 * to finish. That is the rule no caller may re-decide, and it is why this lives
 * here rather than at the write that names them. A mirror is never among them
 * either, and never walked into — a placement is a second VIEW of a node, not a
 * second obligation, so the work it draws stays on screen at the node's own
 * row whatever happens to the branch the placement sits in.
 *
 * DEEP, which is the 2026-08-16 change and the whole of `done-over-open-work`.
 * It was the node's own children, on the reading that a nudge names what a
 * person can see under the row they just ticked. But hiding is not one level:
 * `withoutDone` drops a done row WITH its whole subtree, so a mark on a root is
 * a claim about everything below it, and a gate that looked one level down
 * would let a task two levels down be swept away by a write it never saw. The
 * question this answers is exactly the one the sweep asks.
 *
 * In outline order — parent before child, siblings by `ord` — because a
 * refusal that names them is read as a list of places to go.
 *
 * Cycle-safe like every walk here: a parent loop is a set the validator
 * rejects, and this still has to answer over one.
 */
export const unfinishedWithin = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> => {
  const open: Array<LocatedRegular> = []
  const seen = new Set<string>([id])
  // {@link counted} is what keeps the mirrors out, at every level rather than
  // only the first, and {@link unfinished} is where "no mark means no task" is
  // decided — the same predicate blockedness reads, so the two cannot come to
  // disagree about what is still outstanding.
  const descend = (at: string): void => {
    for (const child of counted(derived.children, at)) {
      if (seen.has(child.node.id)) continue
      seen.add(child.node.id)
      if (unfinished(derived.status.get(child.node.id))) open.push(child)
      descend(child.node.id)
    }
  }
  descend(id)
  return open
}

// ── what cannot start yet ──────────────────────────────────────────────

/**
 * A node standing in another's way, and WHY it is — a task that is not done.
 *
 * The reason travels with the node rather than being restated by each reader,
 * because every one of them wants it: a mark column tones the glyph with it, a
 * page names the node, and a caller left to look the mark up again is a caller
 * free to look it up differently.
 *
 * `Exclude<Status, "done">` says the whole rule in the type: what is in the way
 * is unfinished WORK. A node with no status is absent from this shape entirely
 * — it is not a task, so there is nothing under it to finish — which is not a
 * second sentence but the same one, since {@link unfinished} is the predicate
 * both this and {@link unfinishedWithin} are built from, about the two
 * different kinds of edge.
 */
export interface InTheWay {
  readonly at: LocatedRegular
  readonly status: Exclude<Status, "done">
}

/**
 * The ordering graph of the set: the node an edge holds up → the ids it must
 * come after.
 *
 * `blocks` is sugar — `a blocks b` means `b after a` — and this is the only
 * place it is normalised, so the acyclicity rule and blockedness read one
 * graph rather than two that could disagree.
 *
 * TWO PASSES, and that is the order {@link Derived.blocked} promises: every
 * node's own `after` first, as it writes them, and only then the `blocks`
 * pointing back at it from elsewhere. One interleaved pass filed a reverse edge
 * from a record written earlier in the file AHEAD of the node's own targets,
 * so what a row with room for one blocker showed depended on where in the
 * directory somebody had written an unrelated `blocks`.
 *
 * IN TERMS OF NODES, at both ends: an edge naming a mirror is an edge to the
 * node standing at it, because a placement is addressable like any other
 * record and that is what naming one means. So `a blocks m` and `x after b`
 * land on one list when `m` mirrors `x`, and — this is the half that bites —
 * a deadlock that closes THROUGH a placement is one loop rather than two dead
 * ends. Canonicalising here rather than at each reader is what stops the
 * acyclicity rule and blockedness from disagreeing about whether two records
 * mean one edge: they would have to resolve identically, and one of them did
 * not. An id nothing declares is left as written — an unknown target is the
 * validator's to report, and dropping the edge here would decide that quietly.
 *
 * A mirror is never a source of its own: it carries no edges.
 *
 * AND IT IS A SET, per source: what a node waits on is a list of nodes, each
 * named once, in the order it was first named. That is the same claim the two
 * paragraphs above make about spellings and about placements, carried to the
 * case where the two arrive at one pair — see {@link edge}.
 *
 * THE ONE RULE THE PATCHER RE-SPELLS, and the pointer is here so a change to
 * this walk cannot be made without meeting it: {@link ./patch.ts} builds these
 * same two maps ONE KEY AT A TIME — a node's own `after`, then whatever
 * `blocks` it from elsewhere — because that is the only shape a key can be
 * rebuilt in without walking the corpus. Everything else the patcher needs it
 * calls (mirror resolution, the naming fold, blockedness); this is the walk
 * whose SHAPE cannot be shared, since one pass over every record and one pass
 * per disturbed key are different loops over the same rule. What holds them
 * together is the oracle: the property test compares these two maps whole, so a
 * change here that the patcher does not follow fails rather than drifts.
 *
 * BOTH DIRECTIONS, filed as the edge is made. {@link Derived.edgesTo} is this
 * map reversed — and to be exact about what that buys, since a later pass over
 * a finished `after` would reverse ids that are already canonical and could
 * not disagree with it: what it buys is that the reverse is written where the
 * edge is known, so there is no second place holding a rule about how an edge
 * is filed. It is a set for the reason the forward reading is one, arrived at
 * from the other end: a source that named a target three ways is one node to
 * look at again.
 */
const orderings = (
  byId: ReadonlyMap<string, Located>,
  nodes: ReadonlyArray<Located>,
): {
  readonly after: ReadonlyMap<string, ReadonlyArray<string>>
  readonly edgesTo: ReadonlyMap<string, ReadonlySet<string>>
} => {
  const index = { byId }
  const named = (id: string): string => nodeNamed(index, id)?.node.id ?? id
  const after = new Map<string, Array<string>>()
  const edgesTo = new Map<string, Set<string>>()
  /** File one edge, ONCE, in both directions. Both ends are resolved to nodes
   *  before they get here, so a field repeating a target (a `.olai` is plain
   *  text, and nothing refuses a hand that writes `after: [b, b]`), the two
   *  spellings of one arrow both written down, and two ids standing at one
   *  node through a mirror all arrive as the same pair — and each of them is
   *  one edge. Every reader takes this as a set: the row a page draws keyed by
   *  the blocker's id (a repeat crashes the client,
   *  `web/client/NodeRefs.tsx`), the `blocked by` tip, the walk the acyclicity
   *  rule and `set_after`'s loop refusal share. A duplicate would say one node
   *  is in the way twice — and, read backwards, that one node has to be looked
   *  at twice when the other's mark flips. The reverse is a `Set` for that
   *  reason, so the two directions cannot disagree about how many edges a pair
   *  of records means. */
  const edge = (from: string, to: string): void => {
    const existing = after.get(from)
    if (existing === undefined) after.set(from, [to])
    else if (!existing.includes(to)) existing.push(to)
    const sources = edgesTo.get(to)
    if (sources === undefined) edgesTo.set(to, new Set([from]))
    else sources.add(from)
  }

  for (const { node } of nodes) {
    if (isMirror(node)) continue
    for (const target of node.after ?? []) edge(node.id, named(target))
  }
  for (const { node } of nodes) {
    if (isMirror(node)) continue
    for (const target of node.blocks ?? []) edge(named(target), node.id)
  }
  return { after, edgesTo }
}

/**
 * The node an end of an arrow names, WHILE it is still in play: it exists, it
 * is a task that is not done, and it has not been put away.
 *
 * THE ONE PREDICATE, and it is read at BOTH ENDS of the arrow — which is the
 * racket reference's own shape (`olai/query.rkt`'s `live?`). It is a module
 * function rather than a closure inside {@link blockage} because a THIRD reader
 * arrived: {@link standingBefore}, which asks the target-side half of the same
 * question over a set that is already derived. Two spellings would be two
 * chances to disagree about what unfinished work is.
 */
const inPlay = (
  index: { readonly byId: ReadonlyMap<string, Located> },
  status: ReadonlyMap<string, Status>,
  id: string,
): InTheWay | undefined => {
  const at = nodeNamed(index, id)
  if (at === undefined || isArchived(at.file)) return undefined
  const mark = status.get(at.node.id)
  return unfinished(mark) ? { at, status: mark } : undefined
}

/** Which of these targets are still in the way, in the order they were named
 *  — the target-side half of blockedness, shared by the index below and the
 *  reading beside it. */
const waitingOn = (
  index: { readonly byId: ReadonlyMap<string, Located> },
  status: ReadonlyMap<string, Status>,
  targets: ReadonlyArray<string>,
): ReadonlyArray<InTheWay> =>
  targets
    .map((target) => inPlay(index, status, target))
    .filter((blocker) => blocker !== undefined)

/**
 * What is standing in each node's way — the whole of blockedness, derived like
 * everything else here and stored nowhere.
 *
 * `a after b` means b blocks a WHILE b is a task that is not done — with the
 * three marks there are, while b is `doing` or `todo`. A target with NO status
 * never blocks: it is not a task, there is nothing under it to finish, so
 * there is nothing to wait for. The trap this rule is written against is
 * spelling it `status !== "done"`, which reads every plain bullet as an
 * obstacle that can never be cleared — and adding `todo` did not narrow that
 * trap by one case, since the unmarked node is still the one that must not
 * block (docs/format.md).
 *
 * ONE predicate, read at BOTH ENDS of the arrow, which is the racket
 * reference's own shape (`olai/query.rkt`'s `live?`): "a node this can be said
 * about" and "a node that still stands in the way" are the same question asked
 * from either side, and two spellings of it would be two chances to disagree
 * about what unfinished work is. So a done node is waiting on nothing — it has
 * happened, and the order it happened in is no longer a question — and a
 * bullet is neither blocked nor blocking, because a bullet is not work.
 *
 * ARCHIVED is that same answer arrived at from the other side, and it also
 * goes both ways. Work that was put away is not blocking anything: archiving
 * is what you do to work that is over, and a live node waiting on one would be
 * waiting forever. Nor is it blocked: the archive is read as history, and a
 * node in it is not being told it cannot start. Note where the exemption
 * stops — the validator's `after` cycle check exempts nothing, because a loop
 * is a loop whether or not part of it has been put away, and it is a claim
 * about the file rather than about what is on anyone's plate.
 */
const blockage = (
  byId: ReadonlyMap<string, Located>,
  status: ReadonlyMap<string, Status>,
  after: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlyMap<string, ReadonlyArray<InTheWay>> => {
  const view = { byId, status, after }
  const blocked = new Map<string, ReadonlyArray<InTheWay>>()
  for (const id of after.keys()) {
    const found = blockageAt(view, id)
    if (found !== undefined) blocked.set(found.at, found.waiting)
  }
  return blocked
}

/**
 * ONE key of {@link Derived.blocked}: what the node an `after` key names is
 * waiting on, and the id the index files that under — or `undefined` for a key
 * the index carries nothing for, which is nearly every key.
 *
 * Keyed by the NODE. Both spellings of an edge were resolved to one before they
 * became `after` keys, so a node has one list here however many records pointed
 * at it and however they addressed it — and that resolution is why the id it is
 * filed under is answered rather than assumed by the caller.
 *
 * The whole of {@link blockage} is this function over every key, and the
 * patcher is this function over the few keys an edit disturbed
 * ({@link ./patch.ts}). Two spellings of "what is in the way" would be a
 * patched view that draws a blocker a rebuilt one does not.
 */
export const blockageAt = (
  view: Pick<Derived, "byId" | "status" | "after">,
  id: string,
): { readonly at: string; readonly waiting: ReadonlyArray<InTheWay> } | undefined => {
  const source = inPlay(view, view.status, id)
  if (source === undefined) return undefined
  const waiting = standingBefore(view, id)
  return waiting.length === 0 ? undefined : { at: source.at.node.id, waiting }
}

/**
 * What drawing this record leads to drawing: its children, and — for a mirror
 * — the record it shows.
 *
 * The CONTAINMENT graph, in the one place it is spelled. It runs downward, and
 * the direction is the point: a pure parent loop is found either way, but a
 * mirror's edge to its target is downward by nature, so only this direction
 * finds the placement that expands forever.
 *
 * Two rules read it and they must not disagree. The validator refuses a set
 * whose placements close a loop ({@link ./validate.ts}); the ops layer refuses
 * the PLACEMENT that would close one, before the write, so an agent is told
 * which loop it is about to make rather than handed a report about a file that
 * was never written. Two spellings would be a mirror the planner allowed and
 * the validator then rejected — a write refused for a reason the tool that
 * planned it did not know about.
 */
export const drawnFrom = (
  derived: Pick<Derived, "children">,
  node: Node,
): ReadonlyArray<string> => [
  ...(derived.children.get(node.id) ?? []).map((child) => child.node.id),
  ...(isMirror(node) ? [node.mirror] : []),
]

/**
 * The chain by which drawing `from` leads to drawing `to` — or `null` when it
 * never does.
 *
 * {@link drawnFrom} walked, which is the whole of what this adds: the graph was
 * already shared and the WALK over it was not, so each rule that asked "would
 * this placement expand forever" wrote its own — and a rule that walks the
 * shared graph its own way is a second answer with extra steps. THREE ask now,
 * and they must agree because they are the same question at three moments: the
 * validator refuses a set whose placements close a loop
 * ({@link ./validate.ts}), the ops layer refuses the write that would close one
 * (`ops`' `showsInto`, both for a new mirror and for a MOVE that carries one
 * into what it shows), and the move-to picker refuses the destination at the
 * aim, before the key (`web`'s `move/destination.ts`).
 *
 * A PATH rather than a boolean, because every one of those refusals names the
 * loop: an agent told which chain it just tried to fold into itself can fix the
 * call, and a person told the same can see why a row three branches away is
 * "inside" this one. `chainOf` ({@link ./errors.ts}) is how all three spell it.
 *
 * `from === to` answers with a path of one, which is the honest reading of an
 * edge onto itself — the same reading `chainOf` documents for a loop.
 *
 * Cycle-safe: a set whose containment graph already loops is one the validator
 * has condemned, and a walk that is asked about it anyway must answer rather
 * than hang.
 */
export const drawingPath = (
  derived: Pick<Derived, "byId" | "children">,
  from: string,
  to: string,
): ReadonlyArray<string> | null => {
  const seen = new Set<string>()
  // The trail is extended only for a node this walk actually descends into: a
  // revisit answers `null` without copying anything, which matters because the
  // common answer is `null` and a node reached through three mirrors is
  // reached three times.
  const walk = (at: string, trail: ReadonlyArray<string>): ReadonlyArray<string> | null => {
    if (at === to) return [...trail, at]
    if (seen.has(at)) return null
    seen.add(at)
    const located = derived.byId.get(at)
    // An id nothing declares draws nothing. A set holding one is a set the
    // validator has condemned, and this walk still has to answer over it.
    if (located === undefined) return null
    const path = [...trail, at]
    for (const next of drawnFrom(derived, located.node)) {
      const found = walk(next, path)
      if (found !== null) return found
    }
    return null
  }
  return walk(from, [])
}

/** What one node is waiting on: empty when nothing is in its way, which is the
 *  answer for nearly every node. The reading side of {@link Derived.blocked},
 *  so no caller has to know that absence is how the index spells "nothing". */
export const blockersOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<InTheWay> => derived.blocked.get(id) ?? []

/**
 * WHETHER anything is in this node's way — {@link blockersOf} asked by a caller
 * that only wants the answer yes or no.
 *
 * Beside it rather than spelled as `blockersOf(…).length > 0` at the call site,
 * and for the reason that one exists: absence is how the index spells
 * "nothing", and both halves of that convention belong to the reading side.
 * {@link blockage} never files an empty list — a node with nothing in its way
 * is a node with no entry — so the presence of a key IS the answer, with no
 * array minted to have its length read. That matters because the caller is
 * `filter.ts`'s `is:blocked`, which asks this of every node of the directory,
 * on every keystroke of the filter box — and whose negation is the form that
 * touches nearly all of them, since almost nothing is waiting.
 */
export const isBlocked = (derived: Derived, id: string): boolean =>
  derived.blocked.has(id)

/**
 * What this node's `after` targets hold up — whether or not the node is WORK
 * yet.
 *
 * The one place the two readings differ, and the difference is which end of the
 * arrow the question is asked about. {@link blockersOf} is what a node IS
 * waiting on, and it is empty for a plain bullet because a bullet is not work
 * and is therefore not being told it cannot start — that is what every DRAWING
 * of blockedness wants. This is what a node WOULD be waiting on the moment it
 * became work, and it is what a WRITE that is about to make it work has to ask:
 * the ops layer refuses `set_doing` with it, and asking `blockersOf` there
 * would let `set_doing` on a bullet slip past the gate its own `after` edges
 * declare — the row landing `doing` and the app drawing it blocked a frame
 * later, which is precisely the state the refusal exists to make unreachable.
 *
 * Not a second rule: it is the target-side half of {@link blockage}, the same
 * {@link inPlay} over the same normalised graph, in the same promised order.
 * Both readings say `done` targets, bullets and archived work stand in nobody's
 * way, because there is one function that decides that.
 */
export const standingBefore = (
  derived: Pick<Derived, "byId" | "status" | "after">,
  id: string,
): ReadonlyArray<InTheWay> =>
  waitingOn(derived, derived.status, derived.after.get(id) ?? [])

// ── the drawable tree ──────────────────────────────────────────────────

/** Fields every row has, whatever it turned out to be. */
interface Place {
  /** The record occupying this place — the mirror itself, for a mirror. */
  readonly at: Located
  /** Absent when this place draws a plain bullet — there is no mark, and no
   *  box to draw one in. */
  readonly status: Status | undefined
  /** What this place is waiting on, and empty when nothing is. Asked of the
   *  node the place SHOWS, so a mirror says what its target says — the rule
   *  its status already follows — and a place drawing no node at all is
   *  waiting on nothing. */
  readonly blocked: ReadonlyArray<InTheWay>
  /** The rollup, for a row that has tasks under it: an annotation beside the
   *  title, never a second answer to what the checkbox shows. */
  readonly progress: Progress | undefined
  /** Stable identity of this PLACE, not of the node. The same node reached
   *  through two mirrors is two rows on screen, and folding one must not fold
   *  the other. */
  readonly key: string
  readonly children: ReadonlyArray<Row>
}

/**
 * One place in the tree, and what the reader should be told about it.
 *
 * A union rather than four booleans, and it carries the ANSWER rather than the
 * question: a dangling row knows the id the mirror chain actually died on (not
 * the first hop, which may well exist), and a cycle row knows the id it closed
 * on. The walk is the only thing that knows either; a view recomputing them
 * from `at` would get the first hop and say something untrue.
 */
export type Row =
  | (Place & { readonly kind: "node" | "mirror"; readonly shows: LocatedRegular })
  | (Place & { readonly kind: "dangling"; readonly missing: string })
  | (Place & { readonly kind: "cycle"; readonly through: string })

/** The rows of one outline: the roots of `file`, expanded. Mirrors are
 *  expanded in place, because a pointer the reader has to go and follow is not
 *  a second location — it is a footnote. */
export const rowsOf = (derived: Derived, file: string): ReadonlyArray<Row> =>
  siblingsOf(derived, file, undefined).map((root) => expand(derived, root, [], ""))

/**
 * The rows UNDER one node: what a zoomed page draws below its heading.
 *
 * The same walk as {@link rowsOf} from a different starting line — which is
 * the point of it being one function. `ancestors` seeds the containment guard,
 * and it is the caller's because the caller already worked the chain out for
 * the crumbs: a page zoomed to `install` is still inside `kitchen`, so a mirror
 * of `kitchen` further down is a loop whether or not the ancestors above the
 * heading are being drawn as rows.
 */
export const rowsUnder = (
  derived: Derived,
  shows: LocatedRegular,
  ancestors: ReadonlyArray<LocatedRegular>,
): ReadonlyArray<Row> => {
  const within = [...ancestors.map((crumb) => crumb.node.id), shows.node.id]
  return (derived.children.get(shows.node.id) ?? []).map((child) =>
    expand(derived, child, within, "")
  )
}

const expand = (
  derived: Derived,
  at: Located,
  ancestors: ReadonlyArray<string>,
  parentKey: string,
): Row => {
  const key = `${parentKey}/${at.node.id}`
  const found = follow(derived, at)
  // The fields every branch shares, including the rollup a stub has none of —
  // the drawn branch below overrides it, and no branch has to remember to say
  // it has nothing. What a place is WAITING ON is asked of the node it shows,
  // which a stub has none of either.
  const place = {
    at,
    status: derived.status.get(at.node.id),
    blocked: found.kind === "found" ? blockersOf(derived, found.shows.node.id) : [],
    progress: undefined,
    key,
  }

  if (found.kind !== "found") {
    return { ...place, children: [], ...found }
  }
  if (ancestors.includes(found.shows.node.id)) {
    return { ...place, children: [], kind: "cycle", through: found.shows.node.id }
  }

  const within = [...ancestors, found.shows.node.id]
  return {
    ...place,
    // The rollup of what this place SHOWS: a mirror's row draws its target's
    // children, so it draws its target's progress too.
    progress: progressOf(derived, found.shows.node.id),
    kind: isMirror(at.node) ? "mirror" : "node",
    shows: found.shows,
    children: (derived.children.get(found.shows.node.id) ?? []).map((child) =>
      expand(derived, child, within, key)
    ),
  }
}

/**
 * The same rows with everything done left out — the done-visibility switch,
 * which is a property of a reading and not of the file. Nothing is touched on
 * disk and nothing is marked: a hidden row is a row not drawn.
 *
 * Done-hidden means exactly this: a row whose node STORES `done` is not drawn,
 * and its subtree goes with it. The sweep is justified rather than inferred
 * now — a done mark on a parent is somebody's claim about the whole branch,
 * made deliberately, so hiding what hangs under it is honouring the claim.
 * That was the defect this replaced: a parent that merely *derived* done, by
 * arithmetic nobody had asked for, took unmarked findings down with it, and
 * the view whose whole purpose is showing what is left hid exactly what was
 * left. Nothing derives done any more, so nothing is hidden that nobody
 * finished.
 */
export const withoutDone = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> =>
  rows.flatMap((row) =>
    row.status === "done" ? [] : [{ ...row, children: withoutDone(row.children) }]
  )

/**
 * The canonical parent chain of a node, root first, the node itself excluded.
 *
 * CANONICAL, so it is a property of the node and not of the click that got you
 * there: a node reached through a mirror three files away has the same
 * ancestry as one reached by scrolling to it. `parent` is same-file by the
 * format, so every crumb lives in the node's own outline.
 *
 * Cycle-safe, like every walk here. A parent loop is a set the validator
 * rejects, but the crumbs are drawn from sets its own error messages describe.
 */
export const ancestorsOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<LocatedRegular> => {
  const chain: Array<LocatedRegular> = []
  const seen = new Set<string>([id])
  let next = derived.byId.get(id)?.node.parent

  while (next !== undefined && !seen.has(next)) {
    seen.add(next)
    const located = derived.byId.get(next)
    // A parent that is missing, or is a mirror, is a set the validator has
    // already condemned. Stop at the last crumb that is really there rather
    // than inventing one or walking through a placement.
    if (located === undefined || isMirror(located.node)) break
    chain.push(located as LocatedRegular)
    next = located.node.parent
  }

  return chain.reverse()
}

/**
 * ...and what those crumbs SAY, which is what every reader of them draws:
 * the titles, outermost first.
 *
 * Its own function because it had three callers spelling one `.map` — the ops
 * layer's `foundOf` (which is public precisely so a second `ancestorsOf(…).map`
 * could not drift from what `read_node` answers), the line a chat message's
 * node arrives on, and the chat composer's `@` row, which cannot reach the ops
 * layer at all. Three copies of one expression is three chances for "where does
 * this node hang" to come to mean three things about one id in one turn.
 */
export const ancestorTitles = (
  derived: Derived,
  id: string,
): ReadonlyArray<string> =>
  ancestorsOf(derived, id).map((crumb) => crumb.node.title)

/**
 * A node, and the derived facts that say what it IS.
 *
 * One concept with two readers so far, and they would otherwise be two
 * identical structures: a zoomed page puts these above its heading, a day
 * lists nodes from all over the set and each of them needs the same three, and
 * search-with-ancestors will want them too. A title torn out of its outline
 * says nothing — `order the new cabinets` is a different task under `kitchen
 * remodel` than under `the office move` — so "the node plus its context" is a
 * thing, and it is this one.
 */
export interface Situated {
  /** The regular node at the end of the chain, whatever record was addressed
   *  to reach it. */
  readonly shows: LocatedRegular
  /** Absent when the node carries no mark. */
  readonly status: Status | undefined
  /** What it is waiting on, and empty when nothing is. */
  readonly blocked: ReadonlyArray<InTheWay>
  /** The rollup of its task children, for the same reason a row carries one. */
  readonly progress: Progress | undefined
  /** The canonical parent chain, root first, `shows` excluded. */
  readonly trail: ReadonlyArray<LocatedRegular>
}

export const situate = (derived: Derived, shows: LocatedRegular): Situated => ({
  shows,
  status: derived.status.get(shows.node.id),
  blocked: blockersOf(derived, shows.node.id),
  progress: progressOf(derived, shows.node.id),
  trail: ancestorsOf(derived, shows.node.id),
})

/**
 * What a record actually shows: itself, or — following as many mirror hops as
 * it takes — the regular node at the end of the chain.
 *
 * A mirror of a mirror is legal (nothing in the format forbids a second
 * pointer to a pointer) and resolving only one hop would leave a row standing
 * for a record with no title and no children of its own: a legal set the
 * reader cannot draw. The two failures are told apart and each names the id it
 * failed at, because "a mirror of `b`, which no node declares" is a lie when
 * `b` exists and it is `b`'s own target that is missing.
 */
type Found =
  | { readonly kind: "found"; readonly shows: LocatedRegular }
  | { readonly kind: "dangling"; readonly missing: string }
  | { readonly kind: "cycle"; readonly through: string }

export const follow = (
  // Only the id index, so the status pass and the blockedness pass can call it
  // while the rest of the derivation is still being built — and so a caller
  // with a whole `Derived` passes it unchanged.
  derived: Pick<Derived, "byId">,
  from: Located,
): Found => {
  // The common case, said first because this runs for every node of the set,
  // for every edge endpoint and for every `see` target on every derive: a
  // record that is not a mirror shows itself, and there is no chain to
  // remember.
  if (!isMirror(from.node)) return { kind: "found", shows: from as LocatedRegular }

  const seen = new Set<string>()
  let at: Located = from
  while (isMirror(at.node)) {
    if (seen.has(at.node.id)) return { kind: "cycle", through: at.node.id }
    seen.add(at.node.id)
    const next = derived.byId.get(at.node.mirror)
    if (next === undefined) return { kind: "dangling", missing: at.node.mirror }
    at = next
  }
  return { kind: "found", shows: at as LocatedRegular }
}

/**
 * The node an ID NAMES: the regular record at the end of whatever mirror chain
 * it addresses, and `undefined` when nothing declares it or the chain does not
 * end at a node.
 *
 * An edge target is an id like any other and a mirror is addressable like any
 * other record, so "what does this id mean" is one question with one answer —
 * the node standing at that placement. Every reader of a target field asks it:
 * blockedness, to find what is in the way, and the view, to put a `see`
 * target's title on a link. Two spellings of it would be two answers about the
 * same id, and the one that got it wrong would be a link with no text.
 *
 * The distinction from {@link follow} is which question is being asked: follow
 * tells a ROW apart from the two ways its chain can fail, because a row has to
 * draw the failure. A reference has nothing to draw and nowhere to say it, so
 * both failures answer the same thing here.
 */
export const nodeNamed = (
  derived: Pick<Derived, "byId">,
  id: string,
): LocatedRegular | undefined => {
  const named = derived.byId.get(id)
  if (named === undefined) return undefined
  const found = follow(derived, named)
  return found.kind === "found" ? found.shows : undefined
}

// ── titles ─────────────────────────────────────────────────────────────

/**
 * The two characters that start a tag.
 *
 * `#` is what this format has always had; `@` joined it with the editor's tag
 * autocomplete (`input-widgets`), because Workflowy trains both hands and a
 * trigger that inserted the OTHER character would be an affordance writing text
 * the set does not recognise as a tag. They are two NAMESPACES rather than two
 * spellings of one: `#alice` and `@alice` are different tags, which is the
 * whole reason a person reaches for one rather than the other (`@` for who,
 * `#` for what).
 */
export const TAG_SIGILS = ["#", "@"] as const
export type TagSigil = (typeof TAG_SIGILS)[number]

/** One tag, split the way this format reads one: which sigil started it, and
 *  the name after it. */
export interface TitleTag {
  /** Which character started it — carried rather than assumed, so a part list
   *  rejoins to the title it came from. */
  readonly sigil: TagSigil
  /** The name, without the sigil. */
  readonly tag: string
}

/** A title, split into what to print and what to style. Tags live inline in
 *  the title verbatim — the format stores no tag list — so the split happens
 *  at view time, every time. */
export type TitlePart =
  | { readonly kind: "text"; readonly text: string }
  | ({ readonly kind: "tag" } & TitleTag)

/** The written form of a tag — the characters the title actually holds. One
 *  spelling, because every consumer that draws a tag or indexes one needs it
 *  and three of them re-assembling it is three chances to drop the `@`. It is
 *  also what {@link Derived.taggedBy} is keyed by. */
export const tagText = (part: TitleTag): string => `${part.sigil}${part.tag}`

/**
 * ...and the same reading backwards: a written tag split into its two halves.
 *
 * The inverse of {@link tagText}, beside it, because {@link Derived.taggedBy}'s
 * keys are written tags and a reader that wants the namespace and the name has
 * to take one apart. Doing that at the call site is a second, private claim
 * about where the sigil is — the thing this pair exists to keep to one place.
 *
 * It TRUSTS its argument, which is why it takes no failure: the only strings
 * this is asked about are keys that {@link tagText} wrote.
 */
export const tagParts = (written: string): TitleTag => ({
  sigil: written[0] as TagSigil,
  tag: written.slice(1),
})

/**
 * Whether text could hold a tag AT ALL — a plain `indexOf` per sigil, and the
 * guard every walk of {@link titleParts} takes first.
 *
 * That call runs a global regex and allocates a part per segment, and most
 * titles hold no tag at all; the search index, the client's two renderings of a
 * pill and its tag completion all want the same cheap negative. It was written
 * three times before this existed, and the first two had already drifted (one
 * asked about `#` only).
 */
export const mayHoldTag = (text: string): boolean =>
  text.includes("#") || text.includes("@")

/**
 * A fresh `/g` regex for an inline tag in a title.
 *
 * A sigil followed by letters, digits, `_`, `-` or `/` — the last so
 * `#work/olai` is one tag. A bare sigil is text. Returned new each call so `/g`
 * state is never shared across walks (the client styles tags by walking HAST
 * text nodes with the same alphabet, and must not re-declare it).
 *
 * THE TWO SIGILS ARE NOT MATCHED THE SAME WAY, and the asymmetry is about what
 * people write rather than about tidiness: `@` sits inside ordinary words all
 * the time (`srid@srid.ca`, a handle quoted mid-sentence) and `#` essentially
 * does not, so `@` is claimed only where a word STARTS — the beginning of the
 * title, or after a space or an opening bracket. `#` keeps the alphabet it has
 * had since the format's first day, unchanged, because narrowing it would
 * restyle titles in sets that are already written.
 */
export const titleTagRe = (): RegExp => /#[A-Za-z0-9_/-]+|(?<![^\s([{])@[A-Za-z0-9_/-]+/g

/**
 * Whether `text` is a tag NAME and nothing else — the alphabet above, asked as
 * a question.
 *
 * It exists because a client COMPLETING a tag has to know where one stops
 * while it is still half-typed, and this file already says the alphabet must
 * not be re-declared elsewhere. An empty name passes: `#` on its own is a tag
 * being started, which is exactly when a completion is wanted, and it is
 * {@link titleTagRe}'s business that a bare sigil is not yet a tag.
 */
export const isTagName = (text: string): boolean => /^[A-Za-z0-9_/-]*$/.test(text)

/**
 * Whether a sigil sitting at `at` STARTS a tag rather than sitting inside a
 * word — the beginning of the text, or after a space or an opening bracket.
 *
 * The rule {@link titleTagRe} applies to `@`, asked of ANY position, because a
 * completion wants it for both sigils: offering to rewrite the middle of
 * `issue#42` is offering to rewrite a word somebody is in the middle of
 * typing. What the format RECOGNISES as a tag is the regex's own, wider
 * question for `#`; this is only about where one may be started.
 */
export const tagOpensAt = (text: string, at: number): boolean =>
  at === 0 || /[\s([{]/.test(text[at - 1] as string)

export const titleParts = (title: string): ReadonlyArray<TitlePart> => {
  const parts: Array<TitlePart> = []
  let at = 0
  for (const match of title.matchAll(titleTagRe())) {
    const start = match.index
    if (start > at) parts.push({ kind: "text", text: title.slice(at, start) })
    parts.push({
      kind: "tag",
      sigil: match[0][0] as TagSigil,
      tag: match[0].slice(1),
    })
    at = start + match[0].length
  }
  if (at < title.length) parts.push({ kind: "text", text: title.slice(at) })
  return parts
}
