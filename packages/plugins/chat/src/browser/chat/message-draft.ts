/** Unsent words belong to a conversation in this tab. All its mounted
 * composers share the same draft; closing the last reader keeps the draft
 * without keeping a subscription. The chat activation owns this memory. */
import { createMemo, createSignal, type Accessor } from "solid-js"

interface Draft {
  readonly retry: boolean
  readonly text: string
  readonly taken: ReadonlySet<string>
  readonly caret: number
  readonly dismissed: string | null
}
const empty = (): Draft => ({ retry: false, text: "", taken: new Set(), caret: 0, dismissed: null })
const bin = () => createSignal<Draft>(empty())
export const createMessageMemory = () => new Map<string, ReturnType<typeof bin>>()

/** A plain page's opening gesture can outlive its plain composer. Transfer
 * those words into the resulting conversation without mounting another Chat. */
export const keepMessage = (memory: ReturnType<typeof createMessageMemory>, key: string, text: string, retry = false) => {
  if (text === "") return
  let value = memory.get(key)
  if (value === undefined) { value = bin(); memory.set(key, value) }
  value[1](before => {
    const words = before.text === "" ? text : `${text}\n${before.text}`
    return { ...before, text: words, caret: words.length, retry: before.retry || retry }
  })
}

const restored = (failed: Draft, current: Draft): Draft => {
  if (current.text === "") return { ...failed, retry: true }
  const text = failed.text === "" ? current.text : `${failed.text}\n${current.text}`
  return { retry: true, text, taken: new Set([...failed.taken, ...current.taken]), caret: text.length, dismissed: null }
}

export const createMessageDraft = (conversation: Accessor<string | null>, memory: ReturnType<typeof createMessageMemory>) => {
  const initial = bin()
  let previous = initial
  let first = true
  const current = createMemo(() => {
    const key = conversation()
    // A reconnect is not a change of conversation. Words typed before the
    // initial identity arrives belong to that first conversation.
    if (key === null) return previous
    let value = memory.get(key)
    if (value === undefined) {
      value = first ? initial : bin()
      memory.set(key, value)
    }
    first = false
    previous = value
    return value
  })
  const field = <K extends keyof Draft>(key: K) => (next: Draft[K] | ((before: Draft[K]) => Draft[K])) => {
    let answer!: Draft[K]
    current()[1](before => {
      answer = typeof next === "function" ? next(before[key]) : next
      return { ...before, [key]: answer }
    })
    return answer
  }
  const recover = () => {
    const owner = current()
    const failed = owner[0]()
    return () => owner[1](now => restored(failed, now))
  }
  return {
    draft: () => current()[0]().text, setDraft: field("text"),
    retry: () => current()[0]().retry, setRetry: field("retry"),
    taken: () => current()[0]().taken, setTaken: field("taken"),
    caret: () => current()[0]().caret, setCaret: field("caret"),
    dismissed: () => current()[0]().dismissed, setDismissed: field("dismissed"),
    recover,
  }
}
