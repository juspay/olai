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
 * It is not a smaller `grep`. A grep over `.jsonl` answers with JSON fragments
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
  derive,
  type Derived,
  errorLine,
  follow,
  isMirror,
  type LocatedRegular,
  MARKS,
  type OutlineSet,
  type Progress,
  progressOf,
  mayHoldTag,
  type Status,
  tagText,
  titleParts,
} from "@olai/format"
import { Effect } from "effect"

/** One node, said the way every answer here says it. */
export interface Found {
  readonly id: string
  readonly title: string
  /** Where a person is pointed. Relative to the served directory, 1-based. */
  readonly file: string
  readonly line: number
  /** The mark the node carries — a mirror's being its target's, since that is
   *  what it shows. ABSENT when it carries none: nobody marked it, so it is a
   *  bullet rather than a task nobody has started. */
  readonly status?: Status
  /** The canonical ancestor titles, outermost first. What makes a bare title
   *  like "order" mean something. */
  readonly path: ReadonlyArray<string>
  /** Free cross-references this node carries, as target ids. Absent when the
   *  node has none — so an agent can traverse without a second read, and a
   *  node that does not point anywhere does not pretend to. */
  readonly see?: ReadonlyArray<string>
  /** What this node must come AFTER, as target ids — the edges it carries
   *  itself, exactly as they are written.
   *
   *  Here for the same reason `see` is, and now for a second one: `set_after`
   *  removes a target BY ID, so a reader that could not see the list could only
   *  change it by guessing. Not the derived blockedness — what is standing in
   *  the way right now is a question about marks, and this is what the record
   *  says. */
  readonly after?: ReadonlyArray<string>
}

/**
 * One PLACEMENT of a node: a mirror record that shows it, and where that line
 * sits.
 *
 * Not a {@link Found} — a placement has no title, no mark and no ancestry of
 * its own; it draws the node's. What it does have is an id, and that id is the
 * only thing `remove_mirror` takes, which is why a node's own read is where the
 * placements of it are answered. A search never returns one: a mirror is a
 * second location of a node, and a hit for it would be the same node twice,
 * once at a place no write lands.
 */
export interface Placement {
  readonly id: string
  readonly file: string
  readonly line: number
  /** The node it is placed under. Absent at the top level of its file. */
  readonly parent?: string
}

/**
 * A placement read from the OTHER end: one row of a curated list, and the node
 * standing at it.
 *
 * {@link Placement} answers "where else is this node drawn"; this answers "what
 * is on this list" — the two halves of the same fact, from whichever end the
 * caller happens to be holding. A Now section is a node whose children are
 * placements, so without this half an agent can retire an entry it already
 * knows about and can never ask what is on the list at all.
 *
 * `shows` is the node itself, situated the way every other answer here situates
 * one — id, title, mark, `file:line`, ancestry — because that is what the list
 * is FOR: the reader wants the items, and the placement id is what lets it take
 * one off.
 */
export interface Placed extends Placement {
  readonly shows: Found
}

export interface Hit extends Found {
  /** Which field carried the strongest match — so a caller can say why this
   *  came back, rather than leaving a reader to guess. `meaning` is the one
   *  value no field carries: the node said the same thing in other words, and
   *  a reader owed the difference between evidence and resemblance gets it
   *  here ({@link searchWith}). */
  readonly matched: "title" | "id" | "tag" | "desc" | "meaning"
}

export interface Search {
  readonly hits: ReadonlyArray<Hit>
  /**
   * How many nodes matched in all, by whichever reading answered. `hits` is
   * capped at the limit; this is not, so "twelve of ninety" is sayable.
   *
   * ONE MEANING, and {@link searchWith} is careful to keep it one: the
   * paraphrase half counts every above-floor neighbour it could have shown,
   * not the few that fitted. A field that were uncapped for exact matches and
   * capped for semantic ones would be two fields wearing one name.
   *
   * When exact matches EXCEED the limit, `hits` is a window onto them and the
   * ones past it are absent from `hits` while still counted here — that is
   * the shape {@link search} has always had, and it is deliberate. Note that
   * it never coexists with a paraphrase hit: room is only left over when
   * nothing was truncated.
   */
  readonly total: number
}

/** What one node's page would say, plus the record itself. */
export interface Detail extends Found, Stamps {
  readonly date?: string | undefined
  readonly desc?: string | undefined
  readonly tags: ReadonlyArray<string>
  /** How many of its child tasks are done, when any of them is a task. An
   *  ANNOTATION: it decides nothing, and in particular the node's own status
   *  is `status` above whatever this says. */
  readonly progress?: Progress
  readonly children: ReadonlyArray<Found>
  /** Everywhere else this node is drawn — the mirrors that show it, chains
   *  included. Absent when nothing does, which is nearly every node.
   *
   *  It is here because a placement is otherwise UNFINDABLE: mirrors are left
   *  out of search and out of every child list on purpose, so without this the
   *  only id `remove_mirror` could ever be given is one the same session had
   *  just created. Asked of the node rather than answered as a node, which is
   *  the same shape every refusal about mirrors takes — a mirror is not a node,
   *  so you ask the node where it is placed. */
  readonly mirrors?: ReadonlyArray<Placement>
  /** The placements sitting UNDER this node, in sibling order, each with the
   *  node it shows — what a curated list holds. Absent when none do.
   *
   *  `children` above is the node's own children and never a mirror, because
   *  that list is about what hangs off it; this one is about what it POINTS at,
   *  and the two are different questions with different answers. A Now section
   *  is exactly a node of the second kind: without this, "what is on Now?" is a
   *  question the ops layer could not answer at all, and the ledger it was built
   *  for is read by hand again (the 2026-08-11 review). */
  readonly placed?: ReadonlyArray<Placed>
}

/** The mark a node stores, with what it was stamped — `status` above says
 *  which mark, and only this says when. Keyed by the format's own list rather
 *  than a field per mark: an agent that can `set_todo` should be able to read
 *  back the day it did, and a mark readable everywhere except here is how that
 *  drifts. */
type Stamps = Partial<Record<Status, string | true>>

/** A node and everything under it, nested — the shape a reader draws. */
export interface Subtree extends Found {
  readonly date?: string | undefined
  readonly desc?: string | undefined
  readonly children: ReadonlyArray<Subtree>
  /** True when the walk stopped at the depth it was given and this node has
   *  children it did not descend into. Said out loud, because a subtree that
   *  quietly ended would read as a leaf. */
  readonly truncated?: true
}

export interface Outline {
  readonly file: string
  /** Regular nodes in it. Mirrors are placements, not nodes, so they do not
   *  inflate the count. */
  readonly nodes: number
  /** Its top-level titles, in order — what the outline is ABOUT, in the space
   *  a listing has. */
  readonly roots: ReadonlyArray<string>
  /** Present, and the whole of what can be said about it, when the file did
   *  not parse: its nodes are not loaded, so it has neither count nor roots. */
  readonly unreadable?: ReadonlyArray<string>
}

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
    ...edgesOf(located.node),
  }
}

/** The edge fields a node carries, omitted when empty — the format's own rule
 *  for absence, applied to an answer rather than to a record. One helper
 *  because the two fields differ only in name here; what they MEAN differs
 *  everywhere else. */
const edgesOf = (
  node: LocatedRegular["node"],
): { see?: ReadonlyArray<string>; after?: ReadonlyArray<string> } => ({
  ...(node.see === undefined || node.see.length === 0 ? {} : { see: node.see }),
  ...(node.after === undefined || node.after.length === 0 ? {} : { after: node.after }),
})

/** Every regular node of the set, in file-then-line order. Mirrors are left
 *  out of every answer here: a mirror is a second PLACEMENT of a node, and
 *  returning it would be the same node twice with two locations, one of which
 *  is not where it is defined and so not where a write would land.
 */
const regulars = (derived: Derived): ReadonlyArray<LocatedRegular> =>
  derived.nodes.filter((located) => !isMirror(located.node)) as ReadonlyArray<
    LocatedRegular
  >

// ── search ─────────────────────────────────────────────────────────────

/** What a field is worth when a word is found in it. The order is racket's:
 *  the closer a hit is to what a node CALLS itself, the higher it goes. */
const FIELD_WEIGHT = { title: 1000, id: 750, tag: 500, desc: 250 } as const
type Field = keyof typeof FIELD_WEIGHT

/** Where in the field the word landed. A field that STARTS with it beats one
 *  where it starts a word inside it, which beats one where it is buried. */
const positionBonus = (haystack: string, needle: string): number => {
  const at = haystack.indexOf(needle)
  if (at === -1) return -1
  if (at === 0) return 100
  return /[\s/_-]/.test(haystack[at - 1] as string) ? 50 : 0
}

/** A done node is demoted by about a field's worth: enough to lose a tie, not
 *  enough to disappear. The reason to look for a node you finished is usually
 *  that you finished it. */
const DONE_PENALTY = 300

/** How many hits an unasked-for limit means, when a caller does not say. */
const DEFAULT_LIMIT = 12

/**
 * Case-folded substrings, no operators: a query is words, and every word has
 * to appear somewhere in the same node, in any of the four fields, in any
 * order. Anything more would be a query language nobody asked for.
 */
export const search = (
  derived: Derived,
  query: { readonly text: string; readonly limit?: number },
): Search => {
  const words = query.text.toLowerCase().split(/\s+/).filter((word) => word !== "")
  if (words.length === 0) return { hits: [], total: 0 }

  const scored: Array<{ readonly hit: Hit; readonly score: number }> = []

  for (const located of regulars(derived)) {
    const node = located.node
    const fields: Record<Field, ReadonlyArray<string>> = {
      title: [node.title.toLowerCase()],
      id: [node.id.toLowerCase()],
      // Guarded by the format's own cheap negative: `titleParts` runs a global
      // regex and allocates a part per segment, and most titles hold no tag at
      // all. The semantics are identical — it only ever yields a tag after a
      // sigil.
      //
      // TWO HAYSTACKS PER TAG, the bare name and the name as written, so
      // `alice` finds `@alice` with the full start-of-field bonus and `@alice`
      // finds only the one with that sigil. A single written form would have
      // demoted every bare-word tag search by a character. One fold, and the
      // bare name is a slice of it.
      tag: mayHoldTag(node.title)
        ? titleParts(node.title).flatMap((part) => {
          if (part.kind !== "tag") return []
          const written = tagText(part).toLowerCase()
          return [written.slice(1), written]
        })
        : [],
      desc: node.desc === undefined ? [] : [node.desc.toLowerCase()],
    }

    let score = 0
    let best: Field | null = null
    let bestWeight = -1
    for (const word of words) {
      let wordScore = -1
      for (const field of ["title", "id", "tag", "desc"] as const) {
        for (const haystack of fields[field]) {
          const bonus = positionBonus(haystack, word)
          if (bonus === -1) continue
          const value = FIELD_WEIGHT[field] + bonus
          if (value > wordScore) wordScore = value
          if (FIELD_WEIGHT[field] > bestWeight) {
            bestWeight = FIELD_WEIGHT[field]
            best = field
          }
        }
      }
      // Every word, in the same node. One miss and the node is not a hit.
      if (wordScore === -1) {
        score = -1
        break
      }
      score += wordScore
    }
    if (score < 0 || best === null) continue

    const found = foundOf(derived, located)
    if (found.status === "done") score -= DONE_PENALTY
    scored.push({ hit: { ...found, matched: best }, score })
  }

  // Ties keep the order the outlines are written in, so an answer never moves
  // under the cursor between two keystrokes. `scored` is already in that order
  // and `sort` is stable.
  const ranked = scored.slice().sort((a, b) => b.score - a.score)
  const limit = query.limit ?? DEFAULT_LIMIT
  return { hits: ranked.slice(0, limit).map((entry) => entry.hit), total: ranked.length }
}

// ── search, with the semantic reading behind it ────────────────────────

/** One nearby node, as the index answers it: an id, and how close it sits.
 *  An id and not a {@link Found} — the index is a DERIVED reading and may lag
 *  the snapshot by a beat, so what it says is only ever resolved against the
 *  snapshot in hand, never trusted for a title or a line. */
export interface Near {
  readonly id: string
  /** Cosine similarity, larger is closer. The index owns the floor under it. */
  readonly score: number
}

/**
 * The semantic reading, when something is standing behind the server to give
 * one — an embedding index over the same nodes {@link search} walks.
 *
 * An INTERFACE here and an implementation nowhere in this package, which is
 * the seam the whole feature hangs on: this layer stays pure functions over a
 * snapshot, and the thing that owns vectors, a cache file and a model server
 * lives with the server (`@olai/server`'s `recall/`). Its absence is not an
 * error and not even unusual — it is exactly today's substring search, which
 * is why every consumer holds a `Recall | null` and none of them may treat
 * the `null` as something to report.
 *
 * `nearest` CANNOT FAIL, by type: an embedder that is down, slow or wrong
 * answers as an empty list (logged by whoever owns it), because recall is a
 * reading a search falls back from — never a dependency a search waits on.
 */
export interface Recall {
  /**
   * Every neighbour the index reads as close enough to be a paraphrase,
   * best first. UNCAPPED, and that is the point: the caller has to be able to
   * say how many nodes resemble the query, not how many it had room to draw
   * ({@link Search}' `total`). What bounds this is the index's own
   * similarity floor, which is where a bound belongs — a count cut off at a
   * display limit is not a count.
   */
  readonly nearest: (text: string) => Effect.Effect<ReadonlyArray<Near>>
}

/**
 * {@link search}, with paraphrase matches filled in behind the exact ones.
 *
 * The ranking rule is the design (docs/brainstorming/semantic-recall.md):
 * substring hits rank FIRST because they are evidence — the words are in the
 * node, and a reader can check. Semantic hits only FILL what is left of the
 * limit, because they are resemblance: the index thinks the node says the
 * same thing in other words, and it is sometimes wrong. So a query whose
 * exact matches already fill the answer never asks the index at all, and the
 * two kinds are never interleaved by score — a similarity and a field weight
 * are not commensurable, and a merge that pretended they were would move
 * checkable hits below guessed ones.
 *
 * With no recall standing behind the server — none configured, no embedder in
 * the closure — the answer IS `search`'s, byte for byte. That equality is
 * pinned (`query.test.ts`), because it is the degradation contract: the
 * semantic index is a derived reading, and a missing derivation must cost
 * nothing but the paraphrase matches themselves.
 *
 * COUNTED HONESTLY, which is why the index is asked for every neighbour above
 * its floor rather than for a capped few: `total` is documented as the number
 * of nodes that MATCHED, and a paraphrase half that reported only what fitted
 * on the screen would make one field mean two things. So every resolvable,
 * not-already-answered neighbour is counted, and the first `room` of them are
 * drawn.
 *
 * The dedup is against `exact.hits` and that is complete, not approximate:
 * `room > 0` is only reachable when the substring pass did NOT fill the limit,
 * and a substring pass that did not fill the limit truncated nothing — so the
 * hits in hand ARE every exact match, and no node can be counted twice. An id
 * the snapshot no longer declares is skipped, not resolved: the index lags the
 * truth, never contradicts it.
 */
export const searchWith = (
  at: { readonly derived: Derived; readonly recall: Recall | null },
  query: { readonly text: string; readonly limit?: number },
): Effect.Effect<Search> => {
  const exact = search(at.derived, query)
  const limit = query.limit ?? DEFAULT_LIMIT
  const room = limit - exact.hits.length
  if (at.recall === null || room <= 0 || query.text.trim() === "") {
    return Effect.succeed(exact)
  }
  const recall = at.recall
  return Effect.map(recall.nearest(query.text), (near) => {
    const answered = new Set(exact.hits.map((hit) => hit.id))
    const filled: Array<Hit> = []
    /** Every neighbour that WOULD have been a hit — what `total` reports,
     *  whether or not there was room to draw it. */
    let resembling = 0
    for (const { id } of near) {
      if (answered.has(id)) continue
      const located = at.derived.byId.get(id)
      if (located === undefined || isMirror(located.node)) continue
      resembling += 1
      if (filled.length < room) {
        filled.push({
          ...foundOf(at.derived, located as LocatedRegular),
          matched: "meaning",
        })
      }
    }
    if (resembling === 0) return exact
    return {
      hits: [...exact.hits, ...filled],
      total: exact.total + resembling,
    }
  })
}

// ── one node, and what is under it ─────────────────────────────────────

/** Whichever marks the record carries, from the format's list — at most one
 *  by the format's own rule, but read as a set so this cannot be the place a
 *  new mark is missing from. */
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

  const depth = options.depth ?? 3
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
): ReadonlyArray<Outline> => {
  const broken = new Map(set.broken.map((entry) => [entry.file, entry.errors]))
  return set.files.map((file) => {
    const errors = broken.get(file)
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
