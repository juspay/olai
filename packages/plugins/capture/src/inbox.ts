import { type Accessor, createMemo } from "solid-js"

import { type InboxHeld, NO_INBOX } from "@olai/format"

import { client } from "./client.ts"

export const createInboxHeld = (): Accessor<InboxHeld> => {
  const cell = client().cells.inbox.use()
  return createMemo(() => {
    const held = cell.value()
    return held === undefined ? NO_INBOX : { count: held.count }
  })
}
