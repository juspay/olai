/** Unsent words and chosen @ handles belong to the conversation in this tab,
 * not to a particular composer mount. A plugin roster change rebuilds the
 * page, and closing the drawer also disposes its composer. Keep only nonempty
 * drafts in memory; nothing is written to storage or sent to another tab. */
import { batch, createEffect, createSignal, on, onCleanup, type Accessor } from "solid-js"

interface Draft {
  readonly text: string
  readonly taken: ReadonlySet<string>
  readonly caret: number
}

const held = new Map<string, Draft>()

export const createMessageDraft = (conversation: Accessor<string | null>) => {
  const [draft, setDraft] = createSignal("")
  const [taken, setTaken] = createSignal<ReadonlySet<string>>(new Set())
  const [caret, setCaret] = createSignal(0)
  let owner: string | null = null

  const save = () => {
    if (owner === null) return
    if (draft() === "" && taken().size === 0) held.delete(owner)
    else held.set(owner, { text: draft(), taken: taken(), caret: caret() })
  }

  createEffect(on(conversation, (key) => {
    // A reconnect or a starting session has not told us its identity yet.
    // Do not mistake that gap for a different conversation and erase a draft.
    if (key === null || key === owner) return
    const first = owner === null
    save()
    owner = key
    const stored = held.get(key)
    // Words typed during the first boot go into that first conversation.
    // An actual conversation change starts with its own draft, or an empty box.
    if (stored === undefined && first) return
    batch(() => {
      setDraft(stored?.text ?? "")
      setTaken(stored?.taken ?? new Set<string>())
      setCaret(stored?.caret ?? 0)
    })
  }))
  onCleanup(save)

  return { draft, setDraft, taken, setTaken, caret, setCaret }
}
