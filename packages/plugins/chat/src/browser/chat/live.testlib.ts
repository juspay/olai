import { type Accessor, createRoot, createSignal } from "solid-js"

import type { ChatEntry } from "olai-plugin-chat/wire"
import type { Chat } from "./state.ts"

export const agentRow = (seq: number, text: string): ChatEntry =>
  ({ kind: "agent", seq, text } as unknown as ChatEntry)

export const userRow = (seq: number, text: string): ChatEntry =>
  ({ kind: "user", seq, text } as unknown as ChatEntry)

export const askRow = (
  seq: number,
  id: string,
  text: string,
  settled = false,
): ChatEntry =>
  ({
    kind: "ask",
    seq,
    id,
    text,
    ask: { fields: [], link: null, outcome: settled ? { how: "answered", answers: [] } : null },
  } as unknown as ChatEntry)

export interface Live<T> {
  readonly value: T
  readonly reads: () => number
  readonly stop: () => void
  readonly add: (key: string, entry: ChatEntry) => void
  readonly token: (key: string, entry: ChatEntry) => void
}

export const live = <T>(watch: (chat: Chat) => T): Live<T> => {
  const keysHeld: Array<string> = []
  const [keys, setKeys] = createSignal<ReadonlyArray<string>>(keysHeld)
  const rows = new Map<
    string,
    readonly [Accessor<ChatEntry | undefined>, (next: ChatEntry) => void]
  >()
  let reads = 0
  const chat = {
    rows: keys,
    entry: (key: string): Accessor<ChatEntry | undefined> => () => {
      reads += 1
      return rows.get(key)?.[0]()
    },
  } as unknown as Chat
  const [stop, value] = createRoot((dispose) => [dispose, watch(chat)] as const)
  return {
    value,
    reads: () => reads,
    stop,
    add: (key, entry) => {
      const [value, set] = createSignal<ChatEntry | undefined>(entry)
      rows.set(key, [value, set])
      keysHeld.push(key)
      setKeys([...keysHeld])
    },
    token: (key, entry) => rows.get(key)?.[1](entry),
  }
}
