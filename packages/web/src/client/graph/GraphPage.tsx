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
 * The CAMERA is beside it and is NOT in the address, which is the same division
 * the fold and the calendar's month already keep: how far a reader has zoomed
 * into a picture is a fact about their looking rather than about the page, and
 * a link that carried it would be a link that opened somewhere nobody chose. It
 * is held here — one value, read by the drawing and written by the gestures and
 * by `./Controls.tsx` alike — and it goes back to fitted whenever the picture
 * underneath it changes, because a camera aimed at the last graph is aimed at
 * nothing.
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

import { isArchived, type Graph, type Hops, HOPS } from "@olai/format"
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"

import { useDerived } from "../derived.tsx"
import { useNarrowed } from "../filter/narrowed.tsx"
import { only } from "../narrow.ts"
import { type Around, focusOf } from "../page.ts"
import { NotFound } from "../NotFound.tsx"
import { Segmented } from "../Segmented.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { Canvas, sentenceFor } from "./Canvas.tsx"
import { Controls } from "./Controls.tsx"
import { placed, sameShape } from "./layout.ts"
import { EDGE_LOOKS } from "./look.ts"
import { createLooking } from "./looking.ts"

/** How coarsely the layout follows the box, in pixels. Small enough that a
 *  placement is never visibly stale, large enough that dragging a pane does not
 *  re-settle the picture on every frame. */
const STEP = 24

export interface GraphPageProps {
  /** The CENTRE, resolved — the node and how far the reading reaches, or which
   *  of the three ways the address failed to name one. `undefined` is the
   *  corpus-wide reading, which named none (`../page.ts`'s `Around`). */
  readonly around: Around | undefined
  /**
   * TWO readings, and the difference between them is the whole of what a filter
   * does here.
   *
   * `page` is what the ADDRESS names, and it is what the dots are PLACED from:
   * where a node sits is a property of the neighbourhood, not of a query typed
   * over it. Laying out the narrowed one instead meant a three-hundred-tick
   * force simulation per character — synchronously, on the input's own path —
   * and a picture that jumped under the reader as they typed.
   *
   * `drawn` is what is left after the filter (`../page.ts`), and it is a SUBSET
   * of the first, so every dot it holds has a placement already. A filter takes
   * dots off a picture rather than commissioning a new one.
   *
   * Which node the page is ABOUT is on neither: it is
   * {@link GraphPageProps.around} read once, below, so the accent and the
   * pruned graph cannot come to two answers about one page.
   */
  readonly page: Graph
  readonly drawn: Graph
  readonly onHorizon: (hops: Hops) => void
}

export function GraphPage(props: GraphPageProps) {
  /** The address named a node and the set could not resolve it. The whole page
   *  is that news, in `/n/`'s own words, rather than a heading over an empty
   *  drawing. */
  const missing = (): Exclude<Around, { kind: "node" }> | undefined =>
    props.around === undefined || props.around.kind === "node" ? undefined : props.around

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
  const [pointed, setPointed] = createSignal<string | undefined>()
  const looking = createLooking()

  /** The centre, when there is one — the node this page is about, with the
   *  horizon that is only meaningful beside it. */
  const centre = () => (props.around === undefined ? undefined : only(props.around, "node"))

  /** The node the page is ABOUT — the accent on a dot, and the dot the caption
   *  falls back to. The page model's own derivation (`../page.ts`), because the
   *  filter reads the same one and a second expression here would be the id a
   *  prune protects and the id wearing the accent free to differ. */
  const focus = (): string | undefined => focusOf(props.around)

  /** ...and how far it reaches, as the attribute the page publishes. Absent on
   *  the corpus-wide reading rather than defaulted: there is no centre for a
   *  horizon to be measured from, so a number there would be a claim. */
  const reach = (): string | undefined => centre()?.hops.toString()

  /**
   * WHAT THE READER IS POINTING AT — derived against what is DRAWN rather than
   * held on its own.
   *
   * The signal is a fact about a pointer, and everything it feeds is a fact
   * about this graph: which dot is named in the caption, and which dots go
   * quiet. Those two come apart the moment the graph moves under the pointer —
   * navigating from one neighbourhood to the next, or a live update taking the
   * pointed-at node out of the set — and what the page would then draw is every
   * dot dimmed against one that is not there. Asking the reading rather than
   * remembering is the same rule the rest of this client keeps: the reading is
   * the answer, and a held id is at most a question.
   */
  const hovered = createMemo(() =>
    props.drawn.nodes.find((one) => one.at.node.id === pointed())
  )

  // THE LAYOUT IS HELD BY SHAPE, not by identity, and it is placed from the
  // PAGE's reading rather than the filtered one (see the props above). The
  // reading is minted fresh on every revision the store publishes — every
  // keystroke anywhere in the directory — and settling a force layout is three
  // hundred ticks over a quadtree. `sameShape` costs one walk and answers the
  // only question that matters: would this graph settle to the same picture
  // (`./layout.ts`).
  const held = createMemo(() => props.page, undefined, { equals: sameShape })

  // The frame the layout is FITTED to, coarsened. The box is measured to the
  // pixel (`./looking.ts`) because the drawing has to be exact; the layout does
  // not — re-settling three hundred ticks on every pixel of a sidebar drag
  // would be a picture that boils while somebody resizes. Rounding the
  // dependency and not the drawing is what keeps the two honest: a placement
  // may be up to a step stale against the box, which the margins it already
  // leaves absorb.
  const room = createMemo(() => ({
    width: Math.round(looking.frame().width / STEP) * STEP,
    height: Math.round(looking.frame().height / STEP) * STEP,
  }), undefined, {
    equals: (was, is) => was.width === is.width && was.height === is.height,
  })

  const placement = createMemo(() => placed(held(), room()))

  // A NEW PICTURE IS SEEN FROM THE FRONT. Navigating to another neighbourhood,
  // or widening the horizon, replaces what is under the camera — and a camera
  // left where the last graph was would open the next one on empty space. The
  // reset goes through the BEHAVIOUR rather than through the signal, so d3's
  // own record of the transform (which is on the element) agrees with what is
  // drawn; a signal set on its own would leave the next wheel tick resuming
  // from where the reader had been.
  // A NEW PICTURE is seen from the front — but a RESIZE is not a new picture,
  // so this watches the graph rather than the placement: re-fitting on every
  // window change would throw away wherever the reader had panned to.
  createEffect(on(held, looking.fit, { defer: true }))

  /** The sentence under the drawing: what the dot under the pointer says, or —
   *  with nothing pointed at — what the page's own node does. The SAME sentence
   *  that dot carries on its `aria-label`, out of the one place it is assembled
   *  (`./Canvas.tsx`). */
  const said = createMemo(() => {
    const node = hovered() ??
      props.drawn.nodes.find((one) => one.at.node.id === focus())
    return node === undefined ? "" : sentenceFor(derived(), node)
  })

  return (
    // A COLUMN THAT FILLS THE PANE. The heading, the caption and the legend
    // take what they need and the drawing takes the rest, so the page is the
    // picture and the window is its size (`../pane/PageView.tsx` gives the pane
    // the viewport strip to fill).
    <div
      class="flex min-h-0 flex-1 flex-col"
      data-testid={TESTID.graphPage}
      data-focus={focus()}
      data-hops={reach()}
    >
      <header class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 class="m-0 text-2xl font-bold">
          <Show when={centre()} fallback="Reference graph">
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
        <div class="flex flex-wrap items-center gap-3">
          {/* Only where there is a centre to be far from. */}
          <Show when={centre()}>
            {(node) => <Horizon hops={node().hops} onPick={props.onHorizon} />}
          </Show>
          <Controls
            looking={looking}
            toward={() => {
              const at = focus()
              return at === undefined ? undefined : placement().at.get(at)
            }}
          />
        </div>
      </header>

      <Show
        when={worthDrawing(props.drawn) || narrowed.active()}
        fallback={
          <p class="text-muted" data-testid={TESTID.graphEmpty}>
            {nothing(centre())}
          </p>
        }
      >
        <Canvas
          graph={props.drawn}
          placement={placement()}
          derived={derived()}
          hovered={hovered()?.at.node.id}
          onHover={setPointed}
          focus={focus()}
          looking={looking}
        />
        {/* Reserved rather than conditional: a line that appears would take a
            line off the drawing the moment a pointer reached a dot. */}
        <p
          class="mt-2 min-h-5 shrink-0 truncate text-sm text-muted"
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
const nothing = (node: Extract<Around, { kind: "node" }> | undefined): string => {
  if (node === undefined) {
    return "Nothing in this directory refers to anything yet — no node points at another with see, and no note names one by its @id."
  }
  if (isArchived(node.shows.file)) {
    return "This node is in the Trash, and what is put away is drawn there and nowhere else."
  }
  return node.hops === 1
    ? "Nothing refers to this node, and it refers to nothing."
    : "Nothing refers to this node, and it refers to nothing — not even two hops out."
}

/**
 * How far the reading reaches, as one button per value.
 *
 * The STRIP is `../Segmented.tsx` — this app's one "choose between two or three
 * named things" control, which the preferences panel already draws three of. It
 * was hand-rolled here for a release and that was a second strip with its own
 * `aria-pressed` spelled its own way: the two would drift, and nothing would
 * fail while they did.
 *
 * The VALUES are the format's closed list (`@olai/format`'s `HOPS`), read
 * rather than written out — the same arrangement the legend below has with
 * `WAYS`, and for the same reason: a third horizon added where the reading
 * lives would otherwise be a control that went on offering two. They cross the
 * strip as TEXT because that is what a choice is to it, and they come back
 * through the same list rather than through a `parseInt`: what the reader
 * pressed is one of these values or the press meant nothing.
 */
function Horizon(props: {
  readonly hops: Hops
  readonly onPick: (hops: Hops) => void
}) {
  const choices = HOPS.map((hops) => ({
    value: String(hops),
    label: hops === 1 ? "1 hop" : `${hops} hops`,
  }))

  return (
    <Segmented
      choices={choices}
      value={String(props.hops)}
      testid={TESTID.graphHorizon}
      label="how far the graph reaches"
      onPick={(value) => {
        const asked = HOPS.find((hops) => String(hops) === value)
        if (asked !== undefined) props.onPick(asked)
      }}
    />
  )
}

/** What the two kinds of line mean, out of the one table that says how each is
 *  drawn (`./look.ts`) — never a row written here beside a colour picked by
 *  hand, which is the fragmentation `../backlinks/way.ts` exists to have
 *  stopped one direction over. */
function Legend() {
  return (
    <ul class="mt-2 flex shrink-0 list-none flex-wrap gap-4 p-0 text-xs text-muted">
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
