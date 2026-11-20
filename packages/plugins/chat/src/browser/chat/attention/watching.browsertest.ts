import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createWatchings } from "./watching.ts"

test("a roster shares one channel and three visibility listeners, all released", () => {
  const saved = Object.fromEntries(["window", "document", "BroadcastChannel"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  let listeners = 0
  let channels = 0
  let made: Channel | undefined
  class Target extends EventTarget {
    override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) { listeners++; super.addEventListener(...args) }
    override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) { listeners--; super.removeEventListener(...args) }
  }
  class Channel extends EventTarget {
    constructor(_name: string) { super(); channels++; made = this }
    postMessage(_value: unknown) {}
    close() { channels-- }
  }
  let stop: (() => void) | undefined
  try {
    for (const [key, value] of Object.entries({ window: new Target(), document: Object.assign(new Target(), { visibilityState: "hidden", hasFocus: () => false }), BroadcastChannel: Channel })) {
      Object.defineProperty(globalThis, key, { value, configurable: true })
    }
    createRoot(dispose => {
      stop = dispose
      const watch = createWatchings()
      const first = watch(() => true, "node-0")
      for (let i = 1; i < 200; i++) expect(watch(() => false, `node-${i}`).watched()).toBe(false)
      expect(first.here()).toBe(false)
      made!.dispatchEvent(new MessageEvent("message", { data: "node-0" }))
      expect(first.watched()).toBe(true)
      expect(first.here()).toBe(false)
    })
    expect(channels).toBe(1)
    expect(listeners).toBe(3)
    stop?.()
    stop = undefined
    expect(channels).toBe(0)
    expect(listeners).toBe(0)
  } finally {
    stop?.()
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, key)
      else Object.defineProperty(globalThis, key, descriptor)
    }
  }
})
