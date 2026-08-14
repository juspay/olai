/**
 * The two edge verbs, drawn as controls — for the one place in this app that
 * has no `•••` to put them in.
 *
 * A zoomed node is a PAGE, and the row menu hangs off a ROW. That gap is the
 * whole reason the ⌘K palette grew op rows (`../palette/ops.ts`), and it is
 * also why those rows stop where a verb has a question to ask: `Set date…`
 * opens the row's own picker, and there is nothing on a page for a palette to
 * open. The two edge verbs are in that same class — each opens a panel — so
 * the honest door for them is here, beside the `see` and `after` rows they are
 * about, rather than in a modal that would have to grow a panel of its own.
 *
 * QUIET, because they are always drawn: every node can take an edge, so unlike
 * the menu's list (where a verb that would change nothing is left out) there is
 * nothing here to decide. They read as two words under the node's own lines
 * until one is pressed.
 *
 * The LABELS are the menu's, out of the one table (`./relation.ts`), so the two
 * doors onto this write cannot end up called different things.
 */

import { For } from "solid-js"

import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { type Relation, RELATIONS } from "./relation.ts"

export function EdgeVerbs(props: {
  readonly open: (relation: Relation) => void
  /** Which panel is open, so the control that opened it can say so. `null` is
   *  none — the ordinary state of a page nobody is linking from. */
  readonly openFor: Relation | null
}) {
  return (
    <div class="mt-1 flex flex-wrap items-center gap-1">
      <For each={RELATIONS}>
        {(one) => (
          <button
            type="button"
            class={`${TARGET} md:min-h-0 cursor-pointer rounded border-0 bg-transparent px-1.5 py-0.5 text-xs text-muted hover:bg-rule/50 hover:text-ink`}
            data-testid={TESTID.edgeVerb}
            data-relation={one.relation}
            data-open={props.openFor === one.relation ? "true" : "false"}
            aria-expanded={props.openFor === one.relation}
            onClick={() => props.open(one.relation)}
          >
            {one.verb}
          </button>
        )}
      </For>
    </div>
  )
}
