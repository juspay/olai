import { type Accessor, createComputed, createSignal, mapArray, onCleanup, untrack } from "solid-js"

import { createRanking } from "./ranking.ts"
import type { Chat } from "./state.ts"
import type { ChatEntry } from "olai-plugin-chat/wire"
export type Pick<T> = (row: ChatEntry, at: Accessor<ChatEntry | undefined>) => T | undefined

export const createNewest = <T>(chat: Chat, pick: Pick<T>): Accessor<T | undefined> => {
  const ranked = createRanking<T>()
  const [newest, setNewest] = createSignal<T>()
  const publish = () => setNewest(() => ranked.top())
  const rows = mapArray(chat.rows, (key, position) => {
    const at = chat.entry(key)
    createComputed(() => {
      const row = untrack(at)
      if (row === undefined) at()
      const value = row === undefined ? undefined : pick(row, at)
      if (value === undefined || row === undefined) ranked.drop(key)
      else ranked.put(key, row.seq, position(), value)
      publish()
    })
    onCleanup(() => { ranked.drop(key); publish() })
  })
  createComputed(rows)
  return newest
}
