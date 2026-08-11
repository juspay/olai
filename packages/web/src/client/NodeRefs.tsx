/**
 * A labelled row of links to other nodes — what one of a node's EDGES looks
 * like when it is drawn out rather than hinted at.
 *
 * Two relations are drawn this way so far and they are one shape: the free
 * cross-references a node carries (`see`, ./SeeRefs.tsx) and what it is waiting
 * on (`after`, ./Blocked.tsx). Same reason `NodeLine` and `NodeBody` are one
 * place each — the second copy of a sequence like this is where the two start
 * disagreeing about the touch target, the wrap, or which element carries the
 * target id, with both still compiling and one browser test noticing.
 *
 * The LABEL and the container's testid are the caller's, because which relation
 * this is is exactly what differs; everything else — a link per target, the
 * target's title as its text, `data-ref` carrying the id it opens — is the
 * same claim whichever edge produced it. Titles change under a live page and
 * ids do not, so `data-ref` is what a scenario picks a link by.
 *
 * A row with nothing in it draws NOTHING, and that is decided here rather than
 * by each caller: an empty labelled row is not a thing any relation wants, and
 * a guard per caller is a guard the next one forgets.
 */

import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"

import { Link } from "./router.tsx"
import { type TestId, TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"

/** One target, already resolved: the id a link opens and the text it shows.
 *  Resolving is the caller's, because what an edge NAMES is a question about
 *  the set (`@olai/format`'s `nodeNamed`) rather than about this row. */
export interface NodeRef {
  readonly id: string
  readonly title: string
}

export function NodeRefs(props: {
  /** What the relation is called, in the reader's words: `see`, `blocked by`. */
  readonly label: string
  readonly refs: ReadonlyArray<NodeRef>
  /** What the whole row is, for the browser tests: `see-refs`, `blocked`. */
  readonly testid: TestId
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
            <NodeRefLink to={ref()} class={REF} testid={TESTID.nodeRef}>
              {ref().title}
            </NodeRefLink>
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
  readonly children: string
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
