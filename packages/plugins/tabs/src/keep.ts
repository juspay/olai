/** Every tab owns its conversations, including the front tab during switches.
 * Chat decides which of these are live and owns the actual wire subscriptions. */
import { type Accessor, createMemo } from "solid-js"
import { type Attention, isCurrent } from "olai-plugin-chat/attention"
import type { Routing } from "olai-plugin-navigation/routes"
import { panesOf, workspaceOf } from "olai-plugin-navigation/workspace"
import type { Tab } from "./contract.ts"

export const keptChats = (
  chat: Attention,
  routes: Routing,
  tabs: Accessor<ReadonlyArray<Tab>>,
): Accessor<ReadonlySet<string>> => createMemo(() => {
  const panes = tabs().flatMap(tab => panesOf(workspaceOf(routes, tab.href)))
  return new Set(chat.agents.rows().filter(row =>
    panes.some(({ route }) => isCurrent(route, row, chat.folding.unfolded(row.id))))
    .map(row => row.id))
})
