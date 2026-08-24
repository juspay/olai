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
 * ANOTHER TAB OF THIS BROWSER COUNTS, and that is the fourth fact — the one
 * that is not about this document at all. Two tabs of one olai are two
 * documents and one PERSON: a question arriving in the tab they are reading
 * leaves every other tab hidden, unwatched, and ringing about a form already
 * on their screen. So a watching tab says so on a beat and the others hear it
 * ({@link ./elsewhere.ts}), and "watched" is an ORIGIN's answer rather than a
 * document's. The badge goes with it for the same reason: an installed app has
 * one icon however many windows are open, and badging it while somebody is
 * looking at one of them is the same nag one surface over.
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

import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

import { chatOpen } from "../../layout/prefs.ts"
import { createTicking } from "../../clock.ts"
import { broadcast, createElsewhere, WATCHED_BEAT } from "./elsewhere.ts"

/** What the DOCUMENT says: this page is on screen and the window is in front. */
const documentInFront = (): boolean =>
  document.visibilityState === "visible" && document.hasFocus()

/** The name the tabs of one olai say it under. Origin-scoped by the platform,
 *  which is the whole of how two vaults stay apart ({@link ./elsewhere.ts}). */
const WATCHED = "olai.chat.watched"

/**
 * Whether the conversation is in front of somebody, as a signal that follows
 * the window, the panel, and the browser's other tabs.
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

  /** THIS document's answer, which is what it beats out to the others. */
  const here = (): boolean => front() && chatOpen()

  const elsewhere = createElsewhere(broadcast(WATCHED))
  onCleanup(elsewhere.close)

  // THE ONE REPEATING TIMER IN THIS CLIENT is `../../clock.ts`'s, and this is a
  // caller of it rather than a second one: what a beat and a ticking readout
  // have in common is not the number but the LIFETIME, which is the whole
  // argument `createTicking` was written for and the claim `../../claims.test.ts`
  // holds. Gated on `here`, so it runs only while this tab IS the one being
  // watched — a browser with olai in every window and nobody at it says
  // nothing at all — and gated INSIDE the effect as well as through `when`,
  // because the clock has a value from the moment it is made and a beat on it
  // would be this tab claiming to be watched before anybody looked.
  const beat = createTicking(WATCHED_BEAT, here)
  createEffect(() => {
    if (!here()) return
    beat()
    elsewhere.beat()
  })

  return () => here() || elsewhere.watched()
}
