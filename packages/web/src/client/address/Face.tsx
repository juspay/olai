/**
 * AN ADDRESS, DRAWN AS THE PAGE IT NAMES — the one face, wherever a title
 * turns out to be one.
 *
 * Two surfaces draw it and they are the reason it is a component rather than a
 * string: the sidebar's pinned shelf, where every row is an address
 * (`../pins/Pin.tsx`), and an ORDINARY OUTLINE ROW whose title is one
 * (`../NodeTitle.tsx`). The second arrived from the maintainer opening
 * `Pins.org` — which the design invites, since the shelf is an ordinary file —
 * and finding a bullet reading `/orchestrator/instructions.md`. The shelf
 * resolved its rows and the page did not, which is one title with two answers.
 *
 * SO THE RESOLUTION IS NOT A PROPERTY OF THE PAGE. It is a property of the
 * TITLE, and both callers hand this the same two facts — the route, and what
 * that address is called — and get the same three things back: the mark, the
 * name, and the query when there is one.
 *
 * ## The name: written, or read off the set — and asked by the CALLER
 *
 * A title spelled as a bare address has no name in it, so the set is asked and
 * the answer is live: rename the node anywhere and every face drawn from that
 * address says the new name on the next frame, because nothing stored a copy.
 * A title spelled as one markdown link carries a name somebody CHOSE, and that
 * one wins — it is authored rather than derived, so nothing can disagree with
 * it later (human, 2026-08-19: renaming a pin is editing the row's text, and
 * that is the whole of the feature — no op, no field).
 *
 * WHO ASKS is the caller, and that is the one thing this component stopped
 * doing when the shelf moved to the server (`vault-in-browser`'s PR 5): the
 * SHELF's name comes off the wire, resolved where the set is, and an ORDINARY
 * ROW's is still asked of the page's own reading. Both go through the one
 * switch that decides what an address is called (`./address.ts`'s `nameOf`), so
 * there is still exactly one answer per title — it is now reachable from either
 * side of a wire, which is a resolution this component could not have held.
 *
 * IT IS DRAWN AS THE WORDS THEY CHOSE, and that is the decision behind the
 * plainest line of code here: the label is text, not markdown. A `#home` in it
 * stays the characters `#home` rather than becoming a tag pill, because the
 * label is a NAME for a door and not prose the tag vocabulary indexes — the
 * human chose those words, and a face that restyled part of them would be
 * making a claim about the directory out of somebody's punctuation.
 *
 * THE QUERY IS DRAWN EITHER WAY, which is the other half of that answer: a
 * name renames the PIN and never the destination, and a door onto a narrowed
 * page that did not say so would be promising something it does not open. So
 * `[Overdue](/agenda?q=is%3Atodo)` reads *Overdue* with `is:todo` beside it.
 *
 * ## Pressable only where it was written as a link
 *
 * A face is an anchor exactly when the title was a LINK and the caller allows
 * one. The ruling is that pressing a named pin opens its address, and a link is
 * what somebody wrote — so it goes on being one. A BARE address is left as it
 * was: not a link, so a click there is the row's own (which opens the editor,
 * where the address is what you see and edit). That split is also what keeps
 * a title editable at all — a face that swallowed every click would make a pin
 * the one row in an outline nobody could rename.
 *
 * `pressable` is the CALLER's, because two of them may not hold an anchor at
 * all: the shelf's row is already a `<Link>`, and a breadcrumb or a `see`
 * reference draws a title inside one — which is the same fact `NodeTitle`'s
 * `links` prop has always carried for markdown. It carries the WHOLE of that
 * question now, authored-ness included: the caller is the one that knows
 * whether the name it just handed over is a name somebody wrote or one the
 * address answered for itself.
 */

import { Show } from "solid-js"

import { filterOf, hrefOf, type Route } from "../routes.ts"
import { TESTID } from "../testids.ts"

export function Face(props: {
  readonly route: Route
  /** What this address is CALLED — the name somebody wrote on it, or what the
   *  address itself is called (`./address.ts`'s `nameOf`). Resolved by the
   *  caller, because the two callers learn it from opposite sides of the wire. */
  readonly name: string
  /** Draw the name as an anchor to its address. Only a caller holding an
   *  AUTHORED name ever says true — a bare address is left as it was, so a
   *  click there is the row's own — and one already inside a link says no
   *  whatever the title said. */
  readonly pressable?: boolean
}) {
  return (
    <>
      <Mark />
      <Show
        when={props.pressable === true}
        fallback={
          <span class="min-w-0 flex-1 truncate" data-testid={TESTID.addressName}>
            {props.name}
          </span>
        }
      >
        {/* A plain `<a>` rather than a `<Link>`: the press is answered by the
            pane's delegated listener, which is what already turns a written
            link into a navigation and gives Alt+click its split for free
            (`../router.tsx`'s `followed`, `../pane/PageView.tsx`). A `<Link>`
            here would be a second answer to the same click. */}
        <a
          href={hrefOf(props.route)}
          class="min-w-0 flex-1 truncate underline decoration-rule underline-offset-2 hover:decoration-accent"
          data-testid={TESTID.addressName}
        >
          {props.name}
        </a>
      </Show>
      <Show when={filterOf(props.route) !== ""}>
        {/* INHERITS the row's ink, and that is the visibility: `text-muted`
            is contrast-tested on paper, desk, panel, pill — never on the
            sidebar's ink, which is where a pin actually sits. A long query
            used to be `shrink-0` as well, so `created:yesterday..today`
            took the row and left the name as `c…`. It can shrink now, and
            the full query rides `title` for the half that does not fit. */}
        <span
          class="min-w-0 max-w-[55%] truncate rounded bg-current/15 px-1 font-mono text-[0.65rem]"
          data-testid={TESTID.addressFilter}
          title={filterOf(props.route)}
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
