/**
 * A labelled row of links to other nodes — what one of a node's EDGES looks
 * like when it is drawn out rather than hinted at.
 *
 * Three claims are drawn this way and they are one shape: the two edge FIELDS a
 * node carries — `see` and `after`, both through ./edges/EdgeRefs.tsx — and
 * what is DERIVED from the second of them, `blocked by` (./Blocked.tsx). Same
 * reason `NodeLine` and `NodeBody` are one place each — the second copy of a
 * sequence like this is where the two start disagreeing about the touch target,
 * the wrap, or which element carries the target id, with both still compiling
 * and one browser test noticing.
 *
 * The LABEL, the container's testid and WHETHER A TARGET CAN BE DROPPED are
 * the caller's, because which relation this is is exactly what differs — and
 * one of them is derived, so an `×` there would name no single edge
 * ({@link NodeRefs.onRemove}); everything else — a link per target, the
 * target's title as its text (via {@link NodeTitle}, so markdown and tags
 * match a tree row), `data-ref` carrying the id it opens — is the same claim
 * whichever edge produced it. Titles change under a live page and ids do not,
 * so `data-ref` is what a scenario picks a link by.
 *
 * A row with nothing in it draws NOTHING, and that is decided here rather than
 * by each caller: an empty labelled row is not a thing any relation wants, and
 * a guard per caller is a guard the next one forgets.
 */

import { Key } from "@solid-primitives/keyed"
import { type JSX, Show } from "solid-js"

import { DropRef } from "./edges/DropRef.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import type { NodeRef } from "./ref.ts"
import { Link } from "./router.tsx"
import { type TestId, TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"
import { atNode } from "./routes.ts"

export function NodeRefs(props: {
  /** What the relation is called, in the reader's words: `see`, `blocked by`. */
  readonly label: string
  /**
   * The targets, EACH ONCE — a link is keyed by the id it opens (below), so a
   * target named twice would be one element drawn twice and the page would die
   * on the next frame. It is the caller's to hand over a set because it is the
   * caller who knows what a repeat MEANS: the two writable fields are sets to
   * the ops layer, so `./edges/named.ts` reads them as one, and the derived
   * `blocked by` is one edge per blocker in the ordering graph itself
   * (`@olai/format`). Neither is this row's decision to make.
   */
  readonly refs: ReadonlyArray<NodeRef>
  /** What the whole row is, for the browser tests: `see-refs`, `blocked`. */
  readonly testid: TestId
  /**
   * Drop this target from the node's list — an `×` beside each link, and the
   * removal half of `parity-see` / `parity-after`.
   *
   * ABSENT is read-only, and that is a claim about the ROW rather than about
   * the reader: `blocked by` is DERIVED (`../Blocked.tsx`) — part of it can be
   * a `blocks` written on somebody else's record — so there is no single edge
   * an `×` there would name, and offering one would be an affordance that
   * silently did nothing for half the pills in it. What a person may remove is
   * what THIS node declares, which is what the `see` and `after` rows draw.
   * A read-only page (a day, the agenda) passes nothing for the same reason its
   * titles do not open an editor.
   */
  readonly onRemove?: (id: string) => void
}) {
  return (
    <Show when={props.refs.length > 0}>
      <div
        class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
        data-testid={props.testid}
      >
        <span class="text-muted">{props.label}</span>
        {/* `<Key>`, not `<For>`, for the reason the tree uses it (../Tree.tsx):
            the refs are minted fresh on every frame the store publishes, and
            `<For>` compares by reference — so every link's DOM would be torn
            down and rebuilt on each frame rather than the title binding
            updating. Keyed by the id, which is what a ref IS — honest exactly
            while each target appears once, which is what `refs` promises
            above and why that promise is written down there. */}
        <Key each={props.refs} by="id">
          {(ref) => (
            <span class="inline-flex items-baseline gap-0.5">
              <NodeRefLink to={ref()} class={REF} testid={TESTID.nodeRef}>
                {/* links=false: already inside Link — a markdown [a](url) in
                    the title must not nest a second <a>. */}
                <NodeTitle
                  title={ref().title}
                  from={ref().from}
                  links={false}
                />
              </NodeRefLink>
              {/* OUTSIDE the link, never inside it: a control nested in an
                  anchor is a press that also navigates on every engine that
                  has ever shipped, and the two mean opposite things here. What
                  it SAYS is `./edges/DropRef.tsx`'s, shared with the panel's
                  own × — two doors onto one op, named once. */}
              <Show when={props.onRemove}>
                {(remove) => (
                  <DropRef
                    testid={TESTID.refDrop}
                    relation={props.label}
                    id={ref().id}
                    title={ref().title}
                    onDrop={remove()}
                  />
                )}
              </Show>
            </span>
          )}
        </Key>
      </div>
    </Show>
  )
}

const REF =
  `inline-flex ${TARGET} items-center text-accent no-underline hover:underline md:min-h-0`

/**
 * One link from a node to another node: the address, and the `data-ref` that
 * says which node it opens.
 *
 * Its own component because a row is not the only shape this claim takes — the
 * blocked PILL is one link wearing different chrome (./Blocked.tsx) — and
 * "which element carries the target id" is exactly the thing two copies would
 * disagree about, with the browser tests selecting on it.
 */
export function NodeRefLink(props: {
  /** The node this link opens. NOT named `ref`: Solid reserves that prop for
   *  element refs and would swallow it, which it did — a link to `/#undefined`
   *  with no `data-ref` on it. */
  readonly to: NodeRef
  readonly class: string
  readonly testid: TestId
  /** The hover text. Defaults to what the link does, which is all a row's link
   *  has to say; a pill says what it is a pill ABOUT instead, because its own
   *  text is one word. */
  readonly title?: string
  /** What the link SAYS, which is the target's title in a row and the name of
   *  the relation on a pill. */
  readonly children: JSX.Element
}) {
  return (
    <Link
      route={atNode(props.to.id)}
      class={props.class}
      testid={props.testid}
      title={props.title ?? `open ${props.to.title}`}
    >
      <span data-ref={props.to.id}>{props.children}</span>
    </Link>
  )
}
