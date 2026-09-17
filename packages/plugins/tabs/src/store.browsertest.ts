import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import type { Navigation } from "olai-plugin-navigation/contract"
import { atFile, NO_PAGES, routingOver } from "olai-plugin-navigation/routes"
import { lone, type Workspace, workspaceOf, workspaceRoutingOver } from "olai-plugin-navigation/workspace"

import { TABS_KEY } from "./persist.ts"
import { createTabs } from "./store.ts"

/**
 * THE STORE OVER A ROUTER THAT WRITES DOWN WHAT IT WAS ASKED — which lane was
 * switched in with which key, which lane was forgotten, in what order — so the
 * order the store drives the navigation row in is a claim here rather than
 * something only the browser suite could notice.
 */
const fakeRouter = (first: string) => {
  const routes = workspaceRoutingOver(routingOver(() => undefined, () => NO_PAGES))
  const [workspace, setWorkspace] = createSignal<Workspace>(workspaceOf(routes, first))
  let key = "k0"
  let lane: string | null = null
  let minted = 0
  const said: Array<string> = []
  const router = {
    routes,
    workspace,
    info: () => undefined,
    entryKey: () => key,
    lane: () => lane,
    switchLane: (next: string | null, to?: { readonly workspace: Workspace; readonly key?: string }) => {
      lane = next
      if (to !== undefined) key = to.key ?? `m${++minted}`
      said.push(`switch ${next} ${to === undefined ? key : (to.key ?? "(new)")}`)
      if (to !== undefined) setWorkspace(to.workspace)
      return key
    },
    forgetLane: (lane: string) => said.push(`forget ${lane}`),
    open: (next: Workspace) => {
      key = `m${++minted}`
      said.push("open")
      setWorkspace(next)
    },
    go: (route: Parameters<Navigation["go"]>[0]) => setWorkspace(lone(route)),
  }
  return { router: router as unknown as Navigation, said, go: router.go, setKey: (next: string) => { key = next } }
}

const storage = () => {
  const kept = new Map<string, string>()
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (name: string) => kept.get(name) ?? null,
      setItem: (name: string, value: string) => kept.set(name, value),
      removeItem: (name: string) => kept.delete(name),
    },
  })
  return {
    kept,
    restore: () => saved ? Object.defineProperty(globalThis, "localStorage", saved) : Reflect.deleteProperty(globalThis, "localStorage"),
  }
}

const withStore = (first: string, run: (parts: ReturnType<typeof fakeRouter> & { tabs: ReturnType<typeof createTabs>; desk: (on: boolean) => void; kept: Map<string, string> }) => void, stored?: string) => {
  const store = storage()
  if (stored !== undefined) store.kept.set(TABS_KEY, stored)
  let dispose = () => {}
  try {
    // Set up inside a root, and pressed OUTSIDE it: a root runs its effects
    // once it has returned, and the presses are the reader's, which come later.
    const parts = createRoot((stop) => {
      dispose = stop
      const router = fakeRouter(first)
      const tabs = createTabs(router.router)
      const [desk, setDesk] = createSignal(false)
      tabs.draw(desk)
      const stopLane = tabs.takeLane()
      tabs.follow()
      return { ...router, tabs, desk: setDesk, kept: store.kept, stopLane }
    })
    run(parts)
    parts.stopLane()
  } finally {
    dispose()
    store.restore()
  }
}

const hrefs = (tabs: ReturnType<typeof createTabs>) => tabs.tabs().map((tab) => tab.href)

test("the lane is held only while a strip draws on a desk, and given back when it stops", () => {
  withStore("/house.olai", ({ tabs, said, desk }) => {
    expect(said).toEqual([])
    desk(true)
    expect(said).toEqual(["switch t1 k0"])
    desk(false)
    expect(said).toEqual(["switch t1 k0", "switch null k0"])
    expect(tabs.front()).toBe("t1")
  })
})

test("bringing a tab forward records where the outgoing tab was left, then switches its lane in with its key", () => {
  withStore("/house.olai", ({ tabs, said, desk, setKey }) => {
    desk(true)
    const garden = tabs.open(lone(atFile("garden.olai")), { behind: true })
    expect(tabs.front()).toBe("t1")
    setKey("left-on-house")
    tabs.show(garden)
    expect(tabs.tabs()[0]?.key).toBe("left-on-house")
    expect(tabs.tabs()[1]?.key).toBe("m1")
    said.length = 0
    tabs.show("t1")
    expect(said).toEqual(["switch t1 left-on-house"])
  })
})

test("closing the tab in front forgets its lane before the neighbour's is switched in", () => {
  withStore("/house.olai", ({ tabs, said, desk }) => {
    desk(true)
    tabs.open(lone(atFile("garden.olai")), { behind: true })
    said.length = 0
    tabs.close("t1")
    expect(said[0]).toBe("forget t1")
    expect(said[1]?.startsWith("switch t2")).toBe(true)
    expect(tabs.front()).toBe("t2")
  })
})

test("with no strip on a desk, a new tab is gone to in the window's own history", () => {
  withStore("/house.olai", ({ tabs, said }) => {
    tabs.open(lone(atFile("garden.olai")), { behind: true })
    expect(tabs.front()).toBe("t2")
    expect(said).toEqual(["open"])
    expect(hrefs(tabs)).toEqual(["/house.olai", "/garden.olai"])
  })
})

test("ids are never reused while the tab holding one is open, and the last tab leaves the front page", () => {
  withStore("/house.olai", ({ tabs, desk }) => {
    desk(true)
    const second = tabs.open(lone(atFile("garden.olai")))
    tabs.close("t1")
    const third = tabs.open(lone(atFile("finishes.md")))
    expect(new Set([second, third, ...tabs.tabs().map((tab) => tab.id)]).size).toBe(2)
    tabs.closeOthers(third)
    tabs.close(third)
    expect(hrefs(tabs)).toEqual(["/"])
  })
})

test("the front tab mirrors the router, and a restored front takes the address and a fresh name", () => {
  const stored = JSON.stringify({ v: 1, front: "t2", tabs: [
    { id: "t1", href: "/garden.olai", title: "garden" },
    { id: "t2", href: "/old.md", title: "a name from last session" },
  ] })
  withStore("/house.olai", ({ tabs, go, kept, desk }) => {
    expect(hrefs(tabs)).toEqual(["/garden.olai", "/house.olai"])
    expect(tabs.tabs()[1]?.title).toBe("house.olai")
    const written = kept.get(TABS_KEY)
    go(atFile("finishes.md"))
    expect(hrefs(tabs)).toEqual(["/garden.olai", "/finishes.md"])
    // The page in front moved, and what is kept did not: no write.
    expect(kept.get(TABS_KEY)).toBe(written)
    desk(true)
    tabs.show("t1")
    // ...until that tab leaves the front, with its last address.
    expect(JSON.parse(kept.get(TABS_KEY)!).tabs[1].href).toBe("/finishes.md")
  }, stored)
})

test("two strips holding the same breakpoint are two registrations, and releasing one keeps the other", () => {
  withStore("/house.olai", ({ tabs, said, desk }) => {
    desk(true)
    const [breakpoint] = [() => true]
    const first = tabs.draw(breakpoint)
    const second = tabs.draw(breakpoint)
    desk(false)
    expect(tabs.drawn()).toBe(true)
    first()
    expect(tabs.drawn()).toBe(true)
    expect(said.filter((line) => line.startsWith("switch null"))).toEqual([])
    second()
    expect(tabs.drawn()).toBe(false)
  })
})

test("two dot readings with the same paint are two registrations", () => {
  withStore("/house.olai", ({ tabs }) => {
    const reading = { ids: () => new Set(["t1"]), paint: "bg-doing" }
    const first = tabs.dot(reading)
    const second = tabs.dot(reading)
    first()
    expect(tabs.dotted().get("t1")).toBe("bg-doing")
    second()
    expect(tabs.dotted().size).toBe(0)
  })
})
