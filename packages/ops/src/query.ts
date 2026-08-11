/**
 * Reading the set, as an agent is allowed to read it.
 *
 * Every answer here is about NODES: an id, a title, a derived status, an
 * ancestry, a `file:line`. Never bytes, never a line of a file, never a
 * directory listing. That is the read half of the same decision the write half
 * makes — the agent works in the format's own terms, so the things it can
 * express are the things the format can be (docs/brainstorming/acp.md, resolved
 * 2026-08-09: "query tools are over parsed nodes, not raw lines").
 *
 * It is not a smaller `grep`. A grep over `.jsonl` answers with JSON fragments
 * out of context, invites byte-level edits back, and cannot say what a node's
 * status IS — which is derived, and therefore is not in the file at all. What
 * an agent needs to act is exactly what is here: which node, where it lives so
 * a person can be pointed at it, and what the tree currently makes of it.
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
  isMirror,
  type LocatedRegular,
  type OutlineSet,
  type Status,
  titleParts,
} from "@olai/format"

/** One node, said the way every answer here says it. */
export interface Found {
  readonly id: string
  readonly title: string
  /** Where a person is pointed. Relative to the served directory, 1-based. */
  readonly file: string
  readonly line: number
  /** DERIVED — what the tree makes of it, which for a parent is not in the
   *  file and can never be written there. ABSENT when the node has no status
   *  at all: nobody marked it and nothing under it is marked, so it is a
   *  bullet rather than a task nobody has started. */
  readonly status?: Status
  /** The canonical ancestor titles, outermost first. What makes a bare title
   *  like "order" mean something. */
  readonly path: ReadonlyArray<string>
  /** Free cross-references this node carries, as target ids. Absent when the
   *  node has none — so an agent can traverse without a second read, and a
   *  node that does not point anywhere does not pretend to. */
  readonly see?: ReadonlyArray<string>
}

export interface Hit extends Found {
  /** Which field carried the strongest match — so a caller can say why this
   *  came back, rather than leaving a reader to guess. */
  readonly matched: "title" | "id" | "tag" | "desc"
}

export interface Search {
  readonly hits: ReadonlyArray<Hit>
  /** How many nodes matched in all. `hits` is capped; this is not, so "twelve
   *  of ninety" is sayable. */
  readonly total: number
}

/** What one node's page would say, plus the record itself. */
export interface Detail extends Found {
  readonly date?: string | undefined
  readonly desc?: string | undefined
  readonly done?: string | true | undefined
  readonly doing?: string | true | undefined
  readonly tags: ReadonlyArray<string>
  readonly children: ReadonlyArray<Found>
}

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

const foundOf = (derived: Derived, located: LocatedRegular): Found => {
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
    ...(located.node.see === undefined || located.node.see.length === 0
      ? {}
      : { see: located.node.see }),
  }
}

/** Every regular node of the set, in file-then-line order. Mirrors are left
 *  out of every answer here: a mirror is a second PLACEMENT of a node, and
 *  returning it would be the same node twice with two locations, one of which
 *  is not where it is defined and so not where a write would land. */
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
      // Guarded by a plain `indexOf`: `titleParts` runs a global regex and
      // allocates a part per segment, and most titles hold no tag at all. The
      // semantics are identical — it only ever yields a tag after a `#`.
      tag: node.title.includes("#")
        ? titleParts(node.title).flatMap((part) =>
          part.kind === "tag" ? [part.tag.toLowerCase()] : []
        )
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
  const limit = query.limit ?? 12
  return { hits: ranked.slice(0, limit).map((entry) => entry.hit), total: ranked.length }
}

// ── one node, and what is under it ─────────────────────────────────────

export const detail = (derived: Derived, id: string): Detail | null => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return null
  const regular = located as LocatedRegular
  const node = regular.node
  return {
    ...foundOf(derived, regular),
    ...(node.date === undefined ? {} : { date: node.date }),
    ...(node.desc === undefined ? {} : { desc: node.desc }),
    ...(node.done === undefined ? {} : { done: node.done }),
    ...(node.doing === undefined ? {} : { doing: node.doing }),
    tags: titleParts(node.title).flatMap((part) =>
      part.kind === "tag" ? [part.tag] : []
    ),
    children: countedChildren(derived, id).map((child) => foundOf(derived, child)),
  }
}

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
