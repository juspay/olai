/**
 * WHICH TABS WEAR THE NEEDS-YOU DOT — a reading over chat's roster, handed to
 * the set for as long as the `attention` component is active.
 *
 * A tab wears it when any pane of its workspace is a page a conversation that
 * needs you is about, by chat's own predicate (`isCurrent`). It is a dot and
 * nothing more: no tab comes forward because of it. Without the chat row the
 * component waits and no tab wears one.
 *
 * `needs-you` ONLY, where the sidebar's Needs you section also lists `gone`: a
 * dot on a tab says the page there is waiting on an answer, and an agent that
 * is not running asks nothing of the page it is on.
 */
import { keyArray } from "@solid-primitives/keyed"
import { type Accessor, createMemo } from "solid-js"

import { type Attention, isCurrent, NEEDS_YOU_DOT } from "olai-plugin-chat/attention"
import type { Routing } from "olai-plugin-navigation/routes"
import { panesOf, workspaceOf } from "olai-plugin-navigation/workspace"

import type { Dots, Tab } from "./contract.ts"

export const needingYou = (
  chat: Attention,
  routes: Routing,
  tabs: Accessor<ReadonlyArray<Tab>>,
): Dots => {
  const waiting = createMemo(() => chat.agents.rows().filter(row => row.standing === "needs-you"))
  const active = createMemo(() => waiting().length > 0)
  const parsed = keyArray(tabs, tab => tab.id, tab => {
    const id = tab().id
    const href = createMemo(() => tab().href)
    const panes = createMemo(() => active() ? panesOf(workspaceOf(routes, href())) : [])
    return { id, panes }
  })
  return ({
  paint: NEEDS_YOU_DOT,
  ids: createMemo(() => {
    if (!active()) return new Set<string>()
    return new Set(parsed().filter((tab) => tab.panes().some(({ route }) =>
      waiting().some((row) => isCurrent(route, row, chat.folding.unfolded(row.id))))).map((tab) => tab.id))
  }),
})
}
