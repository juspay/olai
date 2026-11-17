/**
 * A CONVERSATION IS DRAWN ONCE.
 *
 * A chat has its own page now (`./route.ts`), and that page can be a pane
 * beside the thing it is about. The places that drew a conversation before it
 * had an address are all still there — the fold under a row, the foot of a
 * node's page, the seat under a note — and each of them would happily draw
 * the SAME conversation a column away from itself.
 *
 * Twice is not a cosmetic problem. A transcript is a thing somebody is
 * reading and a composer is a thing somebody is typing into: two of each means
 * a draft in the one that is not looked at, a scroll that jumps in the other
 * when the agent says something, and two faces racing to anchor the same
 * arriving row. So wherever a pane in this layout is already drawing an
 * item's chat, every other place says so in one line and focuses that pane
 * instead — the conversation itself stays where the person put it.
 *
 * WHICH PANE, as a pure function of the pane routes and the item key, so the
 * rule is a table (`./beside.test.ts`) rather than three components' guesses.
 * The reader's OWN pane is excluded, which is what makes the chat page itself
 * draw the conversation rather than a sentence about its own column.
 */

import { itemKey } from "@olai/format"
import type { Route } from "olai-plugin-navigation/routes"

import { chatPage } from "./route.ts"

/** The pane OTHER THAN `here` whose page is this item's chat, or `null`.
 *  First in pane order: two panes on one chat is something a person can
 *  arrange by hand, and the leftmost of them is the one the others point at.
 *
 *  PURE, and in a file with no face in it, so the rule is a bun test over a
 *  list of routes rather than a mounted layout (`./ChatBeside.tsx` is where
 *  it is read for the pane a component is drawn in). */
export const besideIn = (routes: ReadonlyArray<Route>, key: string, here: number): number | null => {
  const at = routes.findIndex((route, index) => {
    if (index === here) return false
    const item = chatPage.value(route)
    return item !== null && itemKey(item) === key
  })
  return at < 0 ? null : at
}

