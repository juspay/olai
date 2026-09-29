/** Opening the connection dialog moves focus without the user leaving an editor. */
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
 */
let focused: HTMLElement | undefined
const remember = (event: FocusEvent): void => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  // THE DIALOG'S OWN GRAB IS NOT SOMEBODY TYPING. `showModal` moves focus into
  // the dialog and that fires `focusin` here like any other arrival — recording
  // it would make the dialog the element the keyboard is handed back to, which
  // is a closed `<dialog>` nobody can type in. Ignored, so what survives is the
  // last element a person actually had the caret in.
  if (target instanceof HTMLDialogElement || target.closest("dialog") !== null) return
  focused = target
}
/** Watch for the life of the app, and hand back the disposer: one listener,
 *  owned by whoever mounts the shell (`olai-plugin-layout`'s `Frame.tsx`). */
export const rememberFocus = (): (() => void) => {
  window.addEventListener("focusin", remember)
  return () => window.removeEventListener("focusin", remember)
}

/** NOTHING HOLDS THE KEYBOARD — the body, or nothing at all. A `<dialog>` just
 *  closed still counts: measured in Chromium, `close()` leaves the dialog as
 *  the active element for the rest of the task and it falls to the body after,
 *  which is the moment a hand-back sees "nobody" there. */
const idle = (): boolean => {
  const active = document.activeElement
  if (active === null || active === document.body) return true
  return active instanceof HTMLDialogElement && !active.open
}
/** What a hand-back did: `waiting` means the element that had the caret is
 *  still FROZEN (a control the roster disabled), which passes — so the attempt
 *  is repeated rather than dropped. */
export type HandBack = "done" | "waiting" | "given"
export const returnFocus = (): HandBack => {
  const wanted = focused
  if (wanted === undefined || !wanted.isConnected) return "given"
  if (!idle()) return "given"
  if (wanted.closest("[inert]") !== null || wanted.matches(":disabled,[inert]")) return "waiting"
  wanted.focus()
  return document.activeElement === wanted ? "done" : "given"
}
/** …UNTIL IT IS ALLOWED, a frame at a time. The freeze and the control it froze
 *  lift at different moments — the wire returning is the dialog's business, and
 *  the roster's queue draining is the control's — so an attempt is made now,
 *  and repeated on the browser's own frame boundary for as long as the element
 *  that had the caret is merely not YET focusable. It stops the moment the
 *  hand-back lands or somebody else has the keyboard. Returns its canceller. */
export const handBackFocus = (): (() => void) => {
  let frame = 0
  const once = (): void => {
    if (returnFocus() !== "waiting") return
    frame = requestAnimationFrame(once)
  }
  once()
  return () => cancelAnimationFrame(frame)
}
