/**
 * AN ADDRESS, DRAWN AS THE PAGE IT NAMES — the one face, wherever a title
 * turns out to be one.
 *
 * Two surfaces draw it and they are the reason it is a component rather than a
 * string: the sidebar's pinned shelf, where every row is an address
 * (`../pins/Pin.tsx`), and an ORDINARY OUTLINE ROW whose title is nothing but
 * one (`../NodeTitle.tsx`). The second arrived from the maintainer opening
 * `Pins.olai` — which the design invites, since the shelf is an ordinary file —
 * and finding a bullet reading `/doc/orchestrator/instructions.md`. The shelf
 * resolved its rows and the page did not, which is one title with two answers.
 *
 * SO THE RESOLUTION IS NOT A PROPERTY OF THE PAGE. It is a property of the
 * TITLE, and both callers hand this the same two facts — the route, and the
 * name somebody wrote on it if they wrote one — and get the same three things
 * back: the mark, the live name, and the query when there is one.
 *
 * NOT A LINK, deliberately, and it is the one thing this does not do. A title
 * is where the caret goes: a click on it opens the row's editor, which shows
 * the SOURCE — the address as it is stored — exactly as it does for markdown.
 * An anchor here would take that click away and make the pin the one row in
 * the outline that cannot be edited. It also could not be drawn at all in a
 * breadcrumb or a `see` reference, both of which draw a title INSIDE an anchor
 * already. Where a face IS a door, the door is the row around it (the shelf's
 * `<Link>`), which is the same division `../file/icons.tsx` keeps.
 */

import { Show } from "solid-js"

import { useDerived } from "../derived.tsx"
import { filterOf, type Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { nameOf } from "./address.ts"

export function Face(props: {
  readonly route: Route
  /** The name somebody GAVE this address, or `undefined` for the bare form —
   *  in which case the set is asked. A name that was written is somebody's and
   *  wins; a name that is derived cannot go stale. */
  readonly named?: string | undefined
}) {
  const derived = useDerived()
  const name = () => props.named ?? nameOf(props.route, derived())

  return (
    <>
      <Mark />
      <span class="min-w-0 flex-1 truncate" data-testid={TESTID.addressName}>
        {name()}
      </span>
      <Show when={filterOf(props.route) !== ""}>
        {/* The query, as its own chip: an address that carries one opens a page
            WITH it, and a face that drew only the page's name would be
            promising something it does not open. Mono, because it is a query
            rather than prose. */}
        <span
          class="shrink-0 rounded bg-rule/60 px-1 font-mono text-[0.65rem] text-muted"
          data-testid={TESTID.addressFilter}
        >
          {filterOf(props.route)}
        </span>
      </Show>
    </>
  )
}

/** The mark an address wears — a pin, which is the one drawing in this app
 *  that is about a PLACE SOMEBODY KEEPS rather than about a kind of file, so it
 *  is here rather than in `../file/icons.tsx`'s table of directory kinds. Ours,
 *  drawn to that table's metrics (a 16-box, `currentColor`, the row's own ink)
 *  so the two read as one column. */
function Mark() {
  return (
    <svg
      viewBox="0 0 16 16"
      class="size-3.5 shrink-0"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.53 1.47a.75.75 0 0 0-1.28.53v.94L4.9 6.16a2.75 2.75 0 0 0-2.2.78.75.75 0 0 0 0 1.06l2.3 2.3-3.28 3.28a.75.75 0 1 0 1.06 1.06l3.28-3.28 2.3 2.3a.75.75 0 0 0 1.06 0 2.75 2.75 0 0 0 .78-2.2l3.22-3.35h.94a.75.75 0 0 0 .53-1.28l-5.46-5.46z" />
    </svg>
  )
}
