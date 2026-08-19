/**
 * Where the dots go — the one piece of arithmetic behind the picture, and none
 * of it is ours.
 *
 * The physics is `d3-force`'s: a repulsion between every pair, a spring along
 * every edge, a collision so two labels cannot sit on top of each other, and a
 * pull toward the file each node is written in. Hand-rolling that is exactly
 * what HACKING.md's dependency rule is about — a Barnes–Hut quadtree and a
 * velocity Verlet integrator are a library, not a component — and the library
 * is a leaf: no DOM, no `d3.select`, no rendering. It is handed nodes and edges
 * and it moves numbers.
 *
 * ## Run to rest, not animated
 *
 * The simulation is stopped before it starts and ticked {@link TICKS} times in
 * one pass, so what a page receives is a finished layout rather than a settling
 * one. Three things follow, and each is worth more than the animation:
 *
 *   - it is a PURE FUNCTION of the graph, so it can be unit tested without a
 *     browser and a screenshot of it is reproducible;
 *   - d3's own randomness is a seeded LCG minted per simulation, and the
 *     starting positions below are derived rather than random, so the same
 *     graph settles to the same picture on every machine and on every reload —
 *     a reader who comes back to a link finds the shape they left;
 *   - nothing has to be torn down. A running simulation is a timer, and a timer
 *     inside a page that is redrawn on every revision the store publishes is a
 *     leak with a frame rate.
 *
 * ## Fitted, so a picture of two nodes and a picture of two hundred both fill
 *
 * The forces settle at whatever scale their constants imply, which is a fact
 * about the constants. What a reader wants is the shape filling the frame, so
 * the settled positions are mapped into {@link WIDTH} × {@link HEIGHT} by one
 * UNIFORM scale — uniform because a non-uniform one would stretch the shape,
 * and the shape is the whole content of this page.
 *
 * ## Files are a PLACE, not a colour
 *
 * "Files as groupings" is drawn as a pull toward a per-file anchor, so a file's
 * nodes land together and the file's name is written where they landed. A
 * colour per file was the alternative and it cannot work here: tones come from
 * the eleven theme tokens so that all fifteen palettes follow, and eleven
 * tokens is four usable hues — a vault of twenty outlines would be drawing
 * twenty files in four colours, which says something false rather than
 * something less.
 */

import { byPath, type Graph } from "@olai/format"
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force"

/** The coordinate space a placement is in — the SVG's `viewBox` and the box the
 *  HTML dots are positioned in as percentages of. The two agree because they
 *  are one pair of numbers, and the canvas locks its aspect ratio to it
 *  (`./Canvas.tsx`), which is what lets a percentage and a viewBox unit be the
 *  same place. */
export const WIDTH = 1000
export const HEIGHT = 560

/** How much of the frame is left around the shape, in the units above — room
 *  for the labels, which hang off their dots and are the widest thing here. */
const PADDING = 90

/**
 * How long the simulation is run for.
 *
 * d3's own default schedule reaches its `alphaMin` in about this many ticks, so
 * this is "to rest" rather than a number picked to look right — and it is
 * spelled as a constant because it is the one knob that trades a settled
 * picture against the time a page takes to draw.
 */
const TICKS = 300

/** One node, placed. */
export interface Placed {
  readonly id: string
  readonly x: number
  readonly y: number
}

/**
 * Where a file's name is written: centred on its group horizontally, and level
 * with the LOWEST dot in it.
 *
 * The lowest rather than the middle, because the middle of a cloud of nodes is
 * exactly where their labels are. Clearing those labels is the drawing's job
 * rather than this one's — a title is two lines of text at a fixed size, and
 * this is a coordinate in a box whose pixel height depends on how wide the pane
 * is, so the gap is spent in `rem` where the words are (`./Canvas.tsx`) and not
 * in layout units here, where it would be a different number of pixels on every
 * screen.
 */
export interface Grouping {
  readonly file: string
  readonly x: number
  readonly y: number
}

export interface Placement {
  readonly at: ReadonlyMap<string, Placed>
  /** The files with anything on this page, in path order — the sidebar's own
   *  order, so a legend and a directory read the same way round. */
  readonly files: ReadonlyArray<Grouping>
}

/** Nothing placed — ONE value, shared, for the graph that draws nothing. Not
 *  exported: the page never asks for it, it asks {@link placed} for whatever it
 *  is holding, and a second door onto the same empty answer is one more thing
 *  for the next reader to wonder about. */
const NOTHING_PLACED: Placement = { at: new Map(), files: [] }

interface Body extends SimulationNodeDatum {
  readonly id: string
  readonly file: string
  readonly toward: { readonly x: number; readonly y: number }
}

export const placed = (graph: Graph): Placement => {
  if (graph.nodes.length === 0) return NOTHING_PLACED

  const files = [...new Set(graph.nodes.map((node) => node.at.file))].sort(byPath)
  const anchors = anchorsFor(files)

  // The starting positions are DERIVED rather than left to d3's spiral: every
  // node begins near its file's anchor, offset around a small circle by its
  // index, so the run starts clustered and two nodes never start coincident.
  // Coincident bodies are the one case a force layout has to jiggle its way out
  // of, and jiggling is where its randomness is spent.
  // MUTABLE, and declared so: the simulation writes `x` / `y` / `vx` / `vy`
  // into these on every tick. A `ReadonlyArray` here needed two casts to hand
  // the same value to `forceSimulation`, which is a type saying the opposite of
  // what the value is for.
  const bodies: Array<Body> = graph.nodes.map((node, index) => {
    const toward = anchors.get(node.at.file)!
    const turn = (index * GOLDEN) % (Math.PI * 2)
    return {
      id: node.at.node.id,
      file: node.at.file,
      toward,
      x: toward.x + Math.cos(turn) * SEED_RADIUS,
      y: toward.y + Math.sin(turn) * SEED_RADIUS,
    }
  })

  // ...and so are these: `forceLink` replaces each `source` / `target` id with
  // the body it resolved to.
  const links: Array<SimulationLinkDatum<Body>> = graph.edges.map((edge) => ({
    source: edge.from,
    target: edge.to,
  }))

  forceSimulation(bodies)
    .force(
      "link",
      forceLink<Body, SimulationLinkDatum<Body>>(links)
        .id((body) => body.id)
        .distance(LINK_DISTANCE)
        .strength(LINK_STRENGTH),
    )
    .force("charge", forceManyBody<Body>().strength(REPULSION))
    // Wide enough to hold a dot AND the label under it apart from its
    // neighbour's: the collision radius is what stops the one thing a reader
    // cannot recover from, which is two titles written over each other.
    .force("collide", forceCollide<Body>(COLLISION))
    // The file grouping, as a force rather than as a box: a node is PULLED
    // toward where its file sits and an edge can still drag it across the
    // page, which is what makes a cross-file reference visible as a long arrow
    // instead of being hidden inside a container.
    .force("toFileX", forceX<Body>((body) => body.toward.x).strength(GROUPING))
    .force("toFileY", forceY<Body>((body) => body.toward.y).strength(GROUPING))
    .stop()
    .tick(TICKS)

  return fitted(bodies)
}

/** Where each file pulls its own nodes, before anything is fitted: evenly round
 *  a circle, in path order, so the arrangement is a function of which files are
 *  on the page rather than of which node happened to be walked first. A single
 *  file pulls to the middle, where a circle of one would put it anyway. */
const anchorsFor = (
  files: ReadonlyArray<string>,
): ReadonlyMap<string, { readonly x: number; readonly y: number }> => {
  const reach = files.length === 1 ? 0 : SPREAD
  return new Map(
    files.map((file, index) => {
      const turn = (index / files.length) * Math.PI * 2
      return [file, { x: Math.cos(turn) * reach, y: Math.sin(turn) * reach }] as const
    }),
  )
}

/**
 * The settled bodies, mapped into the frame — and the files' own centres taken
 * AFTER the mapping, so a legend point and the dots it names are in one
 * coordinate space by construction rather than by two conversions agreeing.
 *
 * A shape with no extent in a direction (one node, or a row of them) divides by
 * one instead of by zero, and the uniform scale then centres it.
 */
const fitted = (bodies: ReadonlyArray<Body>): Placement => {
  const xs = bodies.map((body) => body.x ?? 0)
  const ys = bodies.map((body) => body.y ?? 0)
  const from = { x: Math.min(...xs), y: Math.min(...ys) }
  const span = {
    x: Math.max(...xs) - from.x,
    y: Math.max(...ys) - from.y,
  }
  const scale = Math.min(
    (WIDTH - PADDING * 2) / Math.max(span.x, 1),
    (HEIGHT - PADDING * 2) / Math.max(span.y, 1),
  )
  const offset = {
    x: (WIDTH - span.x * scale) / 2,
    y: (HEIGHT - span.y * scale) / 2,
  }
  const place = (body: Body): Placed => ({
    id: body.id,
    x: ((body.x ?? 0) - from.x) * scale + offset.x,
    y: ((body.y ?? 0) - from.y) * scale + offset.y,
  })

  const at = new Map<string, Placed>()
  const middles = new Map<string, { x: number; low: number; of: number }>()
  for (const body of bodies) {
    const spot = place(body)
    at.set(spot.id, spot)
    const middle = middles.get(body.file)
    if (middle === undefined) {
      middles.set(body.file, { x: spot.x, low: spot.y, of: 1 })
    } else {
      middle.x += spot.x
      middle.low = Math.max(middle.low, spot.y)
      middle.of += 1
    }
  }

  return {
    at,
    files: [...middles]
      .sort(([one], [other]) => byPath(one, other))
      .map(([file, { x, low, of }]): Grouping => ({ file, x: x / of, y: low })),
  }
}

/** The force constants, named where they are argued rather than inline. They
 *  are a LOOK: how far apart two connected nodes sit, how hard everything
 *  pushes away from everything else, how strongly a file gathers its own. */
const LINK_DISTANCE = 130
const LINK_STRENGTH = 0.35
const REPULSION = -420
const COLLISION = 46
const GROUPING = 0.07
/** How far a file's anchor sits from the middle before anything is fitted. The
 *  fit rescales all of it, so this is a RATIO to the constants above rather
 *  than a distance on screen. */
const SPREAD = 260
/** Where a node starts relative to its file's anchor, and by how much the
 *  starting angle turns per node — the golden angle, which is what spreads a
 *  sequence of points evenly round a circle without a random source. */
const SEED_RADIUS = 40
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * Is this the same graph, for the purpose of not laying it out again?
 *
 * The page's reading is minted fresh on every revision the store publishes —
 * every keystroke anywhere in the directory — and a layout is three hundred
 * ticks over a quadtree. Comparing the reading by REFERENCE would redo that
 * work on every frame; comparing it by what it draws costs one walk of it, and
 * a graph whose nodes and edges are the same is a graph that would settle to
 * the same picture.
 *
 * WHAT IS COMPARED IS WHAT THE LAYOUT READS, and nothing else: the ids, the
 * files (which are the groupings) and the ends of the edges. A title somebody
 * edited changes the label on a dot and not where the dot is, so it must not
 * move the picture out from under a reader mid-word.
 */
export const sameShape = (one: Graph, other: Graph): boolean => {
  if (one === other) return true
  if (one.nodes.length !== other.nodes.length) return false
  if (one.edges.length !== other.edges.length) return false
  for (const [index, node] of one.nodes.entries()) {
    const mine = other.nodes[index]!
    if (mine.at.node.id !== node.at.node.id || mine.at.file !== node.at.file) return false
  }
  for (const [index, edge] of one.edges.entries()) {
    const mine = other.edges[index]!
    if (mine.from !== edge.from || mine.to !== edge.to) return false
  }
  return true
}
