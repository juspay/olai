/** Opening the connection dialog moves focus without the user leaving an editor. */
import { onCleanup } from "solid-js"

let taking = false
export const takingOfflineFocus = () => taking
export const withOfflineFocus = (open: () => void): void => {
  taking = true
  try { open() } finally { taking = false }
}

/**
 * THE CARET COMES BACK TO WHERE IT WAS — the other half of the sentence above,
 * and of `./Offline.tsx`'s own claim that closing "hands focus back to whatever
 * had it when the freeze began: the browser's own restoration".
 *
 * The browser's restoration is not enough. `showModal` puts focus in the dialog
 * and `close` gives it to the element that had it WHEN THE DIALOG OPENED — so
 * anything that blurred that element first has already moved the target: a
 * control the roster froze goes `disabled` under the caret, the browser blurs
 * it to `<body>` (`@olai-plugin-plugin-inspector`'s `rows.ts` argues why the
 * freeze is there), and the dialog then records the BODY as the focus it took.
 * The wire returns, the freeze lifts, and the person who was typing finds the
 * caret at the top of the document.
 *
 * So the DOCUMENT keeps the last element that had it, and hands it back when
 * the dialog closes and nothing else has claimed the focus. Recorded on
 * `focusin`, which is the event a control that RECEIVES the caret fires — the
 * same one an editor's own caret bookkeeping rides — so a control that keeps
 * the keyboard across a redraw is remembered at its newest element.
 *
 * ## Why the memory is an OBJECT and not a variable in this file
 *
 * It used to be module state, and that is three defects in one: it outlived the
 * mount that recorded it (a listener nobody removed kept answering the next
 * mount with somebody else's page), it kept a detached subtree alive, and the
 * rule "disposing forgets the element" had nowhere to live. It belongs to
 * whoever mounts the shell — {@link watchFocus} is that ownership, spelled once
 * so no caller has to remember it — and `Offline.tsx` READS it rather than
 * reaching into this module for it.
 */

/** WHAT A PERSON LAST HAD THE CARET IN, and the watcher that keeps it. */
export type FocusMemory = {
  /** The element a person had the caret in; `undefined` after disposal. */
  readonly last: () => HTMLElement | undefined
  /** Stop watching, and forget. */
  readonly dispose: () => void
}

/**
 * Watch `watch` (the window, in the app) for the caret, under a Solid OWNER:
 * the listener is registered now and removed — and the element forgotten —
 * when that owner is disposed.
 *
 * (The returned memory's disposer is registered HERE rather than by the caller:
 * `onMount` discards the value its callback returns, so a caller that wrote
 * `onMount(() => rememberFocus())` would leave a listener on `window` for every
 * remount, which is how this started.)
 */
export const watchFocus = (watch: EventTarget = window): FocusMemory => {
  const memory = rememberFocus(watch)
  onCleanup(memory.dispose)
  return memory
}

/** {@link watchFocus} without an owner, for a test that makes its own. */
export const rememberFocus = (watch: EventTarget = window): FocusMemory => {
  let last: HTMLElement | undefined
  const remember = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    // THE DIALOG'S OWN GRAB IS NOT SOMEBODY TYPING. `showModal` moves focus into
    // the dialog and that fires `focusin` here like any other arrival —
    // recording it would make the dialog the element the keyboard is handed
    // back to, which is a closed `<dialog>` nobody can type in. Ignored, so what
    // survives is the last element a person actually had the caret in.
    if (target instanceof HTMLDialogElement || target.closest("dialog") !== null) return
    last = target
  }
  watch.addEventListener("focusin", remember)
  return {
    last: () => last,
    dispose: () => {
      watch.removeEventListener("focusin", remember)
      last = undefined
    },
  }
}

/**
 * THE PAGE THE HAND-BACK READS, named so a unit test can stand in for it:
 * `bun test` imports this client with no document at all
 * (`scripts/bun-test-preload.ts` defines one global, `location`).
 */
export type FocusPage = {
  /** Who holds the keyboard: `document.activeElement`. */
  readonly active: () => Element | null
  /** The element that MEANS nobody — `document.body`. */
  readonly body: () => Element | null
  /** One browser frame later, and its canceller. */
  readonly frame: (work: () => void) => number
  readonly cancel: (handle: number) => void
  /** A monotonic millisecond reading, for the deadline alone. */
  readonly now: () => number
}
export const browserPage = (): FocusPage => ({
  active: () => document.activeElement,
  body: () => document.body,
  frame: (work) => requestAnimationFrame(work),
  cancel: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
})

/** NOTHING HOLDS THE KEYBOARD — the body, nothing at all, or a `<dialog>` just
 *  closed. The last is measured in Chromium: `close()` leaves the dialog as the
 *  active element for the rest of the task and it falls to the body after,
 *  which is the moment a hand-back sees "nobody" there. */
const idle = (page: FocusPage): boolean => {
  const active = page.active()
  if (active === null || active === page.body()) return true
  return active instanceof HTMLDialogElement && !active.open
}
/** What a hand-back did: `waiting` means the element that had the caret is
 *  still FROZEN (a control the roster disabled), which passes — so the attempt
 *  is repeated rather than dropped. */
export type HandBack = "done" | "waiting" | "given"
export const returnFocus = (memory: FocusMemory, page: FocusPage = browserPage()): HandBack => {
  const wanted = memory.last()
  if (wanted === undefined || !wanted.isConnected) return "given"
  if (!idle(page)) return "given"
  if (wanted.closest("[inert]") !== null || wanted.matches(":disabled,[inert]")) return "waiting"
  wanted.focus()
  return page.active() === wanted ? "done" : "given"
}

/**
 * …UNTIL IT IS ALLOWED, a frame at a time, AND NO LONGER THAN THE GAP IT IS
 * FOR. The freeze and the control it froze lift at different moments — the wire
 * returning is the dialog's business, and the roster's queue draining is the
 * control's — so an attempt is made now and repeated on the browser's own frame
 * boundary while the element that had the caret is merely not YET focusable. It
 * stops the moment the hand-back lands or somebody else has the keyboard.
 *
 * AND IT GIVES UP. `configurationFrozen` has reasons that STAY — a reader that
 * is absent, a file that is broken — and a control frozen for one of those is
 * disabled for the life of the app: without a deadline this loop would run once
 * per frame forever, which is not patience but a leak with a clock. The budget
 * is measured against the gap it bridges: in the scenario that exercises it the
 * hand-back takes TWO attempts and about 5 ms — the dialog is still the active
 * element on the first frame, and the control is unfrozen by the second — so a
 * second is two orders of magnitude of headroom for a redial on a slow machine,
 * and small beside a page anyone would call frozen.
 *
 * Returns its canceller, which is the only way this stops early: whoever owns
 * the dialog cancels it when a second outage takes the keyboard back.
 */
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
