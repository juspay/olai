/**
 * Whether somebody is LOOKING at the conversation right now.
 *
 * The ruling says the alert is for a pane that is not focused, and that the
 * form appearing is the alert for one that is. Olai has one conversation and
 * one panel, so "the pane is focused" is three facts and not one, and all
 * three have to be true for the form to be in front of anybody:
 *
 *   - the document is VISIBLE — not a background tab, not a minimized window;
 *   - the window has FOCUS — not the browser behind an editor;
 *   - the panel is OPEN — a minimized dock draws a pill, and a question
 *     arriving behind it is exactly the one that hangs the turn silently.
 *
 * The third is the one worth naming out loud, because it is the reading of the
 * ruling rather than the ruling: a panel put away is a pane not being watched,
 * so an alert fires for it even with the window in front of somebody. That is
 * what every chat application does with its window shut, and it is the case
 * `asking` exists for — a person working in the outline has no way to learn
 * that the agent stopped, and the toggle's own `data-asking` is a mark on a
 * button they are not looking at.
 *
 * `hasFocus()` rather than a `blur` flag of our own: `focus`/`blur` fire for
 * the reasons this cares about AND for reasons it does not, and the platform
 * already keeps the answer. The two listeners are only what WAKES the reading.
 *
 * `clock.ts` listens to the same event and is NOT the same question: it wants
 * the MOMENT a reader comes back, to re-read a clock that went stale while
 * nobody was looking. This wants the STATE, and over two facts rather than
 * one — a window can be visible and behind an editor. One event, two
 * questions; folding them would give the clock a predicate it has no use for
 * and this a wake it would have to debounce.
 *
 * No teardown beyond the owner's: this is created by the panel, which is
 * mounted for the life of the document (`../Panel.tsx` is drawn open or
 * minimized, never absent), and `onCleanup` is here for the tests rather than
 * for the app.
 */

import { type Accessor, createSignal, onCleanup } from "solid-js"

import { chatOpen } from "../../layout/prefs.ts"

/** What the DOCUMENT says: this page is on screen and the window is in front. */
const documentInFront = (): boolean =>
  document.visibilityState === "visible" && document.hasFocus()

/**
 * Whether the conversation is in front of somebody, as a signal that follows
 * the window and the panel both.
 */
export const createWatching = (): Accessor<boolean> => {
  const [front, setFront] = createSignal(documentInFront())
  const look = (): void => {
    setFront(documentInFront())
  }

  document.addEventListener("visibilitychange", look)
  window.addEventListener("focus", look)
  window.addEventListener("blur", look)
  onCleanup(() => {
    document.removeEventListener("visibilitychange", look)
    window.removeEventListener("focus", look)
    window.removeEventListener("blur", look)
  })

  return () => front() && chatOpen()
}
