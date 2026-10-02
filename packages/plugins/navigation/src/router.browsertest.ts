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

test("lanes adopt, retain their panes, navigate independently and release", async () => {
  const names = ["location", "history", "addEventListener", "removeEventListener", "scrollTo", "scrollY", "requestAnimationFrame"] as const
  const saved = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name))
  const here = new URL("http://localhost/first.olai")
  const writes: string[] = []
  const history = { state: null as unknown, scrollRestoration: "auto",
    replaceState(state: unknown, _title: string, href?: string) { this.state = state; if (href) writes.push(href) },
    pushState(state: unknown, _title: string, href: string) { this.state = state; writes.push(href) },
  }
  const values = [here, history, () => {}, () => {}, () => {}, 0, () => 0]
  names.forEach((name, index) => Object.defineProperty(globalThis, name, { configurable: true, value: values[index] }))
  let dispose = () => {}
  try {
    const router = createRoot(stop => { dispose = stop; return createRouter() })
    const first = router.lanes()[0]!
    const pane = first.panes()[0]!
    router.switchLane("first")
    expect(router.lanes()[0]).toBe(first)
    expect(first.panes()[0]).toBe(pane)
    const { atFile } = await import("./routes.ts")
    const { lone } = await import("./workspace.ts")
    router.switchLane("second", { workspace: lone(atFile("second.olai")) })
    expect(router.lanes()).toHaveLength(2)
    expect(first.shown()).toBe(false)
    const before = writes.length
    first.go(atFile("background.olai"))
    expect(writes).toHaveLength(before)
    expect(first.panes()[0]).toBe(pane)
    router.switchLane("first", { workspace: lone(atFile("stale.olai")) })
    expect(router.routes.href(router.route())).toBe("/background.olai")
    expect(first.shown()).toBe(true)
    router.openRight(0, atFile("third.olai"), true)
    const secondPane = router.panes()[1]!
    router.reorder(0, 1)
    expect(router.panes()).toEqual([secondPane, pane])
    expect(pane.index()).toBe(1)
    router.close(0)
    expect(router.panes()).toEqual([pane])
    router.switchLane(null)
    expect(router.lanes()).toEqual([first])
    expect(first.lane()).toBeNull()
  } finally {
    dispose()
    names.forEach((name, index) => {
      const descriptor = saved[index]
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    })
  }
})
