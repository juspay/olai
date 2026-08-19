/**
 * The drawing: arrows underneath, dots and their labels on top.
 *
 * TWO LAYERS, and the split is the whole of why this reads the way it does. The
 * arrows are an `<svg>` — lines and arrowheads are what that element is for —
 * and it takes no pointer events at all. The NODES are ordinary HTML `<a>`s,
 * absolutely positioned over it, because every one of them has to be a real
 * link: middle-click, ⌘-click and "copy link address" behave the way they do
 * everywhere else in this app, Alt+click opens the neighbour in the pane to the
 * right (`../pane/PageView.tsx` catches it by walking up to the anchor), and a
 * label is selectable text in the reading face rather than an `<svg:text>` that
 * is none of those things.
 *
 * ONE COORDINATE SPACE across the two, and it is the layout's
 * (`./layout.ts`'s `WIDTH` × `HEIGHT`): the box locks that aspect ratio, so the
 * SVG's `viewBox` unit and a percentage of the box are the same place. Nothing
 * converts between them, which is what stops an arrow and the dot it points at
 * from drifting apart at some window width nobody tried.
 *
 * WHAT A DOT IS DRAWN IN is `../tone.ts`'s table, unchanged: finished work
 * recedes into the muted ink and everything else is plain. The one accented
 * thing is the node the page is ABOUT, and the `see` arrows — argued in
 * `./look.ts`.
 *
 * THE ANCESTRY IS NOT HOVER-ONLY. A bare title is ambiguous — "order the new
 * cabinets" under which parent? — so every dot carries its ancestry in its
 * `aria-label`, which is this app's standing rule for anything a tip would
 * otherwise be the only home of. The hover caption (`./GraphPage.tsx`) is the
 * sighted reader's copy of the same sentence.
 */

import { ancestorTitles, type Derived, type Graph, type GraphNode } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, For, Show } from "solid-js"

import { NodeTitle } from "../NodeTitle.tsx"
import { nodePlace } from "../search/place.ts"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { toneOf } from "../tone.ts"
import { EDGE_LOOKS, lookOf } from "./look.ts"
import { HEIGHT, type Placed, type Placement, WIDTH } from "./layout.ts"

/** How far short of a dot an arrow stops, in the layout's units — room for the
 *  dot and its arrowhead, so the head is readable instead of buried under the
 *  thing it points at. */
const TRIM = 18

/** The arrowhead, in the marker's own units. */
const ARROW = "M0,0 L6,3 L0,6 z"

export function Canvas(props: {
  readonly graph: Graph
  readonly placement: Placement
  readonly derived: Derived | undefined
  /** The node under the pointer (or the keyboard), and the two halves of
   *  reporting it: the caption above this component draws the ancestry, and
   *  everything not touching it goes quiet here. */
  readonly hovered: string | undefined
  readonly onHover: (id: string | undefined) => void
  /** The node the page is about — accented, and absent for the corpus-wide
   *  reading, which is about no one node. */
  readonly focus: string | undefined
}) {
  const spot = (id: string): Placed | undefined => props.placement.at.get(id)

  /**
   * What stays bright while a reader is pointing at a dot: that dot and
   * everything an arrow joins it to.
   *
   * The NEIGHBOURS and not the dot alone, because what a reader is asking when
   * they point at one is "what is this talking to" — dimming the far end of the
   * arrow they are following would take the answer away with the noise. A memo,
   * so pointing at a dot walks the edges once rather than once per dot.
   */
  const lit = createMemo(() => {
    const asked = props.hovered
    if (asked === undefined) return undefined
    const found = new Set([asked])
    for (const edge of props.graph.edges) {
      if (edge.from === asked) found.add(edge.to)
      if (edge.to === asked) found.add(edge.from)
    }
    return found
  })

  /** Is this dot part of what the reader is pointing at? With nothing hovered
   *  every dot is, which is what makes the quiet a highlight rather than a
   *  permanent dimming. */
  const litNode = (id: string): boolean => lit()?.has(id) !== false

  /** ...and an ARROW, which is a stricter question: an arrow stays bright only
   *  while it TOUCHES the dot being pointed at. Asking it the way a dot is
   *  asked would light every arrow landing on a neighbour, which is most of
   *  them on a hub node — the noise this dimming exists to remove. */
  const litEdge = (from: string, to: string): boolean =>
    props.hovered === undefined || props.hovered === from || props.hovered === to

  return (
    <div
      class="relative w-full"
      style={{ "aspect-ratio": `${WIDTH} / ${HEIGHT}` }}
      data-testid={TESTID.graphCanvas}
      // A pointer leaving the whole box clears the caption: a dot the reader
      // moved off the edge of the page would otherwise stay named.
      onPointerLeave={() => props.onHover(undefined)}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        class="pointer-events-none absolute inset-0 size-full"
        // The arrows say the same thing the links do — `../NodeRefs.tsx`'s rows
        // read backwards — and a screen reader walking a list of line elements
        // learns nothing, so the shape is presentational and the NODES carry
        // the meaning.
        aria-hidden="true"
      >
        <defs>
          {/* One marker per kind: `context-stroke` would let a head inherit the
              line it caps, and it is not answered by every engine this app
              runs in — so each kind declares its own head in its own ink,
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
                <path d={ARROW} class={look.arrowFill} />
              </marker>
            )}
          </For>
        </defs>
        <For each={props.graph.edges}>
          {(edge) => (
            <Show when={both(spot(edge.from), spot(edge.to))}>
              {(ends) => {
                const look = lookOf(edge.ways)
                const line = trimmed(ends()[0], ends()[1])
                return (
                  <line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    class={`${look.stroke} transition-opacity`}
                    stroke-width="2"
                    stroke-dasharray={look.dashes}
                    marker-end={`url(#${look.arrow})`}
                    opacity={litEdge(edge.from, edge.to) ? 0.85 : 0.12}
                    data-testid={TESTID.graphEdge}
                    data-from={edge.from}
                    data-to={edge.to}
                    data-ways={edge.ways.join("+")}
                  />
                )
              }}
            </Show>
          )}
        </For>
      </svg>

      {/* The file names, written where their nodes landed — under the dots,
          because a grouping is context and the nodes are the content.

          The placement puts this LEVEL with the group's lowest dot
          (`./layout.ts`), and the gap that clears that dot's own two lines of
          title is spent HERE, in `rem`: a title is text at a fixed size and
          this box's pixel height depends on how wide the pane is, so a gap
          measured in layout units would clear the words on a wide screen and
          land on them on a narrow one. */}
      <For each={props.placement.files}>
        {(grouping) => (
          <span
            class="pointer-events-none absolute mt-11 -translate-x-1/2 select-none text-[0.6875rem] uppercase tracking-wide text-muted/60"
            style={{ left: across(grouping.x), top: down(grouping.y) }}
            data-testid={TESTID.graphFile}
            data-file={grouping.file}
            aria-hidden="true"
          >
            {grouping.file}
          </span>
        )}
      </For>

      {/* `<Key>` rather than `<For>` for the reason the tree uses it: the
          reading is minted fresh on every revision the store publishes, so
          comparing by reference would tear down and rebuild every link on
          every frame instead of moving it. */}
      <Key each={props.graph.nodes} by={(node) => node.at.node.id}>
        {(node) => (
          <Show when={spot(node().at.node.id)}>
            {(at) => (
              <Dot
                node={node()}
                at={at()}
                derived={props.derived}
                focus={props.focus === node().at.node.id}
                quiet={!litNode(node().at.node.id)}
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
  readonly node: GraphNode
  readonly at: Placed
  readonly derived: Derived | undefined
  readonly focus: boolean
  readonly quiet: boolean
  readonly onHover: (id: string | undefined) => void
}) {
  const id = () => props.node.at.node.id
  const status = () => props.derived?.status.get(id())
  const place = () => ancestry(props.derived, props.node)

  return (
    // THE BOX IS THE DOT, and the label hangs off it absolutely — which is what
    // puts the placement's own point at the centre of the dot rather than
    // halfway between the dot and its words. Sized to the dot, an arrow's
    // trimmed end (below) lands beside the mark it points at instead of across
    // the title under it, and the label still belongs to the anchor, so
    // pointing at the words is pointing at the node.
    <div
      class="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity"
      style={{ left: across(props.at.x), top: down(props.at.y) }}
      classList={{ "opacity-30": props.quiet }}
      data-testid={TESTID.graphNode}
      data-node-id={id()}
      data-hops={String(props.node.hops)}
      data-focus={props.focus ? "true" : undefined}
      onPointerEnter={() => props.onHover(id())}
      // Focus is the keyboard's hover, and it is caught HERE rather than on the
      // link: `focusin` / `focusout` bubble where `focus` does not, so tabbing
      // through the dots names each of them in the caption without `<Link>`
      // having to grow two props for one page's benefit.
      onFocusIn={() => props.onHover(id())}
      onFocusOut={() => props.onHover(undefined)}
    >
      <Link
        route={{ kind: "node", id: id() }}
        class="relative block rounded text-inherit no-underline"
        // The whole sentence, because a tip may never be the only home of one:
        // the title, and the ancestry that says which `order the new cabinets`
        // this is.
        label={`${props.node.at.node.title} — ${place()}`}
      >
        <span
          class="block rounded-full"
          classList={{
            "size-4 bg-accent ring-4 ring-accent/25": props.focus,
            "size-2.5 bg-muted": !props.focus && status() === "done",
            "size-2.5 bg-ink": !props.focus && status() !== "done",
          }}
          aria-hidden="true"
        />
        {/* CLAMPED to two lines rather than cut at one: a title is somebody's
            sentence, and the ellipsis a dot can afford is two lines of it. The
            title itself goes through the app's own renderer, so a `#tag` and a
            markdown emphasis look here exactly as they do on a row —
            `links={false}` because this is already inside an `<a>`. */}
        <span
          class={`absolute left-1/2 top-full mt-1 line-clamp-2 w-36 -translate-x-1/2 text-center text-xs hover:underline ${
            toneOf(status())
          }`}
          classList={{ "font-semibold": props.focus }}
        >
          <NodeTitle
            title={props.node.at.node.title}
            from={props.node.at.file}
            links={false}
          />
        </span>
      </Link>
    </div>
  )
}

/** The two ends of an arrow, or nothing when either is off the page — the
 *  format promises both ends are drawn, and this is the frame where a placement
 *  has not caught up with a reading yet. */
const both = (
  from: Placed | undefined,
  to: Placed | undefined,
): readonly [Placed, Placed] | undefined =>
  from === undefined || to === undefined ? undefined : [from, to]

/** ...and the line between them, stopped short of the dot at each end. Two
 *  nodes the layout put in the same place (which nothing here can rule out)
 *  divide by one rather than by zero and draw a line of no length. */
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

/** Where a node sits, in the reader's words — the SAME sentence a search hit's
 *  second line says (`../search/place.ts`), so "which `order the new
 *  cabinets`?" is answered the same way at every door. */
export const ancestry = (derived: Derived | undefined, node: GraphNode): string =>
  derived === undefined ? node.at.file : nodePlace({
    file: node.at.file,
    path: ancestorTitles(derived, node.at.node.id),
  })

const across = (x: number): string => `${(x / WIDTH) * 100}%`
const down = (y: number): string => `${(y / HEIGHT) * 100}%`
