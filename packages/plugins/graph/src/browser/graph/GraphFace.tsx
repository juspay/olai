/**
 * The reference graph, as a page: what talks to what, around one vertex or
 * over the whole directory.
 *
 * THE PICTURE IS PLACED FROM THE PAGE'S OWN READING AND PRUNED BY THE
 * FILTER — PR #247's rule. `page.vertices` is what the address names, and
 * where a dot sits is a property of the neighbourhood, not of a query typed
 * over it: laying out the narrowed one instead is a three-hundred-tick force
 * simulation per character, synchronously, on the input's own path, and a
 * picture that jumps under the reader as they type. `drawn` is what is left
 * after the filter — a SUBSET of the page's reading, so every dot it holds
 * has a placement already.
 *
 * The CAMERA is a fact about the reader's looking and not about the page, so
 * it is not in the address: one value, written by the gestures and by
 * `./Controls.tsx` alike, returned to fitted whenever the shape underneath it
 * changes.
 *
 * The CAPTION is always drawn — an empty line that fills rather than a line
 * that appears, so nothing on the page moves when a pointer arrives.
 */

import {
  type Address,
  GRAPH_DRAWN_AT_MOST,
  type Centre,
  HOPS,
  type Hops,
  printAddress,
  type Shown,
  type Vertex,
} from "@olai/format"
import { only } from "@olai/web/client/narrow.ts"
import { Segmented } from "@olai/ui-primitives/Segmented.tsx"
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"

import { atFile, atNode, type Route } from "olai-plugin-navigation/routes"
import { Link, useHere } from "olai-plugin-navigation/routing"
import type { Drawn } from "olai-plugin-outlines/page"

import { TESTID } from "../../testids.ts"
import { navigationHeld } from "../held.ts"
import { graph } from "../routes.ts"
import { Canvas, saidOf } from "./Canvas.tsx"
import { Controls } from "./Controls.tsx"
import { EDGE_LOOKS } from "./look.ts"
import { placed, sameShape } from "./layout.ts"
import { createLooking } from "./looking.ts"

/** How coarsely the layout follows the box, in pixels: a placement is never
 *  visibly stale, and dragging a pane does not re-settle the picture on every
 *  frame. */
const FRAME_STEP = 24

/** The vertex's CONTENT page: a node opens its row, a file its own page —
 *  opening the thing is navigation's business, not this page's. */
const contentRoute = (vertex: Vertex): Route =>
  vertex.address.kind === "node" ? atNode(vertex.address.id) : atFile(vertex.address.path)

export function GraphFace(props: {
  readonly page: Extract<Shown, { readonly kind: "graph" }>
  readonly drawn: Drawn
  readonly today: string
}) {
  const nav = navigationHeld.read
  const drawn = createMemo(() => only(props.drawn, "graph"))

  // THE TITLE THE TAB CARRIES: "Graph", or "Graph · <centre>" — navigation's
  // own bar rather than a heading this page draws, so it is the same sentence
  // the breadcrumb says. With no router held this is a no-op, which is the
  // absent arm: the page still draws.
  const router = nav()
  if (router !== undefined) {
    const here = useHere()
    router.report(here, () => ({
      title: props.page.around === null
        ? "Graph"
        : props.page.around.kind === "vertex"
        ? `Graph · ${props.page.around.vertex.title}`
        : "Graph",
    }))
  }

  /** The vertex's CONTENT page: a node opens its row, a file its own page —
 *  opening the thing is navigation's business, not this page's. */
const contentRoute = (vertex: Vertex): Route =>
  vertex.address.kind === "node" ? atNode(vertex.address.id) : atFile(vertex.address.path)

/** THE CENTRE VERTEX'S KEY, or none — the accent on a dot and the dot the
 *  caption falls back to. The page's own derivation: the pruned graph
 *  keeps an unmatched centre, so the same question must not have two
 *  answers. */
  const centre = (): Vertex | undefined =>
    props.page.around?.kind === "vertex" ? props.page.around.vertex : undefined

  /** ...the CENTRE'S OWN KIND OF NEWS, when the address failed to name one:
   *  the graph's `Zoomed` equivalents (`@olai/format`'s `Centre`), each in
   *  zoom's own words. */
  const refused = (): Centre | undefined => {
    const around = props.page.around
    return around === null || around.kind === "vertex" ? undefined : around
  }

  /** HELD BACK: the whole reading over the ceiling draws no picture at all —
   *  a 2000-dot picture is unreadable before it is slow (§7), and a page
   *  showing the first 2000 of something is a page saying something false. */
  const held = () => props.page.held

  /**
   * THE PICTURE, or the sentence that stands in for one.
   *
   * The narrowed drawing — every placement lookup answers for it: the page's
   * reading is placed, the drawn one is pruned, and a dot that is pruned is
   * simply not rendered.
   */
  const picture = () => drawn()

  /** The sentence under the drawing, for the pointer's dot or the page's own
   *  centre: the SAME words the dot's `aria-label` holds. */
  const [pointed, setPointed] = createSignal<string | undefined>()
  const hovered = createMemo(() =>
    picture()?.vertices.find((vertex) => vertex.key === pointed())
  )
  const said = createMemo((): string => {
    const one = hovered() ?? centre()
    return one === undefined ? "" : saidOf(one)
  })

  return (
    <div
      class="flex min-h-0 flex-1 flex-col"
      data-testid={TESTID.graphPage}
      data-centre-key={centre()?.key}
      data-hops={props.page.around === null ? undefined : String(props.page.hops)}
      data-held={held() > 0 ? String(held()) : undefined}
    >
      <Show
        when={refused() === undefined && held() === 0}
        fallback={
          <Empty
            held={held()}
            around={props.page.around}
            reason={refused()}
          />
        }
      >
        <Shape
          page={props.page}
          drawn={picture}
          said={said}
          pointed={pointed}
          setPointed={setPointed}
          centre={centre}
        />
      </Show>
      <Legend />
    </div>
  )
}

function Shape(props: {
  readonly page: Extract<Shown, { readonly kind: "graph" }>
  readonly drawn: () => Pick<Extract<Drawn, { readonly kind: "graph" }>, "vertices" | "edges"> | undefined
  readonly said: () => string
  readonly pointed: () => string | undefined
  readonly setPointed: (key: string | undefined) => void
  readonly centre: () => Vertex | undefined
}) {
  const looking = createLooking()

  /** PLACEMENT HELD BY SHAPE — the reading is minted fresh on every revision
   *  the store publishes, and the layout is three hundred ticks over a
   *  quadtree. `sameShape` costs one walk, and answers the only question that
   *  matters: would this graph settle to the same picture (`./layout.ts`). */
  const held = createMemo((): Extract<Shown, { readonly kind: "graph" }> => props.page, undefined, {
    equals: sameShape,
  })

  // The frame the layout is FITTED to, coarsened: re-settling three hundred
  // ticks on every pixel of a sidebar drag would be a picture that boils
  // while somebody resizes — a placement may be a step stale against the
  // box, which the margins it already leaves absorb.
  const room = createMemo(() => ({
    width: Math.round(looking.frame().width / FRAME_STEP) * FRAME_STEP,
    height: Math.round(looking.frame().height / FRAME_STEP) * FRAME_STEP,
  }), undefined, {
    equals: (was, is) => was.width === is.width && was.height === is.height,
  })

  const placement = createMemo(() => placed(held(), room()))

  // A NEW PICTURE IS SEEN FROM THE FRONT — but a RESIZE is not a new picture,
  // so this watches the graph rather than the placement.
  createEffect(on(held, looking.fit, { defer: true }))

  /** The drawn dots, as ONE list keyed the way the canvas keys them. */
  const drawn = createMemo(() => props.drawn())

  return (
    <>
      <header class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 class="m-0 text-2xl font-bold">
          <Show when={props.centre()} fallback="Reference graph">
            {(vertex) => (
              <>
                <span class="text-muted">Around </span>
                <Link
                  route={contentRoute(vertex())}
                  class="text-inherit no-underline hover:underline"
                >
                  {vertex().title}
                </Link>
              </>
            )}
          </Show>
        </h1>
        <div class="flex flex-wrap items-center gap-3">
          <Show when={props.page.around !== null}>
            <Horizon hops={props.page.hops} />
          </Show>
          <Controls
            looking={looking}
            toward={() => {
              const key = props.centre()?.key
              return key === undefined ? undefined : placement().at.get(key)
            }}
          />
        </div>
      </header>

      <Show
        when={(drawn()?.edges.length ?? 0) > 0}
        fallback={<Edges0 page={props.page} drawn={drawn()} />}
      >
        <Canvas
          graph={drawn()!}
          placement={placement()}
          hovered={props.pointed()}
          onHover={props.setPointed}
          centre={props.centre()?.key}
          looking={looking}
        />
        <p
          class="mt-2 min-h-5 shrink-0 truncate text-sm text-muted"
          data-testid={TESTID.graphCaption}
          aria-live="polite"
        >
          {props.said()}
        </p>
        <Named page={props.page} drawn={drawn()} />
      </Show>
    </>
  )
}

/**
 * How many of the drawn dots' labels are on the picture, said ONCE for a
 * screen reader — so the decluttering `./camera.ts` does for the eye is
 * heard rather than missed. Visually hidden: the picture is the same answer
 * for a sighted reader, one hover at a time.
 */
function Named(props: {
  readonly page: Extract<Shown, { readonly kind: "graph" }>
  readonly drawn: Pick<Extract<Drawn, { readonly kind: "graph" }>, "vertices">
  | undefined
}) {
  return (
    <p
      class="sr-only"
      data-testid={TESTID.graphNamed}
      data-named={props.drawn?.vertices.length}
      data-drawn={props.page.vertices.length}
    >
      {props.drawn?.vertices.length ?? 0} of {props.page.vertices.length} named
    </p>
  )
}

/**
 * The three things the page says instead of drawing an absent centre, and
 * the one it says when the picture is withheld.
 */
function Empty(props: {
  readonly held: number
  readonly around: Centre | null
  readonly reason: Centre | undefined
}) {
  return (
    <div data-testid={TESTID.graphEmpty} data-reason={props.reason?.kind ?? "held"} class="py-6">
      <Show
        when={props.held === 0}
        fallback={
          <p class="max-w-lg text-ink">
            The whole reference map of this directory is over the ceiling this
            page draws under — {props.held} vertices, against {" "}{GRAPH_DRAWN_AT_MOST} — so
            nothing is drawn: a partial picture of a directory is a sentence
            with a silent word missing. Open a NEIGHBOURHOOD instead — a row's
            `•••` has "Reference graph", and the palette has the same page by
            name.
          </p>
        }
      >
        <Reason sentence={props.reason} />
      </Show>
    </div>
  )
}

function Reason(props: { readonly sentence: Centre | undefined }) {
  switch (props.sentence?.kind) {
    case "unknown":
      return props.sentence.address.kind === "node"
        ? (
          <p class="max-w-lg text-ink">
            No node is called <code class="font-mono text-[0.8125rem]">#{props.sentence.address.id}</code> — it was
            deleted, or the outline holding it is no longer served.
          </p>
        )
        : (
          <p class="max-w-lg text-ink">
            No file at <code class="font-mono text-[0.8125rem]">{props.sentence.address.path}</code> — it was
            moved, renamed, or is no longer one of the served kinds.
          </p>
        )
    case "put-away":
      return (
        <p class="max-w-lg text-ink">
          <NameOf address={props.sentence.address} /> is in the Trash, which is
          the one page that draws it.{" "}
          <Link route={{ kind: "trash" }} class="underline">Open the Trash</Link>.
        </p>
      )
    case "dangling":
      return (
        <p class="max-w-lg text-ink">
          <code class="font-mono text-[0.8125rem]">#{props.sentence.id}</code> is a mirror, and the chain from it
          ends at <code class="font-mono text-[0.8125rem]">{props.sentence.missing}</code>, which no node
          declares — so there is no vertex the graph could centre on.
        </p>
      )
    case "cycle":
      return (
        <p class="max-w-lg text-ink">
          <code class="font-mono text-[0.8125rem]">#{props.sentence.id}</code> is a mirror whose chain closes on
          itself at <code class="font-mono text-[0.8125rem]">{props.sentence.through}</code>, so it stands for
          no vertex at all.
        </p>
      )
    default:
      return null
  }
}

/** The address in the sentence, said the way the URL would say it — ONE
 *  spelling, so a sentence and a link never say two names for one thing. */
function NameOf(props: { readonly address: Address }) {
  return <code class="font-mono text-[0.8125rem]">{printAddress(props.address)}</code>
}

/** Nothing refers to the centre, and it refers to nothing — a real answer,
 *  in words rather than a picture of one dot. */
function Edges0(props: {
  readonly page: Extract<Shown, { readonly kind: "graph" }>
  readonly drawn: Pick<Extract<Drawn, { readonly kind: "graph" }>, "vertices"> | undefined
}) {
  return (
    <p class="max-w-lg text-ink" data-testid={TESTID.graphEmpty} data-reason="no-edges">
      {props.page.around === null
        ? "Nothing in this directory refers to anything yet — no node points at another with `see`, no outline is another record's `doc`, and no note names a vertex at all."
        : props.page.hops === 1
        ? "Nothing refers to this one, and it refers to nothing — no `see` written out and none pointed back."
        : "Nothing refers to this one, and it refers to nothing — not even two hops out."}
    </p>
  )
}

/**
 * How far the reading reaches, as one button per value.
 *
 * The VALUES are the format's closed list (`@olai/format`'s `HOPS`), read
 * rather than written out — a third horizon added where the reading lives is
 * a control that has it.
 */
function Horizon(props: { readonly hops: Hops }) {
  const nav = navigationHeld.read
  return (
    <div data-testid={TESTID.graphHorizon} data-hops={String(props.hops)}>
      <Segmented
        choices={HOPS.map((hops) => ({
          value: String(hops) as "1" | "2",
          label: hops === 1 ? "1 hop" : `${hops} hops`,
        }))}
        value={String(props.hops) as "1" | "2"}
        onPick={(picked) => {
          const asked = HOPS.find((one) => String(one) === picked)
          if (asked === undefined) return
          // A jump is a PUSH, so Back undoes it — and the way there goes
          // through the grammar, read back off the pane's own route rather
          // than re-derived from the buttons.
          const current = nav()?.route()
          const page = current === undefined ? undefined : graph.value(current) ?? undefined
          if (page === undefined || page.around === null) return
          nav()?.go(graph.to({ around: page.around, hops: asked }))
        }}
      />
    </div>
  )
}

/**
 * What the four lines mean, out of the one table that says how each is drawn
 * (`./look.ts`) — never four rows of colour picked by hand.
 *
 * The rear dot shapes, said once: a NODE is a circle, a DOCUMENT is a square
 * — the two grains read at a glance.
 */
function Legend() {
  return (
    <ul
      class="mt-2 flex shrink-0 list-none flex-wrap gap-4 p-0 text-xs text-muted"
      data-testid={TESTID.graphLegend}
    >
      <For each={EDGE_LOOKS}>
        {(look) => (
          <li class="flex items-center gap-2" data-way={look.way}>
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
              one writes that it <span class="text-ink">{look.label}</span> the one
              it points at
            </span>
          </li>
        )}
      </For>
      <li class="flex items-center gap-2" data-kind="node">
        <svg viewBox="0 0 32 12" class="h-2.5 w-8 shrink-0" aria-hidden="true">
          <circle cx="6" cy="6" r="4" class="fill-ink" />
        </svg>
        <span>a node</span>
      </li>
      <li class="flex items-center gap-2" data-kind="document">
        <svg viewBox="0 0 32 12" class="h-2.5 w-8 shrink-0" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" class="fill-ink" />
        </svg>
        <span>a file somebody's words point at</span>
      </li>
    </ul>
  )
}
