import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { createRouter } from "./router.tsx"
import { atFile, HOME_ROUTE } from "./routes.ts"
import { lone } from "./workspace.ts"

/**
 * THE REAL ROUTER over a history that behaves like a browser's where it
 * matters to lanes: one stack, `pushState` discarding what is ahead, and
 * `history.go` answering LATER with a `popstate` — so a seek is several
 * traversals the router has to see through without drawing any of them.
 */
const browser = (first = "/", before: ReadonlyArray<{ state: unknown; url: string }> = []) => {
  const entries: Array<{ state: unknown; url: string }> = [...before, { state: null, url: first }]
  let index = before.length
  const popstate = new Set<() => void>()
  const scrolled = new Set<() => void>()
  let top = 0
  const url = () => new URL(entries[index]!.url, "http://localhost")
  const history = {
    scrollRestoration: "auto",
    get state() { return entries[index]!.state },
    pushState(state: unknown, _: string, next?: string) {
      entries.splice(index + 1)
      entries.push({ state, url: next ?? entries[index]!.url })
      index += 1
    },
    replaceState(state: unknown, _: string, next?: string) {
      entries[index] = { state, url: next ?? entries[index]!.url }
    },
    go(delta: number) {
      setTimeout(() => {
        const to = index + delta
        if (delta === 0 || to < 0 || to >= entries.length) return
        index = to
        for (const listener of popstate) listener()
      }, 0)
    },
  }
  const globals: Record<string, unknown> = {
    history,
    location: { get pathname() { return url().pathname }, get search() { return url().search }, get hash() { return url().hash } },
    addEventListener: (type: string, listener: () => void) => {
      if (type === "popstate") popstate.add(listener)
      if (type === "scroll") scrolled.add(listener)
    },
    removeEventListener: (type: string, listener: () => void) => {
      popstate.delete(listener)
      scrolled.delete(listener)
    },
    scrollTo: (to: { top: number }) => { top = to.top },
    requestAnimationFrame: (run: () => void) => setTimeout(run, 0),
    cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  }
  const saved: Array<readonly [string, PropertyDescriptor | undefined]> = [...Object.keys(globals), "scrollY"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, value })
  Object.defineProperty(globalThis, "scrollY", { configurable: true, get: () => top })
  return {
    path: () => url().pathname,
    /** The reader scrolling the page to `to`. */
    scroll: (to: number) => {
      top = to
      for (const listener of scrolled) listener()
    },
    top: () => top,
    address: () => entries[index]!.url,
    back: () => history.go(-1),
    forward: () => history.go(1),
    restore: () => {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else Reflect.deleteProperty(globalThis, name)
      }
    },
  }
}

/** Every queued traversal, and every traversal a seek queues after it. */
const settled = async () => {
  for (let turn = 0; turn < 12; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

const withRouter = async (
  run: (router: ReturnType<typeof createRouter>, page: ReturnType<typeof browser>) => Promise<void>,
  first?: string,
  before?: ReadonlyArray<{ state: unknown; url: string }>,
) => {
  const page = browser(first, before)
  let dispose = () => {}
  try {
    const router = createRoot((stop) => {
      dispose = stop
      return createRouter()
    })
    await run(router, page)
  } finally {
    dispose()
    page.restore()
  }
}

const drawn = (router: ReturnType<typeof createRouter>) => router.routes.href(router.route())

test("Back walks the lane in front and skips another lane's pages", async () => {
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    router.go(atFile("one.md"))
    router.go(atFile("two.md"))
    router.switchLane("b", lone(HOME_ROUTE))
    router.go(atFile("three.md"))
    page.back()
    await settled()
    expect(drawn(router)).toBe("/")
    expect(page.path()).toBe("/")
    // The start of b: Back bounces, and the reader stays where they were —
    // the same workspace, not a fresh one, and no landing minted on the way.
    const before = router.workspace()
    page.back()
    await settled()
    expect(page.path()).toBe("/")
    expect(router.workspace()).toBe(before)
    expect(router.landing(0)).toBeUndefined()
    page.forward()
    await settled()
    expect(drawn(router)).toBe("/three.md")
  })
})

test("a lane brought back walks its own pages again, past the other lane's", async () => {
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    router.go(atFile("one.md"))
    const left = router.entryKey()
    router.switchLane("b", lone(HOME_ROUTE))
    router.go(atFile("three.md"))
    router.switchLane("a", lone(atFile("one.md")), left)
    expect(router.entryKey()).toBe(left)
    page.back()
    await settled()
    // one.md's own entry became b's when b came forward over it, so a's
    // history before it is the page it started on.
    expect(drawn(router)).toBe("/")
    expect(router.lane()).toBe("a")
  })
})

test("a forgotten lane's entries are passed over, and with no lane every entry is walked", async () => {
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    router.go(atFile("one.md"))
    router.go(atFile("two.md"))
    router.switchLane("b", lone(atFile("b.md")))
    router.go(atFile("b2.md"))
    router.switchLane("a", lone(atFile("two.md")))
    router.forgetLane("b")
    page.back()
    await settled()
    expect(drawn(router)).toBe("/one.md")

    // With the window's history back, the closed lane's page is a page again.
    router.switchLane(null, router.workspace(), router.entryKey())
    page.forward()
    await settled()
    expect(drawn(router)).toBe("/b.md")
  })
})

test("switching to the page already drawn keeps it, and the first lane adopts what came before", async () => {
  await withRouter(async (router, page) => {
    router.go(atFile("before.md"))
    const workspace = router.workspace()
    router.switchLane("a", workspace, router.entryKey())
    expect(router.workspace()).toBe(workspace)
    page.back()
    await settled()
    expect(drawn(router)).toBe("/")
  })
})

test("taking a lane over the page already drawn leaves the address bar alone, before any tenant has claimed it", async () => {
  // No claims are held: a page whose reading needs the roster prints as
  // something else until it settles, and must not be written back as that.
  const address = "/s/house.olai%23handles/notes%2Fdeep.html%23beds"
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    expect(page.address()).toBe(address)
    router.switchLane(null, router.workspace(), router.entryKey())
    expect(page.address()).toBe(address)
  }, address)
})

test("Forward at the end of a lane bounces and leaves the page alone", async () => {
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    router.go(atFile("one.md"))
    router.switchLane("b", lone(atFile("b.md")))
    router.go(atFile("b2.md"))
    router.switchLane("a", lone(atFile("one.md")))
    page.back()
    await settled()
    expect(drawn(router)).toBe("/")
    page.forward()
    await settled()
    expect(drawn(router)).toBe("/one.md")
    const before = router.workspace()
    page.forward()
    await settled()
    expect(page.path()).toBe("/one.md")
    expect(router.workspace()).toBe(before)
  })
})

test("an entry written before positions existed is dead while a lane is in force", async () => {
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    const before = router.workspace()
    page.back()
    await settled()
    expect(page.path()).toBe("/here.md")
    expect(router.workspace()).toBe(before)
  }, "/here.md", [{ state: { key: "from-an-older-build" }, url: "/older.md" }])
})

test("forgetting the lane in force still leaves Back somewhere to come home to", async () => {
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    router.go(atFile("one.md"))
    router.forgetLane("a")
    page.back()
    await settled()
    expect(page.path()).toBe("/one.md")
    expect(drawn(router)).toBe("/one.md")
    // ...and the lane switched in afterwards walks as usual.
    router.switchLane("b", lone(atFile("b.md")))
    router.go(atFile("b2.md"))
    page.back()
    await settled()
    expect(drawn(router)).toBe("/b.md")
  })
})

test("a lane brought back with its entry's key comes back to where it was scrolled", async () => {
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    router.go(atFile("one.md"))
    page.scroll(300)
    const left = router.entryKey()
    router.switchLane("b", lone(atFile("b.md")))
    expect(page.top()).toBe(0)
    router.switchLane("a", lone(atFile("one.md")), left)
    expect(page.top()).toBe(300)
  })
})

test("a switch asked for mid-travel is written once the browser is back on its entry", async () => {
  await withRouter(async (router, page) => {
    router.switchLane("a", router.workspace(), router.entryKey())
    router.go(atFile("one.md"))
    router.switchLane("b", lone(atFile("b.md")))
    page.back() // b's start: this will bounce
    router.switchLane("c", lone(atFile("c.md")))
    await settled()
    expect(page.path()).toBe("/c.md")
    expect(router.lane()).toBe("c")
    expect(drawn(router)).toBe("/c.md")
    router.go(atFile("c2.md"))
    page.back()
    await settled()
    expect(drawn(router)).toBe("/c.md")
  })
})
