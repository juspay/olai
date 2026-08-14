/**
 * A labelled row of links to other nodes — what one of a node's EDGES looks
 * like when it is drawn out rather than hinted at.
 *
 * Two relations are drawn this way so far and they are one shape: the free
 * cross-references a node carries and what it is waiting on — both `see` and
 * `after` through ./edges/EdgeRefs.tsx, and the DERIVED `blocked by`
 * through ./Blocked.tsx. Same reason `NodeLine` and `NodeBody` are one
 * place each — the second copy of a sequence like this is where the two start
 * disagreeing about the touch target, the wrap, or which element carries the
 * target id, with both still compiling and one browser test noticing.
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

import { NodeTitle } from "./NodeTitle.tsx"
import { Link } from "./router.tsx"
import { type TestId, TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"

/** One target, already resolved: the id a link opens and the text it shows.
 *  Resolving is the caller's, because what an edge NAMES is a question about
 *  the set (`@olai/format`'s `nodeNamed`) rather than about this row. */
export interface NodeRef {
  readonly id: string
  readonly title: string
  /** Outline the title is written in — handed to {@link NodeTitle} for the
   *  markdown pipeline. Empty when the title is a fallback id with no prose. */
  readonly from: string
}

export function NodeRefs(props: {
  /** What the relation is called, in the reader's words: `see`, `blocked by`. */
  readonly label: string
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
            updating. Keyed by the id, which is what a ref IS. */}
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
                  has ever shipped, and the two mean opposite things here. */}
              <Show when={props.onRemove}>
                {(remove) => (
                  <button
                    type="button"
                    class="cursor-pointer border-0 bg-transparent p-0 text-xs leading-none text-muted hover:text-alarm"
                    data-testid={TESTID.refDrop}
                    data-ref={ref().id}
                    aria-label={`stop this node's \`${props.label}\` naming ${ref().title}`}
                    title={`remove ${ref().title}`}
                    onClick={(event) => {
                      // The row it hangs off is a link and, in a tree, a row
                      // that opens an editor on a click. This press is neither.
                      event.preventDefault()
                      event.stopPropagation()
                      remove()(ref().id)
                    }}
                  >
                    ×
                  </button>
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
   *  element refs and would swallow it, which it did — a link to `/n/undefined`
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
      route={{ kind: "node", id: props.to.id }}
      class={props.class}
      testid={props.testid}
      title={props.title ?? `open ${props.to.title}`}
    >
      <span data-ref={props.to.id}>{props.children}</span>
    </Link>
  )
}
