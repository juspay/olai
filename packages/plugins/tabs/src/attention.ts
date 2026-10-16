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
 *
 * ## ONE WALK, TWO MARKS, and why that is the whole shape here
 *
 * The two readings differ in exactly two things — which rows they are over, and
 * how the mark looks — and everything expensive is shared: a tab's address is
 * PARSED once, and every mark filters over that one parse. Two walks would mean
 * two `panesOf(workspaceOf(…))` memos per tab, and the second would re-parse an
 * address the first had already parsed — which is the discipline
 * `./attention.browsertest.ts` counts, and the thing that keeps a tab's badge
 * from costing a workspace walk per frame.
 */
import { keyArray } from "@solid-primitives/keyed"
import { type Accessor, createMemo } from "solid-js"

import { type Attention, type AttentionRow, isCurrent, NEEDS_YOU_DOT, UNREAD_DOT } from "olai-plugin-chat/attention"
import type { Routing } from "olai-plugin-navigation/routes"
import { panesOf, workspaceOf } from "olai-plugin-navigation/workspace"

import type { Dots, Mark, Tab } from "./contract.ts"

/**
 * THE MARKS A TAB CAN WEAR, over one walk of the strip.
 *
 * `active` gates the walk on there being a ROW SOME MARK IS ABOUT — a directory
 * whose agents are all idle and read parses no address at all — and each mark
 * then filters the rows it is about out of the roster it already holds. `parsed`
 * is the shared half: one memo per tab, rebuilt only when that tab's own address
 * changes.
 */
export const marksOver = (
  chat: Attention,
  routes: Routing,
  tabs: Accessor<ReadonlyArray<Tab>>,
): ReadonlyArray<Dots> => {
  const rows = chat.agents.rows
  /** EVERY MARK, and the rows it is about — ONE table, because the walk's gate
   *  and the readings are both derived from it: a third mark cannot arrive
   *  without the gate widening with it, and cannot arrive with a look that no
   *  reading draws. */
  const marks: ReadonlyArray<Mark & { readonly about: (row: AttentionRow) => boolean }> = [
    { about: row => row.standing === "needs-you", paint: NEEDS_YOU_DOT, label: "Needs you", rank: 2 },
    { about: row => row.unread, paint: UNREAD_DOT, label: "Unread", rank: 1 },
  ]
  /** Whether anything is on a tab at all: with no such row, NO tab's address is
   *  read — which is every directory whose agents are idle and read. The parse
   *  is gated HERE rather than in each mark, which is why the guards below only
   *  have to answer *is this tab showing one of MY rows*. */
  const active = createMemo(() => rows().some(row => marks.some(({ about }) => about(row))))
  const parsed = keyArray(tabs, tab => tab.id, tab => {
    const id = tab().id
    const href = createMemo(() => tab().href)
    const panes = createMemo(() => active() ? panesOf(workspaceOf(routes, href())) : [])
    return { id, panes }
  })

  /** One mark, wired to the walk: the tabs showing one of the rows it is about. */
  const wearing = (about: (row: AttentionRow) => boolean, mark: Mark): Dots => ({
    ...mark,
    ids: createMemo(() => {
      const mine = rows().filter(about)
      if (mine.length === 0) return new Set<string>()
      return new Set(parsed().filter((tab) => tab.panes().some(({ route }) =>
        mine.some((row) => isCurrent(route, row, chat.folding.unfolded(row.id))))).map((tab) => tab.id))
    }),
  })

  return marks.map(({ about, ...mark }) => wearing(about, mark))
}
