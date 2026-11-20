import { onCleanup } from "solid-js"

let taking = false
export const takingOfflineFocus = () => taking
export const withOfflineFocus = (open: () => void): void => {
  taking = true
  try { open() } finally { taking = false }
}

export type FocusMemory = {
  readonly last: () => HTMLElement | undefined
  readonly dispose: () => void
}

export const watchFocus = (watch: EventTarget = window): FocusMemory => {
  const memory = rememberFocus(watch)
  onCleanup(memory.dispose)
  return memory
}

export const rememberFocus = (watch: EventTarget = window): FocusMemory => {
  let last: HTMLElement | undefined
  const remember = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target instanceof HTMLDialogElement || target.closest("dialog") !== null) return
    last = target
  }
  const forget = (event: Event): void => {
    const target = event.target
    if (target !== last || last === undefined || (event as FocusEvent).relatedTarget !== null) return
    if (last.ownerDocument.activeElement === last || frozen(last)) return
    last = undefined
  }
  watch.addEventListener("focusin", remember)
  watch.addEventListener("focusout", forget)
  return {
    last: () => last,
    dispose: () => {
      watch.removeEventListener("focusin", remember)
      watch.removeEventListener("focusout", forget)
      last = undefined
    },
  }
}

export type FocusPage = {
  readonly active: () => Element | null
  readonly body: () => Element | null
  readonly frame: (work: () => void) => number
  readonly cancel: (handle: number) => void
  readonly now: () => number
}
export const browserPage = (): FocusPage => ({
  active: () => document.activeElement,
  body: () => document.body,
  frame: (work) => requestAnimationFrame(work),
  cancel: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
})

const nobodyFocused = (active: Element | null, body: Element | null): boolean =>
  active === null || active === body

/** `close()` restores focus only when the dialog recorded a previously focused
 *  element; with none, the focused area stays inside the closed dialog until
 *  the asynchronous focus fixup rule runs (whatwg/html#13118). */
const justClosedDialog = (active: Element | null): boolean =>
  active instanceof HTMLDialogElement && !active.open

const idle = (page: FocusPage): boolean => {
  const active = page.active()
  return nobodyFocused(active, page.body()) || justClosedDialog(active)
}
const frozen = (element: HTMLElement): boolean =>
  element.closest("[inert]") !== null || element.matches(":disabled,[inert]")
export type HandBack = "done" | "waiting" | "given"
export const returnFocus = (memory: FocusMemory, page: FocusPage = browserPage()): HandBack => {
  const wanted = memory.last()
  if (wanted === undefined || !wanted.isConnected) return "given"
  if (!idle(page)) return "given"
  if (frozen(wanted)) return "waiting"
  wanted.focus()
  return page.active() === wanted ? "done" : "given"
}

export const HAND_BACK_BUDGET_MS = 1_000
export const handBackFocus = (memory: FocusMemory, page: FocusPage = browserPage()): (() => void) => {
  const deadline = page.now() + HAND_BACK_BUDGET_MS
  let frame = 0
  const once = (): void => {
    if (returnFocus(memory, page) !== "waiting") return
    if (page.now() > deadline) return
    frame = page.frame(once)
  }
  once()
  return () => page.cancel(frame)
}
