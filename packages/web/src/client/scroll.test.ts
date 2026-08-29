/**
 * A clamped restore waits on the arriving page's layout, not on a clock from
 * the Back.
 *
 * `popstate` restores against the page being LEFT (`./reading.tsx`: the last
 * answer stands while the next is on the wire). The first attempt clamps to
 * that page's height, and a hang started at that instant expires while the
 * outline is still in flight — Darwin CI's 221px asked, 77px held. The hang
 * arms when the document GROWS. These cases are that seam, over a fake
 * document: the window APIs `./scroll.ts` actually calls, not a browser.
 */

import { afterEach, expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { createScrollMemory, SETTLE_MS } from "./scroll.ts"

const VIEWPORT = 400
const LEFT = 221
const CLAMP = 77

type Listener = EventListenerOrEventListenerObject

const page = () => {
  let y = 0
  let maxY = 0
  let height = VIEWPORT
  const listeners = new Map<string, Set<Listener>>()
  let observe: ((node: { scrollHeight: number }) => void) | undefined
  const element = {
    get scrollHeight() {
      return height
    },
  }
  const fire = (type: string): void => {
    for (const fn of listeners.get(type) ?? []) {
      if (typeof fn === "function") fn(new Event(type))
      else fn.handleEvent(new Event(type))
    }
  }
  const setMax = (next: number): void => {
    maxY = next
    height = next + VIEWPORT
    if (y > maxY) y = maxY
    observe?.(element)
  }
  return {
    get y() {
      return y
    },
    setMax,
    scrollTo: (top: number) => {
      y = Math.max(0, Math.min(top, maxY))
      fire("scroll")
    },
    addEventListener: (type: string, fn: Listener) => {
      const set = listeners.get(type) ?? new Set()
      set.add(fn)
      listeners.set(type, set)
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn)
    },
    fire,
    element,
    watch: (fn: (node: { scrollHeight: number }) => void) => {
      observe = fn
    },
    unwatch: () => {
      observe = undefined
    },
  }
}

type Page = ReturnType<typeof page>

const previous = new Map<string, PropertyDescriptor | undefined>()
let disposeRoot: (() => void) | undefined

const take = (name: string): void => {
  previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
}

const put = (name: string, value: unknown): void => {
  take(name)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  })
}

const install = (it: Page): void => {
  take("scrollY")
  Object.defineProperty(globalThis, "scrollY", {
    configurable: true,
    get: () => it.y,
  })
  put(
    "history",
    { scrollRestoration: "auto", state: { key: "outline" } } satisfies Partial<History>,
  )
  put("scrollTo", (opts: ScrollToOptions | number) => {
    const top = typeof opts === "number" ? opts : (opts.top ?? 0)
    it.scrollTo(top)
  })
  put("document", { documentElement: it.element })
  put("addEventListener", it.addEventListener)
  put("removeEventListener", it.removeEventListener)
  put(
    "requestAnimationFrame",
    (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number,
  )
  put("cancelAnimationFrame", (id: number) => clearTimeout(id))
  put(
    "ResizeObserver",
    class {
      constructor(cb: ResizeObserverCallback) {
        it.watch((node) => {
          cb(
            [{ target: node } as unknown as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          )
        })
      }
      observe() {
        /* the harness fires on setMax, including the size already there */
      }
      disconnect() {
        it.unwatch()
      }
      unobserve() {}
    },
  )
}

const restore = (): void => {
  disposeRoot?.()
  disposeRoot = undefined
  for (const [name, desc] of previous) {
    if (desc === undefined) delete (globalThis as Record<string, unknown>)[name]
    else Object.defineProperty(globalThis, name, desc)
  }
  previous.clear()
}

afterEach(restore)

const memory = (
  it: Page,
  body: (scroll: ReturnType<typeof createScrollMemory>, key: { here: string }) => void,
): void => {
  install(it)
  const here = { here: "outline" }
  disposeRoot = createRoot((dispose) => {
    const scroll = createScrollMemory(() => here.here)
    body(scroll, here)
    return dispose
  })
}

const tick = () => new Promise((go) => setTimeout(go, 15))
const pastHang = () => new Promise((go) => setTimeout(go, SETTLE_MS + 50))

/** Reader at 221 on the outline, then a zoomed page that can only hold 77. */
const clamped = (
  body: (scroll: ReturnType<typeof createScrollMemory>, it: Page) => Promise<void> | void,
): Promise<void> => {
  const it = page()
  return new Promise((ok, no) => {
    memory(it, (scroll, key) => {
      void (async () => {
        it.setMax(LEFT)
        it.scrollTo(LEFT)
        key.here = "zoomed"
        scroll.toTop()
        it.setMax(CLAMP)
        key.here = "outline"
        scroll.restore("outline")
        expect(it.y).toBe(CLAMP)
        await body(scroll, it)
      })()
        .then(ok)
        .catch(no)
    })
  })
}

test("a restore that came up short is still asking after the old one-second hang", async () => {
  await clamped(async (_scroll, it) => {
    await pastHang()
    expect(it.y).toBe(CLAMP)
    it.setMax(LEFT)
    await tick()
    expect(it.y).toBe(LEFT)
  })
})

test("a clamped restore does not remember the clamp as the place the reader left", async () => {
  await clamped(async (scroll, it) => {
    await tick()
    it.setMax(LEFT)
    await tick()
    expect(it.y).toBe(LEFT)
    it.setMax(CLAMP)
    scroll.toTop()
    scroll.restore("outline")
    expect(it.y).toBe(CLAMP)
    it.setMax(LEFT)
    await tick()
    expect(it.y).toBe(LEFT)
  })
})

test("growth that still cannot hold the place is allowed to hang, then stop", async () => {
  await clamped(async (_scroll, it) => {
    it.setMax(100)
    await pastHang()
    expect(it.y).toBe(100)
    it.setMax(LEFT)
    await tick()
    // The hang already ended: a later growth is a different page, not the
    // arrival this restore was waiting on.
    expect(it.y).toBe(100)
  })
})

test("the reader taking the page over stops the asking", async () => {
  await clamped(async (_scroll, it) => {
    it.fire("wheel")
    it.setMax(LEFT)
    await tick()
    expect(it.y).toBe(CLAMP)
  })
})
