/**
 * Reading the set, as an agent is allowed to read it.
 *
 * Every answer about an OUTLINE is about NODES: an id, a title, a mark, an
 * ancestry, a `file:line`. Never bytes, never a line of a file, never a
 * directory listing of them. That is the read half of the same decision the
 * write half makes — the agent works in the format's own terms, so the things
 * it can express are the things the format can be (https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/acp.md,
 * resolved 2026-08-09: "query tools are over parsed nodes, not raw lines").
 *
 * A DOCUMENT is the exception the write half already made, read back. A `.md`
 * has no identity below the file — no records, no ids, nothing to name a piece
 * of it by — so `write_document` takes the whole text and {@link documents} /
 * {@link document} answer with the whole text, which is the same unit read
 * rather than a byte range conceded. What is NOT here is the thing that would
 * be one: no offset, no line range, no walk of the directory that is not the
 * served set's own list.
 *
 * It is not a smaller `grep`. A grep over `.olai` answers with JSON fragments
 * out of context, invites byte-level edits back, and cannot say where a node
 * SITS — its ancestry, the tags in its title, how far the tasks under it have
 * got, none of which is in the line it would print. What an agent needs to act
 * is exactly what is here: which node, where it lives so a person can be
 * pointed at it, and what hangs off it.
 *
 * Pure functions over a snapshot, like {@link ./plan.ts} and for the same
 * reason: they are the part worth testing, and neither a disk nor a protocol
 * has any bearing on the answer.
 */

import {
  ancestorTitles,
  backlinksOf,
  blockersOf,
  bodiedIn,
  brokenBy,
  brokenIn,
  completingTags,
  countedChildren,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SUBTREE_DEPTH,
  type DatedAnswer,
  datedAnswer,
  type DatedRequest,
  type Derived,
  declarationsOf,
  type Detail,
  type DocumentBody,
  type DocumentSummary,
  errorLine,
  follow,
  type Found,
  heldCustom,
  type HomesAnswer,
  type HomesRequest,
  isMirror,
  isRegular,
  type LocatedRegular,
  markdownAt,
  markdownIn,
  MARKS,
  matchingDocuments,
  type NamedAnswer,
  type NamedRequest,
  type NarrowingAnswer,
  type NarrowingRequest,
  narrowingOf,
  NodeId,
  matching,
  type MovingAnswer,
  type MovingRequest,
  movingOf,
  nodeNamed,
  nodesOf,
  nothing,
  type OpFailure,
  type OutlineError,
  type Owed,
  owedNow,
  type OwedRequest,
  type OutlineSet,
  outlineNames,
  outlinePaths,
  type OutlineSummary,
  type PageReading,
  type PageRequest,
  type PathsAnswer,
  parseFilter,
  pageOf,
  rankedTogether,
  type Placed,
  type Placement,
  progressOf,
  type Reading,
  type Reference,
  ranked,
  rootsOf,
  type SearchAnswer,
  type SearchHit,
  type SearchRequest,
  type Stamps,
  type Subtree,
  type SubtreeAnswer,
  type SubtreeRequest,
  type TagsAnswer,
  type TagsRequest,
  tagText,
  titleParts,
  UsageFailure,
} from "@olai/format"
import type { Index } from "@olai/index"
import { Result } from "effect"

import { askedOf } from "./asked.ts"
import { noSuchDocument, notLoaded, outlineAt } from "./refusals.ts"

/**
 * Every shape an answer here has is `@olai/format`'s, and none of them is
 * re-exported — exactly as `RepoState` and `Pending` are that package's, and
 * for the reason its `./reading.ts` argues: the wire spec may not import this
 * layer, so a vocabulary spelled here would have to be spelled again there.
 *
 * These shapes TRAVEL, or are about to: `search_nodes` hands an agent a
 * `SearchAnswer` verbatim and the `search.nodes` procedure the ⌘K palette calls
 * carries the identical value to a browser, and the other three reads are the
 * ones a bridged agent would reach through a surface it cannot get an `Ops`
 * from. A second spelling in the wire spec is a second spelling free to drift
 * from this one — which search's was, and did not merely risk: a field added
 * here and produced by {@link foundOf} type-checked clean everywhere, reached
 * the agent, and was dropped by the palette's encoder. The other three moved
 * BEFORE anything carried them, which is the cheaper end of the same lesson
 * (https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/surface-mcp-positions.md).
 *
 * A CONSUMER IMPORTS THEM FROM THE FLOOR, which is where they are declared;
 * this file used to re-export the lot and rename three, and nothing anywhere
 * read a single one of those names. `Query.Outline` in particular re-made the
 * exact collision the floor renamed away from — `@olai/format` exports an
 * `Outline` that is one file's decoded NODES — one package up, in a file whose
 * whole subject is not spelling one thing twice.
 *
 * What stays HERE is every WALK: which nodes match and how they are ordered,
 * which mirrors resolve to a node, how far a subtree descends, and what a file
 * that did not parse leaves sayable. The shape is the floor's; the reading is
 * this package's.
 */

// ── where the index every query is asked of comes from ─────────────────
//
// NOT FROM HERE, which is the change worth naming: every answer below needs
// the same walk, and this file used to make it behind a memo keyed on the set's
// own identity — the right key for a derivation nobody carried, since the
// validator built one, dropped it, and the first reader of the published set
// built it again. The pair is published now (`@olai/format`'s `Reading`, which
// is what `validate` answers with and what {@link ./deps.ts}'s store holds), so
// the derivation arrives with the snapshot and the memo has nothing left to
// save. A caller holding a bare set and no derivation is a test fixture, and it
// reaches the records through the outlines they are written in — there is no
// node-only list on the set to ask for (`@olai/format`'s `set.ts`).

/**
 * One node, situated — the shape every read here answers with.
 *
 * PUBLIC for the same reason `notFound` and `notANode` are: a caller above
 * this layer situates the same node for the same agent. `@olai/server` builds
 * the line that names a node a chat message is ABOUT, and "where does a node
 * live, and what does it hang under" is a question this file already answers —
 * a second answer to it up there would be free to drift from the one
 * `read_node` gives about the same id in the same turn. The `.map` those two
 * shared is the format's own now (`ancestorTitles`), because a THIRD reader
 * arrived that cannot import this layer at all: the chat composer's `@` row.
 */
export const foundOf = (derived: Derived, located: LocatedRegular): Found => {
  const status = derived.status.get(located.node.id)
  return {
    id: located.node.id,
    title: located.node.title,
    file: located.file,
    line: located.line,
    // Omitted rather than sent as a word for "none" — the same rule the format
    // applies to its own absent fields, and an agent reading a corpus of notes
    // should not have to filter a status out of every answer.
    ...(status === undefined ? {} : { status }),
    path: ancestorTitles(derived, located.node.id),
    ...carriedOf(located.node),
  }
}

/**
 * The record's OWN fields, handed back verbatim, each omitted when it holds
 * nothing — everything a situated answer copies rather than derives.
 *
 * ONE helper because that is ONE QUESTION, and the name says which. It was
 * `edgesOf` over `see` and `after`, named for what those fields ARE, and the
 * comment on it conceded the strain: one helper "because the two fields differ
 * only in name here". A category is not an axis, and the cost arrived the day
 * this set grew — `custom` is not an edge, so a hit given it could not go
 * through the helper and landed BESIDE it, with a third spelling of "does this
 * hold anything" beside that. The name is what forced the duplication.
 *
 * What these fields have in common is not their meaning — that differs
 * everywhere else, which is why they have separate verbs and separate prose on
 * {@link Found} — it is their TREATMENT here, and the treatment is what this
 * names. The set is what changes: `after` joined `see`, `custom` joined both,
 * and the next record field a reader is allowed to see joins them here, on one
 * line, without re-deciding what absent means.
 *
 * `nothing` and `heldCustom` are the FORMAT's, not restated: a field left out
 * of an answer is exactly a field left out of the line on disk, and `prop:` and
 * `has:` ask the same two functions from the query's end.
 *
 * VERBATIM IS ALSO WHAT IS NOT DONE HERE, and the case that names it is the
 * edge fields: they are SETS, so a target a hand-written record names twice is
 * named once wherever the RELATION is read — the links a page draws, the
 * ordering graph blockedness comes off (docs/format.md). This answer is the
 * RECORD, which is the thing `set_see` / `set_after` are about to edit and the
 * thing a reader is deciding to fix, so it is handed over as the line holds
 * it. Nothing an op writes can put a repeat there: a re-add is a no-op.
 */
const carriedOf = (
  node: LocatedRegular["node"],
): Pick<Found, "parent" | "see" | "after" | "custom"> => {
  // Pruned first, so what `nothing` is asked about is what the file would hold:
  // a map of keys that all hold nothing is `{}`, and `{}` is nothing.
  const custom = heldCustom(node.custom)
  return {
    // The parent's id, absent at a root — the record's own field, omitted the
    // same way an empty edge list is. `path` beside it is titles; a write takes
    // this.
    ...(node.parent === undefined ? {} : { parent: node.parent }),
    ...(nothing(node.see) ? {} : { see: node.see }),
    ...(nothing(node.after) ? {} : { after: node.after }),
    ...(nothing(custom) ? {} : { custom }),
  }
}

// ── search ─────────────────────────────────────────────────────────────

/**
 * A query, ranked and shortened — the reading behind `search_nodes` and behind
 * every box a person types into.
 *
 * WHAT MATCHES IS NOT DECIDED HERE any more, and that is the whole of the
 * filter-in-place change: the words, the operators (`is:`, `has:`, `date:`,
 * `created:`, `changed:`, `prop:` and their negations), the archive rule and
 * which field carried a hit all live in
 * `@olai/format`'s `filter.ts`, because a browser narrowing rows it already
 * holds cannot call this procedure on every keystroke and must not answer
 * differently for having to do it itself. One matcher, five callers; that
 * file's header names them and https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/filter-in-place.md argues it.
 *
 * NEITHER IS THE ORDER, as of the chat composer's `@` list: the done penalty
 * and the sort went down to the matcher with the same argument one door later
 * ({@link ranked}) — a completion in a browser cannot call this and must not
 * hold a second opinion about whether a finished node outranks an open one.
 * The CAP stayed, because a row count is a fact about a door rather than about
 * a query: twelve here, eight in that completion, and a floor holding either
 * would be holding somebody else's layout. What is left with it is the
 * SITUATING, which is this layer's alone ({@link foundOf}), the uncapped total,
 * so "twelve of ninety" is sayable, and CARRYING THE REFUSAL, because this is
 * the only layer that has both the parser's answer and a caller to hand it to.
 *
 * SHORTENED BEFORE IT IS SITUATED, which is a change of order rather than a
 * change of answer: a hit carries the ancestor titles `ancestorsOf` walks to
 * find, and building one for every node a common word selects — to keep twelve
 * — was thousands of walks up a tree on a large vault, thrown away by the next
 * line. Ranking asks only for the score and the mark, and both are in hand.
 */
export const search = (
  /** BOTH HALVES of the reading, because a query answers with both kinds of
   *  thing now: the derivation is what the records are matched against, and the
   *  set is where the documents are. It used to take the derivation alone,
   *  which was the whole of what a search could see. */
  at: Reading,
  query: SearchRequest,
  /** When the question is being asked — what the grammar's relative words count
   *  from (`date:yesterday`). A day, or an instant on one: the grammar cuts it
   *  down with the same `dayOf` every date reading in the format uses, so this
   *  layer hands over its clock's own text rather than trimming it first.
   *
   *  Handed IN rather than read here, so this stays a pure function of a
   *  snapshot: the clock is the ops layer's one ({@link ./tools.ts}'s `asking`,
   *  over the `now` a `done` is stamped with), and a second `new Date()` in the
   *  read path would be a second answer to what day it is. */
  now: string,
  /**
   * The directory's search index, when there is one — what the two walks below
   * are run over INSTEAD of the corpus (`@olai/index`).
   *
   * OPTIONAL, and not as a feature flag: this function's answer is the same
   * with it and without it, which is a claim two suites make rather than one
   * this comment does. `@olai/index`'s own `index.test.ts` is the algorithm's
   * — the grammar's corners, a generated corpus, and a soak of random writes
   * that steers the directory across the size where the table starts declining
   * and back; `./search.index.test.ts` is the SEAM's, and is this layer's for
   * that reason: it asks every query through this door and through the corpus
   * walk after each of thirteen writes made by the real gate, which is where an
   * index one revision behind would show up and nowhere else.
   *
   * What the index changes is what has to be READ to arrive at the answer — a
   * shortlist of candidates instead of every record and every body in the
   * directory — and it can only ever hand back MORE than the query selects,
   * which the matcher below then narrows exactly as it narrows the corpus. So a
   * caller with no index is a caller paying what search cost before there was
   * one, and every test in this package that calls `search` directly is
   * deliberately one of them: the two paths are compared, so both are walked.
   *
   * It is handed IN for the same reason the clock is. This stays a pure
   * function of a snapshot; the table is one per served directory and its
   * lifetime is `./ops.ts`'s `make`, which is where a directory's other
   * long-lived things are opened.
   */
  index?: Index | undefined,
): SearchAnswer => {
  // THE VAULT'S OWN VOCABULARY, handed to the grammar — which is what makes
  // `prop:records=190..200` a span rather than an equality against the eight
  // characters between the equals and the space (`@olai/format`'s `typing.ts`).
  // Read per ask, off the reading this search is answered from, so a
  // declaration written a moment ago is in force for the next query; it is one
  // small file's top level, which is the same cost the shelf's reading is.
  const filter = parseFilter(query.text, now, declarationsOf(at.derived))
  // A query the grammar could not read answers with no hits AND WITH THE
  // REASON. An empty one answers with no hits and nothing to say — there is no
  // question to have refused.
  if (filter.kind === "refused") {
    return { hits: [], total: 0, refusals: filter.refusals }
  }
  if (filter.kind === "nothing") return { hits: [], total: 0 }

  const scope = { file: query.file, under: query.under }
  // WHAT MIGHT MATCH, when something knows — the index brought level with this
  // very reading and asked for this very query, so there is no revision between
  // the candidates and the records they are resolved against. `undefined` is
  // both of the two ways there is nothing to narrow by (no index at all, or a
  // query the trigram floor cannot look up) because the two mean the same thing
  // to the walks below: ask the corpus, as they always did.
  const narrowed = index?.narrow(at, filter) ?? undefined
  // ASKED FOR, and the request is where that lives: a door picking a record to
  // point at cannot take a document, and one filtering the answer itself would
  // run short exactly when a query matched enough documents to fill the cap.
  const nodes = query.kind === "document"
    ? []
    : matching(at.derived, filter, scope, narrowed?.nodes)
  // The other arm of the set, asked the same question. A document answers
  // `prop:` out of its frontmatter and nothing else — a mark, a date and a
  // record's field select none of them, which is `matchingDocuments`' own rule
  // and the honest answer rather than a hole.
  const documents = query.kind === "node"
    ? []
    : matchingDocuments(bodiedIn(at.set), filter, scope, narrowed?.documents)
  const limit = query.limit ?? DEFAULT_SEARCH_LIMIT
  // Read ONCE for the answer rather than per hit: it is a fact about the
  // question, and this same request is what a browser's boxes send on every
  // settled keystroke.
  const wantsNotes = query.withDesc === true
  const hits = rankedTogether(at.derived, nodes, documents)
    .slice(0, limit)
    .map((selected): SearchHit => {
      if (selected.kind === "document") {
        // Through `heldCustom` for {@link carriedOf}'s reason, which is not
        // only the pruning: it puts the keys in the FILE's canonical order
        // (alphabetical), and a node hit's `custom` already comes back that
        // way. Without it a document's `props` would arrive in frontmatter
        // line order — two orderings of one open map inside one ranked answer,
        // which is exactly the drift the row's own ordering rule refuses
        // (`@olai/web`'s `search/props.ts`).
        const props = heldCustom(selected.at.props)
        return {
          // WHERE TO GO, which is what a hit is for: the document's own
          // address, minted by the grammar rather than assembled here.
          at: { kind: "document", path: selected.at.path },
          title: selected.at.title,
          ...(selected.match.field === null ? {} : { matched: selected.match.field }),
          // The two halves of "why is this here" a document can carry, each
          // omitted on the format's own rule for absence — the same two lines
          // the node arm below spells, over the frontmatter this file writes
          // about itself instead of over a record's `custom`.
          ...(nothing(props) ? {} : { props }),
          ...(selected.match.props.length === 0 ? {} : { matchedProps: selected.match.props }),
        }
      }
      const { at: located, match } = selected
      const found = foundOf(at.derived, located)
      // The note this query is entitled to — the record's when it asked for
      // one, and nothing at all when it did not. TWO STEPS and not one
      // condition, because they are two questions: this one is the REQUEST's,
      // and the spread below is the FORMAT's rule for absence.
      const note = wantsNotes ? located.node.desc : undefined
      // ANNOTATED, never asserted. It was `as Hit` for as long as this function
      // has existed, and an assertion is exactly the thing that stops checking
      // when the declaration moves: a required field added to `SearchHit` and to
      // nothing else would be silently absent from every hit this produces. The
      // conditional spread needs no cast to satisfy the floor — `foundOf` above
      // spells the same pattern under a plain return type — so what the cast was
      // buying was nothing, at the one place in this file that produces a shape
      // the wire carries.
      return {
        // The BARE id, which is what a node address is: it outlives every move
        // and every rename, so a hit is still right about where the node is
        // after the file it sits in has been renamed (`@olai/format`'s
        // `address.ts`).
        at: { kind: "node", id: NodeId.make(located.node.id) },
        ...found,
        // Omitted for a query that named no words — `is:done` on its own is
        // carried by no field, and answering "title" would be inventing a
        // reason. The format's own rule for absence, applied to an answer.
        ...(match.field === null ? {} : { matched: match.field }),
        // …and the same rule for the other half of "why is this here", which is
        // a separate field because both halves can be true at once. Empty for
        // every query that named no property.
        ...(match.props.length === 0 ? {} : { matchedProps: match.props }),
        // THE NOTE, when it was ASKED FOR — the one field of the record a hit
        // does not carry by default, and the only reason is its size
        // (`@olai/format`'s `SearchRequest.withDesc` argues it). The FORMAT's
        // rule for absence, applied to it exactly as the four lines above apply
        // it: whether the query asked was decided one step earlier, so this
        // line is not the one place a carried field is omitted by a rule that
        // is not the format's.
        ...(note === undefined ? {} : { desc: note }),
      }
    })

  // The TOTAL is what matched, never what was kept, so "twelve of ninety" is
  // sayable — the one number that has to be read off the uncapped lists.
  return { hits, total: nodes.length + documents.length }
}

/**
 * The other question the one matcher answers: WHICH nodes ON ONE PAGE a query
 * selects, with why and nothing else.
 *
 * The filter over the page in front of somebody is what asks it, and what that
 * page needs is the opposite of a shortlist (`@olai/format`'s `searching.ts`
 * argues the split at `MatchedNode`): it prunes itself by the ids and counts
 * itself against them, so a capped answer would make "3 of 41" a sentence with
 * an invented number in it, and a ranked one would be an order the page has no
 * use for — a tree is drawn in the tree's order.
 *
 * OVER THE PAGE and not over the set, which is the whole of what
 * `filter-ask-carries-revision` was. It used to be a whole-vault walk per
 * settled keystroke AND per published revision, answered with every matching id
 * in the corpus — of which the caller looked up only the ones its own rows
 * named. A page's reading has already resolved every mirror, so the records it
 * draws are a set this side holds in its hand, and the honest question is the
 * size of a page (https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/filter-rides-the-page.md).
 *
 * NOTHING IS DECIDED HERE, which is the restraint {@link page} and {@link tags}
 * keep beside it: which page an address names, which of its records a query
 * selects, and whether what was put away may match are all the format's, over
 * the records the format assembled. This layer's whole contribution is that the
 * read is the GATED one.
 *
 * THE WHOLE READING rather than the derivation alone, for {@link page}'s reason
 * word for word: two of the questions a page asks are about FILES rather than
 * about records, and this answers about a page.
 *
 * NO DOCUMENTS, and that is the grammar rather than a narrowing chosen here: a
 * filter narrows rows of a page, a document is prose and is the one page that
 * carries no filter (`@olai/web`'s `routes.ts`). {@link search} is where the
 * other half of the directory is answered.
 *
 * NO REFUSAL either — the door that asks this reads the same grammar itself,
 * one function away, so it has already drawn the sentence by the time a frame
 * could carry one. A refused query never reaches here at all; if one does, it
 * selects nothing, which is what a refusal means everywhere else.
 */
export const narrowing = (
  at: Reading,
  request: NarrowingRequest,
  /** What the grammar's relative words count from — {@link search}'s own
   *  argument, and the same clock. */
  now: string,
): NarrowingAnswer =>
  narrowingOf(at, request, now)

// ── which ids the set declares ─────────────────────────────────────────

/**
 * WHICH OF THESE IDS THE SET DECLARES, and what each one names — the batch
 * lookup the chat transcript asks once per message.
 *
 * The whole of it is `@olai/format`'s {@link nodeNamed}, called in a loop: an
 * id addresses a record, a mirror is a record like any other, and what a caller
 * can be shown is the node at the end of the chain. That is the SAME function
 * an edge target, a `see` link and the composer's chip already resolve through
 * — which is the point of asking it here rather than answering it in the
 * browser out of a copy of the set (`https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/vault-in-browser.md`
 * §3's transcript row). One reading, one rule, other side of the wire.
 *
 * WHY A BATCH IS THE UNIT: the caller is one message, and a message holds every
 * backtick the agent wrote in it — a dozen spans of which two are ids. Asked
 * one at a time this would be a dozen round trips and a dozen readings of the
 * set to draw one paragraph.
 *
 * NOTHING IS SAID ABOUT AN ID THE SET DOES NOT DECLARE, and nothing about a
 * placement whose chain is dead: both are `undefined` from `nodeNamed` and both
 * mean the same thing to the caller — there is nothing to point at. An answer
 * that carried a "no" per span would be the length of the agent's prose and
 * would say nothing with it.
 *
 * TRASHED NODES ARE DECLARED. This is a lookup and not a search, so the
 * grammar's rule about what is reached by `is:trashed` has nothing to say here:
 * an id names the node it names, and a reader pressing it is shown where it now
 * is. That is what the browser's own lookup did, unchanged by the move.
 */
export const named = (
  /** The DERIVATION alone — an id names a record, and no body has one. */
  derived: Derived,
  request: NamedRequest,
): NamedAnswer => {
  const named: Array<NamedAnswer["named"][number]> = []
  // ONE ANSWER PER ID ASKED ABOUT, whatever the request repeated — a `Set` of
  // what was asked rather than a guard the loop carries: this is a lookup, and
  // a caller building a map out of it would otherwise be handed the same key
  // twice for no reason.
  for (const id of new Set(request.ids)) {
    const at = nodeNamed(derived, id)
    if (at === undefined) continue
    named.push({ asked: id, id: at.node.id, title: at.node.title })
  }
  return { named }
}

// ── where the ids a reader remembers now live ──────────────────────────

/**
 * WHERE THESE IDS ARE, and WHICH OF THESE FILES the set has anything from —
 * the two facts a reader holding a memory of records needs to keep it honest.
 *
 * The caller is the browser's fold memory (`@olai/web`'s `fold/memory.ts`),
 * which remembers collapsed node ids grouped by the file each node is defined
 * in. It used to answer both out of the whole id→file map of its own copy of
 * the set — a scan of every record in the directory per fold — which is the
 * copy `https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/vault-in-browser.md` is taking away. Nothing about
 * the RULE moved with it: what the caller does with a home, an absence and an
 * unheard-of file is still the caller's, and is still spelled once, in the
 * module that owns the memory.
 *
 * `byId` AND NOT {@link nodeNamed}, which is the one decision in this
 * function. The lookup one door over ({@link named}) follows a mirror chain,
 * because a backtick in a paragraph means the node a reader would be SHOWN. A
 * fold is of a RECORD — the record of a mirror whose chain has died folds by
 * its own id, since it shows nothing — so this is the plain table and no chain
 * is walked. Through `nodeNamed` a fold on a dangling placement would read as
 * a node that is gone while its record sits in the file, and the caller would
 * drop a fold the set never stopped carrying.
 *
 * TWO LISTS, ANSWERED INDEPENDENTLY (`@olai/format`'s {@link HomesRequest}
 * argues it): nothing here knows which id was filed under which file, and a
 * request that said so would be this layer holding an opinion about a
 * browser's storage.
 *
 * NEITHER HALF IS A WALK — and that sentence was half true until
 * `perf-homes-files`. An id is a `byId` lookup over an index the derivation
 * already carries, which it always was. A file is a membership test against the
 * two lists the SET is made of, which it reads as — but both of those lists
 * were BUILT HERE, per call: a `Set` of every outline path in the directory and
 * a map of every broken file, allocated to answer a handful of `has`, once per
 * fold and unfold a reader presses. The two are held with the set now
 * (`@olai/format`'s `outlineNames` and `brokenBy`), so what this costs is the
 * size of the QUESTION — what one reader has actually collapsed — rather than
 * the size of the directory, and the sentence is a fact rather than an
 * intention. The scan did not move to the server; it stopped existing.
 */
export const homes = (
  /** BOTH HALVES of the reading, and each half answers one half of the
   *  question: an id is a record, which is the derivation's, and whether a file
   *  was read is the SET's — see below. */
  at: Reading,
  request: HomesRequest,
): HomesAnswer => {
  const homes: Array<HomesAnswer["homes"][number]> = []
  // ONE ANSWER PER ID ASKED ABOUT, whatever the request repeated — {@link
  // named}'s rule and for its reason: this is a lookup, and a caller building a
  // map out of it would otherwise be handed the same key twice.
  for (const id of new Set(request.ids)) {
    const found = at.derived.byId.get(id)
    if (found === undefined) continue
    homes.push({ id, file: found.file })
  }
  // ...and WAS THIS FILE READ, which is deliberately not `byFile.has`: that
  // index answers "holds a record", and a file with nothing of its own is
  // absent from it rather than mapped to an empty list (`@olai/format`'s
  // `derive.ts` says so in as many words — which files exist is the SET's
  // answer, never that map's). An outline somebody emptied would come back
  // unreadable, and a caller reading that as "nothing can be concluded" would
  // keep the folds of every node that used to be in it, for good. So it is the
  // two facts the set actually holds: served, and not among the broken.
  const served = outlineNames(at.set)
  const broken = brokenBy(at.set)
  const loaded = [...new Set(request.files)].filter(
    (file) => served.has(file) && !broken.has(file),
  )
  return { homes, loaded }
}

// ── the directory's dates, as the sidebar asks them ────────────────────

/**
 * WHICH DAYS OF ONE MONTH have something on them — the calendar's dots.
 *
 * The browser used to walk its own copy of the set for this, once per month
 * drawn and again on every published revision. It cannot any more
 * (`https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/vault-in-browser.md`: the browser may hold at most the
 * page in front of somebody), so the reading runs here and the answer travels —
 * which is the whole of what changed. The READING is `@olai/format`'s
 * {@link datedDays}, unmoved: what is dated, what a mark's own date counts for
 * and what a put-away outline is excluded from are that module's rulings, read
 * once for the day page, the agenda and this.
 *
 * NOTHING IS ADDED HERE, which is the shape rather than an omission: the answer
 * and the ORDER it comes in are both `@olai/format`'s ({@link datedAnswer},
 * which is the one way to build one, beside the equivalence that rests on it).
 * What this layer contributes is the gate the request arrives through, which is
 * the whole of what a query door is.
 *
 * IT WAS A WALK OF THE WHOLE SET per call, as every date reading this layer has
 * was, and running it per subscriber per revision is exactly the pressure the
 * roadmap's `perf-dates-index` node was filed on. That node has landed: the
 * derivation carries a day index and this is a walk of one month's keys. NOTHING
 * HERE MOVED WITH IT, which is what the paragraph above predicted and is worth
 * leaving as the record of a seam that held — an index changes what a reading
 * COSTS, never what it means.
 */
export const dated = (derived: Derived, request: DatedRequest): DatedAnswer =>
  datedAnswer(derived, request.month)

/**
 * HOW MUCH IS OWED as of the reader's own today — the two numbers the
 * directory's own entry wears (`@olai/web`'s `agenda/owed.ts`).
 *
 * `@olai/format`'s {@link owedNow} and never a count of its own, which is the
 * same restraint every other door here keeps: what is late, what a mark is and
 * which day a value falls on are that package's rulings, and this layer
 * contributes the gate the request arrives through.
 *
 * IT USED TO BE `owedOf` OVER `agendaOf` — the whole agenda read, then counted
 * — because a count taken off the page's own answer cannot disagree with the
 * page one click away. What that cost is what `perf-agenda-history-walk` was
 * filed on: building the answer means situating every overdue node in the
 * directory (an ancestry walk, a mirror resolution and a rollup each), and this
 * door is re-answered per subscriber per published revision to produce two
 * integers. The counts are an index the patcher keeps now, and the guarantee
 * that used to be structural is a GATE instead: `./owed.index.test.ts` asks
 * both spellings after every write of a real corpus, at boundaries either could
 * move on. NOTHING HERE DECIDES ANY OF THAT, which is the shape of this layer
 * and the reason this function is one line either way.
 *
 * TODAY comes from the REQUEST rather than from this layer's clock, and that is
 * the one thing this reading takes from the caller. The dates in the files are
 * what a person wrote down, so what is late is late where that person is
 * standing; a server that answered from its own zone would put a reader west of
 * it on tomorrow's arithmetic all evening ({@link OwedRequest}).
 */
export const owed = (derived: Derived, request: OwedRequest): Owed =>
  owedNow(derived, request.today)

// ── one page, and one gesture over the whole set ───────────────────────

/**
 * WHAT ONE PAGE SHOWS — the envelope, and nothing else.
 *
 * `@olai/format`'s `pageOf` over the whole reading, exactly as {@link homes}
 * takes it and for that member's reason: two of the questions a page asks are
 * about FILES rather than about records — which paths the directory serves at
 * all, and which of them is a day's note — and answering those off the
 * derivation alone is the near miss `homes` exists to have avoided.
 *
 * NOTHING IS DECIDED HERE, which is the same restraint {@link matches} and
 * {@link tags} keep and the reason this function is three lines: which page an
 * address names, what that page draws, and what the ids it points at are called
 * are all the format's, over the records the format assembled. This layer's
 * whole contribution is that the read is the GATED one — the same snapshot a
 * keystroke's write is judged against and the same one an agent's tool is
 * answered from.
 *
 * THE WHOLE READING is handed over, which is what that function takes: the set
 * it is about, the derivation over it, and the index that says which documents
 * point at a given address (`@olai/format`'s `pointing.ts`). Three fields of
 * one value rather than three arguments, so this door cannot pair one
 * revision's set with another's view — which is the reason those three travel
 * together at all.
 */
export const page = (at: Reading, request: PageRequest): PageReading =>
  pageOf(at, request)

/**
 * WHETHER A ROW CAN GO WHERE SOMEBODY IS POINTING — the move picker's preview
 * of this layer's own planner, over the derivation alone.
 *
 * A SECOND READING and never a second POLICY: every sentence it can produce is
 * about a rule {@link ./plan.ts}'s `planMove` enforces, the write still goes
 * through that planner, and a destination it says nothing about can still be
 * refused there. `@olai/format`'s `movingOf` is where that is argued and
 * tested; this is the envelope.
 */
export const moving = (derived: Derived, request: MovingRequest): MovingAnswer =>
  movingOf(derived, request)
// ── what the set already calls things ──────────────────────────────────

/**
 * The tag vocabulary, narrowed to what one popup under one caret can show.
 *
 * NOT A SEARCH, and it is next to two of them so the difference is worth
 * saying: {@link search} and {@link matches} read a query LANGUAGE over the
 * records — operators, fields, a score — and this reads none. It enumerates the
 * words the set has already written down and answers which of them start with
 * what somebody has typed. Nothing here can disagree with `search_nodes`,
 * because nothing here is asked of the matcher.
 *
 * THE BROWSER'S, like {@link matches} and for a cousin of its reason (`./ops.ts`
 * argues the membership at `Ops.matching`): what this answers is the shortlist a
 * completion popup draws, capped at the number of rows that popup has. An agent
 * writing a tag writes the word; it has no popup to fill, and a tool answering
 * "the eight most used tags starting with ho" would be a report shaped like
 * somebody else's widget.
 *
 * ONE CALL, and the ENVELOPE is the whole of what is added — exactly what
 * {@link matches} adds over the matcher. The counting and the prefix test are
 * two functions with two costs down there (the enumeration is memoised per
 * derivation, so a directory that has not moved is counted once however many
 * keystrokes are asked of it), and that split is that package's business:
 * composing them here would be this layer holding a composition it has no
 * opinion about.
 */
export const tags = (
  /** The DERIVATION alone, like {@link matches}: a tag is written in a record's
   *  title or its note, and a document body's `#tags` reach search rather than
   *  this list (`@olai/format`'s `derive.ts` files records). */
  derived: Derived,
  request: TagsRequest,
): TagsAnswer => ({ tags: completingTags(derived, request) })

// ── one node, and what is under it ─────────────────────────────────────

/** Whichever marks the record carries, from the format's list — at most one
 *  by the format's own rule, but read as a set so this cannot be the place a
 *  new mark is missing from. The SHAPE of what comes back is the floor's, taken
 *  off {@link Detail} itself rather than re-spelled here; this is the reading of
 *  one record against it. */
const stampsOf = (node: LocatedRegular["node"]): Stamps =>
  Object.fromEntries(
    MARKS.flatMap((mark) => node[mark] === undefined ? [] : [[mark, node[mark]]]),
  )

export const detail = (derived: Derived, id: string): Detail | null => {
  const located = derived.byId.get(id)
  // `isRegular` narrows the PAIR, where `isMirror` narrows the record and
  // leaves the place around it as wide as it was — which is what this line used
  // to pay for with an assertion on the next one (`@olai/format`'s `node.ts`
  // declares the guard for exactly that).
  if (located === undefined || !isRegular(located)) return null
  const node = located.node
  const progress = progressOf(derived, id)
  const placements = placementsOf(derived, id)
  const placed = placedUnder(derived, id)
  const referencedBy = referrersOf(derived, id)
  const blockedBy = waitingFor(derived, id)
  return {
    ...foundOf(derived, located),
    ...(node.date === undefined ? {} : { date: node.date }),
    // The rule as the record spells it — the answer a writer about to change
    // it reads, and the half of MCP parity that is not `set_repeat`.
    ...(node.repeat === undefined ? {} : { repeat: node.repeat }),
    ...(node.desc === undefined ? {} : { desc: node.desc }),
    // `custom` arrives with `foundOf` above, which every situated answer is
    // built out of — a hit, a child in this list, a row of a subtree.
    ...(node.created === undefined ? {} : { created: node.created }),
    ...(node.changed === undefined ? {} : { changed: node.changed }),
    ...stampsOf(node),
    // AS WRITTEN, sigil and all: `#alice` and `@alice` are two tags, so a list
    // that dropped the character that started them could not tell a reader
    // which one this node carries. It is the same spelling
    // `@olai/format`'s tag index is keyed by (`Derived.taggedBy`), and
    // deliberately not that index read forwards: this is a node's OWN title,
    // which is what a caller about to edit the record is asking about, where
    // the index also files what a NOTE says (`derive.ts`'s `writtenTags`). The
    // two answers were one question until the browser's tag completion began
    // reading the index, and the divergence is stated rather than harmonised —
    // moving `tags` onto the index would put a note's words in a field that
    // says "this node's title", and moving the completion off it would put the
    // corpus walk back.
    tags: titleParts(node.title).flatMap((part) =>
      part.kind === "tag" ? [tagText(part)] : []
    ),
    ...(progress === undefined ? {} : { progress }),
    children: countedChildren(derived, id).map((child) => foundOf(derived, child)),
    ...(placements.length === 0 ? {} : { mirrors: placements }),
    ...(placed.length === 0 ? {} : { placed }),
    ...(referencedBy.length === 0 ? {} : { referencedBy }),
    ...(blockedBy.length === 0 ? {} : { blockedBy }),
  }
}

/**
 * What this node is waiting on, situated — the derived blockedness, in the
 * shape a read answers in.
 *
 * {@link referrersOf}'s arrangement one relation over, and for its reason: the
 * DERIVATION is `@olai/format`'s (`blockersOf`, over the `after` graph with
 * `blocks` already normalised into it, exempting `done` targets, bullets and
 * everything put away — argued and tested down there, and the same index the
 * app's rows dim from and `is:blocked` selects on), and `foundOf` is what turns
 * each blocker into the answer every other list here is made of.
 *
 * NOTHING IS DECIDED HERE, which is the point of it being one expression: a second
 * spelling of "is this still in the way" would be a node an agent is told it
 * can start while the page it is drawn on says it cannot. The mark each entry
 * carries is `foundOf`'s read of `derived.status` — the very map the blockedness
 * pass asked — so the two cannot disagree about the blocker either.
 */
const waitingFor = (derived: Derived, id: string): ReadonlyArray<Found> =>
  blockersOf(derived, id).map((one) => foundOf(derived, one.at))

/**
 * What refers to this node — the browser's own "referenced by" section, in the
 * shape a read answers in.
 *
 * SITUATED, which is this layer's whole contribution: `backlinksOf` says WHICH
 * records refer and how ({@link `@olai/format`}, where the four rulings about
 * what counts as a reference are argued and tested), and `foundOf` turns each
 * of them into the same answer every other list here is made of — so a referrer
 * arrives with its title, its place, its ancestors and its mark, and nothing
 * has to be read a second time to say what it is.
 */
const referrersOf = (derived: Derived, id: string): ReadonlyArray<Reference> =>
  backlinksOf(derived, id).map((one) => ({ ...foundOf(derived, one.at), ways: one.ways }))

/**
 * The placements UNDER a node, in sibling order — the list side of a mirror.
 *
 * Reads `derived.children`, which keeps every record in the row including the
 * mirrors (`siblingsOf`'s own rule: a mirror occupies a place, it is just never
 * a counted child), and resolves each one through `follow` — so an entry that
 * chains through another placement still reports the node at the end of it, and
 * one whose chain is broken is left out rather than reported as a row showing
 * nothing. A set with a broken chain is one the validator has already condemned;
 * a reader that invented an entry for it would be answering with a node that is
 * not there.
 */
const placedUnder = (derived: Derived, id: string): ReadonlyArray<Placed> =>
  (derived.children.get(id) ?? []).flatMap((child) => {
    if (!isMirror(child.node)) return []
    const found = follow(derived, child)
    if (found.kind !== "found") return []
    return [{
      id: child.node.id,
      file: child.file,
      line: child.line,
      ...(child.node.parent === undefined ? {} : { parent: child.node.parent }),
      shows: foundOf(derived, found.shows),
    }]
  })

/**
 * The mirrors that show this node, in file-then-line order.
 *
 * By what each one SHOWS rather than by what it names, so a chain counts: a
 * mirror of a mirror of `order` is a place `order` is drawn, and an agent
 * retiring the Now entry for it should find it whether the ledger pointed
 * straight at the node or at another placement of it.
 *
 * A LOOKUP, in the index that IS that question: {@link Derived.mirrorsOf} is
 * `follow` read backwards over the whole set, filed under the node each chain
 * ends at, and built with the rest of the derivation. This used to walk every
 * node in the directory and resolve every placement in it — per `read_node`,
 * which is the first call an agent makes about anything. `follow` still decides
 * what a mirror shows; this simply stopped asking it once per record to find
 * the few records it had already been asked about.
 *
 * ONE PLACEMENT PER ID, which is the one thing that changed and is worth
 * saying out loud. The index holds mirror IDS, and `byId` is first-claim-wins,
 * so two mirror records sharing an id come back as the single record that id
 * means. The old walk reported both. That set is one the validator refuses
 * (duplicate ids), every other index in `Derived` already collapses duplicates
 * exactly this way, and `remove_mirror` takes an ID — so a second entry named
 * a record no write could reach. It is the duplicate-id rule §3 of
 * https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/model-indices.md names, arriving here first.
 */
const placementsOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<Placement> =>
  [...(derived.mirrorsOf.get(id) ?? [])].flatMap((mirror) => {
    // Never absent: every id in the index came off a record of this same set,
    // and `byId` holds one for each. Guarded because the type says it may be,
    // and inventing a placement would be worse than dropping one.
    const at = derived.byId.get(mirror)
    if (at === undefined) return []
    return [{
      id: at.node.id,
      file: at.file,
      line: at.line,
      ...(at.node.parent === undefined ? {} : { parent: at.node.parent }),
    }]
  })

/**
 * A NODE and what hangs under it, or a whole OUTLINE and everything in it —
 * `read_subtree`, both arms and every refusal.
 *
 * ONE FUNCTION FOR THE TWO WAYS IN, because they are one reading asked from two
 * ends: the walk below is the same walk, and what differs is only where it
 * starts and how many times. A file arm answered by a second exported function
 * would be a second place the depth default, the mirror rule and the
 * `truncated` flag are decided.
 *
 * WHY THE FILE ARM EXISTS AT ALL. `list_outlines` says which outlines there are
 * and what each one's roots are CALLED, and until this the only way DOWN was by
 * id — so an outline of N top-level roots cost N calls, one per root, each
 * answering a fraction of a file the reader was asking about whole. The write
 * side stopped looping some time ago (`add_node` takes a nested capture,
 * `apply` a run of verbs); this is the read side catching up.
 *
 * IT REFUSES, where the id arm answers. That asymmetry is
 * {@link ./query.ts}'s `document` one door over, argued on
 * {@link `@olai/format`}'s `DocumentBody`: an id is minted, guessed at and
 * carried around in prose, so "is there a node called this?" is a fair question
 * with a true answer — while a path was LISTED or typed, and the useful answer
 * to a typo is the near miss, which only a refusal carries. So a `file` the set
 * does not serve as an outline comes back with the closest one that is
 * ({@link outlineAt}), and one it could not READ comes back with the
 * validator's own rows rather than as an outline that happens to hold nothing.
 *
 * A RESULT and not a nullable, for the reason {@link document} is one: a pure
 * function says "or else" this way, and the door lifts it ({@link
 * ./tools.ts}'s `asking`).
 *
 * EXACTLY ONE OF THE TWO, CHECKED HERE. What the schema cannot do is ADVERTISE
 * the rule: the union of two structs that would say it type-level is not
 * available at this seam (the tool table takes a request apart by its
 * `.fields`), and the JSON Schema an MCP host reads is an object with
 * properties rather than an `anyOf` it may or may not honour — the same
 * constraint that unrolls `add_node`'s capture. A decode-level `check` on the
 * struct could REJECT the pair, and is deliberately not used: what comes back
 * from one is a decoder's complaint about a shape, where what a caller needs is
 * which of the two reads it meant. So the request arrives wide and is refused
 * here, in words. The two refusals are two rather than one because they are
 * different mistakes made by different callers: NEITHER is usually a caller
 * that has not noticed the file arm exists, and BOTH is a caller holding two
 * questions who has to pick. Both are USAGE and not NOT-FOUND — nothing was
 * looked up, because there was no single question to look up.
 *
 * NOT `@olai/format`'s `Address`, and the survey is recorded so it is not
 * re-run. That grammar is the canonical way this repository names a PLACE — a
 * document path, a node id, a heading inside a body — and a search hit already
 * carries one. It is the wrong reuse here because it encapsulates a different
 * axis: an address is a place written as TEXT, parsed out of a title somebody
 * typed in `Pins.olai` or out of an address bar, and it carries an arm (a
 * heading in a body) this read has no answer for. Nothing in this request is
 * written text — it is two typed fields, and what is decided below is which of
 * them was given.
 */
export const subtree = (
  /** BOTH HALVES of the reading, unlike the walk this used to be: the id arm
   *  reads the derivation alone, and the file arm asks the SET which paths are
   *  outlines and which of them parsed — the same division {@link homes}
   *  makes. */
  at: Reading,
  request: SubtreeRequest,
): Result.Result<SubtreeAnswer, OpFailure> => {
  // The floor's number, because it is quoted in the sentence `read_subtree`
  // advertises — one place to change it, rather than a schema saying "default
  // 3" over a walk that had stopped agreeing.
  const depth = request.depth ?? DEFAULT_SUBTREE_DEPTH
  // ON by default: a targeted walk usually wants the note. `false` is the lean
  // read — depth bounds levels, not prose, and notes dominate the cost. Same
  // flag `search` already has, the other way round on the default.
  const wantsNotes = request.withDesc !== false
  const walk = (located: LocatedRegular, left: number): Subtree => {
    const children = countedChildren(at.derived, located.node.id)
    return {
      ...foundOf(at.derived, located),
      ...(located.node.date === undefined ? {} : { date: located.node.date }),
      ...(wantsNotes && located.node.desc !== undefined
        ? { desc: located.node.desc }
        : {}),
      children: left <= 0 ? [] : children.map((child) => walk(child, left - 1)),
      ...(left <= 0 && children.length > 0 ? { truncated: true as const } : {}),
    }
  }

  if (request.id !== undefined && request.file !== undefined) {
    return Result.fail(
      new UsageFailure({
        reason: "`id` and `file` are two different reads — give one. `id` is a " +
          "node and what hangs under it; `file` is a whole outline. " +
          "`search_nodes` with `file` is how a query is narrowed to one outline.",
      }),
    )
  }

  if (request.id !== undefined) {
    const located = at.derived.byId.get(request.id)
    if (located === undefined || !isRegular(located)) {
      return Result.succeed({ missing: request.id })
    }
    return Result.succeed(walk(located, depth))
  }

  if (request.file !== undefined) {
    // The GATE and its sentence together, one door over in the planner, because
    // the write that places a node at a file's top level asks the identical
    // question and owes the identical answer ({@link outlineAt}).
    const outline = outlineAt(askedOf(at.set), request.file)
    if (Result.isFailure(outline)) return Result.fail(outline.failure)
    const broken = brokenIn(at.set, request.file)
    if (broken !== undefined) return Result.fail(notLoaded(request.file, broken))
    return Result.succeed({
      file: request.file,
      // The roots a READER sees: `@olai/format`'s own reading of an outline's
      // top level, `ord`-sorted, placements dropped for the reason the walk
      // never descends into one — a mirror is a second view of a node that
      // lives elsewhere, and elsewhere is where this read answers it.
      roots: rootsOf(at.derived, request.file).map((root) => walk(root, depth)),
    })
  }

  return Result.fail(
    new UsageFailure({
      reason: "give `id` (a node and what hangs under it) or `file` " +
        "(a whole outline: every top-level node in it)",
    }),
  )
}

// ── the directory ──────────────────────────────────────────────────────

/**
 * The torn arm of a listing — {@link OutlineSummary}'s and
 * {@link DocumentSummary}'s, built here so they cannot come apart.
 *
 * A count, a root list, a title and a size are what a successful read
 * produces; this is the whole of what can be said when that read did not
 * happen. The floor's own arm, and the reason both listings have two.
 */
const torn = (file: string, errors: ReadonlyArray<OutlineError>) => ({
  file,
  unreadable: errors.map(errorLine),
})

export const outlines = (
  set: OutlineSet,
  derived: Derived,
): ReadonlyArray<OutlineSummary> => {
  const broken = brokenBy(set)
  /**
   * Each file's own nodes, grouped once. The set is FLAT ({@link OutlineSet}
   * says why), so "which nodes are this file's" is a scan of the whole list,
   * and asking it per row cost files × nodes — on the first call an agent
   * makes on a directory it has not seen.
   *
   * `Map.groupBy` holds each group in ENCOUNTER order, which is what `roots`
   * below stands on: a row's titles come out in file order, not the sibling
   * (`ord`) order they would be in had anything sorted them. That is why this
   * does NOT go through `@olai/format`'s `rootsOf`, which is the same question
   * asked of the TREE and answers in `ord` — `read_subtree`'s `file` arm is
   * that one. A listing is about the file; a walk is about the tree; the two
   * part company on a root reordered without its line moving, and both
   * declarations say so.
   *
   * The mirrors drop HERE, once for the whole answer, as `countedChildren`
   * drops them in the floor — a placement is neither counted nor a title, and
   * that rule spelled once per use is a rule that can come to disagree with
   * itself. Saying they are gone is also what lets the titles below be read
   * without an assertion.
   *
   * A FIELD on {@link Derived} now, which is what `siblings-of-quadratic`
   * settled: this used to group the corpus itself, under a note deferring the
   * question to that item. `byFile` is that grouping, built once with the rest
   * of the derivation this function is already holding, and in LINE order —
   * which is stricter than the encounter order `roots` stands on, so the
   * answer is unchanged. What is left here is the mirror drop, which is this
   * answer's own rule rather than the index's: `byFile` holds RECORDS, because
   * a writer re-emitting a file needs the placements too.
   */
  // ANNOTATED, so the row literals below are checked against the floor: a
  // field dropped from `OutlineSummary` fails HERE rather than only at the
  // table-driven decode.
  return outlinePaths(set).map((file): OutlineSummary => {
    const errors = broken.get(file)
    if (errors !== undefined) return torn(file, errors)
    // No entry at all is an outline holding no nodes of its own.
    const own = nodesOf(derived, file).filter(isRegular)
    return {
      file,
      nodes: own.length,
      roots: own
        .filter((located) => located.node.parent === undefined)
        .map((located) => located.node.title),
    }
  })
}

/**
 * The outline PATHS — the same directory, asked the question a capture actually
 * has.
 *
 * WHY IT IS NOT {@link outlines}. A capture is aimed by a convention over the
 * file NAMES (`@olai/format`'s `captureInto`), and the face that resolves one
 * may hold no store at all — an agent's `capture` over a socket — so the only
 * reading it could get was the LISTING, which counts the regular records of
 * every file in the directory to answer with a `nodes` and a `roots` that
 * resolution throws away. On a vault that is the whole corpus materialised per
 * capture, and twice when the capture race makes the resolver read again
 * (roadmap `perf-capture-paths`). The listing keeps those counts, because
 * `list_outlines` is read by an agent CHOOSING a file; this door is for the one
 * that already knows what it is looking for.
 *
 * THE SET ALONE, no derivation, which is the whole shape of the saving: the
 * paths are a narrowing of the documents the set is made of, held with it
 * (`@olai/format`'s `outlinePaths`), and no record is looked at. A file that
 * did not parse is still an outline this directory serves and is in the list —
 * the same rule the listing follows, where such a file is a row rather than an
 * omission, and the right one here too: an inbox nobody can read is still the
 * inbox, and `create`-ing a second one over it would be the worse answer.
 */
export const paths = (set: OutlineSet): PathsAnswer => ({ paths: outlinePaths(set) })

// ── the documents ──────────────────────────────────────────────────────

/**
 * Every document the directory serves, summarised — {@link outlines}' twin
 * over the other kind of file.
 *
 * WHAT COUNTS AS A DOCUMENT is not decided here: `markdownIn` is the floor's
 * one answer, shared with the validator that checks a `doc` reference and the
 * planner that refuses a `write_document`, so what this lists and what those
 * two accept cannot come apart. A `.html` is out of all three — the set keeps
 * its path and not its bytes — and a listing that named one would be offering
 * a read that cannot be answered and a size nobody measured.
 *
 * The broken map is taken once for the whole answer, exactly as {@link
 * outlines} takes its own: a document that did not READ is in the collection
 * with an empty body AND in `broken` (`@olai/format`'s `assemble`), so the
 * empty text has to be told apart from an empty file.
 */
export const documents = (set: OutlineSet): ReadonlyArray<DocumentSummary> => {
  const broken = brokenBy(set)
  // ANNOTATED for {@link outlines}' reason: a field dropped from
  // `DocumentSummary` fails HERE rather than only at the table-driven decode.
  return markdownIn(set).map((entry): DocumentSummary => {
    const errors = broken.get(entry.path)
    if (errors !== undefined) return torn(entry.path, errors)
    // The TITLE is the document's own now rather than this listing's reading of
    // its text: it is a field of the face the decode built (`@olai/format`'s
    // `Document`), which is the same title the browser draws and the same one a
    // hit carries. The SIZE is remembered at that same decode, so a listing
    // does not re-encode every body to report a number the document already
    // holds. The PROPERTIES are through `heldCustom` for {@link carriedOf}'s
    // reason, omitted when the document wrote none, the same two rules a
    // search hit follows over the same map.
    const props = heldCustom(entry.props)
    return {
      file: entry.path,
      title: entry.title,
      bytes: entry.bytes,
      ...(nothing(props) ? {} : { props }),
    }
  })
}

/**
 * One document, whole — or the refusal that says why not.
 *
 * A REFUSAL and not a `{ missing }` arm, which is the one place a document
 * read parts company with a node read; {@link DocumentBody} carries that
 * argument. What matters here is that the sentence is the SAME sentence
 * `write_document` refuses a missing path with, from the same near-miss
 * function over the same candidate list — a path an agent typed is answered
 * one way whichever verb it typed it at.
 *
 * Two refusals rather than one, because a file the set could not READ is not a
 * file the set does not hold: it is on the disk, it will parse or it will not,
 * and answering it as an empty document would be handing back a body nobody
 * read. `brokenIn` is the fact, shared with the write gate's `writable`
 * ({@link ./plan.ts}); the CONSEQUENCE is this verb's own, and it comes back
 * with the validator's rows for the reason a refused write does — fix the
 * file, then read it.
 */
export const document = (
  set: OutlineSet,
  file: string,
): Result.Result<DocumentBody, OpFailure> => {
  const entry = markdownAt(set, file)
  if (entry === undefined) {
    return Result.fail(
      noSuchDocument(set, file, "`list_documents` says what is"),
    )
  }
  const broken = brokenIn(set, file)
  if (broken !== undefined) return Result.fail(notLoaded(file, broken))
  return Result.succeed({ file, text: entry.body })
}

