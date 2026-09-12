import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { TEST_CLAIMS } from "@olai/format/testlib"
import type { Claims } from "@olai/format"
import { holdFiles } from "./pages.ts"
import { createRouter } from "./router.tsx"

// Only the address bar and event listeners are needed: no page is drawn.
// Exercise the real router because reparsing the route alone missed the
// separate landing signal when the claims cell first arrived.
test("late claims land every pane once, without reviving a spent landing on another frame", async () => {
  const names = ["location", "history", "addEventListener", "removeEventListener"] as const
  const saved = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name))
  const here = new URL("http://localhost/s/house.olai%23handles/notes%2Fdeep.html%23beds")
  const history = { state: null as unknown, scrollRestoration: "auto", replaceState(state: unknown) { this.state = state } }
  const values = [here, history, () => {}, () => {}]
  names.forEach((name, index) => Object.defineProperty(globalThis, name, { configurable: true, value: values[index] }))
  let dispose = () => {}
  let release = () => {}
  try {
    const [claims, publish] = createSignal<Claims | undefined>()
    // The provider is mounted before its cell has a value, just as on a tab's
    // first wire. Retiring/reoffering it is another snapshot, not navigation.
    const router = createRoot(stop => {
      dispose = stop
      return createRouter()
    })
    expect(router.landing(0)).toBeUndefined()
    release = holdFiles({ claims: () => claims()!, paths: () => [], standing: () => "loaded" })
    publish(TEST_CLAIMS)
    await Promise.resolve()
    expect(router.landing(0)).toEqual({ file: "house.olai", at: "handles", spent: false })
    expect(router.landing(1)).toEqual({ file: "notes/deep.html", at: "beds", spent: false })
    router.landed(0, "house.olai", "handles")
    publish({ ...TEST_CLAIMS })
    expect(router.landing(0)?.spent).toBe(true)
    expect(router.landing(1)?.spent).toBe(false)
  } finally {
    dispose()
    release()
    names.forEach((name, index) => {
      const descriptor = saved[index]
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    })
  }
})
