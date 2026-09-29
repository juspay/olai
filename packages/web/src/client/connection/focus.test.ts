/**
 * THE CARET'S HAND-BACK: FOUR RULES AND THE TWO ENDS OF ONE PATIENCE.
 *
 * `focus.ts` is the half of "the page resumes" that a browser will not do by
 * itself — a control the roster froze goes `disabled` under the caret, and the
 * dialog that opens after it records the `<body>` as the focus it took, so
 * `close()` hands the caret to the top of the document. Every answer in here is
 * a decision whose wrong side a browser run would show only as "the caret is
 * somewhere else", which is why they are asserted here rather than walked once
 * through a socket: the dialog's own `showModal` grab must not BECOME the
 * element handed back to, somebody else's caret must not be stolen, an element
 * that is merely still frozen must be waited for, and an element frozen for
 * good must stop being waited for (`configurationFrozen`'s reasons that stay).
 *
 * Bun has no DOM at all — `HTMLElement` and friends are undefined, and the
 * preload defines `location` and nothing else — so the two constructors the
 * module judges targets with are stood in for here, and the page it reads is
 * passed in. The watcher is a stand-in too: what is being asserted about it is
 * that the listener it was given is REMOVED, which a counter says and a real
 * `window` would not.
 */
import { afterAll, expect, test } from "bun:test"
import { createRoot, onCleanup } from "solid-js"

import { HAND_BACK_BUDGET_MS, handBackFocus, rememberFocus, returnFocus, watchFocus, type FocusPage } from "./focus.ts"

// THE TWO CONSTRUCTORS the module's filters use, defined for this file and
// removed after it: `instanceof` is the check, so the doubles have to BE the
// classes rather than merely look like them.
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

/** The page, as the hand-back reads it: a manual clock, a manual frame queue,
 *  and whoever holds the keyboard. */
const page = (() => {
  let clock = 0
  const frames: Array<() => void> = []
  const cancelled: Array<number> = []
  /** Whoever holds the keyboard, written by a test and read by the hand-back. */
  const state: { holds: Element | null } = { holds: null }
  return {
    state,
    /** Read through a call, so a test's assertion is not narrowed to the value
     *  the test itself last wrote — the hand-back writes it, from a frame. */
    held: (): Element | null => state.holds,
    advance: (ms: number) => { clock += ms },
    get waiting() { return frames.length },
    /** Run the frame that is due, as the browser would. */
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
  // THE DIALOG'S OWN GRAB IS NOT SOMEBODY TYPING: `showModal` fires `focusin`
  // on the dialog, and recording it would hand the caret back to a closed
  // `<dialog>`.
  const dialog = new StandInDialog()
  watcher.fire(dialog as unknown as HTMLElement)
  expect(memory.last()).toBe(el)
  memory.dispose()
  expect(memory.last()).toBeUndefined()
  expect(watcher.counts).toEqual({ added: 1, removed: 1 })
  // …and it is FORGOTTEN, not merely stopped: a stale answer outliving the
  // mount that recorded it is what module state did.
  watcher.fire(el)
  expect(memory.last()).toBeUndefined()
})

test("the watcher is registered under a Solid owner and goes with it", () => {
  watcher.reset()
  const dispose = createRoot((dispose) => {
    watchFocus(watcher.target)
    return dispose
  })
  expect(watcher.counts).toEqual({ added: 1, removed: 0 })
  dispose()
  expect(watcher.counts).toEqual({ added: 1, removed: 1 })
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
  // A FROZEN-FOR-GOOD control — no reader, a broken file — must not be waited
  // for forever: one frame at a time until the budget passes, and then nothing.
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

/** A stand-in for `window`: the handler is kept so a test can fire it, and the
 *  add/remove pair is counted, which is the whole assertion about ownership. */
const watcher = (() => {
  const handlers: Array<(event: Event) => void> = []
  const counts = { added: 0, removed: 0 }
  return {
    counts,
    /** The counts are the file's, and each test that asserts on them says what
     *  IT added and removed rather than reading another test's total. */
    reset: () => { counts.added = 0; counts.removed = 0 },
    target: {
      addEventListener: (_type: string, handler: EventListenerOrEventListenerObject) => {
        counts.added++
        handlers.push(handler as (event: Event) => void)
      },
      removeEventListener: (_type: string, handler: EventListenerOrEventListenerObject) => {
        counts.removed++
        const at = handlers.indexOf(handler as (event: Event) => void)
        if (at >= 0) handlers.splice(at, 1)
      },
    } as unknown as EventTarget,
    fire: (target: unknown) => {
      for (const handler of [...handlers]) handler({ target } as unknown as Event)
    },
  }
})()
