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

/**
 * The strip these sit in, and the look of one quiet verb in it.
 *
 * EXPORTED because a zoomed node's header draws a SECOND one ten lines down —
 * the door to that node's reference graph (`../graph/GraphLink.tsx`) — and the
 * two are meant to read as one row of quiet words under the node's own lines.
 * They were two copies of these strings, so a change to the padding, the size
 * or the hover ink moved one and left the other, with nothing failing. Same
 * arrangement `../Breadcrumbs.tsx` has with `CRUMB`, for the same reason.
 *
 * What each caller keeps is its own ELEMENT RESET — a `<button>` needs
 * `border-0 bg-transparent cursor-pointer`, an `<a>` needs `no-underline` —
 * because that is a fact about the tag rather than about the look.
 */
export const VERB_STRIP = "mt-1 flex flex-wrap items-center gap-1"
export const QUIET_VERB =
  `${TARGET} md:min-h-0 inline-flex items-center rounded px-1.5 py-0.5 text-xs text-muted hover:bg-rule/50 hover:text-ink`

export function EdgeVerbs(props: {
  readonly open: (relation: Relation) => void
  /** Which panel is open, so the control that opened it can say so. `null` is
   *  none — the ordinary state of a page nobody is linking from. */
  readonly openFor: Relation | null
}) {
  return (
    <div class={VERB_STRIP}>
      <For each={RELATIONS}>
        {(one) => (
          <button
            type="button"
            class={`${QUIET_VERB} cursor-pointer border-0 bg-transparent`}
            data-testid={TESTID.edgeVerb}
            data-relation={one.relation}
            // `aria-expanded` and nothing beside it: whether this panel is up
            // is ONE fact, and the `data-` twin it had was a second spelling
            // of it that nothing read.
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
