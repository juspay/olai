import { type Accessor, createMemo } from "solid-js"

import { client } from "./client.ts"

export const createInboxCount = (): Accessor<number | undefined> => {
  const cell = client().cells.inbox.use()
  return createMemo(() => cell.value()?.count)
}
