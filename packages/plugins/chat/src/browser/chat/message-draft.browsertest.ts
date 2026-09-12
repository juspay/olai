import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { createMessageDraft, createMessageMemory, keepMessage } from "./message-draft.ts"

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

test("a page's opening gesture transfers newer words and recovers a refused first send", () => {
  createRoot(dispose => {
    const memory = createMessageMemory()
    keepMessage(memory, "one", "words typed while opening")
    const draft = createMessageDraft(() => "one", memory)
    expect(draft.draft()).toBe("words typed while opening")
    expect(draft.retry()).toBe(false)
    keepMessage(memory, "one", "the refused first message", true)
    expect(draft.draft()).toBe("the refused first message\nwords typed while opening")
    expect(draft.retry()).toBe(true)
    dispose()
  })
})
