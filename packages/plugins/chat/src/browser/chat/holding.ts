import type { Attached } from "olai-plugin-chat/wire"
import { type Accessor, createMemo, createSignal } from "solid-js"

import { refusalFor } from "./attach.ts"
import type { Chat } from "./state.ts"

export interface Sorted {
  readonly taking: ReadonlyArray<File>
  readonly refusals: ReadonlyArray<string>
}

export const sorting = (files: ReadonlyArray<File>): Sorted => {
  const taking: Array<File> = []
  const refusals: Array<string> = []
  for (const file of files) {
    const rejection = refusalFor(file)
    if (rejection === null) taking.push(file)
    else refusals.push(rejection)
  }
  return { taking, refusals }
}

export interface Holding {
  readonly pending: Accessor<ReadonlyArray<Attached>>
  readonly sending: Accessor<number>
  readonly progress: Accessor<number>
  readonly take: (files: ReadonlyArray<File>) => Promise<void>
  readonly remove: (name: string) => void
  readonly release: () => ReadonlyArray<Attached>
  readonly restore: (scope: string | null, attachments: ReadonlyArray<Attached>) => void
}

const bin = () => {
  const [pending, setPending] = createSignal<ReadonlyArray<Attached>>([])
  const [uploads, setUploads] = createSignal<ReadonlyMap<symbol, { bytes: number; total: number }>>(new Map())
  const track = (token: symbol, bytes: number, total: number) =>
    setUploads(now => new Map(now).set(token, { bytes, total }))
  const finish = (tokens: ReadonlyArray<symbol>) => setUploads(now => {
    const next = new Map(now)
    for (const token of tokens) next.delete(token)
    return next
  })
  const sending = () => uploads().size
  const progress = () => {
    let bytes = 0
    let total = 0
    for (const upload of uploads().values()) {
      bytes += upload.bytes
      total += upload.total
    }
    return total === 0 ? 0 : Math.floor(bytes / total * 100)
  }
  return { pending, setPending, sending, progress, track, finish }
}
export const createHoldingMemory = () => new Map<string, ReturnType<typeof bin>>()

export const createHolding = (chat: Chat): Holding => {
  const held = chat.ui.holding
  const empty = bin()
  const current = createMemo(() => {
    const scope = chat.state().uploadScope
    if (scope == null) return empty
    let value = held.get(scope)
    if (value === undefined) {
      value = bin()
      held.set(scope, value)
    }
    return value
  })

  return {
    pending: () => current().pending(),
    sending: () => current().sending(),
    progress: () => current().progress(),
    take: async (files) => {
      const owner = current()
      const scope = chat.state().uploadScope
      const { taking, refusals } = sorting(files)
      const reasons = [...refusals]
      chat.refuse([])
      const uploads = taking.map(file => {
        const token = Symbol()
        owner.track(token, 0, file.size)
        return { file, token }
      })
      try {
        for (const { file, token } of uploads) {
          if (chat.state().uploadScope !== scope) break
          const answer = await chat.attach(file, bytes => owner.track(token, bytes, file.size))
          owner.finish([token])
          if (answer._tag === "refused") reasons.push(answer.failure.reason)
          if (answer._tag !== "stored") continue
          owner.setPending((already) => [...already, answer.stored])
        }
      } finally {
        owner.finish(uploads.map(({ token }) => token))
      }
      if (chat.state().uploadScope === scope) chat.refuse(reasons)
    },
    remove: (name) =>
      current().setPending((already) => already.filter((attachment) => attachment.name !== name)),
    release: () => {
      const owner = current()
      const attachments = owner.pending()
      owner.setPending([])
      return attachments
    },
    restore: (scope, attachments) => {
      if (scope === null) return
      held.get(scope)?.setPending((now) => [
        ...attachments.filter((file) => !now.some((later) => later.path === file.path)),
        ...now,
      ])
    },
  }
}
