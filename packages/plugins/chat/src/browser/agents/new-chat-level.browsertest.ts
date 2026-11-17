/**
 * THE WHERE LEVEL'S SETTLED TEXT (`./new-chat-level.ts`'s `settled`) — which
 * question the level asks, and when.
 *
 * It runs under the browser condition because its whole subject is an EFFECT
 * and a timer: when the effect first runs relative to a change is the thing
 * being pinned, and a server-resolved run would report nothing at all.
 *
 * THE CASE THE REGRESSION IS: a person pressed the `+`, the level opened, and
 * words landed in the box before the level's first effect had run — which on a
 * loaded machine is ordinary. The old guard skipped the FIRST RUN rather than
 * an unchanged value, so those words were swallowed and the level went on
 * asking about an empty box forever, since nothing was ever going to type
 * again. The list stayed empty and no node could be chosen.
 */
import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import { settled, TYPING_PAUSE_MS } from "./new-chat-level.ts"

const after = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

test("words typed before the level's first effect runs still become the question", async () => {
  const owner = createRoot(dispose => {
    const [typed, setTyped] = createSignal("")
    return { dispose, setTyped, value: settled(typed) }
  })
  try {
    // In the same breath as the opening: no effect has run yet.
    owner.setTyped("pick the hinges")
    await after(TYPING_PAUSE_MS * 4)
    expect(owner.value()).toBe("pick the hinges")
  } finally {
    owner.dispose()
  }
})

test("the box the level opened with is asked at once, and later typing waits for a pause", async () => {
  const owner = createRoot(dispose => {
    const [typed, setTyped] = createSignal("kitchen")
    return { dispose, setTyped, value: settled(typed) }
  })
  try {
    // The opening value is the question, with no pause spent on it.
    expect(owner.value()).toBe("kitchen")
    owner.setTyped("kitchen remodel")
    expect(owner.value()).toBe("kitchen")
    await after(TYPING_PAUSE_MS * 4)
    expect(owner.value()).toBe("kitchen remodel")
  } finally {
    owner.dispose()
  }
})
