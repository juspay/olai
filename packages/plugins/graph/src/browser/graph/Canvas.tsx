/**
 * The drawing: arrows underneath, dots and their labels on top.
 *
 * TWO LAYERS, and the split is the whole of why this reads the way it does.
 * The arrows are an `<svg>` — lines and arrowheads are what that element is
 * for — and it takes no pointer events at all. The VERTICES are ordinary HTML
 * `<a>`s, absolutely positioned over it, because every one of them has to be
 * a real link: middle-click, ⌘-click and "copy link address" behave the way
 * they do everywhere else in this app — opening the thing is navigation's
 * business, not this page's — and a label is selectable text in the reading
 * face rather than an `<svg:text>` that is none of those things.
 *
 * ONE COORDINATE SPACE across the two, and it is the box's own CSS PIXELS:
 * the `viewBox` is the measured size, so an SVG unit IS a pixel, and a dot is
 * offset in pixels beside it. Nothing converts between them, which is what
 * stops an arrow and the dot it points at from drifting apart at some window
 * size nobody tried.
 *
 * THE CAMERA IS APPLIED TO THE POINTS, not to a wrapper. An SVG `transform`
 * on a group would move the arrows and leave the HTML dots behind, so the
 * two layers would need two transforms kept in step — and a scaled group
 * scales its stroke widths and its arrowheads with it, so a zoomed-out
 * picture would draw hairlines and a zoomed-in one would draw ropes. Every
 * position goes through `seenAt` (`./camera.ts`) instead, once, and both
 * layers read the answer: the shape moves and everything drawn ON it keeps
 * its size.
 *
 * WHICH LABELS ARE DRAWN is `./camera.ts`'s `legible`, the answer to the
 * thing that made a corpus-wide reading unreadable: at a scale where every
 * label would land on its neighbour's, only the ones that FIT are drawn.
 */
import { type Vertex } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, For, Show } from "solid-js"

import { Glyph } from "olai-plugin-files/icons"
import { atFile, atNode } from "olai-plugin-navigation/routes"
import { Link } from "olai-plugin-navigation/routing"

import { TESTID } from "../../testids.ts"
import { inFrame, seenAt } from "./camera.ts"
import type { Looking } from "./looking.ts"
import { EDGE_LOOKS, lookOf } from "./look.ts"
import type { Placed, Placement, Shaped } from "./layout.ts"

/** How far short of a dot an arrow stops, in the layout's units — room for
 *  the dot and its arrowhead, so the head is readable instead of buried under
 *  the thing it points at. */
const TRIM = 18

/** The arrowhead, in the marker's own units. */
const ARROW = "M0,0 L6,3 L0,6 z"

export function Canvas(props: {
  /** What is DRAWN — the page's narrowed drawing: pruned by the filter and
   *  by the Done preference, and placed by the un-narrowed one
   *  (`./GraphFace.tsx`). */
  readonly graph: Shaped
  readonly placement: Placement
  /** Which dots are owed their words this frame: `./camera.ts`'s answer,
   *  computed where the caption can announce it too. Its inputs — the edges'
   *  order and the lit neighbourhood — ride as the accessorised facts they
   *  are, so one hover walks the edge table once. */
  readonly labelled: ReadonlySet<string>
  readonly lit: () => ReadonlySet<string> | undefined
  /** The vertex under the pointer (or the keyboard), and the two halves of
   *  reporting it: the caption above this component draws the sentence, and
   *  everything not touching it goes quiet here. */
  readonly hovered: string | undefined
  readonly onHover: (key: string | undefined) => void
  /** The vertex the page is about — accented, and absent for the corpus-wide
   *  reading, which is about no one vertex. */
  readonly centre: string | undefined
  readonly looking: Looking
}) {
  const camera = () => props.looking.camera()
  const frame = () => props.looking.frame()
  /** Where a vertex is ON SCREEN — its placement, seen from where the reader
   *  is. Every position on both layers goes through this one function. */
  const spot = (key: string): Placed | undefined => {
    const at = props.placement.at.get(key)
    return at === undefined ? undefined : seenAt(camera(), at)
  }

  /** ...and the same, for the layer that must not draw what is off the page. */
  const onFrame = (key: string): Placed | undefined => {
    const seen = spot(key)
    return seen !== undefined && inFrame(seen, frame()) ? seen : undefined
  }

  const litVertex = (key: string): boolean => props.lit()?.has(key) !== false

  /** An ARROW stays bright only while it TOUCHES the dot being pointed at:
   *  asking it the way a dot is asked would light every arrow landing on a
   *  neighbour, which is most of them on a hub — the noise this dimming
   *  exists to remove. */
  const litEdge = (from: string, to: string): boolean =>
    props.hovered === undefined || props.hovered === from || props.hovered === to

  return (
    <div
      // OVERFLOW-HIDDEN is the frame: panning and zooming put dots outside the
      // box, and a picture that spilled over the caption and the legend would
      // be a picture with no edges.
      class="relative min-h-0 w-full flex-1 cursor-grab touch-none overflow-hidden rounded border border-rule/50 active:cursor-grabbing"
      data-testid={TESTID.graphCanvas}
      // What a scenario reads the camera by — the scale, to two places,
      // because a test about zooming should not be a test about floating
      // point.
      data-scale={camera().k.toFixed(2)}
      ref={props.looking.watch}
      // NO plane-clearing on leave: the caption DOES clear on leaving a dot
      // for ANOTHER DOT, but clearing when the pointer heads for the
      // caption's "Centre here" would make that press unreachable.
    >
      <svg
        viewBox={`0 0 ${frame().width} ${frame().height}`}
        class="pointer-events-none absolute inset-0 size-full"
        // The arrows say the same thing the vertices do, so the shape is
        // presentational and the DOTS carry the meaning.
        aria-hidden="true"
      >
        <defs>
          {/* One marker per way: `context-stroke` would let a head inherit
              the line it caps, and it is not answered by every engine this
              app runs in — so each way declares its own head in its own ink,
              beside the stroke it belongs to (`./look.ts`). */}
          <For each={EDGE_LOOKS}>
            {(look) => (
              <marker
                id={look.arrow}
                viewBox="0 0 6 6"
                refX="5"
                refY="3"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                {look.hollow
                  ? <path d={ARROW} class={`fill-none ${look.stroke}`} stroke-width="1" />
                  : <path d={ARROW} class={look.arrowFill} />}
              </marker>
            )}
          </For>
        </defs>
        <Key each={props.graph.edges} by={(edge) => `${edge.from} ${edge.to}`}>
          {(edge) => (
            <Show when={both(spot(edge().from), spot(edge().to))}>
              {(ends) => {
                const look = createMemo(() => lookOf(edge().ways))
                const line = createMemo(() => trimmed(ends()[0], ends()[1]))
                return (
                  <line
                    x1={line().x1}
                    y1={line().y1}
                    x2={line().x2}
                    y2={line().y2}
                    class={`${look().stroke} motion-safe:transition-opacity`}
                    stroke-width="2"
                    stroke-dasharray={look().dashes}
                    marker-end={`url(#${look().arrow})`}
                    opacity={litEdge(edge().from, edge().to) ? 0.85 : 0.12}
                    data-testid={TESTID.graphEdge}
                    data-from={edge().from}
                    data-to={edge().to}
                    data-ways={edge().ways.join("+")}
                  />
                )
              }}
            </Show>
          )}
        </Key>
      </svg>

      {/* The file names, written where their vertices landed — under the
          dots, because a grouping is context and the dots are the content. */}
      <For each={props.placement.files}>
        {(grouping) => (
          <span
            class="pointer-events-none absolute mt-11 -translate-x-1/2 select-none text-[0.6875rem] uppercase tracking-wide text-muted/60"
            style={{
              left: at(seenAt(camera(), { id: grouping.file, ...grouping }).x),
              top: at(seenAt(camera(), { id: grouping.file, ...grouping }).y),
            }}
            data-testid={TESTID.graphFile}
            data-file={grouping.file}
            aria-hidden="true"
          >
            {grouping.file}
          </span>
        )}
      </For>

      <Key each={props.graph.vertices} by={(vertex) => vertex.key}>
        {(vertex) => (
          <Show when={onFrame(vertex().key)}>
            {(at) => (
              <Dot
                vertex={vertex()}
                at={at()}
                centre={props.centre === vertex().key}
                quiet={!litVertex(vertex().key)}
                labelled={props.labelled.has(vertex().key)}
                onHover={props.onHover}
              />
            )}
          </Show>
        )}
      </Key>
    </div>
  )
}

function Dot(props: {
  readonly vertex: Vertex
  readonly at: Placed
  readonly centre: boolean
  readonly quiet: boolean
  readonly labelled: boolean
  readonly onHover: (key: string | undefined) => void
}) {
  const cancelled = () => props.vertex.status === "cancelled"
  const done = () => props.vertex.status === "done"

  return (
    <div
      class="absolute -translate-x-1/2 -translate-y-1/2 motion-safe:transition-opacity"
      style={{ left: at(props.at.x), top: at(props.at.y) }}
      classList={{ "opacity-30": props.quiet, "opacity-60": cancelled() }}
      data-testid={TESTID.graphVertex}
      data-key={props.vertex.key}
      data-kind={props.vertex.kind}
      data-centre={props.centre ? "true" : undefined}
      data-hops={String(props.vertex.hops)}
      data-labelled={props.labelled ? "true" : "false"}
      onPointerEnter={() => props.onHover(props.vertex.key)}
      // Focus is the keyboard's hover, caught here rather than on the link:
      // `focusin` bubbles, so tabbing through the dots names each of them in
      // the caption without `<Link>` growing a prop for one page's benefit.
      // There is deliberately NO per-dot `focusout` clear: the caption's
      // own control ("Centre here") is focusable off the same fact, and a
      // clear on the dot's blur would unmount the thing focus is landing
      // on — the region up in `./GraphFace.tsx` clears on the way OUT.
      onFocusIn={() => props.onHover(props.vertex.key)}
    >
      <Link
        // The vertex's content route — opening the thing is navigation's
        // business, not this page's.
        route={props.vertex.address.kind === "node"
          ? atNode(props.vertex.address.id)
          : atFile(props.vertex.address.path)}
        class="relative block rounded text-inherit no-underline"
        // The whole sentence, because a tip may never be the only home of
        // one — the title and where it sits, said the same way in the
        // caption.
        label={saidOf(props.vertex)}
      >
        <Show
          when={props.vertex.kind === "node"}
          fallback={
            // A DOCUMENT's dot is a SQUARE rather than a circle: the two
            // grains read as the two shapes at a glance, and the glyph of
            // the kind rides beside the title below.
            <span
              class={`block rounded-sm ${props.centre ? "size-4 bg-accent ring-4 ring-accent/25" : "size-2.5 bg-ink"}`}
              aria-hidden="true"
            />
          }
        >
          <span
            class="block rounded-full"
            classList={{
              "size-4 bg-accent ring-4 ring-accent/25": props.centre,
              "size-2.5 bg-muted": !props.centre && done(),
              "size-2.5 bg-ink": !props.centre && !done(),
            }}
            aria-hidden="true"
          />
        </Show>
        <Show when={props.labelled}>
          <span
            class={`absolute left-1/2 top-full mt-1 line-clamp-2 w-36 -translate-x-1/2 text-center text-xs ${
              cancelled() ? "text-muted/70" : done() ? "text-muted line-through" : ""
            }`}
            classList={{ "font-semibold": props.centre }}
          >
            {props.vertex.kind !== "node" ? (
              <><Glyph of={props.vertex.kind as Exclude<Vertex["kind"], "node">} /> {props.vertex.title}</>
            ) : (
              props.vertex.title
            )}
          </span>
        </Show>
      </Link>
    </div>
  )
}

/**
 * WHAT A DOT SAYS: its title, and where it sits — the trail root-to-leaf,
 * nearest first, and the file at the end, the search row's own rule.
 *
 * The whole sentence rather than its tail, because it is said TWICE — on the
 * dot's own `aria-label` and in the caption under the drawing
 * (`./GraphFace.tsx`) — and the two are meant to be the same words.
 */
export const saidOf = (vertex: Vertex): string => {
  // What the mark says, WORDED: done and cancelled are carried by the dot's
  // colour alone elsewhere, and a tip a screen reader or a smudged screen
  // draws from the sentence must be able to miss the colour.
  const marked = vertex.status === "done" ? " (done)"
    : vertex.status === "cancelled" ? " (cancelled)"
    : ""
  const where = [...vertex.crumbs].reverse()
  if (vertex.kind === "node") {
    return where.length === 0
      ? `${vertex.title}${marked} — ${vertex.file}`
      : `${vertex.title}${marked} — ${where.join(" — ")} — ${vertex.file}`
  }
  return `${vertex.title}${marked} — ${vertex.file}`
}

/** The two ends of an arrow, or nothing when either is off the page. */
const both = (
  from: Placed | undefined,
  to: Placed | undefined,
): readonly [Placed, Placed] | undefined =>
  from === undefined || to === undefined ? undefined : [from, to]

const trimmed = (
  from: Placed,
  to: Placed,
): { x1: number; y1: number; x2: number; y2: number } => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const reach = Math.max(Math.hypot(dx, dy), 1)
  const step = { x: (dx / reach) * TRIM, y: (dy / reach) * TRIM }
  return {
    x1: from.x + step.x,
    y1: from.y + step.y,
    x2: to.x - step.x,
    y2: to.y - step.y,
  }
}

/** One coordinate, as the offset it is — the box's own pixels, which is what
 *  the layout, the camera and the `viewBox` are all in. */
const at = (px: number): string => `${px}px`
