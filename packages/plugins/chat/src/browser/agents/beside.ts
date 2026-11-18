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
 * The pane that DRAWS is the leftmost one whose page is that chat — named,
 * rather than "any pane but mine", so that two panes on one chat page settle
 * on the same answer instead of each pointing at the other and neither
 * drawing anything.
 */

import { type AgentItem, itemKey } from "@olai/format"
import type { Route } from "olai-plugin-navigation/routes"

import { chatPage } from "./route.ts"

/** The pane whose page is this item's chat, or `null`. FIRST IN PANE ORDER:
 *  two panes on one chat is something a person can arrange by hand, and the
 *  leftmost of them is the one that draws the conversation and the one the
 *  others point at.
 *
 *  This is the answer a PRESS wants — go to where the chat already is,
 *  whichever pane that is, including the one pressing. */
export const drawnIn = (routes: ReadonlyArray<Route>, key: string): number | null => {
  const at = routes.findIndex((route) => {
    const item = chatPage.value(route)
    return item !== null && itemKey(item) === key
  })
  return at < 0 ? null : at
}

/** The pane drawing this item's chat as seen FROM pane `here`: the same pane
 *  as {@link drawnIn}, except that the pane which draws is told `null` — it
 *  draws the conversation rather than a sentence about its own column.
 *
 *  PURE, and in a file with no face in it, so the rule is a bun test over a
 *  list of routes rather than a mounted layout (`./ChatBeside.tsx` is where
 *  it is read for the pane a component is drawn in). */
export const besideIn = (routes: ReadonlyArray<Route>, key: string, here: number): number | null => {
  const at = drawnIn(routes, key)
  return at === null || at === here ? null : at
}

/** ...AND THE PANE SHOWING THE ITEM ITSELF — the note, or the node's own page
 *  (`./here.ts`'s `routeOfItem` is the address this recognises). FIRST IN
 *  PANE ORDER for {@link drawnIn}'s reason.
 *
 *  A *beside* press needs this as much as it needs the chat's pane: the pair
 *  it opens is the item and the conversation, so a press made while the item
 *  is already on screen must use THAT column rather than put a second copy of
 *  the note beside a chat that is already there (`./focus.ts`'s
 *  `chatTarget`).
 *
 *  A PLACE INSIDE THE ITEM STILL SHOWS IT: a heading of the note is the
 *  note's page, as the one reading of what a page is about says
 *  (`./here.ts`'s `itemHere`) — and a ROW address is its outline and not the
 *  row's page, which is why the kinds are named rather than the file
 *  compared. The claim table is not asked, because the caller already knows
 *  which of the two kinds this item is. */
export const shownIn = (routes: ReadonlyArray<Route>, item: AgentItem): number | null => {
  const at = routes.findIndex((route) => {
    if (route.kind !== "at" || route.address === null) return false
    const address = route.address
    if (item.kind === "node") return address.kind === "node" && address.id === item.id
    return (address.kind === "document" || address.kind === "heading") && address.path === item.path
  })
  return at < 0 ? null : at
}

