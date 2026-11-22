/** Unsent words belong to a conversation in this tab. All its mounted
 * composers share the same draft; closing the last reader keeps the draft
 * without keeping a subscription.
 *
 * TWO OWNERS, ONE FOR EACH LIFETIME. The chat activation owns the live draft
 * (the signals below, and the caret and dismissed token that are only about
 * the box on screen). The TAB owns the words: every write to a conversation's
 * draft is also written to this tab's `sessionStorage`, and a draft made for a
 * conversation that has none yet starts from what is kept there. Chat's
 * browser half is remounted whenever its row restarts — any chat setting
 * changed, chat switched off and on — and the activation's memory leaves with
 * it; the words a person typed, or a send the server refused, must not. A tab
 * whose storage refuses keeps the words for the activation only, as before. */
import { createMemo, createSignal, type Accessor, type Signal } from "solid-js"

interface Draft {
  readonly retry: boolean
  readonly text: string
  readonly taken: ReadonlySet<string>
  readonly caret: number
  readonly dismissed: string | null
}
const empty = (): Draft => ({ retry: false, text: "", taken: new Set(), caret: 0, dismissed: null })
type Bin = Signal<Draft>
const bin = (from: Draft = empty()): Bin => createSignal<Draft>(from)

/** Where the tab keeps unsent words: `sessionStorage`'s three verbs, or a
 *  stand-in a test hands over. */
export interface KeptWords {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
  readonly removeItem: (key: string) => void
}

/** This tab's storage, or `null` where there is none to reach. */
const tabWords = (): KeptWords | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage
  } catch {
    return null
  }
}

/** Namespaced like every key this app stores (`@olai/web`'s `preference.ts`). */
const KEPT = "olai.chat.unsent:"

/** The kept half of a draft: what a person wrote and what a remount needs to
 *  draw it again. `dismissed` is not kept — it is about the menu on screen. */
const keep = (kept: KeptWords | null, key: string, draft: Draft): void => {
  if (kept === null) return
  try {
    if (draft.text === "") kept.removeItem(KEPT + key)
    else kept.setItem(KEPT + key, JSON.stringify({ text: draft.text, taken: [...draft.taken], caret: draft.caret, retry: draft.retry }))
  } catch {
    // A tab that will not store keeps the words for this activation only.
  }
}

/** What the tab kept for a conversation, or `null` for nothing legible. */
const kept = (from: KeptWords | null, key: string): Draft | null => {
  if (from === null) return null
  try {
    const raw = from.getItem(KEPT + key)
    if (raw === null) return null
    const value = JSON.parse(raw) as { text?: unknown; taken?: unknown; caret?: unknown; retry?: unknown }
    if (typeof value.text !== "string" || value.text === "") return null
    const taken = Array.isArray(value.taken) ? value.taken.filter((one): one is string => typeof one === "string") : []
    const caret = typeof value.caret === "number" ? Math.min(value.caret, value.text.length) : value.text.length
    return { text: value.text, taken: new Set(taken), caret, retry: value.retry === true, dismissed: null }
  } catch {
    return null
  }
}

/** One chat activation's drafts, by conversation, over the tab's kept words. */
export const createMessageMemory = (words: KeptWords | null = tabWords()) => {
  const bins = new Map<string, Bin>()
  const keyOf = new WeakMap<Bin, string>()
  /** Tie a bin to its conversation: a bin with no words takes what the tab
   *  kept, and one that already has words (typed before the conversation was
   *  known) is what the tab keeps from now on. */
  const bind = (key: string, value: Bin): Bin => {
    keyOf.set(value, key)
    bins.set(key, value)
    const now = value[0]()
    const before = now.text === "" ? kept(words, key) : null
    if (before !== null) value[1](before)
    else keep(words, key, now)
    return value
  }
  return {
    bins,
    /** The conversation's bin, made from what the tab kept if there is none. */
    at: (key: string): Bin => bins.get(key) ?? bind(key, bin()),
    bind,
    /** Change a draft, and keep the change for the tab when its conversation
     *  is known. Every writer goes through here, so none can forget the tab. */
    write: (value: Bin, next: (before: Draft) => Draft): void => {
      const after = value[1](next)
      const key = keyOf.get(value)
      if (key !== undefined) keep(words, key, after)
    },
  }
}
type Memory = ReturnType<typeof createMessageMemory>

/** A plain page's opening gesture can outlive its plain composer. Transfer
 * those words into the resulting conversation without mounting another Chat. */
export const keepMessage = (memory: Memory, key: string, text: string, retry = false) => {
  if (text === "") return
  memory.write(memory.at(key), before => {
    const words = before.text === "" ? text : `${text}\n${before.text}`
    return { ...before, text: words, caret: words.length, retry: before.retry || retry }
  })
}

const restored = (failed: Draft, current: Draft): Draft => {
  if (current.text === "") return { ...failed, retry: true }
  const text = failed.text === "" ? current.text : `${failed.text}\n${current.text}`
  return { retry: true, text, taken: new Set([...failed.taken, ...current.taken]), caret: text.length, dismissed: null }
}

export const createMessageDraft = (conversation: Accessor<string | null>, memory: Memory) => {
  const initial = bin()
  let previous = initial
  let first = true
  const current = createMemo(() => {
    const key = conversation()
    // A reconnect is not a change of conversation. Words typed before the
    // initial identity arrives belong to that first conversation.
    if (key === null) return previous
    let value = memory.bins.get(key)
    if (value === undefined) value = first ? memory.bind(key, initial) : memory.at(key)
    first = false
    previous = value
    return value
  })
  const field = <K extends keyof Draft>(key: K) => (next: Draft[K] | ((before: Draft[K]) => Draft[K])) => {
    let answer!: Draft[K]
    memory.write(current(), before => {
      answer = typeof next === "function" ? next(before[key]) : next
      return { ...before, [key]: answer }
    })
    return answer
  }
  const recover = () => {
    const owner = current()
    const failed = owner[0]()
    return () => memory.write(owner, now => restored(failed, now))
  }
  return {
    draft: createMemo(() => current()[0]().text), setDraft: field("text"),
    retry: createMemo(() => current()[0]().retry), setRetry: field("retry"),
    taken: createMemo(() => current()[0]().taken), setTaken: field("taken"),
    caret: createMemo(() => current()[0]().caret), setCaret: field("caret"),
    dismissed: createMemo(() => current()[0]().dismissed), setDismissed: field("dismissed"),
    recover,
  }
}
