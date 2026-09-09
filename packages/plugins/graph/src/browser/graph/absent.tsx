/**
 * WHAT THE PAGE SAYS WHEN THERE IS NO PICTURE — one concept, apart from
 * `./GraphFace.tsx`'s picture machinery: the words of an absence change
 * with the format's rulings, never with the camera's.
 *
 * Three ways there is no picture, each its own sentence rather than a
 * shared "empty" template — because a sentence about the FILTER is not a
 * claim about the directory, and a centre that failed to resolve is a
 * different question from a picture that was withheld:
 *
 *   - {@link Empty}: the centre's refusal in `./zoom.ts`'s own judgements
 *     (`unknown`, `put-away`, `dangling`, `cycle`), or the whole reading
 *     held back over the ceiling;
 *   - {@link Edges0}: there IS a page, but no arrows run on it — nothing
 *     ever referred anywhere, the filter took every dot, or the centre
 *     both refers to nothing and is referred to by nothing, NAMED.
 */

import { type Address, GRAPH_DRAWN_AT_MOST, type Centre, printAddress } from "@olai/format"
import type { Shown, Vertex } from "@olai/format"
import { Show } from "solid-js"

import { Link } from "olai-plugin-navigation/routing"
import type { Drawn } from "olai-plugin-outlines/page"

import { TESTID } from "../../testids.ts"

/** The address in the sentence, said the way the URL would say it — ONE
 *  spelling, so a sentence and a link never say two names for one thing. */
export function NameOf(props: { readonly address: Address }) {
  return <code class="font-mono text-[0.8125rem]">{printAddress(props.address)}</code>
}

/**
 * The three things the page says instead of drawing an absent centre, and
 * the one it says when the picture is withheld.
 */
export function Empty(props: {
  readonly held: number
  readonly reason: Centre | undefined
}) {
  return (
    <div data-testid={TESTID.graphEmpty} data-reason={props.reason?.kind ?? "held"} class="py-6">
      <Show
        when={props.reason !== undefined}
        fallback={
          <p class="max-w-lg text-ink">
            The whole reference map of this directory is over the ceiling this
            page draws under — {props.held} vertices, against {" "}{GRAPH_DRAWN_AT_MOST} — so
            nothing is drawn: a partial picture of a directory is a sentence
            with a silent word missing. Narrowing THIS page cannot help —
            it has nothing on it — but a tighter circle does: open a
            NEIGHBOURHOOD — a row's ••• has "Reference graph", and the
            palette has the same page by name.
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

/** The sentences drawn where a picture would be — one per way "no edges"
 *  happens, each in the words of the arm the reader is in:
 *  - nothing ever referred anywhere (the open map, unfiltered);
 *  - the FILTER took everything — a sentence about the filter, never a
 *    claim about the directory (a head-counted picture stays a picture);
 *  - nothing refers to the centre, and it refers to nothing — the CENTRE
 *    NAMED, because a sentence reading "this one" is a sentence from the
 *    perspective nobody holds.
 */
export function Edges0(props: {
  readonly page: Extract<Shown, { readonly kind: "graph" }>
  readonly drawn: Pick<Extract<Drawn, { readonly kind: "graph" }>, "vertices">
  | undefined
}) {
  return (
    <p class="max-w-lg text-ink" data-testid={TESTID.graphEmpty} data-reason="no-edges">
      {props.page.around === null
        ? (props.drawn?.vertices.length ?? 0) === 0 && props.page.vertices.length > 0
          ? <>The filter took every dot on this map — say less, or clear it, to see the picture.</>
          : <>Nothing in this directory refers to anything yet — no node points at another with <code class="font-mono text-[0.8125rem]">see</code>, no outline is another record's <code class="font-mono text-[0.8125rem]">doc</code>, and no note names a vertex at all.</>
        : props.page.hops === 1
        ? <>Nothing refers to <NameTitle page={props.page} />, and it refers to nothing — no <code class="font-mono text-[0.8125rem]">see</code> written out and none pointed back.</>
        : <>Nothing refers to <NameTitle page={props.page} />, and it refers to nothing — not even two hops out.</>}
    </p>
  )
}

/** The centre's own name in a sentence — read off the most reliable name the
 *  page holds: the resolved centre's vertex first, the bare address print
 *  when there was none. */
function NameTitle(props: { readonly page: Extract<Shown, { readonly kind: "graph" }> }) {
  const around = () => props.page.around
  return around()?.kind === "vertex"
    ? <>{(around() as { kind: "vertex"; vertex: Vertex }).vertex.title}</>
    : null
}
