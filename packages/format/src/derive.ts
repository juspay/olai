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

import { Order, Schema } from "effect"

import { Tag } from "./address.ts"
import {
  isLeftoverArchive,
  isPutAway,
  isTrashed,
  isMirror,
  isRegular,
  Located,
  LocatedRegular,
  type Node,
  type RegularNode,
  type Settled,
  settles,
  Status,
  storedMarker,
  type TargetField,
  targetsOf,
  Unfinished,
} from "./node.ts"
import { type Dated, dateInto } from "./occasion.ts"
import type { Read } from "./overlay.ts"
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
  /**
   * Every record of the set, in corpus order — path order across files, line
   * order within one.
   *
   * IT IS {@link Derived.byFile} READ THE OTHER WAY, the same objects and never
   * a second copy of them, which is why a view holds both and is not holding
   * the corpus twice. A rebuild is HANDED this list and files it; a patch is
   * handed a delta and files that, so the flat reading is one it would have to
   * build — one array per record in the directory, for a reading none of its
   * own work asks for. A patched view therefore builds it WHEN SOMEBODY ASKS
   * and hands the same array back every time after ({@link ./patch.ts}), which
   * a reader cannot tell from a field: it is the same value, reached later.
   *
   * So a caller that wants a record COUNT or the corpus grouped should ask
   * `byFile` rather than this, and one that wants the records as a list should
   * bind this once rather than name it per rule.
   *
   * AND IT IS AN ARRAY, which was asked and measured rather than assumed: the
   * five whole-set rules could take an `Iterable` and walk `byFile` nested,
   * allocating nothing at all. On the bench vault that is SLOWER, and not
   * marginally — five rule-shaped walks of 21,552 records cost 3.9ms off one
   * array built once, 5.3ms walking the grouping nested and 5.8ms through a
   * generator, against the 0.10ms the array costs to build. A reading spent
   * five times wants to be a list; what it must not be is a list built by
   * somebody who was not going to read it.
   */
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
   * Backlinks want the `@` half ({@link ./backlinks.ts}); the tag COMPLETION
   * wants the whole vocabulary and the sigil it was written with ({@link
   * ./vocabulary.ts}, which the browser used to hold its own copy of and now
   * asks for). Sigil-stripped keys would collide the
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
   * THE TRASH IS IN IT, like every other index here: what is put away is left
   * out at the READ (both readers do, each in its own words), because an index
   * that knew about `_olai/Trash.olai` would be the format's storage rule wired
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
  /**
   * A DAY (`YYYY-MM-DD`) → the dates that land on it, each with the record that
   * carries it: {@link ./occasion.ts}'s `datesOf` read backwards over the set.
   *
   * The journal, as an index. A day used to be a QUESTION asked of every node in
   * every live outline — the agenda, the calendar's dots and a day page each
   * walked the whole directory per call, and since `vault-in-browser`'s PR 4 two
   * of those walks ran per subscriber per published revision on the server. This
   * is the same reading with the walk done once, at the fold, and maintained by
   * the patcher at what an edit touched (roadmap `perf-dates-index`).
   *
   * KEYS IN DAY ORDER, which is plain code-point order on `YYYY-MM-DD` — the
   * only index here that promises an order its keys are read in for a reason
   * that is not the corpus's. Three readers spend it and none of them may sort
   * to get it: the calendar's month walks the keys that fall inside it and stops
   * (`./dates.ts`'s `datedDays`), and the agenda walks back from today for what
   * has slipped and forward for the next few days that have anything
   * (`./agenda.ts`). Sorting per read is what those three did before there was
   * an index at all, and a decade of daily notes is three and a half thousand
   * keys to sort — per subscriber, per revision. The patcher pays for it the way
   * {@link Derived.byFile} pays for path order: only an edit that ADDS or DROPS
   * a day re-sorts, which nearly none do.
   *
   * VALUES IN CORPUS ORDER, like the reverse indexes above, and within one
   * record its own dates in `datesOf` precedence — which is what lets a day page
   * decide, for a node scheduled and finished on one day, which of the two names
   * the row without asking the record again.
   *
   * A MIRROR IS NEVER IN IT and WHAT WAS PUT AWAY IS NEVER IN IT, both at the
   * fold rather than at the read, which is where this index parts company with
   * `taggedBy` above — {@link ./occasion.ts}'s `dateInto` argues both, and the
   * second is the older ruling that every date reading in this package inherits
   * rather than restates.
   */
  readonly byDay: ReadonlyMap<string, ReadonlyArray<Dated>>
  /**
   * A DAY → HOW MUCH IT OWES: the unfinished dated work sitting on it, counted
   * ({@link owingOn}). A day that owes nothing is ABSENT, exactly as a day
   * nothing is on at all is absent from {@link Derived.byDay} above.
   *
   * {@link Derived.byDay} COUNTED, and nothing else — one number per key of
   * that index, taken from the very list that index holds, so the two cannot
   * come to disagree about what a day owes. It is not a second fold over the
   * records: the patcher recounts the days an edit TOUCHED out of the buckets
   * it has just re-filed ({@link ./patch.ts}'s `dating`), which is the only
   * place a day's members can have moved.
   *
   * WHY A COUNT IS AN INDEX AT ALL, where every other reading of this set is
   * derived at view time: the two numbers a mark outside the agenda prints
   * (`./agenda.ts`'s `Owed`, read by its `owedNow`) are re-answered per
   * subscriber per published revision, and answering them used to mean DRESSING every overdue
   * node in the directory — an ancestry walk, a rollup and a blocker list per
   * row — to produce two integers (roadmap `perf-agenda-history-walk`). A
   * vault with years of days behind it paid all of that on every keystroke
   * anywhere in it.
   *
   * KEYS IN DAY ORDER, like the index it counts and for the same readers: what
   * is LATE is the days before today, so the count is a walk of these keys that
   * stops at today — and the agenda's back half walks exactly the days this map
   * holds ({@link ./agenda.ts}'s `behind`), since a day owing nothing is not a
   * day that page draws.
   *
   * ITS KEY SET MOVES ON ITS OWN, which is why it is a map of its own rather
   * than a second column on `byDay`: a task finished on a day the calendar
   * still has something on takes that day out of THIS index and leaves the
   * other one exactly where it was.
   */
  readonly owedByDay: ReadonlyMap<string, number>
  /**
   * Every day the set has, in day order — {@link Derived.byDay}'s keys as an
   * ARRAY, so a reading that begins in the MIDDLE of the line can jump to it.
   *
   * A map's keys can only be stepped from the front. Two readings begin
   * somewhere else — the calendar at a month, the agenda's forward half at
   * tomorrow — and each of them reached its starting point by walking every
   * earlier day and doing nothing with it (`perf-agenda-history-walk`:
   * `continue` over ten years of daily notes, per month paged, per subscriber,
   * per published revision). An array is what makes that a BINARY SEARCH
   * ({@link dayAt}) instead.
   *
   * THE SAME KEYS AND THE SAME ORDER as `byDay`, never a second opinion about
   * which days the set has: it is built from that map, and rebuilt from it
   * whenever the patcher moves that map's key set — which is the same edit that
   * re-sorts those keys, and nearly no edit at all ({@link ./patch.ts}'s
   * `dating`).
   */
  readonly days: ReadonlyArray<string>
}

/** The fields of {@link Derived} that are INDEXES — every one of them but the
 *  two LISTS, which are {@link Derived.byFile} read the other way and
 *  {@link Derived.byDay}'s keys rather than tables of their own. */
export type Index = {
  [K in keyof Derived]: Derived[K] extends ReadonlyMap<string, unknown> ? K : never
}[keyof Derived]

/**
 * HOW EACH INDEX IS READ — one row per index, and the one place that partition
 * is written down.
 *
 * It is a fact about each index's CONSUMERS: does anything in the tree walk it
 * whole, or does everything ask it for a key? {@link ./patch.ts} spends it,
 * because the answer decides whether an edit carries that index forward as a
 * LAYER over the map that stood or as a clone of it ({@link ./overlay.ts}
 * argues the trade and `./patch.bench.ts` prices both halves). But it is not
 * the patcher's fact and it does not live there: it is about the readers of the
 * value declared above, so it is declared beside them, where the doc comment on
 * each index already says who reads it and how.
 *
 * EXHAUSTIVE BY THE TYPE, which is the point of it being a table rather than a
 * word at each of a dozen call sites, where it began. An index added to
 * {@link Derived} fails the typecheck until somebody says how it is read — and
 * the benchmark and the property test read their two lists out of THIS, so a
 * row that moves moves everywhere rather than in three places out of four.
 *
 * WHEN A ROW MOVES: a new consumer that walks one of the by-key indexes whole,
 * or the last whole-index reader of one of the others going away. Both are
 * changes to who reads the index, which is the fact this table is.
 */
export const READ: { readonly [K in Index]: Read } = {
  /** `byId.get(id)` on every reference the validator resolves and every row a
   *  page draws; its one whole-index reader wants `keys()`, which a layer hands
   *  over without a lookup per entry (`./suggest.ts`'s did-you-mean). */
  byId: "by key",
  /** What hangs under a node, asked per row drawn and per rollup counted. */
  children: "by key",
  /** What a node shows, asked per row and per edge judged. */
  status: "by key",
  /** What a node waits on, asked per node. */
  after: "by key",
  /** What is in a node's way, asked per row and per page. */
  blocked: "by key",
  /** Which placements stand for a node, asked per node a backlink situates. */
  mirrorsOf: "by key",
  /** Who is waiting on a node, asked per node whose mark moved. */
  edgesTo: "by key",
  /** WALKED: the flat reading of the corpus is this map's values run together
   *  ({@link Derived.nodes}), and tag completion and the pin shelf walk its
   *  keys. Also the one row close enough to have been timed rather than argued
   *  — `./patch.ts`'s `regrouped` carries the numbers. */
  byFile: "whole",
  /** WALKED: the validator reports every id nothing declares by reading every
   *  entry of this map (`./validate.ts`'s `checkTargets`). */
  namedBy: "whole",
  /** WALKED: tag completion reads every key and every member to rank them
   *  (`./vocabulary.ts`). */
  taggedBy: "whole",
  /** WALKED: the agenda's two directions and the calendar's month step this
   *  map's entries (`./agenda.ts`, `./dates.ts`). */
  byDay: "whole",
  /** WALKED: what is late is this map's keys up to today, added up — the count
   *  and the page's own back half both step them (`./agenda.ts`). */
  owedByDay: "whole",
}

/**
 * One record filed under the node it hangs beneath — how {@link Derived.children}
 * is KEYED, in one place, for {@link nameInto}'s reason and with one of its own.
 *
 * A record with no `parent` files NOTHING, which is what keeps this index from
 * holding a key for every root in the directory — the "skips the records with
 * no key at all" the walk below names, and the reason this is not
 * `Map.groupBy`.
 *
 * THE ORDER IS NOT HERE, and that is deliberate rather than an omission: a
 * single walk of a corpus-ordered list gets sibling order for free and sorts
 * once at the end ({@link byOrd}, below), while a patcher MERGING records that
 * arrive from two directions has to say the tie out loud (`./patch.ts`'s
 * `bySibling`). Two callers with genuinely different information, so what they
 * share is the filing and not the sort.
 *
 * IT IS A FUNCTION because the patcher files into this index too, over the
 * records one changed file brought in ({@link ./patch.ts}), and it had reached
 * for `Map.groupBy` with a filter in front of it — the same answer arrived at
 * the other way, which is precisely the second spelling the three folds beside
 * this one exist to stop. What each of the four says is now asked of one
 * function per index, by the rebuild and by the patch alike.
 */
export const parentInto = (
  children: Map<string, Array<Located>>,
  located: Located,
): void => {
  const parent = located.node.parent
  if (parent === undefined) return
  const siblings = children.get(parent)
  if (siblings === undefined) children.set(parent, [located])
  else siblings.push(located)
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
export const writtenTags = (node: Node): ReadonlyArray<Tag> => {
  if (isMirror(node)) return NO_TAGS
  const title = tagsIn(node.title)
  const note = node.desc === undefined ? NO_TAGS : tagsIn(node.desc)
  // Three answers rather than one concat, and each shares a list the caller
  // does not own: most records say nothing at all, and of the ones that do,
  // most say it in one of the two places. Statements rather than a nested
  // ternary — the same three arms, read top to bottom.
  if (note.length === 0) return title
  if (title.length === 0) return note
  return [...title, ...note]
}

/** The answer for prose that tags nothing: ONE list, shared. */
const NO_TAGS: ReadonlyArray<Tag> = []

/**
 * The tags of one string, as written — {@link titleParts}, kept.
 *
 * EXPORTED since PR 2, and for one caller: a markdown BODY is prose the same
 * way a note is, so a document's face is tagged by this rather than by a
 * second walk of the same alphabet (`./document.ts`). The name lost its
 * `written` because nothing else here answers "the tags of a string" — the
 * record-shaped question next door keeps it.
 *
 * THROUGH THAT WALK rather than through a second one over {@link titleTagRe},
 * which is what this was: where a tag starts and stops is one function's
 * answer, and a private loop here would be a second walk of that alphabet
 * keeping its own boundaries. The argument for the loop is that it allocates
 * neither the prose between the tags nor the written form (a match IS one).
 *
 * WHAT IT IS WORTH IS PRINTED rather than remembered, and the figure MOVED:
 * `patch.bench.ts`'s `walks` times the corpus's prose three ways, and on the
 * bench vault the loop is about 9ms against this walk's 12ms — a quarter,
 * where the same comparison read three per cent before {@link titleParts}
 * stopped asking `matchAll` for an iterator. The regex used to dominate; it no
 * longer does, so what the parts cost is visible.
 *
 * IT IS STILL NOT TAKEN HERE, and the reason is scope rather than the number:
 * a tag-only walk beside the one every renderer uses is a second shape of the
 * same question, on the hot path, and it belongs in a change that is about
 * that rather than riding along with an index re-key. The leg is what makes it
 * a decision somebody can re-take — three arms, one command — instead of a
 * sentence quoting a laptop.
 *
 * The cheap negative is {@link mayHoldTag}, which is the guard for a walk that
 * wants both sigils — and this one does, since the index behind it is the
 * whole of what prose tagged rather than one namespace of it.
 */
export const tagsIn = (text: string): ReadonlyArray<Tag> => {
  if (!mayHoldTag(text)) return NO_TAGS
  let found: Array<Tag> | undefined
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
  // of a built-in (the same note #198 took). The five tables below are not
  // that shape: one keeps the FIRST claim rather than every one, one skips the
  // records with no key at all, one keys a record by every id it names, one by
  // every tag its prose writes, and one by every DAY its dates fall on (which
  // is 0, 1 or 2 keys per record, so not a grouping at all) — so they share one
  // walk, since none of them reads what another builds and splitting them is
  // five passes to ask five things about a record already in hand.
  const byFile = Map.groupBy(nodes, (located) => located.file)

  const byId = new Map<string, Located>()
  const children = new Map<string, Array<Located>>()
  const namedBy = new Map<string, Array<{ at: Located; fields: Array<TargetField> }>>()
  const taggedBy = new Map<string, Array<LocatedRegular>>()
  const dated = new Map<string, Array<Dated>>()

  for (const located of nodes) {
    if (!byId.has(located.node.id)) byId.set(located.node.id, located)

    parentInto(children, located)
    nameInto(namedBy, located)
    tagInto(taggedBy, located)
    dateInto(dated, located)
  }

  // Sorted rather than trusted: a set assembled file by file already arrives
  // this way (and `Map.groupBy` keeps encounter order), but the promise is
  // about what the index MEANS — the records in the order they are on disk —
  // not about how the caller happened to build the list it handed over.
  for (const own of byFile.values()) own.sort(byLine)
  // `ord` is a fractional index over base62, so plain string comparison IS the
  // sort; file order breaks ties rather than leaving them to the engine.
  for (const siblings of children.values()) siblings.sort(byOrd)
  // The one index here whose KEYS are promised in an order the walk does not
  // already give ({@link Derived.byDay}): a set is in corpus order, and the days
  // its records name arrive in no order at all.
  const byDay = new Map([...dated].sort(([one], [other]) => byDayKey(one, other)))
  // The two READINGS of that index that are kept beside it rather than taken
  // per read: which days there are, in order, and how much each owes
  // ({@link Derived.days}, {@link Derived.owedByDay}). Both are functions of
  // `byDay` alone — one walk of the map that was just sorted — which is what
  // lets the patcher carry them and recount only the days an edit touched.
  const days: Array<string> = []
  const owedByDay = new Map<string, number>()
  for (const [day, own] of byDay) {
    days.push(day)
    const owed = owingOn(own)
    if (owed > 0) owedByDay.set(day, owed)
  }

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
    byDay,
    owedByDay,
    days,
  }
}

/** Ascending by day — {@link Derived.byDay}'s promised key order, and effect's
 *  own comparator rather than a hand-rolled one, for the reason every other day
 *  comparison in this package reaches for it (`./dates.ts`): a day is TEXT, and
 *  `localeCompare` would put the same one in two orders on two machines.
 *  Exported for the patcher, which re-sorts the keys an edit added rather than
 *  re-deciding what day order is. */
export const byDayKey: (a: string, b: string) => number = Order.String

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
 * base62, so plain string comparison IS the sort, and the LINE breaks ties
 * rather than leaving them to the engine.
 *
 * THE LINE AND NOT THE FILE, which is what this comparator itself settles —
 * said precisely here because two callers now lean on the difference. Siblings
 * share a parent and `parent` is same-file by the format, so the line is the
 * whole answer for every set the validator accepts. Where it is NOT — a set
 * that has been condemned, whose children come from two files — this leaves the
 * pair equal, and where the ORDER of that pair is answered is one level up:
 * {@link derive}'s walk is in corpus order and its sort is stable, so the file
 * decides by the pair rather than by this function. A caller that MERGES two
 * lists instead of sorting one cannot get that for free and has to spell the
 * pair out, which is exactly what `./patch.ts`'s `bySibling` is.
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

/**
 * The ROOTS of one outline — its top-level records, in sibling order, with the
 * placements dropped.
 *
 * {@link siblingsOf} asked at the top of a file is about PLACES, so a mirror is
 * one of them; this is about what the file HOLDS, so it is not — the same
 * division {@link countedChildren} makes one level down, and the reason it is
 * named rather than left as a filter at each caller: the mirror drop was
 * spelled three different ways (a `!isMirror` predicate, an `isMirror` skip
 * inside a `flatMap`, an `isRegular` filter) by three readers asking one
 * question, which is exactly the rule-that-disagrees-with-itself {@link
 * counted} warns about.
 *
 * IN SIBLING ORDER, which is a real claim and not the incidental one: `ord` is
 * what a reader sees, and a file's lines are not sorted on emit. `OutlineSummary`'s
 * `roots` deliberately does NOT come through here — a listing names a file's
 * titles in the order the FILE writes them (`@olai/ops`' `outlines`, and the
 * case that pins it) — and the two differing is a fact worth knowing rather
 * than a bug: one is about the file, this is about the tree.
 */
export const rootsOf = (
  derived: Derived,
  file: string,
): ReadonlyArray<LocatedRegular> => siblingsOf(derived, file, undefined).filter(isRegular)

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
    // A leftover Archive.olai is not a live placement: it is not drawn on
    // the trash page (unlike `_olai/Trash.olai`, which still counts) and it
    // is not a live outline. Filing it here would make `is:mirrored` re-enter
    // an orphaned file.
    if (isLeftoverArchive(located.file)) continue
    const mirrors = mirrorsOf.get(found.shows.node.id)
    if (mirrors === undefined) mirrorsOf.set(found.shows.node.id, new Set([located.node.id]))
    else mirrors.add(located.node.id)
  }
  return { status, mirrorsOf }
}

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
 * is `Exclude<Status, Settled>`. `undefined` — a node nobody marked — is not
 * unfinished work; it is not work. The trap this is written against is
 * spelling it `mark !== "done"`, which reads every plain bullet as something
 * outstanding — and the SECOND trap, which the fourth mark walked into, is
 * spelling it `mark !== "done"` once the list has two words in it: that reads a
 * cancelled task as work somebody still owes, which is the one thing "not
 * happening" says it is not. {@link ./node.ts}'s `settles` is the list, asked
 * here rather than restated.
 */
export const unfinished = (
  mark: Status | undefined,
): mark is Exclude<Status, Settled> => mark !== undefined && !settles(mark)

/**
 * Is this node WORK that nobody has finished?
 *
 * {@link unfinished} asked of the mark the node STORES — one composition,
 * because the agenda's predicates and {@link owingOn} below are the same
 * question asked with and without a day, and a second `storedMarker` walk
 * would be a second chance to write `!== "done"` again. Named apart from
 * {@link unfinished} so a node-taking helper cannot shadow the mark-taking one,
 * which is how the old local survived.
 *
 * HERE rather than in `./agenda.ts`, where it was spelled and where every
 * reader of it still lives, because the index this file keeps is counted with
 * it ({@link Derived.owedByDay}) and a fold cannot live above the reading it
 * feeds — the same rule that put {@link ./occasion.ts}'s `dateInto` one module
 * below the day readings.
 *
 * ## THE FOURTH MARK LANDED HERE, and this is the contract it kept
 *
 * WHAT COUNTS AS UNFINISHED WORK is decided in exactly two places, and they
 * are twins: THIS predicate (through {@link unfinished}) and
 * {@link ./node.ts}'s `Unfinished`, which is `MARKS` with the settling marks
 * filtered out. Both used to be written as "everything that is not `done`" —
 * exactly right for three marks, and a decision disguised as an omission for a
 * fourth. Both now ask {@link ./node.ts}'s `settles` of the mark, which is one
 * LIST rather than one word.
 *
 * A mark added to `MARKS` and nowhere else is, by DEFAULT, unfinished work: a
 * dated node carrying it stays overdue, stays in {@link Derived.owedByDay}'s
 * tally, stays on the agenda, keeps its date badge burning and goes on blocking
 * whatever waits on it. That is the right default for a mark that means
 * somebody still has to do this, and the wrong one for a mark that SETTLES.
 * `cancelled` is that case (the human, 2026-08-25) and it took the one seam
 * this header promised: naming it in `SETTLED` is what made a cancelled task
 * un-owed on the count, the page, the badge and the blocker arrow at once.
 * A reading that had spelled the rule for itself would be the one left saying a
 * cancelled task is still owed — and there was none, which is what the
 * contract was for.
 *
 * WHAT SETTLING DOES NOT MEAN is that the two marks are interchangeable. Every
 * reading that asks WHICH mark still gets a different answer — a day page names
 * the occasion, a glyph draws a check or a cross, a commit line says `done:` or
 * `cancelled:`. What they share is that nobody is waiting.
 */
export const unfinishedWork = (node: RegularNode): boolean =>
  unfinished(storedMarker(node))

/**
 * How much one day OWES — {@link Derived.owedByDay}'s value, from
 * {@link Derived.byDay}'s list.
 *
 * ONE ENTRY PER RECORD falls out rather than being deduplicated, and it is the
 * whole reason this is a filter and a length rather than the `Set` of records
 * the day PAGE builds (`./dates.ts`'s `groupedOn`). A record's two dates are
 * its `date` and a dated `done` ({@link ./occasion.ts}'s `datesOf`), and the
 * second is filed only for a record whose mark IS `done` — which is not
 * unfinished work. So the owed half of a day holds at most the `date` entry of
 * any record, and a node scheduled and finished on one day contributes nothing
 * here rather than contributing twice.
 *
 * Counted rather than collected, which is the point of the index: what asks
 * this wants a number, and the rows behind it are dressed where a page actually
 * draws them.
 */
export const owingOn = (dated: ReadonlyArray<Dated>): number => {
  let owed = 0
  for (const one of dated) {
    if (unfinishedWork(one.at.node)) owed++
  }
  return owed
}

/**
 * WHERE A DAY SITS ON THE LINE, or where it would: the first index of `days`
 * that is not before `value`, by binary search.
 *
 * {@link Derived.days} is what makes this possible and this is the whole of
 * what it is for — a reading that starts at a month or at tomorrow jumps here
 * instead of stepping over every earlier day to reach it
 * (`perf-agenda-history-walk`).
 *
 * TOTAL IN `value`, and deliberately not "a day": a MONTH (`2026-08`) is a
 * shorter prefix and lands on that month's first day, and a DATETIME lands past
 * its own day — both of which are what plain code-point order over ISO text
 * already means, and both of which its two callers spend. An answer of
 * `days.length` means every day the set has is before `value`, which is a
 * caller's empty walk rather than a missing answer.
 */
export const dayAt = (days: ReadonlyArray<string>, value: string): number => {
  let low = 0
  let high = days.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if ((days[middle] as string) < value) low = middle + 1
    else high = middle
  }
  return low
}

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
 *
 * ## A CANCELLED CHILD LEAVES THE DENOMINATOR
 *
 * The fourth mark's second open question (2026-08-25), and the answer is that
 * `3/5` counts the things that are HAPPENING. A cancelled child is neither
 * finished nor outstanding, and the two other answers are both worse:
 *
 *   - **counted as done** (`3/5` where two were finished and one was called
 *     off) makes the numerator a lie about how much got done, on the one
 *     annotation a reader trusts to say exactly that;
 *   - **left in the denominator as outstanding** (`2/5` that can never reach
 *     `5/5`) makes the rollup permanently unfinishable, which is the reading a
 *     settling mark exists to end. Nobody is waiting on that child, so nothing
 *     should go on counting it as something still to do.
 *
 * Dropped, `2/4` says four things are on and two are finished, and the branch
 * can reach `4/4` by finishing them. A parent whose children were ALL cancelled
 * has a total of zero and shows no rollup at all — which is the sentence
 * directly above read once more: nothing under it is happening, so there is no
 * progress to show rather than progress of zero.
 *
 * The row does not lose the fact — the cancelled child is still drawn, struck
 * through, on its own line. What it loses is a claim in a two-integer badge
 * that has nowhere to put "and one is not happening".
 */
export const Progress = Schema.Struct({
  done: Schema.Int,
  total: Schema.Int,
})
export type Progress = typeof Progress.Type

export const progressOf = (derived: Derived, id: string): Progress | undefined => {
  const tasks = tasksUnder(derived, id)
  // Counted in place rather than filtered: this runs once per drawn row, and
  // the answer is two integers.
  let done = 0
  let total = 0
  for (const task of tasks) {
    if (task.status === "cancelled") continue
    total += 1
    if (task.status === "done") done += 1
  }
  return total === 0 ? undefined : { done, total }
}

/**
 * One ROUND's span: `settled` minus `started`, in WHOLE SECONDS, clamped at
 * zero — or `undefined` when either end will not read as an instant.
 *
 * THE ONE SUBTRACTION this format does, and the reason it is a function:
 * two readers answer with it — {@link tookOf}, for the node whose rounds
 * predate the bank, and `set_done` / `set_cancelled` themselves, at the
 * moment they BANK the round they close into `worked` (`@olai/ops`' plan).
 * Spelled twice, the rounding or the clamp would drift between what a
 * settle counts and what a read reports, and the bank and the answer must
 * be the same arithmetic.
 *
 * A NEGATIVE is clamped to zero: a `started` after the settling instant is
 * a record a hand or a merge wrote, and a span of minus six minutes is a
 * worse answer than none of the truth at all. The values are validated ISO
 * by the time a set reaches here (`./parse.ts`), and this still asks rather
 * than assumes, for {@link drawingPath}'s reason: a set already condemned
 * is still read.
 */
export const spanOf = (started: string, settled: string): number | undefined => {
  const from = Date.parse(started)
  const at = Date.parse(settled)
  if (Number.isNaN(from) || Number.isNaN(at)) return undefined
  return Math.max(0, Math.round((at - from) / 1000))
}

/**
 * How long the work TOOK, in WHOLE SECONDS — and one more ANNOTATION, to the
 * rule {@link progressOf} keeps: it decides nothing, it is derived and never
 * stored, and it is `undefined` rather than zero when there is no span to
 * tell.
 *
 * THE BANK ANSWERS FIRST: a record carrying `worked` has had its rounds
 * closed for it already — every settle added the one it closed
 * (`./node.ts`), so a settled node's answer is the bank ITSELF, rounds
 * summed and pauses never counted. The arithmetic below is the SLIMMER
 * case: a record with no bank asks the one-round question it always asked,
 * settling instant minus `started`, which is also what the first settle of
 * a banked record had in hand when it wrote it — the two arms answer one
 * number for one round, so a node whose first settle writes `worked`
 * answers the same seconds before and after.
 *
 * THREE cases still answer `undefined`, and each is a refusal to invent a
 * past:
 *
 *   - NO SETTLING MARK. A `doing` node's span is still running, and the
 *     running half is a reading of a clock — the browser ticks it locally:
 *     the bank plus now minus the stored instant (`@olai/web`'s `took.ts`),
 *     which is why the wire carries the INSTANT and the BANK, never a
 *     duration;
 *   - neither a bank NOR a `started`. A todo→done jump has no round, and
 *     `created` is never the fallback — that measures the node's age, not
 *     the work;
 *   - a settling mark holding `true` on a record with no bank, the shape
 *     finished work written before instants still has: it says the wait
 *     ended and declines to say when, so there is nothing to subtract
 *     from.
 *
 * The two settling marks are read the same way — a `cancelled` node's bank
 * is the time sunk before it was called off, exactly as `./occasion.ts`
 * reads the pair for a day.
 */
export const tookOf = (node: RegularNode): number | undefined => {
  const mark = storedMarker(node)
  if (mark === undefined || !settles(mark)) return undefined
  if (node.worked !== undefined) return Math.max(0, node.worked)
  const started = node.started
  if (started === undefined) return undefined
  const settled = node[mark]
  if (typeof settled !== "string") return undefined
  return spanOf(started, settled)
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
 * `Exclude<Status, Settled>` says the whole rule in the type: what is in the
 * way is unfinished WORK. A node with no status is absent from this shape
 * entirely — it is not a task, so there is nothing under it to finish — and so
 * is a CANCELLED one, which is the same sentence with the fourth mark in it:
 * work that is not happening is not work anybody is waiting for. Neither is a
 * second rule, since {@link unfinished} is the predicate both this and
 * {@link unfinishedWithin} are built from, about the two different kinds of
 * edge.
 */
export const InTheWay = Schema.Struct({
  at: LocatedRegular,
  /** `./node.ts`'s {@link Unfinished}, which is {@link Status} minus the marks
   *  that settle — the rule in the type, read off the one list rather than
   *  written out. */
  status: Unfinished,
})
export type InTheWay = typeof InTheWay.Type

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
  if (at === undefined || isPutAway(at.file)) {
    return undefined
  }
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
 * `a after b` means b blocks a WHILE b is a task nobody has settled — with the
 * four marks there are, while b is `doing` or `todo`. A target with NO status
 * never blocks: it is not a task, there is nothing under it to finish, so
 * there is nothing to wait for. Nor does a CANCELLED one: "not happening" ends
 * the wait exactly as finishing does, so anything `after` it unblocks the
 * moment the mark lands (the human, 2026-08-25). The trap this rule is written
 * against is spelling it `status !== "done"`, which reads every plain bullet as
 * an obstacle that can never be cleared — and, once a second settling mark
 * exists, reads work somebody called off as an obstacle nobody can clear at
 * all, since the way to clear it is the very mark being ignored
 * (docs/format.md).
 *
 * ONE predicate, read at BOTH ENDS of the arrow, which is the racket
 * reference's own shape (`olai/query.rkt`'s `live?`): "a node this can be said
 * about" and "a node that still stands in the way" are the same question asked
 * from either side, and two spellings of it would be two chances to disagree
 * about what unfinished work is. So a done node is waiting on nothing — it has
 * happened, and the order it happened in is no longer a question — a CANCELLED
 * one is waiting on nothing either, since it is not going to happen and the
 * order is no longer a question for that reason instead, and a bullet is
 * neither blocked nor blocking, because a bullet is not work.
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
 * aim, before the key (`./moving.ts`).
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
 * WHETHER THIS NODE IS DRAWN ANYWHERE ELSE — {@link Derived.mirrorsOf} asked
 * by a caller that only wants the answer yes or no.
 *
 * {@link isBlocked}'s shape one index over, and here for the same two reasons.
 * Absence is how that index spells "nothing" — a node nothing mirrors has no
 * entry, never an empty set (`./patch.ts` deletes a key whose last member
 * leaves) — so the presence of a key IS the answer, with no set minted to have
 * its size read. And the reading side is where both halves of that convention
 * belong: the caller is `filter.ts`'s `is:mirrored`, which asks this of every
 * node of the directory on every keystroke of the filter box, and whose
 * negation is the form that touches nearly all of them, since almost nothing
 * is placed twice.
 *
 * CHAINS FOLLOWED and THE TRASH INCLUDED, both inherited from the index
 * rather than decided here — which is what makes this the same answer
 * `read_node` hands back as `mirrors` (`@olai/ops`' `placementsOf`). A
 * placement in an `_olai/Trash.olai` is a placement: it is where the node is drawn
 * on the trash page, and a reader who put one copy away has not thereby
 * unmirrored the node.
 */
export const isMirrored = (derived: Pick<Derived, "mirrorsOf">, id: string): boolean =>
  derived.mirrorsOf.has(id)

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

/**
 * Fields every row has, whatever it turned out to be.
 *
 * A SCHEMA rather than the interface it was, for {@link LocatedRegular}'s
 * reason: since `vault-in-browser`'s PR 10 the rows of a page are what the WIRE
 * carries, so the shape a walk produces and the shape an encoder reads have to
 * be one declaration. Nothing about a row changed with that — the browser
 * draws the value this walk has always built, computed on the side that holds
 * the set.
 */
interface Place {
  readonly at: Located
  readonly status?: Status | undefined
  readonly blocked: ReadonlyArray<InTheWay>
  readonly progress?: Progress | undefined
  readonly key: string
  readonly under: number
  readonly children: ReadonlyArray<Row>
}

const PLACE = {
  /** The record occupying this place — the mirror itself, for a mirror. */
  at: Located,
  /** Absent when this place draws a plain bullet — there is no mark, and no
   *  box to draw one in. */
  status: Schema.optional(Status),
  /** What this place is waiting on, and empty when nothing is. Asked of the
   *  node the place SHOWS, so a mirror says what its target says — the rule
   *  its status already follows — and a place drawing no node at all is
   *  waiting on nothing. */
  blocked: Schema.Array(InTheWay),
  /** The rollup, for a row that has tasks under it: an annotation beside the
   *  title, never a second answer to what the checkbox shows. */
  progress: Schema.optional(Progress),
  /** Stable identity of this PLACE, not of the node. The same node reached
   *  through two mirrors is two rows on screen, and folding one must not fold
   *  the other. */
  key: Schema.String,
  /**
   * How many records hang under the node this place SHOWS, in the set —
   * {@link under}, answered once where the walk already is.
   *
   * A FACT ABOUT THE SET rather than about the rows below, and the difference
   * is the whole reason it rides here. What a reader is asked to agree to when
   * they archive a row must be what the write moves, and the children under
   * this one are a READING: done-hiding has already dropped branches from
   * them, a filter may have pruned more, and a mirror among them draws records
   * of some live outline that archiving this row does not touch. Counting the
   * rows would understate every one of those.
   *
   * It was the browser's own walk of its copy of the set, per row, on every
   * menu opened (`@olai/web`'s `menu/subtree.ts`). The rule did not move; the
   * set did.
   */
  under: Schema.Int,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Row> => Row)),
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

export const Row: Schema.Codec<Row> = Schema.Union([
  Schema.Struct({
    ...PLACE,
    kind: Schema.Literals(["node", "mirror"]),
    shows: LocatedRegular,
  }),
  Schema.Struct({ ...PLACE, kind: Schema.Literal("dangling"), missing: Schema.String }),
  Schema.Struct({ ...PLACE, kind: Schema.Literal("cycle"), through: Schema.String }),
])

/**
 * HOW MANY RECORDS HANG UNDER A NODE — every descendant, however deep, counted
 * in the set rather than on a screen.
 *
 * The number a `Move to Trash` has to name: an archive takes the whole subtree,
 * and a page hiding what is done — or narrowed by a filter — is drawing fewer
 * rows than the write moves. It was `@olai/web`'s `menu/subtree.ts`, walking
 * the browser's own copy of the directory per row per opened menu, and it is
 * here for the reason every other reading moved here: this is where the set is.
 *
 * TOTAL over a set the validator would condemn. Parent links form a forest in
 * any set that validates, so the memo below is a cache; in one whose links
 * close a loop it is also the guard, since a node is filed at zero before its
 * own walk and a second arrival reads that rather than recursing for ever.
 */
export const under = (derived: Pick<Derived, "children">, id: string): number =>
  descendants(derived, id, new Map())

/** {@link under}, sharing one memo across a whole walk — which is what makes
 *  a row per node cost the tree once rather than once per row. */
const descendants = (
  derived: Pick<Derived, "children">,
  id: string,
  memo: Map<string, number>,
): number => {
  const held = memo.get(id)
  if (held !== undefined) return held
  memo.set(id, 0)
  const count = (derived.children.get(id) ?? []).reduce(
    (total, child) => total + 1 + descendants(derived, child.node.id, memo),
    0,
  )
  memo.set(id, count)
  return count
}

/** The rows of one outline: the roots of `file`, expanded. Mirrors are
 *  expanded in place, because a pointer the reader has to go and follow is not
 *  a second location — it is a footnote. */
export const rowsOf = (derived: Derived, file: string): ReadonlyArray<Row> => {
  // ONE memo for the file's whole tree — see {@link descendants}.
  const counting = new Map<string, number>()
  return siblingsOf(derived, file, undefined).map((root) =>
    expand(derived, root, [], "", counting)
  )
}

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
  const counting = new Map<string, number>()
  return (derived.children.get(shows.node.id) ?? []).map((child) =>
    expand(derived, child, within, "", counting)
  )
}

const expand = (
  derived: Derived,
  at: Located,
  ancestors: ReadonlyArray<string>,
  parentKey: string,
  counting: Map<string, number>,
): Row => {
  const key = `${parentKey}/${at.node.id}`
  const found = follow(derived, at)
  const status = derived.status.get(at.node.id)
  // The fields every branch shares. What a place is WAITING ON is asked of the
  // node it shows, which a stub has none of — and so is what hangs UNDER it,
  // which is nothing at all for a place drawing no node.
  //
  // AN ABSENT MARK IS AN ABSENT KEY, not a key holding `undefined`, and that is
  // the rule every answer in this package keeps (`./reading.ts`'s `Found`
  // spells it the same way). It matters here because a row TRAVELS: the wire
  // drops an undefined value on the way out, so a value built with the key
  // present would compare unequal to the same value read back — and the
  // comparison is what decides whether a frame is sent at all.
  const place = {
    at,
    ...(status === undefined ? {} : { status }),
    blocked: found.kind === "found" ? blockersOf(derived, found.shows.node.id) : [],
    under: found.kind === "found"
      ? descendants(derived, found.shows.node.id, counting)
      : 0,
    key,
  }

  if (found.kind !== "found") {
    return { ...place, children: [], ...found }
  }
  if (ancestors.includes(found.shows.node.id)) {
    return { ...place, children: [], kind: "cycle", through: found.shows.node.id }
  }

  const within = [...ancestors, found.shows.node.id]
  // The rollup of what this place SHOWS: a mirror's row draws its target's
  // children, so it draws its target's progress too. Absent when nothing under
  // it is a task, for the reason the mark above is.
  const progress = progressOf(derived, found.shows.node.id)
  return {
    ...place,
    ...(progress === undefined ? {} : { progress }),
    kind: isMirror(at.node) ? "mirror" : "node",
    shows: found.shows,
    children: (derived.children.get(found.shows.node.id) ?? []).map((child) =>
      expand(derived, child, within, key, counting)
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
export const Situated = Schema.Struct({
  /** The regular node at the end of the chain, whatever record was addressed
   *  to reach it. */
  shows: LocatedRegular,
  /** Absent when the node carries no mark. */
  status: Schema.optional(Status),
  /** What it is waiting on, and empty when nothing is. */
  blocked: Schema.Array(InTheWay),
  /** The rollup of its task children, for the same reason a row carries one. */
  progress: Schema.optional(Progress),
  /** The canonical parent chain, root first, `shows` excluded. */
  trail: Schema.Array(LocatedRegular),
})
export type Situated = typeof Situated.Type

export const situate = (derived: Derived, shows: LocatedRegular): Situated => {
  // Absent rather than present-and-undefined, for the reason a row's are
  // ({@link Row}'s `place`): these travel, and a key the wire drops on the way
  // out must not be a key the value was built with.
  const status = derived.status.get(shows.node.id)
  const progress = progressOf(derived, shows.node.id)
  return {
    shows,
    ...(status === undefined ? {} : { status }),
    blocked: blockersOf(derived, shows.node.id),
    ...(progress === undefined ? {} : { progress }),
    trail: ancestorsOf(derived, shows.node.id),
  }
}

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
 *  also what {@link Derived.taggedBy} is keyed by.
 *
 *  A {@link Tag}, which is the vocabulary's word for exactly this — a name in
 *  the same sense a document's path and a node's id are (`./address.ts`) — so
 *  what this walk hands back says what it is rather than being one more
 *  string. */
export const tagText = (part: TitleTag): Tag => Tag.make(`${part.sigil}${part.tag}`)

/**
 * ...and the same reading backwards: a written tag split into its two halves.
 *
 * The inverse of {@link tagText}, beside it, because {@link Derived.taggedBy}'s
 * keys are written tags and a reader that wants the namespace and the name has
 * to take one apart. Doing that at the call site is a second, private claim
 * about where the sigil is — the thing this pair exists to keep to one place,
 * which is also why {@link titleParts} splits its own matches through this
 * rather than beside it.
 *
 * It TRUSTS its argument, which is why it takes no failure: the only strings
 * this is asked about are a {@link titleTagRe} match and a key that
 * {@link tagText} wrote, and both are a sigil followed by a name.
 */
export const tagPart = (written: string): TitleTag => ({
  sigil: written[0] as TagSigil,
  tag: written.slice(1),
})

/**
 * Whether text could hold a tag AT ALL — a plain `indexOf` per sigil, and the
 * guard every walk of {@link titleParts} takes first.
 *
 * That call runs a global regex and allocates a part per segment, and most
 * prose holds no tag at all; this file's own fold ({@link tagsIn}), the
 * search index and the client's two renderings of a pill all want the same
 * cheap negative. It was written three times before this existed, and the first
 * two had already drifted (one asked about `#` only). The tag
 * COMPLETION used to be a fourth caller and is not one any more — it reads
 * {@link Derived.taggedBy} rather than walking the corpus for itself ({@link
 * ./vocabulary.ts}), which is this guard's argument taken all the way.
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

/**
 * A title, split into what to print and what to style.
 *
 * `exec` IN A LOOP rather than `matchAll`, over the same fresh
 * {@link titleTagRe} — the same walk, the same matches, and no second reader of
 * the alphabet: what changes is only that a `/g` regex is stepped rather than
 * asked for an iterator. `matchAll` clones the regex and allocates an iterator
 * per call, and this is called once per string of prose in the directory — for
 * the tag index's fold, for the search matcher's per-record fold, and per drawn
 * row in the browser, so it is a GLOBAL change and is named as one on the PR
 * that made it (#249).
 *
 * The pair is a LEG rather than a sentence, for this package's standing reason:
 * `patch.bench.ts`'s `walks` times the corpus's prose as this function is, as
 * it was, and in the shape {@link tagsIn} declines — roughly 12ms
 * against 16ms against 9ms on the bench vault, all three checked to find the
 * same tags before any of them is timed.
 */
export const titleParts = (title: string): ReadonlyArray<TitlePart> => {
  const parts: Array<TitlePart> = []
  const tags = titleTagRe()
  let at = 0
  let match: RegExpExecArray | null
  while ((match = tags.exec(title)) !== null) {
    const start = match.index
    if (start > at) parts.push({ kind: "text", text: title.slice(at, start) })
    // Split by {@link tagPart}, which is where this file says the sigil sits.
    // A match IS a written tag, so the walk that finds one and the reader that
    // takes one apart cannot come to disagree about which character it is.
    parts.push({ kind: "tag", ...tagPart(match[0]) })
    at = start + match[0].length
  }
  if (at < title.length) parts.push({ kind: "text", text: title.slice(at) })
  return parts
}
