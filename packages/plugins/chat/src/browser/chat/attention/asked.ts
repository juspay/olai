import { type Accessor } from "solid-js"

import { createNewest } from "../newest.ts"
import type { Chat } from "../state.ts"

export interface Asked {
  readonly id: string
  readonly text: string
}

export const createAsked = (chat: Chat): Accessor<Asked | undefined> => {
  const waiting = createNewest<Asked>(chat, (row, at) => {
    if (row.kind !== "ask") return undefined
    at()
    return row.ask.outcome === null ? { id: row.id, text: row.text } : undefined
  })

  return waiting
}
