/**
 * The reference graph — the same edges {@link ./backlinks.ts} reads backwards,
 * read as a shape rather than as a list.
 *
 * A node's page answers "what points at this" one node at a time. That is the
 * right answer for a page ABOUT a node and the wrong one for the question
 * behind it: which nodes are talking to each other, and where does this one sit
 * among them. Nothing in this format could answer that without walking the
 * directory and drawing the answer by hand, so nobody asked it.
 *
 * ## What an edge IS is not decided here
 *
 * Every ruling about what counts as a reference is {@link ./backlinks.ts}'s,
 * and this module inherits every one of them rather than restating any:
 *
 *   - a `see` counts, and an `@id` in prose counts exactly when the word names
 *     a node;
 *   - a MIRROR does not — a placement is a view of a node, not a claim about
 *     one — and neither does an `after` or a `blocks`, which are the ordering
 *     graph and are drawn both ways on the node's own page;
 *   - a reference to a PLACEMENT of a node is a reference to that node, so both
 *     ends of every edge here are canonical;
 *   - what is put away is on the Trash and nowhere else (#226), so an archived
 *     record is at neither end.
 *
 * What is new is {@link referencesOf}: the same rulings read FORWARDS, which
 * `backlinksOf` cannot be asked for. It is not a second opinion and it is not
 * asserted to be one — `graph.test.ts` holds the two to each other over a whole
 * corpus, in both directions, which is the only statement of "these agree" that
 * cannot go stale while somebody edits one of them.
 *
 * ## Scoped, because a corpus-wide picture answers nothing
 *
 * A graph of ten thousand nodes is a hairball, and a hairball is a picture of
 * the fact that a directory is large. So the reading takes a FOCUS and a
 * horizon ({@link Hops}): the node, what refers to it and what it refers to,
 * and optionally the ring beyond that. The corpus-wide reading is the same
 * function with the focus left out, and it is deliberately not "every node" —
 * it is every node that is IN the reference graph, since a node nothing refers
 * to and which refers to nothing is not part of the shape being drawn.
 *
 * ## A lookup, like the section it generalises
 *
 * A focused reading costs the walk it draws: two index reads per node reached,
 * and nothing scans the corpus. The corpus-wide one is O(records) once, which
 * is what "every node that is in the graph" means and is why it is the reading
 * you have to ask for by name.
 */

import { backlinksOf, type Way, WAYS } from "./backlinks.ts"
import { byCorpus, type Derived, mentionsOf, nodeNamed } from "./derive.ts"
import { isArchived, isRegular, type LocatedRegular, targetsOf } from "./node.ts"
import type { Selected } from "./filter.ts"

/**
 * How far from the focus a reading reaches, as the closed list both the address
 * and the control read.
 *
 * TWO VALUES and not a number, because there is no third that is a different
 * KIND of answer: one hop is "what is this node's own conversation", two is
 * "…and who those nodes are talking to", and past that every graph in a real
 * directory is the corpus with extra steps. A free integer in the address
 * would be a horizon nobody could draw and a link that meant something else on
 * a bigger vault.
 */
export const HOPS = [1, 2] as const
export type Hops = (typeof HOPS)[number]

/** The default horizon: the node's own neighbourhood. The wider one is a thing
 *  a reader asks for, so the plain address stays the plain reading. */
export const HOPS_DEFAULT: Hops = 1

/** One node this graph draws, and how far out it is: `0` is the focus, and `0`
 *  for every node of a corpus-wide reading, where there is no centre to be far
 *  from. */
export interface GraphNode {
  readonly at: LocatedRegular
  readonly hops: number
}

/**
 * One edge, in the direction it was written: `from` is the record that made the
 * reference and `to` is the node it named.
 *
 * IDS AND NOT RECORDS, unlike {@link GraphNode}: an edge is a pair of ends, the
 * records are already in `nodes`, and a second copy of a record on every edge
 * touching it is a shape whose two halves can disagree about the same node.
 *
 * ONE ENTRY PER PAIR, with the ways it refers, in {@link WAYS} order — the same
 * rule {@link ./backlinks.ts}'s `Backlink` keeps and for the same reader: a
 * record that both points at a node and names it in prose is one relationship,
 * drawn once.
 */
export interface GraphEdge {
  readonly from: string
  readonly to: string
  readonly ways: ReadonlyArray<Way>
}

/**
 * The reading: the nodes, in corpus order, and every edge with BOTH ends among
 * them.
 *
 * The edge rule is what makes the picture honest rather than merely small: an
 * edge is drawn only where the reader can see what is at each end of it, so
 * there are no arrows into the dark at the horizon.
 */
export interface Graph {
  readonly nodes: ReadonlyArray<GraphNode>
  readonly edges: ReadonlyArray<GraphEdge>
}

/** A reading with nothing in it — ONE value, shared, for the frames and the
 *  addresses that produce one. */
export const NOTHING_DRAWN_GRAPH: Graph = { nodes: [], edges: [] }

/** One node this record refers to, and how. {@link Backlink} read the other way
 *  round: that one names the REFERRER, this one names the target. */
export interface Outgoing {
  readonly to: string
  readonly ways: ReadonlyArray<Way>
}

/** The answer for a record that refers to nothing, which is most of them. */
const REFERS_TO_NOTHING: ReadonlyArray<Outgoing> = []

/**
 * Everything `at` refers to — {@link backlinksOf} read forwards, under the same
 * rulings.
 *
 * CANONICAL AT THE FAR END: a `see` or an `@id` naming a placement is a
 * reference to the node standing at it ({@link nodeNamed}), which is exactly
 * how the reverse reading files it — so the two answers are about the same
 * pairs and `graph.test.ts` can hold them to each other.
 *
 * A record never refers to ITSELF, an id nothing claims is not a reference, and
 * a target in an archive is left out. The first two are the reverse reading's
 * own rules; the third is #226 asked at the other end of the arrow, and it is
 * what keeps a graph from growing a limb into the Trash.
 *
 * The `see` list is read through {@link targetsOf} rather than off the field,
 * so the one table that says which fields point at ids is the one table this
 * reads — the same reason the reverse reading asks the index rather than the
 * record.
 */
export const referencesOf = (
  derived: Derived,
  at: LocatedRegular,
): ReadonlyArray<Outgoing> => {
  let found: Map<string, Set<Way>> | undefined
  const file = (named: string, way: Way): void => {
    const target = nodeNamed(derived, named)
    if (target === undefined) return
    if (target.node.id === at.node.id || isArchived(target.file)) return
    const ways = (found ??= new Map()).get(target.node.id)
    if (ways === undefined) found.set(target.node.id, new Set([way]))
    else ways.add(way)
  }

  for (const [field, named] of targetsOf(at.node)) {
    if (field === "see") file(named, "see")
  }
  for (const word of mentionsOf(at.node)) file(word, "mention")

  if (found === undefined) return REFERS_TO_NOTHING
  return [...found].map(([to, ways]): Outgoing => ({
    to,
    ways: WAYS.filter((way) => ways.has(way)),
  }))
}

/** What a reading was asked for: one node's neighbourhood, or the whole
 *  reference graph when no node is named. */
export interface Asked {
  /**
   * The node at the centre — CANONICAL, since a zoom has already resolved a
   * mirror's chain by the time a page asks. An id nothing claims draws nothing,
   * which is the same answer an empty directory gives.
   *
   * AN ARCHIVED ID DRAWS NOTHING EITHER, and that is #226 rather than a gap: a
   * record that was put away is drawn on the Trash and nowhere else, so it is
   * at no end of any edge here — the centre included. The alternative was a
   * centre the walk would then have to reach two different ways, since the
   * forward reading leaves an archived TARGET out and the backward one does
   * not: a picture whose arrows pointed one way only, about a node the ruling
   * says is not on this page at all.
   */
  readonly focus?: string
  readonly hops: Hops
}

export const graphOf = (derived: Derived, asked: Asked): Graph => {
  const reached = asked.focus === undefined
    ? everythingReferring(derived)
    : neighbourhoodOf(derived, asked.focus, asked.hops)
  if (reached.size === 0) return NOTHING_DRAWN_GRAPH

  const nodes: Array<GraphNode> = []
  for (const [id, hops] of reached) {
    const at = derived.byId.get(id)
    if (at !== undefined && isRegular(at)) nodes.push({ at, hops })
  }
  nodes.sort((one, other) => byCorpus(one.at, other.at))

  // ONE pass, and it is the FORWARD reading for every node — which is what
  // makes each edge appear exactly once without a dedup step, and what makes
  // the arrows agree with the records that wrote them. The far end is kept only
  // when it is drawn: an arrow into the dark says less than no arrow.
  const edges: Array<GraphEdge> = []
  for (const node of nodes) {
    for (const { to, ways } of referencesOf(derived, node.at)) {
      if (reached.has(to)) edges.push({ from: node.at.node.id, to, ways })
    }
  }
  return { nodes, edges }
}

/**
 * The nodes within `hops` of the focus, each against how far out it is.
 *
 * BOTH DIRECTIONS at every step, because "this node's neighbourhood" is not a
 * question about who wrote the arrow: a note somebody else wrote about this
 * node is as much its context as one it wrote about them. The focus is always
 * in the answer, even when nothing refers to it — the page is about it, and a
 * page that drew nothing would be saying the node is not there.
 */
const neighbourhoodOf = (
  derived: Derived,
  focus: string,
  hops: Hops,
): ReadonlyMap<string, number> => {
  const found = new Map<string, number>()
  const at = derived.byId.get(focus)
  if (at === undefined || !isRegular(at) || isArchived(at.file)) return found
  found.set(focus, 0)

  let frontier: ReadonlyArray<string> = [focus]
  for (let hop = 1; hop <= hops && frontier.length > 0; hop += 1) {
    const next: Array<string> = []
    for (const id of frontier) {
      const here = derived.byId.get(id)
      if (here === undefined || !isRegular(here)) continue
      for (const { to } of referencesOf(derived, here)) {
        if (!found.has(to)) {
          found.set(to, hop)
          next.push(to)
        }
      }
      for (const back of backlinksOf(derived, id)) {
        const from = back.at.node.id
        if (!found.has(from)) {
          found.set(from, hop)
          next.push(from)
        }
      }
    }
    frontier = next
  }
  return found
}

/**
 * Every node that is IN the reference graph — the corpus-wide reading.
 *
 * NOT every node in the directory, and that is the decision: a graph of a vault
 * is mostly nodes nobody has connected to anything, and drawing them is drawing
 * the size of the directory rather than the shape of what is in it. So a node
 * is here when it refers to something or something refers to it, and a corpus
 * with no references at all draws nothing rather than a field of dots.
 *
 * Everything is at hop `0`: there is no centre for anything to be far from, and
 * a distance measured from an arbitrary node would be a fact about the walk
 * rather than about the set.
 */
const everythingReferring = (derived: Derived): ReadonlyMap<string, number> => {
  const found = new Map<string, number>()
  for (const at of derived.nodes) {
    if (!isRegular(at) || isArchived(at.file)) continue
    for (const { to } of referencesOf(derived, at)) {
      found.set(at.node.id, 0)
      found.set(to, 0)
    }
  }
  return found
}

/**
 * The same graph narrowed to what a query selected — {@link keeping} for the
 * page that is a SHAPE rather than a tree.
 *
 * `keep` is the focus, and it survives whether or not it matched: the page is
 * about that node, exactly as a day page goes on being about its date when
 * nothing on it matches. Filtering it out would leave a neighbourhood with no
 * centre, which is a picture of nothing.
 *
 * AN EDGE NEEDS BOTH ENDS, which is {@link Graph}'s own rule applied to what is
 * left: an arrow to a node the query took away is an arrow into the dark.
 */
export const keepingGraph = (
  graph: Graph,
  matched: Selected,
  keep: string | undefined,
): Graph => {
  const nodes = graph.nodes.filter(
    (node) => node.at.node.id === keep || matched.has(node.at.node.id),
  )
  if (nodes.length === graph.nodes.length) return graph
  const drawn = new Set(nodes.map((node) => node.at.node.id))
  return {
    nodes,
    edges: graph.edges.filter((edge) => drawn.has(edge.from) && drawn.has(edge.to)),
  }
}

/** How many places this graph draws — a node appears once, so this is the node
 *  count, and it is a function rather than a `.length` at the call site for
 *  {@link rowsIn}'s reason: one walk decides what a place is, and both numbers
 *  of "3 of 41" are asked of it. */
export const placesInGraph = (graph: Graph): number => graph.nodes.length

/** How many of those places the query selected — the first number. */
export const matchedInGraph = (graph: Graph, matched: Selected): number =>
  graph.nodes.reduce(
    (total, node) => total + (matched.has(node.at.node.id) ? 1 : 0),
    0,
  )
