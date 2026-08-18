/**
 * The way from a node to its own neighbourhood.
 *
 * A control of its own on the zoomed page, for `../edges/EdgeVerbs.tsx`'s
 * reason: a zoom is a PAGE and the `•••` menu hangs off a ROW, so a heading has
 * nowhere to put a verb. The row's menu carries the same door
 * (`../menu/actions.ts`), which is the arrangement every other thing a row and
 * a page can both do already has.
 *
 * It sits under the `Referenced by …` section deliberately: that section is the
 * one place this app reads a reference BACKWARDS, and the graph is the same
 * relations read both ways at once. Reading one and then asking for the picture
 * is the gesture, so the door is where the reading ends.
 *
 * QUIET, and always drawn — like the edge verbs beside it, and unlike the
 * menu's list, where a verb that would change nothing is left out. There is
 * nothing to decide: every node has a neighbourhood, and one with nothing in it
 * is an answer the page gives in words (`./GraphPage.tsx`).
 */

import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"

export function GraphLink(props: { readonly id: string }) {
  return (
    <div class="mt-1 flex flex-wrap items-center gap-1">
      <Link
        route={{ kind: "graph", focus: props.id }}
        class={`${TARGET} md:min-h-0 inline-flex items-center rounded px-1.5 py-0.5 text-xs text-muted no-underline hover:bg-rule/50 hover:text-ink`}
        testid={TESTID.nodeGraphLink}
        label={`draw the reference graph around this node`}
      >
        Reference graph
      </Link>
    </div>
  )
}
