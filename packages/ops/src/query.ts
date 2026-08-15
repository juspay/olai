/**
 * Reading the set, as an agent is allowed to read it.
 *
 * Every answer here is about NODES: an id, a title, a mark, an ancestry, a
 * `file:line`. Never bytes, never a line of a file, never a directory listing.
 * That is the read half of the same decision the write half makes — the agent
 * works in the format's own terms, so the things it can express are the things
 * the format can be (docs/brainstorming/acp.md, resolved 2026-08-09: "query
 * tools are over parsed nodes, not raw lines").
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
  ancestorsOf,
  countedChildren,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SUBTREE_DEPTH,
  derive,
  type Derived,
  type Detail,
  errorLine,
  follow,
  type Found,
  heldCustom,
  isMirror,
  type LocatedRegular,
  MARKS,
  matching,
  nothing,
  type OutlineSet,
  type OutlineSummary,
  parseFilter,
  type Placed,
  type Placement,
  progressOf,
  type SearchAnswer,
  type SearchHit,
  type SearchRequest,
  type Stamps,
  type Subtree,
  tagText,
  titleParts,
} from "@olai/format"

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

// ── the index every query is asked of ──────────────────────────────────

/**
 * The derivations, computed once for a run of queries.
 *
 * `derive` walks the whole set, and every answer below needs the same walk, so
 * the caller does it once and hands it down. That is also why only
 * {@link outlines} still takes the `OutlineSet` itself: it is the one answer
 * that reads something the derivations do not carry — which files were found,
 * and which of them did not parse.
 */
export const index = (set: OutlineSet): Derived => {
  const known = INDEXED.get(set)
  if (known !== undefined) return known
  const derived = derive(set.nodes)
  INDEXED.set(set, derived)
  return derived
}

/**
 * Memoised on the SET'S OWN IDENTITY, which is exactly the right key and needs
 * no invalidation: the store replaces the whole `OutlineSet` object when a
 * probe finds a change, so one object is one revision, forever. An agent that
 * lists the outlines and then searches three times used to walk the whole tree
 * four times; a write that follows those reads walked it once more.
 *
 * Weak, so a superseded revision is collectable the moment nothing holds it.
 */
const INDEXED = new WeakMap<OutlineSet, Derived>()

/**
 * One node, situated — the shape every read here answers with.
 *
 * PUBLIC for the same reason `notFound` and `notANode` are: a caller above
 * this layer situates the same node for the same agent. `@olai/server` builds
 * the line that names a node a chat message is ABOUT, and "where does a node
 * live, and what does it hang under" is a question this file already answers —
 * a second `ancestorsOf(…).map(…)` up there would be a second answer, free to
 * drift from the one `read_node` gives about the same id in the same turn.
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
    path: ancestorsOf(derived, located.node.id).map((crumb) => crumb.node.title),
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
 */
const carriedOf = (
  node: LocatedRegular["node"],
): Pick<Found, "see" | "after" | "custom"> => {
  const custom = heldCustom(node.custom)
  return {
    ...(nothing(node.see) ? {} : { see: node.see }),
    ...(nothing(node.after) ? {} : { after: node.after }),
    ...(custom === undefined ? {} : { custom }),
  }
}

// ── search ─────────────────────────────────────────────────────────────

/** A done node is demoted by about a field's worth: enough to lose a tie, not
 *  enough to disappear. The reason to look for a node you finished is usually
 *  that you finished it. */
const DONE_PENALTY = 300

/**
 * A query, ranked and shortened — the reading behind `search_nodes` and behind
 * every box a person types into.
 *
 * WHAT MATCHES IS NOT DECIDED HERE any more, and that is the whole of the
 * filter-in-place change: the words, the operators (`is:`, `has:`, `date:` and
 * their negations), the archive rule and which field carried a hit all live in
 * `@olai/format`'s `filter.ts`, because a browser narrowing rows it already
 * holds cannot call this procedure on every keystroke and must not answer
 * differently for having to do it itself. One matcher, four callers; that file's
 * header names them and docs/brainstorming/filter-in-place.md argues it.
 *
 * What is still this layer's is everything about showing a stranger a
 * SHORTLIST — a finished node loses ties, the list is capped, and the total is
 * reported uncapped so "twelve of ninety" is sayable — and CARRYING THE
 * REFUSAL, because this is the only layer that has both the parser's answer and
 * a caller to hand it to.
 */
export const search = (
  derived: Derived,
  query: SearchRequest,
): SearchAnswer => {
  const filter = parseFilter(query.text)
  // A query the grammar could not read answers with no hits AND WITH THE
  // REASON. An empty one answers with no hits and nothing to say — there is no
  // question to have refused.
  if (filter.kind === "refused") {
    return { hits: [], total: 0, refusals: filter.refusals }
  }
  if (filter.kind === "nothing") return { hits: [], total: 0 }

  const ranked = matching(derived, filter, { file: query.file, under: query.under })
    .map(({ at, match }) => {
      const found = foundOf(derived, at)
      // ANNOTATED, never asserted. It was `as Hit` for as long as this function
      // has existed, and an assertion is exactly the thing that stops checking
      // when the declaration moves: a required field added to `SearchHit` and to
      // nothing else would be silently absent from every hit this produces. The
      // conditional spread needs no cast to satisfy the floor — `foundOf` above
      // spells the same pattern under a plain return type — so what the cast was
      // buying was nothing, at the one place in this file that produces a shape
      // the wire carries.
      const hit: SearchHit = {
        ...found,
        // Omitted for a query that named no words — `is:done` on its own is
        // carried by no field, and answering "title" would be inventing a
        // reason. The format's own rule for absence, applied to an answer.
        ...(match.field === null ? {} : { matched: match.field }),
      }
      return {
        hit,
        score: found.status === "done" ? match.score - DONE_PENALTY : match.score,
      }
    })

  // Ties keep the order the outlines are written in, so an answer never moves
  // under the cursor between two keystrokes. The list is already in that order
  // — `matching` walks the set in file-then-line order — and `sort` is stable.
  // Sorted in place, because the array was minted by the `map` above and is
  // nobody else's.
  ranked.sort((a, b) => b.score - a.score)
  const limit = query.limit ?? DEFAULT_SEARCH_LIMIT
  return { hits: ranked.slice(0, limit).map((entry) => entry.hit), total: ranked.length }
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
  return {
    ...foundOf(derived, regular),
    ...(node.date === undefined ? {} : { date: node.date }),
    ...(node.desc === undefined ? {} : { desc: node.desc }),
    // `custom` arrives with `foundOf` above, which every situated answer is
    // built out of — a hit, a child in this list, a row of a subtree.
    ...(node.created === undefined ? {} : { created: node.created }),
    ...(node.changed === undefined ? {} : { changed: node.changed }),
    ...stampsOf(node),
    // AS WRITTEN, sigil and all: `#alice` and `@alice` are two tags, so a list
    // that dropped the character that started them could not tell a reader
    // which one this node carries.
    tags: titleParts(node.title).flatMap((part) =>
      part.kind === "tag" ? [tagText(part)] : []
    ),
    ...(progress === undefined ? {} : { progress }),
    children: countedChildren(derived, id).map((child) => foundOf(derived, child)),
    ...(placements.length === 0 ? {} : { mirrors: placements }),
    ...(placed.length === 0 ? {} : { placed }),
  }
}

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
 * straight at the node or at another placement of it. `follow` is the format's
 * own resolution of that chain, cycle-safe, so this cannot be a second answer to
 * what a mirror shows.
 */
const placementsOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<Placement> =>
  derived.nodes.flatMap((located) => {
    if (!isMirror(located.node)) return []
    const found = follow(derived, located)
    if (found.kind !== "found" || found.shows.node.id !== id) return []
    return [{
      id: located.node.id,
      file: located.file,
      line: located.line,
      ...(located.node.parent === undefined ? {} : { parent: located.node.parent }),
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
  const broken = new Map(set.broken.map((entry) => [entry.file, entry.errors]))
  // ANNOTATED, so the row literals below are checked against the floor: a
  // field dropped from `OutlineSummary` fails HERE rather than only at the
  // table-driven decode. That is independent of what the rows hold, which is
  // why it survives the revert of the two-arm shape.
  return set.files.map((file): OutlineSummary => {
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
    const own = derived.nodes.filter((located) => located.file === file)
    return {
      file,
      nodes: own.filter((located) => !isMirror(located.node)).length,
      roots: own
        .filter((located) => located.node.parent === undefined && !isMirror(located.node))
        .map((located) => (located as LocatedRegular).node.title),
    }
  })
}
