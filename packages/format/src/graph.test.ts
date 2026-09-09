/**
 * THE REFERRAL STRUCTURE, READ — and the agreements that let it be trusted.
 *
 * Four things are asserted here and they are different in kind.
 *
 * **That the fold says what the records write.** Vertex shapes and edge
 * spellings, over a corpus chosen so each ruling of `./graph.ts`'s header
 * bites: a mirror at no end, the archive and the leftover folded OUT, a
 * `see` onto oneself drawn as no line at all, and a `see` onto a placement
 * laid along the placement's target.
 *
 * **That the two-sided readings agree.** The edges are the FORWARD reading
 * of the same references `./backlinks.ts` answers backward — for one record,
 * the writers arriving by `see`/`mention` are `backlinksOf`'s, with the same
 * ways — and of `referrersTo`'s faces arriving by `see`/`doc`/`link`. Two
 * walks of one rule, and any drift between them is the kind of bug this
 * reading was built to close (its header has the argument).
 *
 * **That crops behave.** Hops are the shortest path, nested crops agree on
 * the numbering wherever both reach, the centre comes out one of
 * `./zoom.ts`'s judgements, and a too-big page withholds by
 * {@link GRAPH_DRAWN_AT_MOST} rather than drawing hair.
 *
 * **That the filter rides it**, exactly the way
 * `./narrowing.test.ts` asks of every other page: matched node vertices,
 * matched document vertices, and the put-away rule being the fold's, not
 * the box's.
 */

import { expect, test } from "bun:test"
import { Schema } from "effect"

import { addressOf } from "./address.ts"
import { backlinksOf, referrersTo } from "./backlinks.ts"
import { readingOf, setOf } from "./fixtures.testlib.ts"
import { GRAPH_DRAWN_AT_MOST, Graph, graphOf, HOPS_DEFAULT } from "./graph.ts"
import { narrowingOf, showsPutAway } from "./narrowing.ts"
import { pageOf, shownOf } from "./page.ts"
import { NO_KINDS } from "./typing.ts"

const NOW = "2026-08-10"

/**
 * THE CORPUS, built for the rulings to bite — two live outlines, a pair of
 * markdocs writing their own references, the trash writing one of its own,
 * and the leftover archive claiming a reference nobody else can see. The
 * comment beside each line states the ruling the line exercises, so a
 * failure names what the corpus lost.
 */
const GARDEN = [
  // The hub everything points at — a plain record with a plain title.
  `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  `{"id":"shed","ord":"a1","title":"shed [walnut](notes/walnut.md)"}`,
  // Reached only by the window page's link — a vertex by being pointed at.
  `{"id":"lone","ord":"a2","title":"the lone bench"}`,
].join("\n")

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"the kitchen"}`,
  // A `see` and a `doc` writing two ways at two targets.
  `{"id":"doors","parent":"kitchen","ord":"a0","title":"the doors","see":["herbs"],"doc":"notes/walnut.md"}`,
  // An `@` mention is an edge; a # on the same word would be none.
  `{"id":"hinge","parent":"kitchen","ord":"a1","title":"hinge @herbs"}`,
  // A placement of herbs — at NO end of any edge (a view, not a claim).
  `{"id":"hplace","parent":"kitchen","ord":"a2","mirror":"herbs"}`,
  // `see: [self]`: the one line the fold must never draw.
  `{"id":"selfish","ord":"a1","title":"the selfish one","see":["selfish"]}`,
  // A `see` onto an id the set has no record for — dropped, no vertex.
  `{"id":"deadsee","ord":"a2","title":"sees the dead","see":["nope"]}`,
  // A LINK (one level down, the body grammar) to the walnut page.
  `{"id":"linker","ord":"a3","title":"lab [walnut](notes/walnut.md)"}`,
].join("\n")

const TRASHED = [
  // The archive writes references the live fold must never show
  // (`./graph.ts`): "the trash refers to everything" holds, and stays out.
  `{"id":"old","ord":"a0","title":"the old door","see":["herbs"]}`,
].join("\n")

const LEFTOVER = [
  // The same ruling for a dormant archive (2026-08-19's dead convention).
  `{"id":"attic","ord":"a0","title":"the attic visit","see":["herbs"]}`,
].join("\n")

const SET = setOf(
  {
    "garden.olai": GARDEN,
    "house.olai": HOUSE,
    "_olai/Trash.olai": TRASHED,
    "Archive.olai": LEFTOVER,
  },
  [
    // A page that refers to both kinds: a `#id` link and an `@id` mention.
    ["notes/walnut.md", "The walnut door.\n\nSee [the herb bed](#herbs), and @herbs again.\n"],
    // Points at `lone`, otherwise untouched — pulls one more vertex in.
    ["notes/window.md", "The window seat — [the lone bench](#lone).\n"],
  ],
)
const READING = readingOf(SET)

/** The whole-directory page, and the spelling of its request. */
const whole = (): Graph => graphOf(READING, { around: null, hops: HOPS_DEFAULT })
const around = (address: string, hops = HOPS_DEFAULT): Graph =>
  graphOf(READING, { around: addressOf("", address)!, hops })
const aroundDocument = (path: string, hops = HOPS_DEFAULT): Graph =>
  graphOf(READING, { around: addressOf(path, null)!, hops })

const keysOf = (graph: Graph): Array<string> => graph.vertices.map((vertex) => vertex.key)
const edgesOf = (graph: Graph): ReadonlyArray<string> =>
  graph.edges.map((edge) => `${edge.from}→${edge.to}:${edge.ways.join("+")}`)

// ── vertices and edges ───────────────────────────────────────────────

test("the whole page: vertex key, kind, title, crumbs, file, hops", () => {
  const byKey = new Map(whole().vertices.map((vertex) => [vertex.key, vertex]))
  expect(byKey.get("#herbs")).toMatchObject({
    key: "#herbs",
    address: { kind: "node" },
    kind: "node",
    title: "the herb bed",
    file: "garden.olai",
    crumbs: [],
    hops: 0,
  })
  // A record's crumbs are its ancestors root-first — the locator line a tree
  // gives the same record.
  expect(byKey.get("#doors")?.crumbs).toEqual(["the kitchen"])
  // A document's crumbs are its directory segments, and its title the
  // document grammar's (the file's own body, not my fixture's head).
  expect(byKey.get("notes/walnut.md")).toMatchObject({
    address: { kind: "document", path: "notes/walnut.md" },
    kind: "document",
    file: "notes/walnut.md",
    crumbs: ["notes"],
  })
})

test("the whole page: exact edges, in the fold's own order", () => {
  expect(edgesOf(whole())).toEqual([
    // Records first, in corpus order — garden.olai writes first, and its
    // shed and herbs levels land their rows in their lines' order.
    "#shed→notes/walnut.md:link",
    "#doors→#herbs:see",
    "#doors→notes/walnut.md:doc",
    "#hinge→#herbs:mention",
    "#linker→notes/walnut.md:link",
    // ...and the bodies walk after the records, in path order.
    "notes/walnut.md→#herbs:link+mention",
    "notes/window.md→#lone:link",
  ])
})

test("a mirror is at no end", () => {
  const graph = whole()
  expect(graph.vertices.some((vertex) => vertex.key === "#hplace")).toBe(false)
  // ...and nothing arrives at herbs THROUGH the placement: the two writing
  // rows (#doors, #hinge) and the walnut page — never the mirror.
  expect(
    graph.edges.filter((edge) => edge.to === "#herbs").map((edge) => edge.from),
  ).toEqual(["#doors", "#hinge", "notes/walnut.md"])
})

test("way-merge on one edge", () => {
  const merged = whole().edges.find(
    (edge) => edge.from === "notes/walnut.md" && edge.to === "#herbs",
  )
  expect(merged?.ways).toEqual(["link", "mention"])
})

test("self-reference and the unserved drop out of the fold", () => {
  const graph = whole()
  const keys = keysOf(graph)
  expect(keys).not.toContain("#selfish")
  expect(keys).not.toContain("#deadsee")
  expect(keys).not.toContain("#old")
  expect(keys).not.toContain("#attic")
  // ...and every edge endpoint is a vertex — the one clipped-promise.
  const held = new Set(keys)
  for (const edge of graph.edges) {
    expect(held.has(edge.from)).toBe(true)
    expect(held.has(edge.to)).toBe(true)
  }
})

test("a link onto the archive's own file draws no vertex", () => {
  // Ruling 3 reads one sentence both ways on a path too: what is put away
  // is at NEITHER end, and naming `_olai/Trash.olai` by link is naming a
  // deleted pile — `centreOf` already refuses the place; the fold must not
  // mint it as a dot on the way past.
  const reading = readingOf(setOf(
    { "_olai/Trash.olai": `{"id":"old","ord":"a0","title":"gone"}` },
    [["notes/main.md", "It went the way of [yesterday](../_olai/Trash.olai).\n"]],
  ))
  const graph = graphOf(reading, { around: null, hops: HOPS_DEFAULT })
  // ...so the writer's only pointer is the dropped one, and the writer is
  // at an end of nothing: the page is empty rather than holding one dot.
  expect(keysOf(graph)).toEqual([])
  expect(graph.edges).toEqual([])
})

test("the whole page reads deterministic and value-equal", () => {
  expect(whole()).toEqual(whole())
})

test("every vertex sort: records corpus-first, then documents in path order", () => {
  expect(keysOf(whole())).toEqual([
    "#herbs",
    "#shed",
    "#lone",
    "#doors",
    "#hinge",
    "#linker",
    "notes/walnut.md",
    "notes/window.md",
  ])
})

test("the envelope: around null, hops carried, held is the count", () => {
  const graph = whole()
  expect(graph.around).toBeNull()
  expect(graph.hops).toBe(HOPS_DEFAULT)
  expect(graph.held).toBe(graph.vertices.length)
})

// ── crops ──────────────────────────────────────────────────────────

test("one hop around a hub records both ends and counts both ways", () => {
  const crop = around("herbs", 1)
  expect(crop.around).toMatchObject({ kind: "vertex", vertex: { key: "#herbs", hops: 0 } })
  // one hop out: see, mention, and body writers — the undirected walk.
  expect(keysOf(crop).sort()).toEqual(["#doors", "#herbs", "#hinge", "notes/walnut.md"])
})

test("hops are the shortest path", () => {
  const crop = around("herbs", 2)
  // From herbs: writers at 1; the walnut page's own writers at 2. The
  // first-wins rule says no re-numbering past a settled hop.
  const byKey = new Map(crop.vertices.map((vertex) => [vertex.key, vertex.hops]))
  expect(byKey.get("#herbs")).toBe(0)
  expect(byKey.get("notes/walnut.md")).toBe(1)
  expect(byKey.get("#doors")).toBe(1)
  expect(byKey.get("#hinge")).toBe(1)
  expect(byKey.get("#linker")).toBe(2)
  expect(byKey.get("#shed")).toBe(2)
})

test("an id pointing at a placement resolves at the centre", () => {
  const crop = around("hplace", 1)
  expect(crop.around).toMatchObject({ kind: "vertex", vertex: { key: "#herbs" } })
})

test("a centre way out of the fold is one vertex and no edges", () => {
  // `kitchen` holds the whole outline but no writer's pointer — it IS its
  // own page.
  const crop = around("shed", 1)
  // shed IS at an edge: shed → walnut.md (link). So the crop has both.
  expect(keysOf(crop).sort()).toEqual(["#shed", "notes/walnut.md"])
})

test("a centre that failed to resolve states the reason and draws nothing", () => {
  expect(around("nope")).toMatchObject({
    around: { kind: "unknown", address: { kind: "node", id: "nope" } },
    vertices: [],
    edges: [],
    held: 0,
  })
  expect(around("old")).toMatchObject({ around: { kind: "put-away" } })
  expect(around("hplace", 2).around).toMatchObject({ kind: "vertex" })
})

test("a document centre's reason is stated the same way", () => {
  expect(aroundDocument("notes/missing.md")).toMatchObject({
    around: { kind: "unknown" },
    held: 0,
  })
  // The walnut page's neighbourhood is every record writer it holds.
  expect(keysOf(aroundDocument("notes/walnut.md", 1)).sort()).toEqual([
    "#doors",
    "#herbs",
    "#linker",
    "#shed",
    "notes/walnut.md",
  ])
})

// ── the nesting rule ────────────────────────────────────────────────

test("two nested neighbourhoods hold the same hop numbers on the overlap", () => {
  const near = around("herbs", 1)
  const far = around("herbs", 2)
  for (const vertex of near.vertices) {
    const beyond = far.vertices.find((one) => one.key === vertex.key)
    expect(beyond?.hops).toBe(vertex.hops)
  }
})

// ── agreement with the server readings ──────────────────────────────

test("a document's link to an OUTLINE lands as the set's own dot, kind aside", () => {
  // The body grammar REFUSES an outline for a renderer — it is a tree, not a
  // body — but a note that names `garden.olai` is a reference the map
  // cannot keep quiet: a suffix rule is no reason for a dot to vanish.
  const reading = readingOf(setOf(
    { "garden.olai": "" },
    [["notes/porch.md", "Put the crate down in [the garden](../garden.olai).\n"]],
  ))
  const graph = graphOf(reading, { around: null, hops: HOPS_DEFAULT })
  expect(keysOf(graph).sort()).toEqual(["garden.olai", "notes/porch.md"])
  expect(graph.vertices.find((vertex) => vertex.key === "garden.olai")?.kind).toBe("outline")
  expect(edgesOf(graph)).toEqual(["notes/porch.md→garden.olai:link"])
})

test("a link-shaped VALUE in the frontmatter is no edge, the way it is no referrer", () => {
  // One body the page table reads as PROSE and the fold reads as SETS: both
  // answers come out of the document's own decode, and neither knows
  // `matter.[...]` to be a link at all. Without the take-out of the kept
  // list's provenance (`document.links` and the prose the same call spent),
  // the map would draw a line the document page cannot report.
  const reading = readingOf(setOf(
    { "garden.olai": "" },
    [["notes/porch.md", "---\nmatter: \"[the garden](../garden.olai)\"\n---\nThe prose itself points at nothing.\n"]],
  ))
  const graph = graphOf(reading, { around: null, hops: HOPS_DEFAULT })
  // No file equals no vertex at all — not a lonely dot with a count of its
  // reading attached: both halves rule together on what's absent.
  expect(graph.vertices).toEqual([])
  expect(graph.edges).toEqual([])
})

test("FOR EVERY NODE, the writers arriving by see/mention ARE backlinksOf", () => {
  const graph = whole()
  const wanted = graph.vertices
    .flatMap((vertex) =>
      vertex.address.kind === "node" ? [vertex.address.id] : [],
    )
  for (const id of wanted) {
    const incoming = graph.edges
      .filter((edge) => edge.to === `#${id}`)
      .filter((edge) => edge.ways.some((way) => way === "see" || way === "mention"))
      .filter((edge) => edge.from.startsWith("#"))
      .map((edge) => ({ from: edge.from.slice(1), ways: edge.ways.filter((way) => way === "see" || way === "mention") }))
    const asked = backlinksOf(READING.derived, id).map((one) => ({ from: one.at.node.id, ways: [...one.ways].sort() }))
    expect(incoming.sort((a, b) => a.from.localeCompare(b.from))).toEqual(
      asked.sort((a, b) => a.from.localeCompare(b.from)),
    )
  }
})

test("FOR EVERY DOCUMENT, the faces arriving by see/doc/link ARE referrersTo", () => {
  const graph = whole()
  const faces = READING.set.documents.filter((document) => document.kind === "document")
  for (const document of faces) {
    const address = addressOf(document.path, null)!
    const incoming = graph.edges
      .filter((edge) => edge.to === document.path)
      .filter((edge) => edge.ways.some((way) => way === "see" || way === "doc" || way === "link"))
      .map((edge) => (edge.from.startsWith("#") ? vertexFile(graph, edge.from) : edge.from))
    const asked = referrersTo(address, READING.pointing, READING.derived).map((referrer) => referrer.face.path)
    expect([...incoming].sort()).toEqual([...asked].sort())
  }
})

const vertexFile = (graph: Graph, key: string): string =>
  // The writer's face is its outline — `referrersTo`'s face leans on
  // `./pointing.ts`'s the-same-rule.
  graph.vertices.find((vertex) => vertex.key === key)!.file

// ── the ceiling ─────────────────────────────────────────────────────

/** A chain one past the ceiling, as a serving — the corpus designed so both
 *  halves of the ceiling ask are one fixture. */
const CHAIN = Array.from(
  { length: GRAPH_DRAWN_AT_MOST + 1 },
  (_, index) =>
    `{"id":"n${index}","ord":"o${index}","title":"node ${index}"${index === 0 ? "" : `,"see":["n${index - 1}"]`}}`,
).join("\n")

test("the ceiling answers held, with the draw withheld", () => {
  const reading = readingOf(setOf({ "wide.olai": CHAIN }))
  const graph = graphOf(reading, { around: null, hops: 1 })
  expect(graph.vertices).toEqual([])
  expect(graph.edges).toEqual([])
  expect(graph.held).toBe(GRAPH_DRAWN_AT_MOST + 1)
})

test("one hop asks the same ceiling no bigger answer", () => {
  const reading = readingOf(setOf({ "wide.olai": CHAIN }))
  // The same corpus, centred on one END of the chain: the crop reaches its
  // own `hops`, not the ceiling.
  const crop = graphOf(reading, { around: addressOf("", `n${GRAPH_DRAWN_AT_MOST}`)!, hops: 1 })
  expect(crop.held).toBeGreaterThan(0)
  expect(crop.vertices.length).toBe(crop.held)
  expect(crop.vertices.length).toBe(2)
})

// ── the filter rides it ─────────────────────────────────────────────

test("a query over the whole page selects vertices of both kinds", () => {
  const answer = narrowingOf(READING, { page: { kind: "graph", around: null, hops: 1 }, text: "walnut" }, NOW, NO_KINDS)
  // The walnut page itself, matched through its own title (the file name).
  expect(answer.documents).toMatchObject([
    { path: "notes/walnut.md", matched: "title" },
  ])
  // And the two record writers whose titles link to it — the page's dots
  // are kept by their own match, not dropped for being documents.
  expect(answer.matches.map((one) => one.id as string)).toEqual(["shed", "linker"])
})

test("a word a tree would not keep still dots it", () => {
  // `again` rests in the walnut page's own body, under no title — the dot
  // is its own document match, not acquired through any row.
  const answer = narrowingOf(READING, { page: { kind: "graph", around: null, hops: 1 }, text: "again" }, NOW, NO_KINDS)
  expect(answer.matches).toEqual([])
  expect(answer.documents).toMatchObject([{ path: "notes/walnut.md", matched: "body" }])
})

test("the archive rule is the fold's, and the filter accepts it", () => {
  // is:trashed everything-is-in rule * can the box ask for the archive —
  // the graph holds nothing of it to begin with.
  expect(showsPutAway(shownOf(READING, { kind: "graph", around: null, hops: 1 }))).toBe(false)
})

test("pageOf names the vertices the page draws", () => {
  const page = pageOf(READING, { kind: "graph", around: null, hops: HOPS_DEFAULT })
  const names = new Map(page.names.map((name) => [name.id, name.title]))
  expect(names.get("herbs")).toBe("the herb bed")
  expect(names.get("doors")).toBe("the doors")
  // A record at NO end is not a row of this page and holds no name in it —
  // the title would have to come from the drawer itself, which is what the
  // names contract refuses.
  expect(names.has("kitchen")).toBe(false)
})

test("value equality holds on the whole thing — the wire's own pulse", () => {
  const a = pageOf(READING, { kind: "graph", around: null, hops: 1 })
  const b = pageOf(READING, { kind: "graph", around: null, hops: 1 })
  expect(a).toEqual(b)
})

test("the graph reading survives the wire", () => {
  const encoded = Schema.encodeUnknownSync(Graph)(whole())
  const back = Schema.decodeUnknownSync(Graph)(JSON.parse(JSON.stringify(encoded)))
  expect(back).toEqual(whole())
})

test("the crop survives the wire, centre and all", () => {
  const encoded = Schema.encodeUnknownSync(Graph)(aroundDocument("notes/walnut.md", 2))
  expect(Schema.decodeUnknownSync(Graph)(JSON.parse(JSON.stringify(encoded)))).toEqual(
    aroundDocument("notes/walnut.md", 2),
  )
})
