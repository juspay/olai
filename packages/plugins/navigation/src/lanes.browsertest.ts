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
const browser = () => {
  const entries: Array<{ state: unknown; url: string }> = [{ state: null, url: "/" }]
  let index = 0
  const popstate = new Set<() => void>()
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
    addEventListener: (type: string, listener: () => void) => { if (type === "popstate") popstate.add(listener) },
    removeEventListener: (type: string, listener: () => void) => { if (type === "popstate") popstate.delete(listener) },
    scrollTo: () => {},
    scrollY: 0,
    requestAnimationFrame: (run: () => void) => setTimeout(run, 0),
    cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  }
  const saved = Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, value })
  return {
    path: () => url().pathname,
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

const withRouter = async (run: (router: ReturnType<typeof createRouter>, page: ReturnType<typeof browser>) => Promise<void>) => {
  const page = browser()
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
    // The start of b: Back bounces, and the reader stays where they were.
    page.back()
    await settled()
    expect(page.path()).toBe("/")
    expect(drawn(router)).toBe("/")
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
