import { afterAll, expect, test } from "bun:test"
import { createRoot, onCleanup } from "solid-js"

import { HAND_BACK_BUDGET_MS, handBackFocus, rememberFocus, returnFocus, watchFocus, type FocusPage } from "./focus.ts"

class StandInElement {
  isConnected = true
  disabled = false
  focused = 0
  readonly focusedBy: Array<HTMLElement> = []
  focus(): void {
    this.focused++
    page.state.holds = this as unknown as Element
  }
  closest(selector: string): Element | null {
    return selector === "[inert]" && this.inert === true ? this as unknown as Element : null
  }
  matches(selector: string): boolean {
    return this.disabled && selector.includes(":disabled")
  }
  inert = false
  get ownerDocument(): { readonly activeElement: Element | null } {
    return { activeElement: page.held() }
  }
}
class StandInDialog extends StandInElement {
  open = true
}
const DOM = globalThis as unknown as Record<string, unknown>
const had = { html: "HTMLElement" in DOM, dialog: "HTMLDialogElement" in DOM }
DOM.HTMLElement = StandInElement
DOM.HTMLDialogElement = StandInDialog
afterAll(() => {
  if (!had.html) delete DOM.HTMLElement
  if (!had.dialog) delete DOM.HTMLDialogElement
})

const page = (() => {
  let clock = 0
  const frames: Array<() => void> = []
  const cancelled: Array<number> = []
  const state: { holds: Element | null } = { holds: null }
  return {
    state,
    held: (): Element | null => state.holds,
    advance: (ms: number) => { clock += ms },
    get waiting() { return frames.length },
    tick: () => { frames.shift()?.() },
    page: {
      active: () => state.holds,
      body: () => null,
      frame: (work: () => void) => frames.push(work),
      cancel: (handle: number) => { cancelled.push(handle) },
      now: () => clock,
    } as FocusPage,
    cancelled,
  }
})()
const element = (): { readonly el: HTMLElement; readonly stand: StandInElement } => {
  const stand = new StandInElement()
  return { el: stand as unknown as HTMLElement, stand }
}

test("the memory records a person's caret and forgets it with its owner", () => {
  watcher.reset()
  const memory = rememberFocus(watcher.target)
  const { el, stand } = element()
  watcher.fire(el)
  expect(memory.last()).toBe(el)
  const dialog = new StandInDialog()
  watcher.fire(dialog as unknown as HTMLElement)
  expect(memory.last()).toBe(el)
  memory.dispose()
  expect(memory.last()).toBeUndefined()
  expect(watcher.counts).toEqual({ added: 2, removed: 2 })
  watcher.fire(el)
  expect(memory.last()).toBeUndefined()
})

test("the watcher is registered under a Solid owner and goes with it", () => {
  watcher.reset()
  const dispose = createRoot((dispose) => {
    watchFocus(watcher.target)
    return dispose
  })
  expect(watcher.counts).toEqual({ added: 2, removed: 0 })
  dispose()
  expect(watcher.counts).toEqual({ added: 2, removed: 2 })
})

test("a caret the person put down is forgotten; one taken from them is not", () => {
  const memory = rememberFocus(watcher.target)
  const { el, stand } = element()
  watcher.fire(el)
  watcher.leave(el, new StandInDialog())
  expect(memory.last()).toBe(el)
  page.state.holds = el as unknown as Element
  watcher.leave(el)
  expect(memory.last()).toBe(el)
  page.state.holds = null
  stand.disabled = true
  watcher.leave(el)
  expect(memory.last()).toBe(el)
  stand.disabled = false
  watcher.leave(el)
  expect(memory.last()).toBeUndefined()
  expect(returnFocus(memory, page.page)).toBe("given")
  expect(stand.focused).toBe(0)
  memory.dispose()
})

test("the hand-back lands as soon as the element is allowed", () => {
  const { el, stand } = element()
  const memory = rememberFocus(watcher.target)
  watcher.fire(el)
  stand.disabled = true
  page.state.holds = null
  expect(returnFocus(memory, page.page)).toBe("waiting")
  handBackFocus(memory, page.page)
  expect(page.waiting).toBe(1)
  stand.disabled = false
  page.tick()
  expect(stand.focused).toBe(1)
  expect(page.held()).toBe(el)
  expect(page.waiting).toBe(0)
})

test("the hand-back gives up on an element that stays frozen", () => {
  const { el, stand } = element()
  const memory = rememberFocus(watcher.target)
  watcher.fire(el)
  stand.disabled = true
  page.state.holds = null
  handBackFocus(memory, page.page)
  let ticks = 0
  while (page.waiting > 0 && ticks < 1000) { page.advance(HAND_BACK_BUDGET_MS / 10); page.tick(); ticks++ }
  expect(page.waiting).toBe(0)
  expect(ticks).toBeGreaterThan(1)
  expect(stand.focused).toBe(0)
})

test("somebody else's caret is left alone", () => {
  const { el, stand } = element()
  const memory = rememberFocus(watcher.target)
  watcher.fire(el)
  page.state.holds = element().el
  expect(returnFocus(memory, page.page)).toBe("given")
  handBackFocus(memory, page.page)
  expect(page.waiting).toBe(0)
  expect(stand.focused).toBe(0)
})

const watcher = (() => {
  const handlers: Array<{ type: string; handler: (event: Event) => void }> = []
  const counts = { added: 0, removed: 0 }
  const dispatch = (type: string, event: object) => {
    for (const each of [...handlers]) if (each.type === type) each.handler(event as Event)
  }
  return {
    counts,
    reset: () => { counts.added = 0; counts.removed = 0 },
    target: {
      addEventListener: (type: string, handler: EventListenerOrEventListenerObject) => {
        counts.added++
        handlers.push({ type, handler: handler as (event: Event) => void })
      },
      removeEventListener: (type: string, handler: EventListenerOrEventListenerObject) => {
        counts.removed++
        const at = handlers.findIndex((each) => each.type === type && each.handler === handler)
        if (at >= 0) handlers.splice(at, 1)
      },
    } as unknown as EventTarget,
    fire: (target: unknown) => dispatch("focusin", { target }),
    leave: (target: unknown, to: unknown = null) => dispatch("focusout", { target, relatedTarget: to }),
  }
})()
