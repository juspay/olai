/**
 * WHERE THE READER IS LOOKING FROM, and what is legible from there.
 *
 * The layout fits a whole graph into one frame ({@link ./layout.ts}), which is
 * the right first sight and the wrong only one: a corpus-wide reading of a real
 * directory fits by making every label land on its neighbour's, and a picture
 * whose words are unreadable is not a picture. So the drawing has a CAMERA —
 * pan and zoom over the placement — and this module is the two pure questions
 * that come with it.
 *
 * ## The transform is `d3-zoom`'s own shape
 *
 * `{k, x, y}`, meaning `screen = world * k + (x, y)`. It is d3's because the
 * GESTURES are d3's (`./Canvas.tsx`): wheel, pinch, drag and the momentum
 * between them are exactly the kind of thing HACKING.md's rule is about, and
 * `zoomIdentity` / `scaleBy` / `translateBy` are the arithmetic that goes with
 * them. What is here is what a component has to answer for itself — where a dot
 * lands, and which labels survive — held apart from the gestures so both can be
 * tested without a browser.
 *
 * ## Identity IS the fit
 *
 * The placement is already fitted to the frame with a margin, so the camera
 * that shows everything is the one that does nothing. That is why the `Fit`
 * control is a reset and why a page opens fitted without measuring anything —
 * and it is a property of the layout rather than a coincidence, so it is stated
 * here where the reset is spelled.
 */

import { zoomIdentity, type ZoomTransform } from "d3-zoom"

import { HEIGHT, type Placed, type Placement, WIDTH } from "./layout.ts"

/** Where the reader is looking from. d3's own transform, so the gesture handler
 *  and the drawing hold one value rather than two that agree. */
export type Camera = ZoomTransform

/** Fitted — the whole graph in the frame, which is what the layout already
 *  produced, so this does nothing at all. */
export const FITTED: Camera = zoomIdentity

/** How far in and out the camera may go. Out far enough that a corpus-wide
 *  reading of a large directory is one shape rather than a wall; in far enough
 *  to read a label in a dense cluster. */
export const NEAREST = 8
export const FURTHEST = 0.2

/** One step of the `+` and `−` controls. A ratio rather than an addition, so
 *  the two are each other's inverse at every scale. */
export const STEP = 1.5

/** A world point, seen from here. */
export const seenAt = (camera: Camera, spot: Placed): Placed => ({
  id: spot.id,
  x: spot.x * camera.k + camera.x,
  y: spot.y * camera.k + camera.y,
})

/**
 * IS THIS DOT ON THE PAGE from here?
 *
 * Asked by the drawing before it renders one at all, and by {@link legible}
 * before it spends a label on one. A dot the camera has moved off the frame is
 * not drawn: the box clips it either way, but a clipped ANCHOR is still an
 * anchor — it sits at a negative offset, over whatever the page has there, and
 * a press aimed at it lands on the sidebar. So "not visible" and "not there"
 * are made the same thing, which is also what stops a panned-away label from
 * holding room in the middle of the picture.
 */
export const inFrame = (seen: Placed): boolean =>
  seen.x >= 0 && seen.x <= WIDTH && seen.y >= 0 && seen.y <= HEIGHT

/**
 * How much room one label needs, in the frame's own units — a little wider than
 * a label is (`w-36` against a 1000-unit frame at a typical pane width) and as
 * tall as its two clamped lines, so two kept labels never touch.
 *
 * A rectangle rather than a radius because a label is much wider than it is
 * tall, and a circle big enough to keep two side by side apart would throw away
 * every label above and below one.
 */
const NEEDS = { x: 168, y: 54 }

/**
 * WHICH LABELS ARE DRAWN from here — every one that fits, and nothing that
 * would land on a label already kept.
 *
 * A greedy pass in an order that is a claim rather than an accident: the nodes
 * a reader must see first (the centre, and whatever they are pointing at),
 * then the ones the most arrows touch, then corpus order. So a far view of a
 * directory names its hubs, and zooming in fills the gaps between them — which
 * is the same picture growing detail rather than a different picture.
 *
 * BUCKETED rather than compared pair-by-pair: a kept label rules out the space
 * around it, so only labels in the nine cells around a candidate can conflict.
 * That is what keeps this linear on a corpus-wide reading, where a quadratic
 * pass would run on every wheel tick.
 *
 * A node OFF THE FRAME is not drawn and not counted — it cannot collide with
 * anything a reader can see, and letting it claim space would leave a hole in
 * the middle of the picture as the reader panned.
 */
export const legible = (
  placement: Placement,
  camera: Camera,
  order: ReadonlyArray<string>,
  /** The ones a reader is owed whatever the scale — the centre of the page, and
   *  whatever the pointer is on and reaches. They go first, so they claim their
   *  space before anything competes for it. */
  owed: ReadonlySet<string>,
): ReadonlySet<string> => {
  // NO SHORTCUT AT ANY SCALE, and the first version had one: "past this zoom,
  // draw them all". The scale it exempted was the FITTED one — the sight a page
  // opens on, and the one this exists for — so the picture a reader met was
  // every label at once and the decluttering only started once they had already
  // zoomed in. There is no scale at which the question is not "does it fit":
  // zoomed in the dots are far apart and the answer is yes for all of them,
  // which is the same rule producing the same result for a reason.
  const kept = new Set<string>()
  const taken = new Map<string, Array<Placed>>()
  const cell = (spot: Placed): string =>
    `${Math.floor(spot.x / NEEDS.x)} ${Math.floor(spot.y / NEEDS.y)}`

  const room = (spot: Placed): boolean => {
    const across = Math.floor(spot.x / NEEDS.x)
    const down = Math.floor(spot.y / NEEDS.y)
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const other of taken.get(`${across + dx} ${down + dy}`) ?? []) {
          if (
            Math.abs(other.x - spot.x) < NEEDS.x && Math.abs(other.y - spot.y) < NEEDS.y
          ) {
            return false
          }
        }
      }
    }
    return true
  }

  for (const id of [...order].sort(byWanted(owed, order))) {
    const spot = placement.at.get(id)
    if (spot === undefined) continue
    const seen = seenAt(camera, spot)
    if (!inFrame(seen) || !room(seen)) continue
    kept.add(id)
    const key = cell(seen)
    const here = taken.get(key)
    if (here === undefined) taken.set(key, [seen])
    else here.push(seen)
  }
  return kept
}

/**
 * The order labels are spent in: what a reader is owed first, then the order
 * the caller ranked them in.
 *
 * The caller's order is the graph's — hubs before leaves, corpus order inside a
 * tie ({@link rankedBy}) — and is stable, so panning the same picture keeps the
 * same words on it rather than reshuffling which node got to speak.
 */
const byWanted = (
  owed: ReadonlySet<string>,
  order: ReadonlyArray<string>,
): ((one: string, other: string) => number) => {
  const at = new Map(order.map((id, index) => [id, index] as const))
  return (one, other) => {
    const mine = owed.has(one) ? 0 : 1
    const theirs = owed.has(other) ? 0 : 1
    return mine !== theirs ? mine - theirs : (at.get(one) ?? 0) - (at.get(other) ?? 0)
  }
}

/**
 * The nodes of a graph, most-connected first and in corpus order inside a tie —
 * the order {@link legible} spends its room in.
 *
 * DEGREE, because at a scale where only some labels fit, the ones worth reading
 * are the nodes the arrows converge on: a hub names what a cluster is about,
 * and a leaf named while its hub is not says nothing about either. Corpus order
 * breaks the tie so the answer is a function of the directory rather than of
 * which node the walk happened to reach first.
 */
export const rankedBy = (
  nodes: ReadonlyArray<string>,
  edges: ReadonlyArray<{ readonly from: string; readonly to: string }>,
): ReadonlyArray<string> => {
  const touching = new Map<string, number>()
  for (const edge of edges) {
    touching.set(edge.from, (touching.get(edge.from) ?? 0) + 1)
    touching.set(edge.to, (touching.get(edge.to) ?? 0) + 1)
  }
  return [...nodes].sort((one, other) =>
    (touching.get(other) ?? 0) - (touching.get(one) ?? 0)
  )
}
