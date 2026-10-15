/**
 * WHICH TABS WEAR A MARK — two readings over chat's roster, handed to the set
 * for as long as the `attention` component is active.
 *
 * A tab is caught by a mark when any pane of its workspace is a page the fact
 * is about, by chat's own predicate (`isCurrent`): a conversation waiting on an
 * answer wears the needs-you dot, and one whose agent has said something nobody
 * has read wears the muted one. The second is the quieter mark on purpose — a
 * question is asking you for something and a finished turn is only news — and
 * where a conversation is both, the needs-you dot wins, which is
 * `contract.ts`'s `Dots.rank` rather than a registration order.
 *
 * It is a dot and nothing more: no tab comes forward because of either. Without
 * the chat row the component waits and no tab wears one.
 *
 * `needs-you` is the standing the first of the two reads, where the sidebar's
 * Needs you section also lists `gone`: a dot on a tab says the page there is
 * waiting on an answer, and an agent that is not running asks nothing of the
 * page it is on.
 */
import { keyArray } from "@solid-primitives/keyed"
import { type Accessor, createMemo } from "solid-js"

import { type Attention, type AttentionRow, isCurrent, NEEDS_YOU_DOT, UNREAD_DOT } from "olai-plugin-chat/attention"
import type { Routing } from "olai-plugin-navigation/routes"
import { panesOf, workspaceOf } from "olai-plugin-navigation/workspace"

import type { Dots, Tab } from "./contract.ts"

/**
 * ONE MARK, wired: the rows it is about, the look it is drawn with, and the
 * per-tab walk that decides which tabs are showing one of them.
 *
 * THE WALK IS SHARED because the two readings differ in exactly two things —
 * which rows they are over, and how the mark looks — and a second copy of the
 * parse-and-match would be a second place the "this page is that conversation"
 * rule could drift from `isCurrent`. `active` gates the parse: with no row to
 * be about, no tab's address is read at all.
 */
const wearing = (
  rows: Accessor<ReadonlyArray<AttentionRow>>,
  unfolded: (node: string) => boolean,
  routes: Routing,
  tabs: Accessor<ReadonlyArray<Tab>>,
  mark: Pick<Dots, "paint" | "label" | "rank">,
): Dots => {
  const active = createMemo(() => rows().length > 0)
  const parsed = keyArray(tabs, tab => tab.id, tab => {
    const id = tab().id
    const href = createMemo(() => tab().href)
    const panes = createMemo(() => active() ? panesOf(workspaceOf(routes, href())) : [])
    return { id, panes }
  })
  return ({
    ...mark,
    ids: createMemo(() => {
      if (!active()) return new Set<string>()
      return new Set(parsed().filter((tab) => tab.panes().some(({ route }) =>
        rows().some((row) => isCurrent(route, row, unfolded(row.id))))).map((tab) => tab.id))
    }),
  })
}

/** The conversations that are WAITING ON AN ANSWER, and the tabs showing one. */
export const needingYou = (
  chat: Attention,
  routes: Routing,
  tabs: Accessor<ReadonlyArray<Tab>>,
): Dots =>
  wearing(
    createMemo(() => chat.agents.rows().filter(row => row.standing === "needs-you")),
    chat.folding.unfolded,
    routes,
    tabs,
    { paint: NEEDS_YOU_DOT, label: "Needs you", rank: 2 },
  )

/**
 * ... AND THE ONES SOMETHING HAS BEEN SAID IN SINCE ANYBODY LOOKED — chat's
 * `unread` read straight off the roster row, where the two instants were
 * compared once (`olai-plugin-chat`'s `unreadOf`).
 */
export const unreadIn = (
  chat: Attention,
  routes: Routing,
  tabs: Accessor<ReadonlyArray<Tab>>,
): Dots =>
  wearing(
    createMemo(() => chat.agents.rows().filter(row => row.unread)),
    chat.folding.unfolded,
    routes,
    tabs,
    { paint: UNREAD_DOT, label: "Unread", rank: 1 },
  )
