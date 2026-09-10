import { expect, test } from "bun:test"
import { createRoot, createSignal, onCleanup } from "solid-js"
import { followReading, type SearchProvider } from "./contracts/reading.ts"

test("withdrawn search releases its query and disables takes; return opens a fresh query", () => {
  let closes = 0, opens = 0, takes = 0
  createRoot(dispose => {
    const provider: SearchProvider = () => {
      const generation = ++opens
      onCleanup(() => { closes++ })
      return {
        hits: () => [], total: () => generation, failure: () => null,
        refusals: () => [], answering: () => "cabinet",
        taking: act => act(),
      }
    }
    const [active, setActive] = createSignal<SearchProvider | undefined>(provider)
    const found = followReading(active, () => "cabinet")
    expect(found.total()).toBe(1)
    found.taking(() => { takes++ })
    setActive(undefined)
    expect(closes).toBe(1)
    expect(found.failure()).toContain("Search is unavailable")
    expect(found.answering()).toBeNull()
    found.taking(() => { takes++ })
    expect(takes).toBe(1)
    setActive(() => provider)
    expect(found.total()).toBe(2)
    expect(found.failure()).toBeNull()
    dispose()
    expect(closes).toBe(2)
  })
})
