/**
 * PUT THE CARET IN THE ONE BOX — asked from outside the pane that draws it.
 *
 * Two doors ask, and neither of them is anywhere near a filter bar: the phone's
 * magnifier in the header (`../search/Magnifier.tsx`) and the ⌘K palette's
 * handoff row (`../palette/`). Both are the same gesture — *search*, from
 * somewhere that has no box of its own — and since the header's box was deleted
 * there is exactly one box for that gesture to mean
 * (docs/brainstorming/one-search-box.md).
 *
 * A COUNTER rather than a boolean, because what is being published is an EVENT
 * and a boolean would be a state somebody has to put back down: two presses in
 * a row are two asks, and a flag that was already `true` would answer the
 * second with nothing at all.
 *
 * WHICH BOX is not decided here, and that is why this is four lines rather than
 * a registry. A workspace can be split, so more than one bar may be on screen —
 * and the one that answers is the FOCUSED pane's, which is a fact each bar
 * already knows about itself (`../pane/PageView.tsx` hands it down). So the ask
 * is broadcast and the bars decide, exactly as a keyboard layer is claimed by
 * whichever surface is topmost rather than by a table of who is where.
 *
 * WHETHER THERE IS A BOX AT ALL is the CALLER's, deliberately: a document page
 * carries no `?q=` and so draws none (`../routes.ts`'s `narrowable`), and what
 * a magnifier should do there is go to `/search` rather than press a key into
 * nothing. That is a decision about where a reader lands, and it belongs where
 * the route is in hand.
 */

import { type Accessor, createSignal } from "solid-js"

const [asks, setAsks] = createSignal(0)

/** Ask the focused pane's filter box for the caret. */
export const focusFilter = (): void => {
  setAsks((many) => many + 1)
}

/** How many times it has been asked — what a bar watches. The value means
 *  nothing; that it MOVED is the whole message. */
export const filterFocusAsked: Accessor<number> = asks
