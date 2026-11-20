import { keyArray } from "@solid-primitives/keyed"
import { type Accessor, createMemo } from "solid-js"

import { type Attention, type AttentionRow, NEEDS_YOU_DOT, UNREAD_DOT } from "olai-plugin-chat/attention"
import type { Routing } from "olai-plugin-navigation/routes"
import { panesOf, workspaceOf } from "olai-plugin-navigation/workspace"

import type { Dots, Mark, Tab } from "./contract.ts"

export const marksOver = (
  chat: Attention,
  routes: Routing,
  tabs: Accessor<ReadonlyArray<Tab>>,
): ReadonlyArray<Dots> => {
  const rows = chat.agents.rows
  const marks: ReadonlyArray<Mark & { readonly about: (row: AttentionRow) => boolean }> = [
    { about: row => row.standing === "needs-you", paint: NEEDS_YOU_DOT, label: "Needs you", rank: 2 },
    { about: row => row.unread, paint: UNREAD_DOT, label: "Unread", rank: 1 },
  ]
  const active = createMemo(() => rows().some(row => marks.some(({ about }) => about(row))))
  const parsed = keyArray(tabs, tab => tab.id, tab => {
    const id = tab().id
    const href = createMemo(() => tab().href)
    const panes = createMemo(() => active() ? panesOf(workspaceOf(routes, href())) : [])
    return { id, panes }
  })

  const wearing = (about: (row: AttentionRow) => boolean, mark: Mark): Dots => ({
    ...mark,
    ids: createMemo(() => {
      const mine = rows().filter(about)
      if (mine.length === 0) return new Set<string>()
      return new Set(parsed().filter((tab) => tab.panes().some(({ route }) =>
        mine.some((row) => chat.isCurrent(route, row)))).map((tab) => tab.id))
    }),
  })

  return marks.map(({ about, ...mark }) => wearing(about, mark))
}
