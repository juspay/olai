/**
 * The camera's two pure questions: where a dot lands, and which labels fit.
 *
 * What is NOT tested here is a gesture — that is `d3-zoom`'s, bound in
 * `./looking.ts`, and a test of it would be a test of the library. What these
 * hold is the arithmetic this app does with the transform the library hands it,
 * and the rule the maintainer's screenshot was about: at a scale where every
 * label would land on its neighbour's, only the ones that fit are drawn.
 */

import { zoomIdentity } from "d3-zoom"
import { expect, test } from "bun:test"

import { FITTED, inFrame, legible, rankedBy, seenAt } from "./camera.ts"
import { type Frame, type Placement } from "./layout.ts"

/** The box these are asked about — a fixture, since the real one is measured. */
const FRAME: Frame = { width: 1000, height: 560 }

const placement = (
  at: ReadonlyArray<readonly [id: string, x: number, y: number]>,
): Placement => ({
  at: new Map(at.map(([id, x, y]) => [id, { id, x, y }] as const)),
  files: [],
})

const ids = (found: ReadonlySet<string>): ReadonlyArray<string> => [...found].sort()

test("fitted is the camera that does nothing — which is what makes it the fit", () => {
  // The layout has already put the whole graph inside the frame with a margin,
  // so opening a page fitted costs no measurement and `Fit` is a reset.
  expect(seenAt(FITTED, { id: "a", x: 12, y: 34 })).toEqual({ id: "a", x: 12, y: 34 })
})

test("a dot is placed by the transform, scale then pan", () => {
  const camera = zoomIdentity.translate(100, 50).scale(2)
  expect(seenAt(camera, { id: "a", x: 10, y: 10 })).toEqual({ id: "a", x: 120, y: 70 })
})

// ── which labels are drawn ────────────────────────────────────────────

// ONE rule at every scale, and no exemption: zooming in moves the dots apart,
// so the same "does it fit" question answers yes for all of them. The first
// version short-circuited above a threshold and the threshold was the FITTED
// scale — which is the sight a page opens on, and the one this exists for.
test("zoomed in, the same dots all keep their labels", () => {
  // Two units apart in the world; at this scale that is wider than a label, so
  // the same "does it fit" question answers yes for every one of them — and the
  // pan keeps all three inside the frame, which the rule also asks.
  const three = placement([["a", 10, 0], ["b", 12, 0], ["c", 14, 0]])
  const close = zoomIdentity.translate(-800, 200).scale(100)
  expect(ids(legible(three, close, FRAME, ["a", "b", "c"], new Set()))).toEqual(["a", "b", "c"])
})

test("...and fitted, which is where the crowding is, they do not", () => {
  const three = placement([["a", 10, 0], ["b", 12, 0], ["c", 14, 0]])
  expect(ids(legible(three, FITTED, FRAME, ["a", "b", "c"], new Set()))).toEqual(["a"])
})

test("zoomed out, a label that would land on one already drawn is not", () => {
  // Three dots a few units apart: at this scale their words would overlap, and
  // the picture the maintainer photographed was every one of them drawn.
  const heap = placement([["a", 10, 10], ["b", 12, 10], ["c", 14, 10]])
  const far = zoomIdentity.scale(0.5)
  expect(ids(legible(heap, far, FRAME, ["a", "b", "c"], new Set()))).toEqual(["a"])
})

test("...and the same dots, spread out, all keep their labels", () => {
  const spread = placement([["a", 10, 10], ["b", 500, 10], ["c", 10, 300]])
  const far = zoomIdentity.scale(0.5)
  expect(ids(legible(spread, far, FRAME, ["a", "b", "c"], new Set()))).toEqual(["a", "b", "c"])
})

// The other half of decluttering: what is hidden has to be one gesture away.
test("what the reader is owed claims its room first, whatever the order says", () => {
  const heap = placement([["a", 10, 10], ["b", 12, 10], ["c", 14, 10]])
  const far = zoomIdentity.scale(0.5)
  expect(ids(legible(heap, far, FRAME, ["a", "b", "c"], new Set(["c"])))).toEqual(["c"])
})

test("what is off the frame is not on the page — the drawing asks this too", () => {
  // Not merely invisible: the box clips it either way, and a clipped anchor is
  // still an anchor sitting over whatever the page has where it went.
  expect(inFrame({ id: "a", x: 10, y: 10 }, FRAME)).toBe(true)
  expect(inFrame({ id: "a", x: -1, y: 10 }, FRAME)).toBe(false)
  expect(inFrame({ id: "a", x: FRAME.width + 1, y: 10 }, FRAME)).toBe(false)
  expect(inFrame({ id: "a", x: 10, y: FRAME.height + 1 }, FRAME)).toBe(false)
})

test("a dot the camera has panned off the frame claims no room and draws none", () => {
  // It cannot collide with anything a reader can see, and letting it hold space
  // would leave a hole in the middle of the picture as they panned.
  const pair = placement([["off", -900, 10], ["on", 10, 10]])
  const panned = zoomIdentity.scale(0.5)
  expect(ids(legible(pair, panned, FRAME, ["off", "on"], new Set()))).toEqual(["on"])
  expect(seenAt(panned, { id: "off", x: -900, y: 10 }).x).toBeLessThan(0)
})

test("nothing is drawn outside the frame, in either direction", () => {
  const wide = placement([["far", FRAME.width * 4, FRAME.height * 4]])
  expect(ids(legible(wide, zoomIdentity.scale(0.5), FRAME, ["far"], new Set()))).toEqual([])
})

// ── the order the room is spent in ────────────────────────────────────

test("the nodes the most arrows touch are ranked first, corpus order inside a tie", () => {
  const ranked = rankedBy(["a", "b", "hub", "c"], [
    { from: "a", to: "hub" },
    { from: "b", to: "hub" },
    { from: "c", to: "hub" },
  ])
  expect(ranked).toEqual(["hub", "a", "b", "c"])
})

test("a graph with no arrows keeps the order it was given", () => {
  expect(rankedBy(["a", "b", "c"], [])).toEqual(["a", "b", "c"])
})
