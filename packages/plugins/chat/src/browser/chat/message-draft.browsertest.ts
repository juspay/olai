import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { createMessageDraft, createMessageMemory, keepMessage, type KeptWords } from "./message-draft.ts"

/** The tab's storage, as a map a case can look into. */
const tab = (): KeptWords & { readonly held: Map<string, string> } => {
  const held = new Map<string, string>()
  return {
    held,
    getItem: key => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
    removeItem: key => void held.delete(key),
  }
}

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

test("unsent words outlive the chat activation that held them, and a send takes them from the tab", () => {
  const words = tab()
  createRoot(dispose => {
    const draft = createMessageDraft(() => "one", createMessageMemory(words))
    draft.setDraft("half a thought")
    draft.setCaret(4)
    dispose()
  })
  // CHAT'S BROWSER HALF REMOUNTED: a new activation, a new memory, the same tab.
  createRoot(dispose => {
    const draft = createMessageDraft(() => "one", createMessageMemory(words))
    expect(draft.draft()).toBe("half a thought")
    expect(draft.caret()).toBe(4)
    expect(createMessageDraft(() => "two", createMessageMemory(words)).draft()).toBe("")
    draft.setDraft("")
    dispose()
  })
  expect(words.held.size).toBe(0)
})

test("a send refused after its activation has gone comes back in the next one, as a retry", () => {
  const words = tab()
  let recover = () => {}
  createRoot(dispose => {
    const draft = createMessageDraft(() => "one", createMessageMemory(words))
    draft.setDraft("sent while chat restarted")
    recover = draft.recover()
    draft.setDraft("")
    dispose()
  })
  recover()
  createRoot(dispose => {
    const draft = createMessageDraft(() => "one", createMessageMemory(words))
    expect(draft.draft()).toBe("sent while chat restarted")
    expect(draft.retry()).toBe(true)
    dispose()
  })
})

test("words typed before the conversation is known are kept for it once it is", () => {
  const words = tab()
  createRoot(dispose => {
    const [key, setKey] = createSignal<string | null>(null)
    const draft = createMessageDraft(key, createMessageMemory(words))
    draft.setDraft("typed while opening")
    setKey("one")
    expect(draft.draft()).toBe("typed while opening")
    dispose()
  })
  createRoot(dispose => {
    const memory = createMessageMemory(words)
    keepMessage(memory, "one", "the refused first message", true)
    expect(createMessageDraft(() => "one", memory).draft()).toBe("the refused first message\ntyped while opening")
    dispose()
  })
})
