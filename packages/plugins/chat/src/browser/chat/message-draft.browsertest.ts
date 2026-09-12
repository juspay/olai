import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { createMessageDraft, createMessageMemory } from "./message-draft.ts"

test("two readers share words while other conversations stay independent, including after remount", () => {
  const memory = createMessageMemory()
  let stop = () => {}
  const first = createRoot(dispose => { stop = dispose; return createMessageDraft(() => "one", memory) })
  first.setDraft("timber")
  createRoot(dispose => {
    const second = createMessageDraft(() => "one", memory)
    const other = createMessageDraft(() => "two", memory)
    expect(second.draft()).toBe("timber")
    second.setDraft("oak")
    expect(first.draft()).toBe("oak")
    expect(other.draft()).toBe("")
    stop()
    const remount = createMessageDraft(() => "one", memory)
    expect(remount.draft()).toBe("oak")
    dispose()
  })
})

test("a delayed refusal restores into its own conversation alongside newer words", () => {
  createRoot(dispose => {
    const [key, setKey] = createSignal<string | null>(null)
    const draft = createMessageDraft(key, createMessageMemory())
    draft.setDraft("queued during opening")
    setKey("one")
    expect(draft.draft()).toBe("queued during opening")
    const recover = draft.recover()
    draft.setDraft("")
    setKey("two")
    draft.setDraft("other")
    recover()
    expect(draft.draft()).toBe("other")
    expect(draft.retry()).toBe(false)
    setKey("one")
    expect(draft.draft()).toBe("queued during opening")
    expect(draft.retry()).toBe(true)
    draft.setRetry(false)
    expect(draft.retry()).toBe(false)
    dispose()
  })
})
