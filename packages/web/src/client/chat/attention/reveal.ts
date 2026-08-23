/**
 * What a press of the banner asks for: the panel open, at what is waiting.
 *
 * The ruling is one sentence — "clicking it focuses the right tab/pane,
 * scrolled to the prompt" — and it is three things in this app. The WINDOW is
 * the service worker's to focus and it does that itself, with no window open
 * as well as with one (`@kolu/surface-app/notify`). The PANEL is a preference
 * of this browser, so opening it is the same write the toggle makes. The
 * SCROLL is the only half that needs anything here, and it needs it because
 * the transcript is not mounted at the moment the press arrives: the panel was
 * shut, so opening it is what mounts it, and the rows land a frame or several
 * later on a subscription that has only just opened.
 *
 * So this is an ASK THAT OUTLIVES THE PRESS — a request the transcript takes
 * up when it has a conversation to take it up with ({@link ../Transcript.tsx})
 * — rather than a call into a component that does not exist yet. It is
 * answered exactly once and then let go, so a scroll of somebody's own is
 * never overruled by a press from ten minutes ago.
 *
 * It names no question, for {@link ./notice.ts}'s reason: what is waiting is
 * something the panel knows when the press lands and the banner did not
 * necessarily know when it was raised.
 */

import { type Accessor, createSignal } from "solid-js"

import { setChatOpen } from "../../layout/prefs.ts"

const [asked, setAsked] = createSignal(false)

/** Whether the transcript is being asked to show what is waiting. */
export const revealing: Accessor<boolean> = asked

/** The banner was pressed: open the panel, and ask. */
export const reveal = (): void => {
  setChatOpen(true)
  setAsked(true)
}

/** ... and the transcript has answered it. Called once the conversation has
 *  actually ARRIVED, whether or not it turned out to hold a waiting form — a
 *  request left standing would hijack whatever row landed next, minutes
 *  later. */
export const revealed = (): void => {
  setAsked(false)
}
