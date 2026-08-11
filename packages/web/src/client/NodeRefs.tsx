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
 */

import { For } from "solid-js"

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
    <div
      class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
      data-testid={props.testid}
    >
      <span class="text-muted">{props.label}</span>
      <For each={props.refs}>
        {(ref) => (
          <Link
            route={{ kind: "node", id: ref.id }}
            class={`inline-flex ${TARGET} items-center text-accent no-underline hover:underline md:min-h-0`}
            testid={TESTID.nodeRef}
            title={`open ${ref.title}`}
          >
            <span data-ref={ref.id}>{ref.title}</span>
          </Link>
        )}
      </For>
    </div>
  )
}
