/**
 * The reference graph, as a page: what talks to what, around one node or over
 * the whole directory.
 *
 * Every other page in this app draws a LIST of the set — a tree, a day, what is
 * owed, what was put away. This one draws its SHAPE, and it is the only page
 * that is about the relations rather than about the records. The relations
 * themselves are nobody's new invention: they are the `see` edges and the `@id`
 * mentions a zoomed node already reads backwards (`../backlinks/`), read
 * forwards as well and drawn as arrows.
 *
 * DERIVED AND LIVE like every other face. Nothing is stored, nothing is cached
 * on disk, and a note written in another outline moves a dot on a page somebody
 * already has open — the same property the `Referenced by …` section has, for
 * the same reason: it is a lookup over indexes the derivation already keeps,
 * patched per changed file like the rest of the view.
 *
 * ## What the page is made of, and why each piece is there
 *
 * The HEADING says which reading this is, and the focus's own title is a link
 * to its page: a graph is a place you come back FROM.
 *
 * The HORIZON is one button per value and appears only on a focused reading,
 * because a corpus-wide graph has no centre to be far from. It writes the
 * address (`../routes.ts`'s `?hops=`), so what a reader is looking at is a link
 * they can send and Back is the browser's own history.
 *
 * The CAPTION under the drawing is the ancestry of whatever the reader is
 * pointing at, and it is always drawn — an empty line that fills rather than a
 * line that appears, so nothing on the page moves when a pointer arrives. It is
 * the sighted half of a sentence every dot also carries in its `aria-label`
 * (`./Canvas.tsx`), which is this app's rule about anything a hover would
 * otherwise be the only home of.
 *
 * The LEGEND says what the two kinds of line mean. Two ways to refer is a fact
 * about the FORMAT (`@olai/format`'s `WAYS`), so the legend is that list read
 * rather than two rows written here.
 *
 * ## The three things it says instead of drawing
 *
 * An id that resolves to nothing is `../NotFound.tsx` and the whole page,
 * because that is the same answer `/n/` gives to the same address — a graph is
 * not a second opinion about whether a node exists. A node that was PUT AWAY is
 * a sentence, because #226 says what is archived is drawn on the Trash and
 * nowhere else. And a node nothing refers to draws no lone dot: a picture of
 * one thing is not a picture, and "nothing refers to this node" is a real
 * answer that deserves words — unless a FILTER is on, in which case the absence
 * is the query's and the bar above has already counted it.
 */

import { isArchived, type Graph, type Hops, HOPS, type Zoomed } from "@olai/format"
import { createMemo, createSignal, For, Show } from "solid-js"

import { useDerived } from "../derived.tsx"
import { useNarrowed } from "../filter/narrowed.tsx"
import { only } from "../narrow.ts"
import { NotFound } from "../NotFound.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { ancestry, Canvas } from "./Canvas.tsx"
import { placed, sameShape } from "./layout.ts"
import { EDGE_LOOKS } from "./look.ts"

export interface GraphPageProps {
  /** The node the address named, resolved — `undefined` for the corpus-wide
   *  reading, which named none. */
  readonly zoomed: Zoomed | undefined
  readonly hops: Hops
  /** What the page draws, AFTER the filter: the reading and the node it is
   *  about, which a filter may not take away (`../page.ts`). */
  readonly graph: Graph
  readonly focus: string | undefined
  readonly onHorizon: (hops: Hops) => void
}

export function GraphPage(props: GraphPageProps) {
  /** The address named a node and the set could not resolve it. The whole page
   *  is that news, in `/n/`'s own words, rather than a heading over an empty
   *  drawing. */
  const missing = (): Zoomed | undefined =>
    props.zoomed === undefined || props.zoomed.kind === "node" ? undefined : props.zoomed

  return (
    <Show when={missing()} fallback={<Shape {...props} />}>
      {(zoomed) => <NotFound zoomed={zoomed()} />}
    </Show>
  )
}

/** The page when the address resolved — its own component so the hover signal
 *  and the layout memo are minted only where there is something to draw. */
function Shape(props: GraphPageProps) {
  const derived = useDerived()
  const narrowed = useNarrowed()
  const [hovered, setHovered] = createSignal<string | undefined>()

  const shows = () => (props.zoomed === undefined ? undefined : only(props.zoomed, "node"))

  // THE LAYOUT IS HELD BY SHAPE, not by identity. The reading is minted fresh
  // on every revision the store publishes — every keystroke anywhere in the
  // directory — and settling a force layout is three hundred ticks over a
  // quadtree. `sameShape` costs one walk and answers the only question that
  // matters: would this graph settle to the same picture (`./layout.ts`).
  const held = createMemo(() => props.graph, undefined, { equals: sameShape })
  const placement = createMemo(() => placed(held()))

  /** The sentence under the drawing: where the dot under the pointer sits, or —
   *  with nothing pointed at — where the page's own node does. */
  const said = createMemo(() => {
    const asked = hovered() ?? props.focus
    const node = props.graph.nodes.find((one) => one.at.node.id === asked)
    return node === undefined
      ? ""
      : `${node.at.node.title} — ${ancestry(derived(), node)}`
  })

  return (
    <div
      data-testid={TESTID.graphPage}
      data-focus={props.focus}
      data-hops={String(props.hops)}
    >
      <header class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 class="m-0 text-2xl font-bold">
          <Show when={shows()} fallback="Reference graph">
            {(node) => (
              <>
                <span class="text-muted">Around </span>
                <Link
                  route={{ kind: "node", id: node().shows.node.id }}
                  class="text-inherit no-underline hover:underline"
                >
                  {node().shows.node.title}
                </Link>
              </>
            )}
          </Show>
        </h1>
        {/* Only where there is a centre to be far from. */}
        <Show when={shows()}>
          <Horizon hops={props.hops} onPick={props.onHorizon} />
        </Show>
      </header>

      <Show
        when={worthDrawing(props.graph) || narrowed.active()}
        fallback={
          <p class="text-muted" data-testid={TESTID.graphEmpty}>
            {nothing(shows(), props.hops)}
          </p>
        }
      >
        <Canvas
          graph={props.graph}
          placement={placement()}
          derived={derived()}
          hovered={hovered()}
          onHover={setHovered}
          focus={props.focus}
        />
        {/* Reserved rather than conditional: a line that appears would push the
            drawing up the moment a pointer reached a dot. */}
        <p
          class="mt-2 min-h-5 truncate text-sm text-muted"
          data-testid={TESTID.graphCaption}
          aria-live="polite"
        >
          {said()}
        </p>
        <Legend />
      </Show>
    </div>
  )
}

/** Is there a SHAPE here — something with a relation in it? A single dot is not
 *  a picture, and the page says so in words instead. */
const worthDrawing = (graph: Graph): boolean => graph.edges.length > 0

/**
 * What the page says when it draws nothing, and the three cases are three
 * different pieces of news.
 *
 * The archived one is read off the RESOLUTION rather than off the empty
 * reading, because "the walk refused this centre" and "nothing refers to it"
 * are the same empty graph and not the same sentence.
 */
const nothing = (
  node: Extract<Zoomed, { kind: "node" }> | undefined,
  hops: Hops,
): string => {
  if (node === undefined) {
    return "Nothing in this directory refers to anything yet — no node points at another with see, and no note names one by its @id."
  }
  if (isArchived(node.shows.file)) {
    return "This node is in the Trash, and what is put away is drawn there and nowhere else."
  }
  return hops === 1
    ? "Nothing refers to this node, and it refers to nothing."
    : "Nothing refers to this node, and it refers to nothing — not even two hops out."
}

/**
 * How far the reading reaches, as one button per value.
 *
 * The values are the FORMAT's closed list (`@olai/format`'s `HOPS`), read
 * rather than written out here — the same arrangement the legend below has with
 * `WAYS`, and for the same reason: a third horizon added where the reading
 * lives would otherwise be a control that went on offering two.
 */
function Horizon(props: {
  readonly hops: Hops
  readonly onPick: (hops: Hops) => void
}) {
  return (
    <div
      class="flex items-center gap-1 text-xs text-muted"
      role="group"
      aria-label="how far the graph reaches"
    >
      <For each={HOPS}>
        {(hops) => (
          <button
            type="button"
            class={`${TARGET} md:min-h-0 cursor-pointer rounded border border-rule/70 bg-transparent px-2 py-0.5 hover:bg-rule/50 hover:text-ink aria-pressed:border-accent aria-pressed:bg-accent/15 aria-pressed:text-accent`}
            data-testid={TESTID.graphHorizon}
            data-hops={String(hops)}
            aria-pressed={props.hops === hops}
            onClick={() => props.onPick(hops)}
          >
            {hops === 1 ? "1 hop" : `${hops} hops`}
          </button>
        )}
      </For>
    </div>
  )
}

/** What the two kinds of line mean, out of the one table that says how each is
 *  drawn (`./look.ts`) — never a row written here beside a colour picked by
 *  hand, which is the fragmentation `../backlinks/way.ts` exists to have
 *  stopped one direction over. */
function Legend() {
  return (
    <ul class="mt-3 flex list-none flex-wrap gap-4 p-0 text-xs text-muted">
      <For each={EDGE_LOOKS}>
        {(look) => (
          <li class="flex items-center gap-2" data-testid={look.testid}>
            <svg viewBox="0 0 32 8" class="h-2 w-8 shrink-0" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="32"
                y2="4"
                class={look.stroke}
                stroke-width="2"
                stroke-dasharray={look.dashes}
              />
            </svg>
            <span>
              a node <span class="text-ink">{look.label}</span> the one it points at
            </span>
          </li>
        )}
      </For>
    </ul>
  )
}
