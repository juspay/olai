/**
 * THE GRAPH — every reference the served directory holds, laid flat as
 * vertices and edges, and every neighbourhood cut out of that one fold.
 *
 * WHY A READING AND NOT A BROWSER WALK: who refers to whom is a fact about
 * the set, and the browser that draws the graph holds no set. So the whole
 * structure is folded ONCE, in {@link buildWhole}, over the same `Reading`
 * every other page is answered off of — records in corpus order, documents
 * in path order — and every answer this module gives is a crop of that fold:
 * {@link graphOf} hands the fold over when `around` is `null`, and otherwise
 * numbers hops on it from a resolved centre. One walk is the agreement
 * argument itself: a neighbourhood and the whole page are trimmings of ONE
 * table of edges, never two walks that could differ — which is what
 * `./graph.test.ts` then checks back against `./backlinks.ts` (for one node,
 * the records arriving by `see` and `mention` ARE `backlinksOf`, computed
 * once forward and once backward) and against `./documents.ts`'s
 * `referrersTo` (for one document, the faces arriving by `see`, `doc` and
 * `link` ARE its referrers).
 *
 * THE VERTEX, and the rulings it stands on:
 *
 * - A record vertex is ALWAYS the record pointed at, canonicalised through
 *   `nodeNamed`: a mirror is a view, not a claim, so it is at no end of any
 *   edge, and a `see` onto a placement draws an edge to the record that
 *   placement shows. `key` is the vertex's one name — `printAddress` of its
 *   address — which the URL fragment and the camera both read without
 *   further parsing.
 * - Anything put away is out of the reading entirely: no vertex, no edge, no
 *   path through one to somewhere else. The reader asked "what refers to
 *   this", and "the trash refers to everything" is true and useless — the
 *   whole archive stays out, which is `referrersTo`'s own rule read once
 *   more in the other direction. Self-reference is dropped for the same
 *   reason: a document does not refer to itself, and a record's own `see`
 *   onto itself is noise the drawing must never lay an edge for.
 *
 * THE WAYS are the four kinds of reference the format declares — a `see`, a
 * `doc` attachment, a link in a note or in a body, an `@id` mention — and an
 * edge MERGES every way one writer reaches one other vertex by, because the
 * drawing draws the line and not the count. A `#tag` merges nothing: it
 * names no record, which is the mention rule, not a choice made here.
 *
 * THE CEILING, {@link GRAPH_DRAWN_AT_MOST}, is the opposite ruling from a row
 * page: there "too many rows" is the filter's problem and a cut answer is
 * still an answer. A vertex set that large is hair, and no crop of it is
 * readable either way — so rather than laying out slower and slower meshes
 * of somebody's generated corpus, the reading answers hot: `held` says how
 * many the reading holds and `vertices` stays empty, and the face offers a
 * narrower crop — a query, fewer hops, a centre. `held` is stated ALWAYS,
 * so the face reads one number whether or not the draw was withheld.
 *
 * HOPS ride on the request and land on every vertex: the neighbourhood's
 * count from the centre, the whole page's flat 0. The first-visit breadth
 * walk is what numbers them, so a vertex's hop is the SHORTEST path the
 * reading knows, and two neighbourhoods nested by one step hold the same
 * numbers wherever both reach — the rule `./graph.test.ts` pins.
 */
import { Schema } from "effect"

import { Address, addressOf, AtDocument, AtNode, type NodeId, printAddress } from "./address.ts"
import { type Derived, ancestorsOf, follow, nodeNamed, writtenTags } from "./derive.ts"
import { type Document } from "./document.ts"
import { docOf, linksIn } from "./documents.ts"
import { FileKind, fileKind } from "./kinds.ts"
import { type LocatedRegular, Status, isPutAway, isRegular, storedMarker } from "./node.ts"
import { byPath } from "./paths.ts"
import type { Reading } from "./validate.ts"

/** The four kinds of reference the graph draws, in the order an edge lists
 *  the ones it merges. The order is the WIRE's, not a drawing's: two answers
 *  about one edge must say the same list, so the list has one order
 *  (`./graph.test.ts`'s agreement checks read it). */
export const WAYS_DRAWN = ["see", "doc", "link", "mention"] as const
export const WayDrawn = Schema.Literals(WAYS_DRAWN)
export type WayDrawn = typeof WayDrawn.Type

/** How far a neighbourhood reaches — the route spells it and the request
 *  carries it, and it is never more than 2: past the second hop most of an
 *  honest corpus is the mesh, and {@link GRAPH_DRAWN_AT_MOST} is the ruling
 *  that keeps even the second hop bounded. */
export const HOPS = [1, 2] as const
export const Hops = Schema.Literals(HOPS)
export type Hops = typeof Hops.Type
export const HOPS_DEFAULT: Hops = 1

/** See the module header: past this many vertices the reading withholds the
 *  draw and reports `held`, because no crop of a hairball is an answer. */
export const GRAPH_DRAWN_AT_MOST = 2000

/** What a vertex IS — a record, or one of the directory's files standing as
 *  itself. The file's own kind comes along so the face draws an outline dot
 *  and a picture dot differently without re-asking the registry. */
export const VertexKind = Schema.Union([Schema.Literal("node"), FileKind])
export type VertexKind = typeof VertexKind.Type

/**
 * ONE THING THE READER CAN POINT AT: a record, or a document standing as
 * itself.
 *
 * `address` is the openable thing — the face's panes write it into links,
 * and the camera's fragment reads it — and `key` is its one printed name,
 * stable across readings of the same set. `crumbs` are the locator line the
 * graph shows instead of a tree: ancestor titles root-first for a record
 * (the chain a zoom prints, off `ancestorsOf`), the directory segments for
 * a document. `status` is the record's own stored mark, absent for one
 * claiming nothing and always absent for a document. `hops` is the crop's
 * own number; see the module header.
 */
export const Vertex = Schema.Struct({
  key: Schema.String,
  address: Schema.Union([AtNode, AtDocument]),
  kind: VertexKind,
  title: Schema.String,
  file: Schema.String,
  crumbs: Schema.Array(Schema.String),
  status: Schema.optionalKey(Status),
  hops: Schema.Int,
})
export type Vertex = typeof Vertex.Type

/** One line between two vertices, and the ways it merges — nonempty by
 *  construction, listed in {@link WAYS_DRAWN} order. The ends are KEYS, so
 *  the reading stays flat: who they are is `vertices`' business. */
export const Edge = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  ways: Schema.NonEmptyArray(WayDrawn),
})
export type Edge = typeof Edge.Type

/**
 * WHAT THE CENTRE TURNED OUT TO BE — the graph page's own answer to its
 * `around`, and its arms are `./zoom.ts`'s judgements spelt the same way,
 * because they are the same judgements: a record that resolved, or the
 * reason it did not, `id`/`missing`/`through` written bare just as `Zoomed`
 * writes them. A DOCUMENT centre resolves to a `vertex`, to `unknown`, or to
 * `put-away` — a path has no chain to dangle or to loop on, so only the
 * record half grows those two arms.
 */
export const Centre = Schema.Union([
  /** A resolved vertex — the crop numbered hops from it. */
  Schema.Struct({ kind: Schema.Literal("vertex"), vertex: Vertex }),
  /** The address named an id or a path the served directory does not have. */
  Schema.Struct({ kind: Schema.Literal("unknown"), address: Address }),
  /** ...or one the reader can no longer be shown: it is put away, and what
   *  is put away has a page of its own that is not this one. */
  Schema.Struct({ kind: Schema.Literal("put-away"), address: Address }),
  Schema.Struct({
    kind: Schema.Literal("dangling"),
    id: Schema.String,
    missing: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal("cycle"), id: Schema.String, through: Schema.String }),
])
export type Centre = typeof Centre.Type

/**
 * THE READING ITSELF — one page's worth of vertices and the edges among
 * them.
 *
 * `around` is `null` for the whole directory and otherwise what the centre
 * resolved to, so a failed crop and a centred one are two different things
 * to SAY, and the failed one carries the reason. `hops` is the request's
 * own number, spelled back unchanged. When the ceiling withheld the draw,
 * `vertices` and `edges` are EMPTY and `held` says how many there were —
 * see the module header for why the answer is hot rather than partial.
 */
export const Graph = Schema.Struct({
  kind: Schema.Literal("graph"),
  around: Schema.NullOr(Centre),
  hops: Hops,
  vertices: Schema.Array(Vertex),
  edges: Schema.Array(Edge),
  held: Schema.Int,
})
export type Graph = typeof Graph.Type

/**
 * The request's own tail, so the fold reads it structurally: page.ts's
 * `PageRequest` arm spells exactly this, and keeping the parameter open is
 * what keeps THIS module on the reading's side of the wire — it folds a
 * directory, it does not declare routes.
 */
export interface GraphRequest {
  readonly around: Address | null
  readonly hops: Hops
}

/** A vertex under construction: the wire value, plus the corpus line the
 *  reading order sorts records by (documents sort by their path, which
 *  `vertex.file` already carries). */
interface Draft {
  readonly vertex: Vertex
  readonly line: number | undefined
}

/** The fold's whole table — {@link WHOLE} is the one copy. */
interface WholeGraph {
  /** By key, with the sort keys still on. */
  readonly drafts: ReadonlyMap<string, Draft>
  /** The set's documents by path — the centre's own resolution walks the
   *  same table, so a two-crop page and a whole page cannot disagree about
   *  what a path names. */
  readonly documents: ReadonlyMap<string, Document>
  /** Records in corpus order, then documents in the one path order — the
   *  reading's own spelling of "fair", which every crop inherits. */
  readonly vertices: ReadonlyArray<Vertex>
  readonly edges: ReadonlyArray<Edge>
  /** Both ends of every edge, keyed either way — the neighbourhood's walk
   *  order, undirected because "who points at whom" answers both ways. */
  readonly adjacent: ReadonlyMap<string, ReadonlyArray<string>>
}

/**
 * THE ONE FOLD, beside the value it folds — a `WeakMap` for the same reason
 * ./vocabulary.ts's tag counts are one: it is a function of an immutable
 * value, so it lives beside that value and leaves with it, and value-equality
 * (`Schema.toEquivalence`) is then the same equality the whole page answers
 * each reopen with.
 */
const WHOLE = new WeakMap<Reading, WholeGraph>()

/** A record's id IS the id the address carries — the same nominal-brand
 *  cast `./narrowing.ts` argues at `narrowedIn`: re-parsing would run a
 *  grammar on a value already minted by it. */
const nodeVertexId = (id: string): NodeId => id as NodeId

const buildWhole = (at: Reading): WholeGraph => {
  const documents = new Map(
    at.set.documents.map((document): readonly [string, Document] => [document.path, document]),
  )
  const drafts = new Map<string, Draft>()
  const edges: Array<Edge> = []

  const record = (ways: Map<string, Set<WayDrawn>>, to: string, way: WayDrawn): void => {
    const held = ways.get(to)
    if (held === undefined) ways.set(to, new Set([way]))
    else held.add(way)
  }

  // WHERE A POINTER LANDS — the module header's two rulings, said twice so
  // the self-reference check sits beside each kind's own resolution. A NODE
  // target is canonicalised through `nodeNamed`: a `see` or an `@x` onto a
  // placement draws to the record the placement shows; anything put away or
  // absent is dropped, and a pointer back to the writer's own record is
  // noise. A DOCUMENT target — a heading lands on its document, because a
  // place inside a body is the body's vertex — keeps the same discipline.
  const landNode = (
    id: string,
    way: WayDrawn,
    self: { readonly node: string | undefined; readonly path: string },
    ways: Map<string, Set<WayDrawn>>,
  ): void => {
    const found = nodeNamed(at.derived, id)
    if (found === undefined || isPutAway(found.file)) return
    if (self.node !== undefined && found.node.id === self.node) return
    const key = printAddress({ kind: "node", id: nodeVertexId(found.node.id) })
    if (!drafts.has(key)) drafts.set(key, nodeDraftFor(at.derived, found))
    record(ways, key, way)
  }
  const landDocument = (
    path: string,
    way: WayDrawn,
    self: { readonly node: string | undefined; readonly path: string },
    ways: Map<string, Set<WayDrawn>>,
  ): void => {
    if (path === self.path) return
    const document = documents.get(path)
    if (document === undefined) return
    const key = printAddress({ kind: "document", path: document.path })
    if (!drafts.has(key)) drafts.set(key, documentDraftFor(document))
    record(ways, key, way)
  }
  const land = (
    target: Address,
    way: WayDrawn,
    self: { readonly node: string | undefined; readonly path: string },
    ways: Map<string, Set<WayDrawn>>,
  ): void =>
    target.kind === "node" || target.kind === "row"
      ? landNode(target.id, way, self, ways)
      : landDocument(target.path, way, self, ways)

  // RECORDS FIRST — a writer that is a mirror writes nothing of its own: its
  // `doc` is its record's (`docOf` already rules it out), its note is
  // nobody's, and that is `referrersTo`'s `isRegular` guard read once more.
  for (const located of at.derived.nodes) {
    if (!isRegular(located) || isPutAway(located.file)) continue
    const self = { node: located.node.id as string, path: located.file }
    const ways = new Map<string, Set<WayDrawn>>()
    for (const id of located.node.see ?? []) landNode(id, "see", self, ways)
    const doc = docOf(located)
    if (doc !== undefined) {
      // Suffix-relative, like the document grammar everywhere: `doc: a.md`.
      const to = addressOf(doc, null)
      if (to !== null) land(to, "doc", self, ways)
    }
    for (const link of linksIn(located.file, located.node.title)) land(link, "link", self, ways)
    if (located.node.desc !== undefined) {
      for (const link of linksIn(located.file, located.node.desc)) land(link, "link", self, ways)
    }
    // An `@x` whose `x` is no record lands nowhere — `landNode` already
    // drops it; a `#x` is never asked, because a tag is not a reference to
    // one.
    for (const tag of writtenTags(located.node)) {
      if (tag.startsWith("@")) landNode(tag.slice(1), "mention", self, ways)
    }
    // A writer is at an end only of a SURVIVING pointer: no ways, no vertex.
    if (ways.size === 0) continue
    const from = printAddress({ kind: "node", id: nodeVertexId(located.node.id) })
    if (!drafts.has(from)) drafts.set(from, nodeDraftFor(at.derived, located))
    pushEdges(edges, from, ways)
  }

  // ...then the bodies. An outline is REFERRED to as a document (a dot of
  // its own), but it writes its references as RECORDS, which the walk above
  // already said — this half is the bodied kinds'.
  for (const document of at.set.documents) {
    if (document.kind === "outline" || isPutAway(document.path)) continue
    const self = { node: undefined, path: document.path }
    const ways = new Map<string, Set<WayDrawn>>()
    for (const link of document.links) land(link, "link", self, ways)
    for (const tag of document.tags) {
      if (tag.startsWith("@")) landNode(tag.slice(1), "mention", self, ways)
    }
    if (ways.size === 0) continue
    const from = printAddress({ kind: "document", path: document.path })
    if (!drafts.has(from)) drafts.set(from, documentDraftFor(document))
    pushEdges(edges, from, ways)
  }

  const vertices = [...drafts.values()].sort(orderDrafts).map((draft) => draft.vertex)
  const adjacent = new Map<string, Array<string>>()
  for (const edge of edges) {
    getOrPut(adjacent, edge.from).push(edge.to)
    getOrPut(adjacent, edge.to).push(edge.from)
  }
  return { drafts, documents, vertices, edges, adjacent }
}

/** One writer's ways, as one edge per target — merged in {@link WAYS_DRAWN}
 *  order. `ways` is nonempty at this point (the writer loop's own skip), and
 *  the [head, ...rest] split asserts the shape the type cannot recover past
 *  `filter`'s widening. */
const pushEdges = (edges: Array<Edge>, from: string, ways: Map<string, Set<WayDrawn>>): void => {
  for (const [to, merged] of ways) {
    const [head, ...rest] = WAYS_DRAWN.filter((way) => merged.has(way))
    if (head === undefined) continue
    edges.push({ from, to, ways: [head, ...rest] })
  }
}

const getOrPut = (adjacent: Map<string, Array<string>>, key: string): Array<string> => {
  const held = adjacent.get(key)
  if (held !== undefined) return held
  const empty: Array<string> = []
  adjacent.set(key, empty)
  return empty
}

/** The reading's one order, on both crops alike: records spine-first by
 *  corpus position, and every document after, in the one path order. */
const orderDrafts = (a: Draft, b: Draft): number =>
  a.line === undefined
    ? b.line === undefined
      ? byPath(a.vertex.file, b.vertex.file)
      : 1
    : b.line === undefined
      ? -1
      : byPath(a.vertex.file, b.vertex.file) || a.line - b.line

const wholeGraphOf = (at: Reading): WholeGraph => {
  const held = WHOLE.get(at)
  if (held !== undefined) return held
  const built = buildWhole(at)
  WHOLE.set(at, built)
  return built
}

/** The reading, or the withheld stand-in when the ceiling ruled — see the
 *  module header for why an over-large crop answers EMPTY and says how much
 *  it held. */
const bounded = (
  request: GraphRequest,
  around: Centre | null,
  vertices: ReadonlyArray<Vertex>,
  edges: ReadonlyArray<Edge>,
): Graph =>
  vertices.length > GRAPH_DRAWN_AT_MOST
    ? { kind: "graph", around, hops: request.hops, vertices: [], edges: [], held: vertices.length }
    : { kind: "graph", around, hops: request.hops, vertices, edges, held: vertices.length }

/** What an `around` resolves to — `Zoomed`'s walk for a record, the face's
 *  for a document. The centre is built FRESH rather than found in the fold:
 *  a record nobody points at is a one-vertex neighbourhood, which is a page
 *  the fold alone could not state. */
type CentreAnswer =
  | { readonly kind: "found"; readonly draft: Draft }
  | { readonly kind: "failed"; readonly centre: Centre }

const centreOf = (at: Reading, documents: ReadonlyMap<string, Document>, address: Address): CentreAnswer => {
  if (address.kind === "node" || address.kind === "row") {
    const placed = at.derived.byId.get(address.id)
    if (placed === undefined) return { kind: "failed", centre: { kind: "unknown", address } }
    const found = follow(at.derived, placed)
    if (found.kind === "dangling") {
      return { kind: "failed", centre: { kind: "dangling", id: address.id, missing: found.missing } }
    }
    if (found.kind === "cycle") {
      return { kind: "failed", centre: { kind: "cycle", id: address.id, through: found.through } }
    }
    if (isPutAway(found.shows.file)) {
      return { kind: "failed", centre: { kind: "put-away", address } }
    }
    return { kind: "found", draft: nodeDraftFor(at.derived, found.shows) }
  }
  const document = documents.get(address.path)
  if (document === undefined) return { kind: "failed", centre: { kind: "unknown", address } }
  if (isPutAway(address.path)) return { kind: "failed", centre: { kind: "put-away", address } }
  return { kind: "found", draft: documentDraftFor(document) }
}

/** The vertex builders, module-level so the centre answer and the fold share
 *  ONE spelling of either kind — an isolated record's dot and a pointed-at
 *  record's dot are the same dot. */
const nodeDraftFor = (derived: Derived, found: LocatedRegular): Draft => {
  const marker = storedMarker(found.node)
  return {
    vertex: {
      key: printAddress({ kind: "node", id: nodeVertexId(found.node.id) }),
      address: { kind: "node", id: nodeVertexId(found.node.id) },
      kind: "node",
      title: found.node.title,
      file: found.file,
      crumbs: ancestorsOf(derived, found.node.id).map((one) => one.node.title),
      ...(marker === undefined ? {} : { status: marker }),
      hops: 0,
    },
    line: found.line,
  }
}

const documentDraftFor = (document: Document): Draft => ({
  vertex: {
    key: printAddress({ kind: "document", path: document.path }),
    address: { kind: "document", path: document.path },
    kind: fileKind(document.path) ?? "outline",
    title: document.title,
    file: document.path,
    crumbs: document.path.split("/").slice(0, -1),
    hops: 0,
  },
  line: undefined,
})

/**
 * WHAT THE ADDRESS PUTS ON THE SCREEN — the graph page's whole half, and the
 * crop.
 *
 * The breadth walk numbers FIRST-WINS: a vertex reached at hop 1 never
 * re-counts at hop 2, which is what makes `vertices`' `hops` the shortest
 * path — and what makes nesting the two crops ask one question, per the
 * module header. The fold's own order (records corpus-first, then documents
 * by path) is re-established on the crop, not the walk's, because the
 * reading order is a property of the SET, not of where the walk happened to
 * start.
 */
export const graphOf = (at: Reading, request: GraphRequest): Graph => {
  const whole = wholeGraphOf(at)
  if (request.around === null) {
    return bounded(request, null, whole.vertices, whole.edges)
  }
  const centre = centreOf(at, whole.documents, request.around)
  if (centre.kind === "failed") {
    return { kind: "graph", around: centre.centre, hops: request.hops, vertices: [], edges: [], held: 0 }
  }
  const start = centre.draft
  const reached = new Map<string, number>([[start.vertex.key, 0]])
  let run = 0
  const queue = [start.vertex.key]
  while (run < queue.length) {
    const key = queue[run]
    run += 1
    if (key === undefined) break
    const hops = reached.get(key) ?? 0
    if (hops >= request.hops) continue
    for (const next of whole.adjacent.get(key) ?? []) {
      if (reached.has(next)) continue
      reached.set(next, hops + 1)
      queue.push(next)
    }
  }
  const drawn = new Map<string, Draft>([[start.vertex.key, start]])
  for (const key of reached.keys()) {
    if (!drawn.has(key)) {
      const held = whole.drafts.get(key)
      if (held !== undefined) drawn.set(key, held)
    }
  }
  // The centre's own vertex is THE SAME OBJECT in both places it rides —
  // the crop's and the `around`'s — so two reads of one page agree by
  // identity, not by a second render.
  const centreDrawn: Vertex = { ...start.vertex, hops: 0 }
  const vertices = [...drawn.values()]
    .sort(orderDrafts)
    .map((draft): Vertex =>
      draft.vertex.key === start.vertex.key
        ? centreDrawn
        : { ...draft.vertex, hops: reached.get(draft.vertex.key) ?? 0 },
    )
  const edges = whole.edges.filter((edge) => reached.has(edge.from) && reached.has(edge.to))
  return bounded(request, { kind: "vertex", vertex: centreDrawn }, vertices, edges)
}
