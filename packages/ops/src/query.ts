/**
 * Reading the set, as an agent is allowed to read it.
 *
 * Every answer about an OUTLINE is about NODES: an id, a title, a mark, an
 * ancestry, a `file:line`. Never bytes, never a line of a file, never a
 * directory listing of them. That is the read half of the same decision the
 * write half makes — the agent works in the format's own terms, so the things
 * it can express are the things the format can be (docs/brainstorming/acp.md,
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
  bodiedIn,
  brokenBy,
  brokenIn,
  bytesOf,
  countedChildren,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SUBTREE_DEPTH,
  type Derived,
  type Detail,
  type DocumentBody,
  type DocumentSummary,
  errorLine,
  follow,
  type Found,
  heldCustom,
  isMirror,
  type LocatedRegular,
  markdownAt,
  markdownIn,
  MARKS,
  matchingDocuments,
  NodeId,
  matching,
  nodesOf,
  nothing,
  type OpFailure,
  type OutlineSet,
  outlinePaths,
  type OutlineSummary,
  parseFilter,
  rankedTogether,
  type Placed,
  type Placement,
  progressOf,
  type Reading,
  type Reference,
  ranked,
  type SearchAnswer,
  type SearchHit,
  type SearchRequest,
  type Stamps,
  type Subtree,
  tagText,
  titleParts,
  ValidationFailure,
} from "@olai/format"
import { Result } from "effect"

import { noSuchDocument } from "./plan.ts"

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
 * (docs/brainstorming/surface-mcp-positions.md).
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
): Pick<Found, "see" | "after" | "custom"> => {
  // Pruned first, so what `nothing` is asked about is what the file would hold:
  // a map of keys that all hold nothing is `{}`, and `{}` is nothing.
  const custom = heldCustom(node.custom)
  return {
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
 * filter-in-place change: the words, the operators (`is:`, `has:`, `date:` and
 * their negations), the archive rule and which field carried a hit all live in
 * `@olai/format`'s `filter.ts`, because a browser narrowing rows it already
 * holds cannot call this procedure on every keystroke and must not answer
 * differently for having to do it itself. One matcher, five callers; that
 * file's header names them and docs/brainstorming/filter-in-place.md argues it.
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
): SearchAnswer => {
  const filter = parseFilter(query.text, now)
  // A query the grammar could not read answers with no hits AND WITH THE
  // REASON. An empty one answers with no hits and nothing to say — there is no
  // question to have refused.
  if (filter.kind === "refused") {
    return { hits: [], total: 0, refusals: filter.refusals }
  }
  if (filter.kind === "nothing") return { hits: [], total: 0 }

  const scope = { file: query.file, under: query.under }
  // ASKED FOR, and the request is where that lives: a door picking a record to
  // point at cannot take a document, and one filtering the answer itself would
  // run short exactly when a query matched enough documents to fill the cap.
  const nodes = query.kind === "document" ? [] : matching(at.derived, filter, scope)
  // The other arm of the set, asked the same question. What a document cannot
  // answer — a mark, a date, a property — selects none of them, which is
  // `matchingDocuments`' own rule and the hole frontmatter fills.
  const documents = query.kind === "node"
    ? []
    : matchingDocuments(bodiedIn(at.set), filter, scope)
  const limit = query.limit ?? DEFAULT_SEARCH_LIMIT
  const hits = rankedTogether(at.derived, nodes, documents)
    .slice(0, limit)
    .map((selected): SearchHit => {
      if (selected.kind === "document") {
        return {
          // WHERE TO GO, which is what a hit is for: the document's own
          // address, minted by the grammar rather than assembled here.
          at: { kind: "document", path: selected.at.path },
          title: selected.at.title,
          ...(selected.match.field === null ? {} : { matched: selected.match.field }),
        }
      }
      const { at: located, match } = selected
      const found = foundOf(at.derived, located)
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
      }
    })

  // The TOTAL is what matched, never what was kept, so "twelve of ninety" is
  // sayable — the one number that has to be read off the uncapped lists.
  return { hits, total: nodes.length + documents.length }
}

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
  if (located === undefined || isMirror(located.node)) return null
  const regular = located as LocatedRegular
  const node = regular.node
  const progress = progressOf(derived, id)
  const placements = placementsOf(derived, id)
  const placed = placedUnder(derived, id)
  const referencedBy = referrersOf(derived, id)
  return {
    ...foundOf(derived, regular),
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
  }
}

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
 * docs/brainstorming/model-indices.md names, arriving here first.
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

export const subtree = (
  derived: Derived,
  id: string,
  options: { readonly depth?: number } = {},
): Subtree | null => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return null

  // The floor's number, because it is quoted in the sentence `read_subtree`
  // advertises — one place to change it, rather than a schema saying "default
  // 3" over a walk that had stopped agreeing.
  const depth = options.depth ?? DEFAULT_SUBTREE_DEPTH
  const walk = (at: LocatedRegular, left: number): Subtree => {
    const children = countedChildren(derived, at.node.id)
    return {
      ...foundOf(derived, at),
      ...(at.node.date === undefined ? {} : { date: at.node.date }),
      ...(at.node.desc === undefined ? {} : { desc: at.node.desc }),
      children: left <= 0 ? [] : children.map((child) => walk(child, left - 1)),
      ...(left <= 0 && children.length > 0 ? { truncated: true as const } : {}),
    }
  }
  return walk(located as LocatedRegular, depth)
}

// ── the directory ──────────────────────────────────────────────────────

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
   * (`ord`) order they would be in had anything sorted them.
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
  // table-driven decode. That is independent of what the rows hold, which is
  // why it survives the revert of the two-arm shape.
  return outlinePaths(set).map((file): OutlineSummary => {
    const errors = broken.get(file)
    // The zero and the empty list are what a file that did not parse gets, and
    // {@link OutlineSummary} says why that is held rather than settled.
    if (errors !== undefined) {
      return {
        file,
        nodes: 0,
        roots: [],
        unreadable: errors.map(errorLine),
      }
    }
    // No entry at all is an outline holding no nodes of its own.
    const own = nodesOf(derived, file)
      .filter((located): located is LocatedRegular => !isMirror(located.node))
    return {
      file,
      nodes: own.length,
      roots: own
        .filter((located) => located.node.parent === undefined)
        .map((located) => located.node.title),
    }
  })
}

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
    // The empty title and the zero are what a file that could not be read
    // gets, and {@link DocumentSummary} says why that is held rather than
    // settled — it is `OutlineSummary`'s convention, matched on purpose.
    if (errors !== undefined) {
      return { file: entry.path, title: "", bytes: 0, unreadable: errors.map(errorLine) }
    }
    // The TITLE is the document's own now rather than this listing's reading of
    // its text: it is a field of the face the decode built (`@olai/format`'s
    // `Document`), which is the same title the browser draws and the same one a
    // hit carries.
    return { file: entry.path, title: entry.title, bytes: bytesOf(entry.body) }
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
  if (broken !== undefined) {
    return Result.fail(
      new ValidationFailure({
        reason: `\`${file}\` could not be read, so what it holds is not loaded — ` +
          `there is nothing to answer with. Fix the file first.`,
        errors: broken,
      }),
    )
  }
  return Result.succeed({ file, text: entry.body })
}

