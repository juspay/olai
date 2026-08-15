import { expect, test } from "bun:test"

import { ancestorsOf, derive, type Row } from "./derive.ts"
import { nodesOf, nodesOfFiles } from "./fixtures.testlib.ts"
import { zoom, type Zoomed } from "./zoom.ts"

const zoomOf = (contents: string, id: string): Zoomed =>
  zoom(derive(nodesOf(contents)), id)

const zoomOfFiles = (files: Record<string, string>, id: string): Zoomed =>
  zoom(derive(nodesOfFiles(files)), id)

/** The page's crumbs as a plain list of ids — a breadcrumb trail is an order,
 *  and the order is the whole of what these tests are about. */
const crumbs = (zoomed: Zoomed): ReadonlyArray<string> =>
  zoomed.kind === "node" ? zoomed.trail.map((crumb) => crumb.node.id) : []

/** The rows under the heading, flattened to `key kind`. */
const shape = (rows: ReadonlyArray<Row>): ReadonlyArray<string> =>
  rows.flatMap((row) => [`${row.key} ${row.kind}`, ...shape(row.children)])

/** A page, insisting it is one. The three failure kinds all have to be told
 *  apart by the caller, so a test reading `shows` says which it expected. */
const page = (zoomed: Zoomed): Extract<Zoomed, { readonly kind: "node" }> => {
  if (zoomed.kind !== "node") {
    throw new Error(`expected a node page, got a \`${zoomed.kind}\` answer`)
  }
  return zoomed
}

const HOUSE = `{"id":"kitchen","ord":"a0","title":"kitchen remodel","props":{"status":"doing","since":"2026-08-05"}}\n` +
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","props":{"status":"done"}}\n` +
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install the cabinets"}\n` +
  `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles","props":{"status":"doing"}}`

// ── the parent chain ───────────────────────────────────────────────────

test("the crumbs are the parent chain, root first, the node itself excluded", () => {
  expect(crumbs(zoomOf(HOUSE, "handles"))).toEqual(["kitchen", "install"])
})

test("a root has no crumbs", () => {
  expect(crumbs(zoomOf(HOUSE, "kitchen"))).toEqual([])
})

// A parent loop is a set the validator rejects, and the crumbs are drawn from
// sets its own error messages quote. A renderer that hung would be a worse way
// to learn about it than a chain that stops.
test("a parent cycle stops rather than looping", () => {
  const derived = derive(
    nodesOf(
      `{"id":"a","parent":"b","ord":"a0","title":"a"}\n` +
        `{"id":"b","parent":"a","ord":"a0","title":"b"}`,
    ),
  )
  expect(ancestorsOf(derived, "a").map((crumb) => crumb.node.id)).toEqual(["b"])
})

test("a chain through a missing parent stops at the last crumb that exists", () => {
  const derived = derive(
    nodesOf(
      `{"id":"top","ord":"a0","title":"top"}\n` +
        `{"id":"middle","parent":"gone","ord":"a0","title":"middle"}\n` +
        `{"id":"leaf","parent":"middle","ord":"a0","title":"leaf"}`,
    ),
  )
  expect(ancestorsOf(derived, "leaf").map((crumb) => crumb.node.id)).toEqual(["middle"])
})

// ── the page itself ────────────────────────────────────────────────────

test("the page shows the node and its children, not its parents' other branches", () => {
  const zoomed = page(zoomOf(HOUSE, "install"))
  expect(zoomed.shows.node.title).toBe("install the cabinets")
  expect(shape(zoomed.children)).toEqual(["/handles node"])
})

test("the page carries the node's mark, and the rollup of its children beside it", () => {
  const kitchen = page(zoomOf(HOUSE, "kitchen"))
  expect(kitchen.status).toBe("doing")
  // Two children, and one of them is a task that is done: `install` carries no
  // mark, so it is not counted. The two answers are separate on purpose — the
  // heading is toned by the mark, annotated by the rollup.
  expect(kitchen.progress).toEqual({ done: 1, total: 1 })
  expect(page(zoomOf(HOUSE, "demo")).status).toBe("done")
  expect(page(zoomOf(HOUSE, "demo")).progress).toBeUndefined()
})

// And a page can carry no status at all — the heading of a bullet is a
// heading, not an unfinished to-do.
test("the page of an unmarked node has no status", () => {
  const notes = `{"id":"trip","ord":"a0","title":"the coast trip"}\n` +
    `{"id":"ferry","parent":"trip","ord":"a0","title":"ferry times"}`
  expect(page(zoomOf(notes, "trip")).status).toBeUndefined()
  expect(page(zoomOf(notes, "ferry")).status).toBeUndefined()
})

test("a leaf's page has no children", () => {
  expect(page(zoomOf(HOUSE, "handles")).children).toEqual([])
})

// ── mirrors resolve to the one canonical page ──────────────────────────

test("zooming a mirror shows the node it stands for, with THAT node's crumbs", () => {
  const zoomed = page(
    zoomOfFiles(
      {
        "house.jsonl": `{"id":"kitchen","ord":"a0","title":"kitchen"}\n` +
          `{"id":"kitchen-herbs","parent":"kitchen","ord":"a1","mirror":"herbs"}`,
        "garden.jsonl": `{"id":"garden","ord":"a0","title":"garden"}\n` +
          `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed"}\n` +
          `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}`,
      },
      "kitchen-herbs",
    ),
  )
  // The page is the canonical node's, in the canonical node's file, under the
  // canonical node's parent — not `kitchen`, which is where the click was.
  expect(zoomed.shows.node.id).toBe("herbs")
  expect(zoomed.shows.file).toBe("garden.jsonl")
  expect(crumbs(zoomed)).toEqual(["garden"])
  expect(shape(zoomed.children)).toEqual(["/basil node"])
})

// A mirror of a mirror is legal. Resolving one hop would land on a record with
// no title and no children of its own — a legal set with an undrawable page.
test("a chain of mirrors resolves all the way to the regular node", () => {
  const zoomed = page(
    zoomOf(
      `{"id":"real","ord":"a0","title":"the real one"}\n` +
        `{"id":"once","ord":"a1","mirror":"real"}\n` +
        `{"id":"twice","ord":"a2","mirror":"once"}`,
      "twice",
    ),
  )
  expect(zoomed.shows.node.id).toBe("real")
})

// ── the three ways an id names no page ─────────────────────────────────

test("an id nothing declares is unknown, and says which id", () => {
  expect(zoomOf(HOUSE, "nope")).toEqual({ kind: "unknown", id: "nope" })
})

test("an empty id is unknown rather than a page", () => {
  expect(zoomOf(HOUSE, "")).toEqual({ kind: "unknown", id: "" })
})

// The id the chain DIED on, not the first hop: "a mirror of `once`, which no
// node declares" is a lie when `once` exists and it is its target that does not.
test("a mirror chain that dies names the id it died on", () => {
  expect(
    zoomOf(
      `{"id":"once","ord":"a0","mirror":"gone"}\n` +
        `{"id":"twice","ord":"a1","mirror":"once"}`,
      "twice",
    ),
  ).toEqual({ kind: "dangling", id: "twice", missing: "gone" })
})

test("a mirror chain that closes on itself is a cycle, not a dangling id", () => {
  const zoomed = zoomOf(
    `{"id":"a","ord":"a0","mirror":"b"}\n` + `{"id":"b","ord":"a1","mirror":"a"}`,
    "a",
  )
  expect(zoomed.kind).toBe("cycle")
  expect(zoomed.kind === "cycle" ? zoomed.id : undefined).toBe("a")
})

// ── the containment guard, seeded from the page's own ancestry ─────────

// Zooming to `install` does not leave `kitchen` behind: a mirror of `kitchen`
// under it would expand forever if the guard started empty.
test("a mirror of an ancestor is a cycle stub on the ancestor's descendant page", () => {
  const zoomed = page(
    zoomOf(
      `{"id":"kitchen","ord":"a0","title":"kitchen"}\n` +
        `{"id":"install","parent":"kitchen","ord":"a0","title":"install"}\n` +
        `{"id":"loop","parent":"install","ord":"a0","mirror":"kitchen"}`,
      "install",
    ),
  )
  expect(shape(zoomed.children)).toEqual(["/loop cycle"])
})
